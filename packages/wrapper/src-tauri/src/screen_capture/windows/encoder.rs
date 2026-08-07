use std::mem::ManuallyDrop;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, Once};

use windows::core::Interface;
use windows::Win32::Media::MediaFoundation::{
    eAVEncCommonRateControlMode_CBR, eAVEncH264VProfile_High, CODECAPI_AVEncCommonMeanBitRate,
    CODECAPI_AVEncCommonRateControlMode, CODECAPI_AVEncMPVGOPSize, CODECAPI_AVLowLatencyMode,
    ICodecAPI, IMFActivate, IMFMediaType, IMFSample, IMFTransform, MFCreateMediaType,
    MFCreateMemoryBuffer, MFCreateSample, MFMediaType_Video, MFStartup, MFTEnumEx,
    MFVideoFormat_H264, MFVideoFormat_NV12, MFVideoInterlace_Progressive, MFSTARTUP_NOSOCKET,
    MFT_CATEGORY_VIDEO_ENCODER, MFT_ENUM_FLAG_SORTANDFILTER, MFT_ENUM_FLAG_SYNCMFT,
    MFT_MESSAGE_COMMAND_DRAIN, MFT_MESSAGE_COMMAND_FLUSH, MFT_MESSAGE_NOTIFY_BEGIN_STREAMING,
    MFT_MESSAGE_NOTIFY_END_OF_STREAM, MFT_MESSAGE_NOTIFY_END_STREAMING,
    MFT_MESSAGE_NOTIFY_START_OF_STREAM, MFT_OUTPUT_DATA_BUFFER, MFT_OUTPUT_STREAM_PROVIDES_SAMPLES,
    MFT_REGISTER_TYPE_INFO, MF_E_TRANSFORM_NEED_MORE_INPUT, MF_E_TRANSFORM_STREAM_CHANGE,
    MF_MT_AVG_BITRATE, MF_MT_FRAME_RATE, MF_MT_FRAME_SIZE, MF_MT_INTERLACE_MODE, MF_MT_MAJOR_TYPE,
    MF_MT_MPEG2_PROFILE, MF_MT_MPEG_SEQUENCE_HEADER, MF_MT_PIXEL_ASPECT_RATIO, MF_MT_SUBTYPE,
    MF_VERSION,
};
use windows::Win32::System::Com::CoTaskMemFree;
use windows::Win32::System::Variant::VARIANT;

use crate::native_error::NativeError;
use crate::screen_capture::{CaptureMessage, CaptureQuality, EncodedConfig, FrameSender};

const NAL_SPS: u8 = 7;
const NAL_PPS: u8 = 8;
const NAL_IDR: u8 = 5;
const KEYFRAME_INTERVAL_SECONDS: u32 = 2;
const HUNDRED_NANOS_PER_MICRO: i64 = 10;

static STARTUP: Once = Once::new();

fn start_media_foundation() {
    STARTUP.call_once(|| {
        let _ = unsafe { MFStartup(MF_VERSION, MFSTARTUP_NOSOCKET) };
    });
}

fn packed(high: u32, low: u32) -> u64 {
    (u64::from(high) << 32) | u64::from(low)
}

fn avc_decoder_config(sps: &[u8], pps: &[u8]) -> Option<Vec<u8>> {
    if sps.len() < 4 {
        return None;
    }

    let mut config = Vec::with_capacity(sps.len() + pps.len() + 11);
    config.push(1);
    config.push(sps[1]);
    config.push(sps[2]);
    config.push(sps[3]);
    config.push(0xFF);
    config.push(0xE1);
    config.extend_from_slice(&(sps.len() as u16).to_be_bytes());
    config.extend_from_slice(sps);
    config.push(1);
    config.extend_from_slice(&(pps.len() as u16).to_be_bytes());
    config.extend_from_slice(pps);
    Some(config)
}

