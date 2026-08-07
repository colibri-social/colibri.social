use std::ptr::NonNull;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use block2::RcBlock;
use objc2_core_foundation::{CFBoolean, CFDictionary, CFNumber, CFRetained, CFString, CFType};
use objc2_core_media::{
    kCMSampleAttachmentKey_NotSync, kCMTimeInvalid, CMFormatDescription, CMSampleBuffer, CMTime,
};
use objc2_core_video::CVImageBuffer;
use objc2_video_toolbox::{
    kVTCompressionPropertyKey_AllowFrameReordering, kVTCompressionPropertyKey_AverageBitRate,
    kVTCompressionPropertyKey_ExpectedFrameRate,
    kVTCompressionPropertyKey_MaxKeyFrameIntervalDuration, kVTCompressionPropertyKey_ProfileLevel,
    kVTCompressionPropertyKey_RealTime, kVTProfileLevel_H264_High_AutoLevel, VTCompressionSession,
    VTEncodeInfoFlags, VTSession, VTSessionSetProperty,
};

use crate::native_error::NativeError;
use crate::screen_capture::{CaptureMessage, CaptureQuality, EncodedConfig, FrameSender};

type OSStatus = i32;

unsafe extern "C-unwind" {
    fn CMVideoFormatDescriptionGetH264ParameterSetAtIndex(
        video_desc: &CMFormatDescription,
        parameter_set_index: usize,
        parameter_set_pointer_out: *mut *const u8,
        parameter_set_size_out: *mut usize,
        parameter_set_count_out: *mut usize,
        nal_unit_header_length_out: *mut i32,
    ) -> OSStatus;
}

const KEYFRAME_INTERVAL_SECONDS: f64 = 2.0;

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

fn parameter_set(description: &CMFormatDescription, index: usize) -> Option<Vec<u8>> {
    let mut pointer: *const u8 = std::ptr::null();
    let mut size: usize = 0;
    let status = unsafe {
        CMVideoFormatDescriptionGetH264ParameterSetAtIndex(
            description,
            index,
            &mut pointer,
            &mut size,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
        )
    };

    if status != 0 || pointer.is_null() || size == 0 {
        return None;
    }

    Some(unsafe { std::slice::from_raw_parts(pointer, size) }.to_vec())
}

fn is_keyframe(sample: &CMSampleBuffer) -> bool {
    let Some(attachments) = (unsafe { sample.sample_attachments_array(false) }) else {
        return true;
    };

    let first = unsafe { attachments.value_at_index(0) };
    if first.is_null() {
        return true;
    }

    let dictionary = unsafe { &*(first as *const CFDictionary) };
    let key = unsafe { kCMSampleAttachmentKey_NotSync };
    let value = unsafe { dictionary.value(key as *const CFString as *const _) };
    if value.is_null() {
        return true;
    }

    let flag = unsafe { &*(value as *const CFBoolean) };
    !flag.value()
}

fn sample_data(sample: &CMSampleBuffer) -> Option<Vec<u8>> {
    let buffer = unsafe { sample.data_buffer() }?;
    let length = unsafe { buffer.data_length() };
    if length == 0 {
        return None;
    }

    let mut data = vec![0u8; length];
    let destination = NonNull::new(data.as_mut_ptr().cast())?;
    let status = unsafe { buffer.copy_data_bytes(0, length, destination) };

    if status != 0 {
        return None;
    }
    Some(data)
}

struct EncoderState {
    sender: FrameSender,
    config_sent: AtomicBool,
    coded_width: u32,
    coded_height: u32,
}

impl EncoderState {
    fn emit(&self, sample: &CMSampleBuffer) {
        if !self.config_sent.load(Ordering::Acquire) {
            if let Some(description) = unsafe { sample.format_description() } {
                let sps = parameter_set(&description, 0);
                let pps = parameter_set(&description, 1);
                if let (Some(sps), Some(pps)) = (sps, pps) {
                    if let Some(config) = avc_decoder_config(&sps, &pps) {
                        let _ = self.sender.send(CaptureMessage::Config(EncodedConfig {
                            codec: codec_string(&sps),
                            description: config,
                            coded_width: self.coded_width,
                            coded_height: self.coded_height,
                        }));
                        self.config_sent.store(true, Ordering::Release);
                    }
                }
            }
        }

        if !self.config_sent.load(Ordering::Acquire) {
            return;
        }

        let Some(data) = sample_data(sample) else {
            return;
        };

        let pts = unsafe { sample.presentation_time_stamp() };
        let timestamp_micros = if pts.timescale > 0 {
            (pts.value as i128 * 1_000_000 / pts.timescale as i128) as i64
        } else {
            0
        };

        let _ = self.sender.send(CaptureMessage::Frame {
            keyframe: is_keyframe(sample),
            timestamp_micros,
            data,
        });
    }
}