fn codec_string(sps: &[u8]) -> String {
    if sps.len() < 4 {
        return "avc1.42E01E".to_string();
    }
    format!("avc1.{:02X}{:02X}{:02X}", sps[1], sps[2], sps[3])
}

fn nal_units(data: &[u8]) -> Vec<&[u8]> {
    let mut starts = Vec::new();
    let mut index = 0usize;

    while index + 3 <= data.len() {
        if data[index] == 0 && data[index + 1] == 0 {
            if data[index + 2] == 1 {
                starts.push((index, 3usize));
                index += 3;
                continue;
            }
            if index + 4 <= data.len() && data[index + 2] == 0 && data[index + 3] == 1 {
                starts.push((index, 4usize));
                index += 4;
                continue;
            }
        }
        index += 1;
    }

    let mut units = Vec::with_capacity(starts.len());
    for (position, (offset, prefix)) in starts.iter().enumerate() {
        let begin = offset + prefix;
        let end = starts
            .get(position + 1)
            .map_or(data.len(), |(next, _)| *next);
        if end > begin {
            units.push(&data[begin..end]);
        }
    }

    units
}

fn nal_kind(unit: &[u8]) -> u8 {
    unit.first().map_or(0, |byte| byte & 0x1F)
}

fn to_avcc(units: &[&[u8]]) -> Vec<u8> {
    let mut framed = Vec::new();
    for unit in units {
        framed.extend_from_slice(&(unit.len() as u32).to_be_bytes());
        framed.extend_from_slice(unit);
    }
    framed
}

fn is_annex_b(data: &[u8]) -> bool {
    data.starts_with(&[0, 0, 1]) || data.starts_with(&[0, 0, 0, 1])
}

#[derive(Clone)]
struct Parameters {
    sps: Vec<u8>,
    pps: Vec<u8>,
}

fn parameters_from(units: &[&[u8]]) -> Option<Parameters> {
    let sps = units
        .iter()
        .find(|unit| nal_kind(unit) == NAL_SPS)?
        .to_vec();
    let pps = units
        .iter()
        .find(|unit| nal_kind(unit) == NAL_PPS)?
        .to_vec();
    Some(Parameters { sps, pps })
}

fn find_transform(quality: CaptureQuality) -> Result<IMFTransform, NativeError> {
    let input = MFT_REGISTER_TYPE_INFO {
        guidMajorType: MFMediaType_Video,
        guidSubtype: MFVideoFormat_NV12,
    };
    let output = MFT_REGISTER_TYPE_INFO {
        guidMajorType: MFMediaType_Video,
        guidSubtype: MFVideoFormat_H264,
    };

    let mut activates: *mut Option<IMFActivate> = std::ptr::null_mut();
    let mut count = 0u32;

    unsafe {
        MFTEnumEx(
            MFT_CATEGORY_VIDEO_ENCODER,
            MFT_ENUM_FLAG_SYNCMFT | MFT_ENUM_FLAG_SORTANDFILTER,
            Some(&input),
            Some(&output),
            &mut activates,
            &mut count,
        )
    }
    .map_err(|error| NativeError::failed(format!("could not look for a video encoder: {error}")))?;

    let mut transform = None;
    for index in 0..count as usize {
        let candidate = unsafe { (*activates.add(index)).clone() };
        if transform.is_none() {
            if let Some(activate) = candidate {
                transform = unsafe { activate.ActivateObject::<IMFTransform>() }.ok();
            }
        }
        unsafe { std::ptr::drop_in_place(activates.add(index)) };
    }

    unsafe { CoTaskMemFree(Some(activates.cast())) };

    let transform =
        transform.ok_or_else(|| NativeError::failed("this PC has no H.264 video encoder"))?;

    configure(&transform, quality)?;
    Ok(transform)
}

fn media_type(quality: CaptureQuality) -> Result<IMFMediaType, NativeError> {
    let media = unsafe { MFCreateMediaType() }
        .map_err(|error| NativeError::failed(format!("could not describe the video: {error}")))?;

    unsafe {
        media.SetGUID(&MF_MT_MAJOR_TYPE, &MFMediaType_Video).ok();
        media
            .SetUINT64(&MF_MT_FRAME_SIZE, packed(quality.width, quality.height))
            .ok();
        media
            .SetUINT64(&MF_MT_FRAME_RATE, packed(quality.framerate, 1))
            .ok();
        media
            .SetUINT64(&MF_MT_PIXEL_ASPECT_RATIO, packed(1, 1))
            .ok();
        media
            .SetUINT32(&MF_MT_INTERLACE_MODE, MFVideoInterlace_Progressive.0 as u32)
            .ok();
    }

    Ok(media)
}

fn configure(transform: &IMFTransform, quality: CaptureQuality) -> Result<(), NativeError> {
    let output = media_type(quality)?;
    unsafe {
        output.SetGUID(&MF_MT_SUBTYPE, &MFVideoFormat_H264).ok();
        output
            .SetUINT32(&MF_MT_AVG_BITRATE, quality.max_bitrate)
            .ok();
        output
            .SetUINT32(&MF_MT_MPEG2_PROFILE, eAVEncH264VProfile_High.0 as u32)
            .ok();
    }

    unsafe { transform.SetOutputType(0, &output, 0) }.map_err(|error| {
        NativeError::failed(format!(
            "the video encoder rejected the output format: {error}"
        ))
    })?;

    let input = media_type(quality)?;
    unsafe { input.SetGUID(&MF_MT_SUBTYPE, &MFVideoFormat_NV12).ok() };

    unsafe { transform.SetInputType(0, &input, 0) }.map_err(|error| {
        NativeError::failed(format!(
            "the video encoder rejected the input format: {error}"
        ))
    })?;

    if let Ok(codec) = transform.cast::<ICodecAPI>() {
        let rate_control = VARIANT::from(eAVEncCommonRateControlMode_CBR.0 as u32);
        let bitrate = VARIANT::from(quality.max_bitrate);
        let gop = VARIANT::from(quality.framerate * KEYFRAME_INTERVAL_SECONDS);
        let low_latency = VARIANT::from(true);

        unsafe {
            codec
                .SetValue(&CODECAPI_AVEncCommonRateControlMode, &rate_control)
                .ok();
            codec
                .SetValue(&CODECAPI_AVEncCommonMeanBitRate, &bitrate)
                .ok();
            codec.SetValue(&CODECAPI_AVEncMPVGOPSize, &gop).ok();
            codec
                .SetValue(&CODECAPI_AVLowLatencyMode, &low_latency)
                .ok();
        }
    }

    Ok(())
}

fn sequence_header(transform: &IMFTransform) -> Option<Parameters> {
    let current = unsafe { transform.GetOutputCurrentType(0) }.ok()?;
    let size = unsafe { current.GetBlobSize(&MF_MT_MPEG_SEQUENCE_HEADER) }.ok()?;
    if size == 0 {
        return None;
    }

    let mut blob = vec![0u8; size as usize];
    unsafe { current.GetBlob(&MF_MT_MPEG_SEQUENCE_HEADER, &mut blob, None) }.ok()?;

    parameters_from(&nal_units(&blob))
}

struct Inner {
    transform: IMFTransform,
    provides_samples: bool,
    output_size: u32,
}

pub struct Encoder {
    inner: Mutex<Inner>,
    sender: FrameSender,
    declared: Option<Parameters>,
    config_sent: AtomicBool,
    coded_width: u32,
    coded_height: u32,
}

unsafe impl Send for Encoder {}
unsafe impl Sync for Encoder {}