pub struct Encoder {
    session: CFRetained<VTCompressionSession>,
    state: Arc<EncoderState>,
}

fn as_cf_type<T>(value: &T) -> &CFType {
    unsafe { &*(value as *const T as *const CFType) }
}

fn as_session(session: &VTCompressionSession) -> &VTSession {
    unsafe { &*(session as *const VTCompressionSession as *const VTSession) }
}

fn set_property(
    session: &VTCompressionSession,
    key: &CFString,
    value: &CFType,
) -> Result<(), NativeError> {
    let status = unsafe { VTSessionSetProperty(as_session(session), key, Some(value)) };
    if status != 0 {
        return Err(NativeError::failed(format!(
            "the video encoder rejected a setting ({status})"
        )));
    }
    Ok(())
}

impl Encoder {
    pub fn new(quality: CaptureQuality, sender: FrameSender) -> Result<Self, NativeError> {
        let mut out: *mut VTCompressionSession = std::ptr::null_mut();
        let codec = u32::from_be_bytes(*b"avc1");

        let status = unsafe {
            VTCompressionSession::create(
                None,
                quality.width as i32,
                quality.height as i32,
                codec,
                None,
                None,
                None,
                None,
                std::ptr::null_mut(),
                NonNull::from(&mut out),
            )
        };

        if status != 0 || out.is_null() {
            return Err(NativeError::failed(format!(
                "could not start the video encoder ({status})"
            )));
        }

        let session = unsafe { CFRetained::from_raw(NonNull::new(out).expect("checked above")) };

        let real_time = CFBoolean::new(true);
        let no_reordering = CFBoolean::new(false);
        let bitrate = CFNumber::new_i32(quality.max_bitrate as i32);
        let frame_rate = CFNumber::new_i32(quality.framerate as i32);
        let keyframe_interval = CFNumber::new_f64(KEYFRAME_INTERVAL_SECONDS);

        unsafe {
            set_property(
                &session,
                kVTCompressionPropertyKey_RealTime,
                as_cf_type::<CFBoolean>(real_time),
            )?;
            set_property(
                &session,
                kVTCompressionPropertyKey_AllowFrameReordering,
                as_cf_type::<CFBoolean>(no_reordering),
            )?;
            set_property(
                &session,
                kVTCompressionPropertyKey_ProfileLevel,
                as_cf_type(kVTProfileLevel_H264_High_AutoLevel),
            )?;
            set_property(
                &session,
                kVTCompressionPropertyKey_AverageBitRate,
                as_cf_type(&*bitrate),
            )?;
            set_property(
                &session,
                kVTCompressionPropertyKey_ExpectedFrameRate,
                as_cf_type(&*frame_rate),
            )?;
            set_property(
                &session,
                kVTCompressionPropertyKey_MaxKeyFrameIntervalDuration,
                as_cf_type(&*keyframe_interval),
            )?;
        }

        unsafe { session.prepare_to_encode_frames() };

        Ok(Self {
            session,
            state: Arc::new(EncoderState {
                sender,
                config_sent: AtomicBool::new(false),
                coded_width: quality.width,
                coded_height: quality.height,
            }),
        })
    }

    pub fn encode(&self, image: &CVImageBuffer, pts: CMTime, duration: CMTime) {
        let state = self.state.clone();
        let handler = RcBlock::new(
            move |status: OSStatus, _flags: VTEncodeInfoFlags, sample: *mut CMSampleBuffer| {
                if status != 0 || sample.is_null() {
                    return;
                }
                state.emit(unsafe { &*sample });
            },
        );

        unsafe {
            self.session.encode_frame_with_output_handler(
                image,
                pts,
                duration,
                None,
                std::ptr::null_mut(),
                RcBlock::as_ptr(&handler),
            );
        }
    }

    pub fn finish(&self) {
        unsafe {
            self.session.complete_frames(kCMTimeInvalid);
            self.session.invalidate();
        }
    }
}

unsafe impl Send for Encoder {}
unsafe impl Sync for Encoder {}

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
}