impl Encoder {
    pub fn new(quality: CaptureQuality, sender: FrameSender) -> Result<Self, NativeError> {
        start_media_foundation();

        let transform = find_transform(quality)?;

        let info = unsafe { transform.GetOutputStreamInfo(0) }.map_err(|error| {
            NativeError::failed(format!("the video encoder has no output stream: {error}"))
        })?;

        let provides_samples = info.dwFlags & MFT_OUTPUT_STREAM_PROVIDES_SAMPLES.0 as u32 != 0;
        let output_size = info.cbSize.max(quality.width * quality.height * 3 / 2);

        unsafe {
            transform.ProcessMessage(MFT_MESSAGE_COMMAND_FLUSH, 0).ok();
            transform
                .ProcessMessage(MFT_MESSAGE_NOTIFY_BEGIN_STREAMING, 0)
                .ok();
            transform
                .ProcessMessage(MFT_MESSAGE_NOTIFY_START_OF_STREAM, 0)
                .ok();
        }

        let declared = sequence_header(&transform);

        Ok(Self {
            inner: Mutex::new(Inner {
                transform,
                provides_samples,
                output_size,
            }),
            sender,
            declared,
            config_sent: AtomicBool::new(false),
            coded_width: quality.width,
            coded_height: quality.height,
        })
    }

    pub fn encode(&self, nv12: &[u8], timestamp_micros: i64, duration_micros: i64) {
        let Ok(inner) = self.inner.lock() else {
            return;
        };

        let Ok(sample) = (unsafe { MFCreateSample() }) else {
            return;
        };
        let Ok(buffer) = (unsafe { MFCreateMemoryBuffer(nv12.len() as u32) }) else {
            return;
        };

        let mut destination: *mut u8 = std::ptr::null_mut();
        if unsafe { buffer.Lock(&mut destination, None, None) }.is_err() || destination.is_null() {
            return;
        }
        unsafe {
            std::ptr::copy_nonoverlapping(nv12.as_ptr(), destination, nv12.len());
            buffer.Unlock().ok();
            buffer.SetCurrentLength(nv12.len() as u32).ok();
            sample.AddBuffer(&buffer).ok();
            sample
                .SetSampleTime(timestamp_micros * HUNDRED_NANOS_PER_MICRO)
                .ok();
            sample
                .SetSampleDuration(duration_micros * HUNDRED_NANOS_PER_MICRO)
                .ok();
        }

        if unsafe { inner.transform.ProcessInput(0, &sample, 0) }.is_err() {
            return;
        }

        self.drain(&inner);
    }

    fn drain(&self, inner: &Inner) {
        loop {
            let mut allocated = None;
            if !inner.provides_samples {
                let Ok(sample) = (unsafe { MFCreateSample() }) else {
                    return;
                };
                let Ok(buffer) = (unsafe { MFCreateMemoryBuffer(inner.output_size) }) else {
                    return;
                };
                if unsafe { sample.AddBuffer(&buffer) }.is_err() {
                    return;
                }
                allocated = Some(sample);
            }

            let mut buffers = [MFT_OUTPUT_DATA_BUFFER {
                dwStreamID: 0,
                pSample: ManuallyDrop::new(allocated),
                dwStatus: 0,
                pEvents: ManuallyDrop::new(None),
            }];

            let mut status = 0u32;
            let outcome = unsafe { inner.transform.ProcessOutput(0, &mut buffers, &mut status) };

            let produced = unsafe { ManuallyDrop::take(&mut buffers[0].pSample) };
            let events = unsafe { ManuallyDrop::take(&mut buffers[0].pEvents) };
            drop(events);

            match outcome {
                Ok(()) => {
                    if let Some(sample) = produced {
                        self.emit(&sample);
                    }
                }
                Err(error) if error.code() == MF_E_TRANSFORM_NEED_MORE_INPUT => return,
                Err(error) if error.code() == MF_E_TRANSFORM_STREAM_CHANGE => {
                    if !self.renegotiate(inner) {
                        return;
                    }
                }
                Err(_) => return,
            }
        }
    }

    fn renegotiate(&self, inner: &Inner) -> bool {
        let Ok(available) = (unsafe { inner.transform.GetOutputAvailableType(0, 0) }) else {
            return false;
        };
        unsafe { inner.transform.SetOutputType(0, &available, 0) }.is_ok()
    }

    fn announce(&self, units: Option<&[&[u8]]>) -> bool {
        if self.config_sent.load(Ordering::Acquire) {
            return true;
        }

        let Some(parameters) = units
            .and_then(parameters_from)
            .or_else(|| self.declared.clone())
        else {
            return false;
        };

        let Some(description) = avc_decoder_config(&parameters.sps, &parameters.pps) else {
            return false;
        };

        let _ = self.sender.send(CaptureMessage::Config(EncodedConfig {
            codec: codec_string(&parameters.sps),
            description,
            coded_width: self.coded_width,
            coded_height: self.coded_height,
        }));
        self.config_sent.store(true, Ordering::Release);
        true
    }

    fn emit(&self, sample: &IMFSample) {
        let Ok(buffer) = (unsafe { sample.ConvertToContiguousBuffer() }) else {
            return;
        };

        let mut data: *mut u8 = std::ptr::null_mut();
        let mut length = 0u32;
        if unsafe { buffer.Lock(&mut data, None, Some(&mut length)) }.is_err() || data.is_null() {
            return;
        }

        let encoded = unsafe { std::slice::from_raw_parts(data, length as usize) }.to_vec();
        unsafe { buffer.Unlock().ok() };

        if encoded.is_empty() {
            return;
        }

        let timestamp_micros = unsafe { sample.GetSampleTime() }
            .map(|time| time / HUNDRED_NANOS_PER_MICRO)
            .unwrap_or(0);

        if !is_annex_b(&encoded) {
            if !self.announce(None) {
                return;
            }
            let _ = self.sender.send(CaptureMessage::Frame {
                keyframe: true,
                timestamp_micros,
                data: encoded,
            });
            return;
        }

        let units = nal_units(&encoded);
        if units.is_empty() || !self.announce(Some(&units)) {
            return;
        }

        let keyframe = units.iter().any(|unit| nal_kind(unit) == NAL_IDR);

        let _ = self.sender.send(CaptureMessage::Frame {
            keyframe,
            timestamp_micros,
            data: to_avcc(&units),
        });
    }

    pub fn finish(&self) {
        let Ok(inner) = self.inner.lock() else {
            return;
        };

        unsafe {
            inner
                .transform
                .ProcessMessage(MFT_MESSAGE_NOTIFY_END_OF_STREAM, 0)
                .ok();
            inner
                .transform
                .ProcessMessage(MFT_MESSAGE_COMMAND_DRAIN, 0)
                .ok();
        }

        self.drain(&inner);

        unsafe {
            inner
                .transform
                .ProcessMessage(MFT_MESSAGE_NOTIFY_END_STREAMING, 0)
                .ok();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SPS: [u8; 8] = [0x67, 0x64, 0x00, 0x28, 0xAC, 0xD9, 0x40, 0x78];
    const PPS: [u8; 4] = [0x68, 0xEB, 0xE3, 0xCB];

    #[test]
    fn the_decoder_config_starts_with_version_one_and_the_sps_profile() {
        let config = avc_decoder_config(&SPS, &PPS).expect("builds");

        assert_eq!(config[0], 1);
        assert_eq!(&config[1..4], &SPS[1..4]);
        assert_eq!(config[4], 0xFF);
        assert_eq!(config[5], 0xE1);
    }

    #[test]
    fn the_decoder_config_carries_both_parameter_sets_with_their_lengths() {
        let config = avc_decoder_config(&SPS, &PPS).expect("builds");

        let sps_len = u16::from_be_bytes([config[6], config[7]]) as usize;
        assert_eq!(sps_len, SPS.len());
        assert_eq!(&config[8..8 + sps_len], &SPS);

        let after_sps = 8 + sps_len;
        assert_eq!(config[after_sps], 1);
        let pps_len = u16::from_be_bytes([config[after_sps + 1], config[after_sps + 2]]) as usize;
        assert_eq!(pps_len, PPS.len());
        assert_eq!(&config[after_sps + 3..after_sps + 3 + pps_len], &PPS);
    }

    #[test]
    fn a_truncated_sps_is_rejected_rather_than_producing_a_bad_box() {
        assert!(avc_decoder_config(&[0x67, 0x64], &PPS).is_none());
    }

    #[test]
    fn the_codec_string_encodes_the_sps_profile_bytes() {
        assert_eq!(codec_string(&SPS), "avc1.640028");
    }

    #[test]
    fn the_codec_string_falls_back_when_the_sps_is_unusable() {
        assert_eq!(codec_string(&[]), "avc1.42E01E");
    }

    #[test]
    fn nal_units_are_split_on_both_start_code_lengths() {
        let stream = [
            0, 0, 0, 1, 0x67, 0xAA, 0, 0, 1, 0x68, 0xBB, 0xCC, 0, 0, 0, 1, 0x65, 0xDD,
        ];
        let units = nal_units(&stream);

        assert_eq!(units.len(), 3);
        assert_eq!(units[0], &[0x67, 0xAA]);
        assert_eq!(units[1], &[0x68, 0xBB, 0xCC]);
        assert_eq!(units[2], &[0x65, 0xDD]);
    }

    #[test]
    fn a_stream_with_no_start_code_yields_nothing() {
        assert!(nal_units(&[0x67, 0x64, 0x00]).is_empty());
    }

    #[test]
    fn avcc_prefixes_every_unit_with_its_big_endian_length() {
        let framed = to_avcc(&[&[0x67, 0xAA][..], &[0x65][..]]);

        assert_eq!(&framed[0..4], &[0, 0, 0, 2]);
        assert_eq!(&framed[4..6], &[0x67, 0xAA]);
        assert_eq!(&framed[6..10], &[0, 0, 0, 1]);
        assert_eq!(framed[10], 0x65);
    }

    #[test]
    fn avcc_output_carries_no_start_codes() {
        let stream = [0, 0, 0, 1, 0x65, 0x11, 0x22];
        let framed = to_avcc(&nal_units(&stream));
        assert_eq!(framed, vec![0, 0, 0, 3, 0x65, 0x11, 0x22]);
    }

    #[test]
    fn parameter_sets_are_recovered_from_an_annex_b_keyframe() {
        let mut stream = vec![0, 0, 0, 1];
        stream.extend_from_slice(&SPS);
        stream.extend_from_slice(&[0, 0, 0, 1]);
        stream.extend_from_slice(&PPS);
        stream.extend_from_slice(&[0, 0, 0, 1, 0x65, 0x42]);

        let parameters = parameters_from(&nal_units(&stream)).expect("found");
        assert_eq!(parameters.sps, SPS);
        assert_eq!(parameters.pps, PPS);
    }

    #[test]
    fn a_stream_without_a_picture_parameter_set_is_not_usable_yet() {
        let mut stream = vec![0, 0, 0, 1];
        stream.extend_from_slice(&SPS);
        assert!(parameters_from(&nal_units(&stream)).is_none());
    }

    #[test]
    fn an_idr_unit_is_recognised_as_a_keyframe() {
        assert_eq!(nal_kind(&[0x65, 0x00]), NAL_IDR);
        assert_eq!(nal_kind(&[0x61, 0x00]), 1);
    }

    #[test]
    fn annex_b_is_told_apart_from_length_prefixed_data() {
        assert!(is_annex_b(&[0, 0, 0, 1, 0x67]));
        assert!(is_annex_b(&[0, 0, 1, 0x67]));
        assert!(!is_annex_b(&[0, 0, 0, 5, 0x67]));
    }

    #[test]
    fn a_packed_pair_puts_the_first_value_in_the_high_word() {
        assert_eq!(packed(1920, 1080), (1920u64 << 32) | 1080);
    }
}
