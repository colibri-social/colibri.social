use std::mem::ManuallyDrop;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;
use std::sync::Arc;
use std::thread::JoinHandle;

use windows::core::{implement, Interface, Ref, Result as WindowsResult};
use windows::Win32::Foundation::{CloseHandle, HANDLE, WAIT_OBJECT_0};
use windows::Win32::Media::Audio::{
    ActivateAudioInterfaceAsync, IActivateAudioInterfaceAsyncOperation,
    IActivateAudioInterfaceCompletionHandler, IActivateAudioInterfaceCompletionHandler_Impl,
    IAudioCaptureClient, IAudioClient, AUDCLNT_BUFFERFLAGS_SILENT, AUDCLNT_SHAREMODE_SHARED,
    AUDCLNT_STREAMFLAGS_EVENTCALLBACK, AUDCLNT_STREAMFLAGS_LOOPBACK, AUDIOCLIENT_ACTIVATION_PARAMS,
    AUDIOCLIENT_ACTIVATION_PARAMS_0, AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK,
    AUDIOCLIENT_PROCESS_LOOPBACK_PARAMS, PROCESS_LOOPBACK_MODE_EXCLUDE_TARGET_PROCESS_TREE,
    PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE, VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK,
    WAVEFORMATEX,
};
use windows::Win32::System::Com::StructuredStorage::{
    PROPVARIANT, PROPVARIANT_0, PROPVARIANT_0_0, PROPVARIANT_0_0_0,
};
use windows::Win32::System::Com::{CoInitializeEx, BLOB, COINIT_MULTITHREADED};
use windows::Win32::System::Threading::{
    CreateEventW, GetCurrentProcessId, SetEvent, WaitForSingleObject,
};
use windows::Win32::System::Variant::VT_BLOB;

use crate::native_error::NativeError;
use crate::screen_capture::{CaptureMessage, FrameSender};

pub const MAX_CHANNELS: u16 = 2;
const WAVE_FORMAT_PCM: u16 = 1;
const WAVE_FORMAT_IEEE_FLOAT: u16 = 3;
const SAMPLE_RATE: u32 = 48_000;
const BUFFER_DURATION: i64 = 200_000;
const ACTIVATION_TIMEOUT_MS: u32 = 5_000;
const WAIT_TIMEOUT_MS: u32 = 200;

#[derive(Debug, Clone, Copy)]
pub enum Target {
    Process(u32),
    EverythingExceptColibri,
}

#[implement(IActivateAudioInterfaceCompletionHandler)]
struct Completion {
    signal: HANDLE,
}

impl IActivateAudioInterfaceCompletionHandler_Impl for Completion_Impl {
    fn ActivateCompleted(
        &self,
        _operation: Ref<'_, IActivateAudioInterfaceAsyncOperation>,
    ) -> WindowsResult<()> {
        let _ = unsafe { SetEvent(self.signal) };
        Ok(())
    }
}

struct Owned(HANDLE);

impl Drop for Owned {
    fn drop(&mut self) {
        let _ = unsafe { CloseHandle(self.0) };
    }
}

fn wave_format(float: bool) -> WAVEFORMATEX {
    let bits = if float { 32u16 } else { 16u16 };
    let block = MAX_CHANNELS * bits / 8;

    WAVEFORMATEX {
        wFormatTag: if float {
            WAVE_FORMAT_IEEE_FLOAT
        } else {
            WAVE_FORMAT_PCM
        },
        nChannels: MAX_CHANNELS,
        nSamplesPerSec: SAMPLE_RATE,
        nAvgBytesPerSec: SAMPLE_RATE * u32::from(block),
        nBlockAlign: block,
        wBitsPerSample: bits,
        cbSize: 0,
    }
}

fn activation_params(target: Target) -> AUDIOCLIENT_ACTIVATION_PARAMS {
    let (process, mode) = match target {
        Target::Process(process) => (process, PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE),
        Target::EverythingExceptColibri => (
            unsafe { GetCurrentProcessId() },
            PROCESS_LOOPBACK_MODE_EXCLUDE_TARGET_PROCESS_TREE,
        ),
    };

    AUDIOCLIENT_ACTIVATION_PARAMS {
        ActivationType: AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK,
        Anonymous: AUDIOCLIENT_ACTIVATION_PARAMS_0 {
            ProcessLoopbackParams: AUDIOCLIENT_PROCESS_LOOPBACK_PARAMS {
                TargetProcessId: process,
                ProcessLoopbackMode: mode,
            },
        },
    }
}

fn activation_blob(params: &mut AUDIOCLIENT_ACTIVATION_PARAMS) -> ManuallyDrop<PROPVARIANT> {
    ManuallyDrop::new(PROPVARIANT {
        Anonymous: PROPVARIANT_0 {
            Anonymous: ManuallyDrop::new(PROPVARIANT_0_0 {
                vt: VT_BLOB,
                wReserved1: 0,
                wReserved2: 0,
                wReserved3: 0,
                Anonymous: PROPVARIANT_0_0_0 {
                    blob: BLOB {
                        cbSize: std::mem::size_of::<AUDIOCLIENT_ACTIVATION_PARAMS>() as u32,
                        pBlobData: std::ptr::from_mut(params).cast::<u8>(),
                    },
                },
            }),
        },
    })
}

fn activate(target: Target) -> WindowsResult<IAudioClient> {
    let signal = Owned(unsafe { CreateEventW(None, false, false, None) }?);
    let handler: IActivateAudioInterfaceCompletionHandler = Completion { signal: signal.0 }.into();

    let mut params = activation_params(target);
    let blob = activation_blob(&mut params);

    let operation = unsafe {
        ActivateAudioInterfaceAsync(
            VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK,
            &IAudioClient::IID,
            Some(&*blob),
            &handler,
        )
    }?;

    if unsafe { WaitForSingleObject(signal.0, ACTIVATION_TIMEOUT_MS) } != WAIT_OBJECT_0 {
        return Err(windows::core::Error::empty());
    }

    let mut status = windows::core::HRESULT(0);
    let mut activated: Option<windows::core::IUnknown> = None;
    unsafe { operation.GetActivateResult(&mut status, &mut activated) }?;
    status.ok()?;

    activated
        .ok_or_else(windows::core::Error::empty)?
        .cast::<IAudioClient>()
}

fn planar(interleaved: &[u8], frames: u32, float: bool) -> Option<CaptureMessage> {
    let channels = usize::from(MAX_CHANNELS);
    let count = frames as usize;
    if count == 0 {
        return None;
    }

    let mut data = Vec::with_capacity(count * channels * std::mem::size_of::<f32>());

    for channel in 0..channels {
        for frame in 0..count {
            let index = frame * channels + channel;
            let sample = if float {
                let offset = index * 4;
                let bytes = interleaved.get(offset..offset + 4)?;
                f32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]])
            } else {
                let offset = index * 2;
                let bytes = interleaved.get(offset..offset + 2)?;
                f32::from(i16::from_le_bytes([bytes[0], bytes[1]])) / f32::from(i16::MAX)
            };
            data.extend_from_slice(&sample.to_le_bytes());
        }
    }

    Some(CaptureMessage::Audio {
        channels: MAX_CHANNELS as u8,
        frames,
        data,
    })
}

fn silence(frames: u32) -> CaptureMessage {
    CaptureMessage::Audio {
        channels: MAX_CHANNELS as u8,
        frames,
        data: vec![0u8; frames as usize * usize::from(MAX_CHANNELS) * 4],
    }
}

struct Stream {
    client: IAudioClient,
    capture: IAudioCaptureClient,
    signal: Owned,
    float: bool,
}

fn open(target: Target) -> WindowsResult<Stream> {
    let client = activate(target)?;

    let mut float = true;
    let mut format = wave_format(true);
    let mut outcome = unsafe {
        client.Initialize(
            AUDCLNT_SHAREMODE_SHARED,
            AUDCLNT_STREAMFLAGS_LOOPBACK | AUDCLNT_STREAMFLAGS_EVENTCALLBACK,
            BUFFER_DURATION,
            0,
            &format,
            None,
        )
    };

    if outcome.is_err() {
        float = false;
        format = wave_format(false);
        outcome = unsafe {
            client.Initialize(
                AUDCLNT_SHAREMODE_SHARED,
                AUDCLNT_STREAMFLAGS_LOOPBACK | AUDCLNT_STREAMFLAGS_EVENTCALLBACK,
                BUFFER_DURATION,
                0,
                &format,
                None,
            )
        };
    }

    outcome?;

    let signal = Owned(unsafe { CreateEventW(None, false, false, None) }?);
    unsafe { client.SetEventHandle(signal.0) }?;

    let capture = unsafe { client.GetService::<IAudioCaptureClient>() }?;
    unsafe { client.Start() }?;

    Ok(Stream {
        client,
        capture,
        signal,
        float,
    })
}

fn pump(stream: &Stream, sender: &FrameSender, running: &AtomicBool) {
    while running.load(Ordering::Acquire) {
        unsafe { WaitForSingleObject(stream.signal.0, WAIT_TIMEOUT_MS) };

        loop {
            let Ok(available) = (unsafe { stream.capture.GetNextPacketSize() }) else {
                return;
            };
            if available == 0 {
                break;
            }

            let mut data: *mut u8 = std::ptr::null_mut();
            let mut frames = 0u32;
            let mut flags = 0u32;

            if unsafe {
                stream
                    .capture
                    .GetBuffer(&mut data, &mut frames, &mut flags, None, None)
            }
            .is_err()
            {
                return;
            }

            if frames > 0 {
                let message = if flags & AUDCLNT_BUFFERFLAGS_SILENT.0 as u32 != 0 || data.is_null()
                {
                    Some(silence(frames))
                } else {
                    let width = if stream.float { 4 } else { 2 };
                    let bytes = unsafe {
                        std::slice::from_raw_parts(
                            data,
                            frames as usize * usize::from(MAX_CHANNELS) * width,
                        )
                    };
                    planar(bytes, frames, stream.float)
                };

                if let Some(message) = message {
                    if sender.send(message).is_err() {
                        let _ = unsafe { stream.capture.ReleaseBuffer(frames) };
                        return;
                    }
                }
            }

            if unsafe { stream.capture.ReleaseBuffer(frames) }.is_err() {
                return;
            }
        }
    }
}

pub struct Capture {
    running: Arc<AtomicBool>,
    worker: Option<JoinHandle<()>>,
}

impl Capture {
    pub fn stop(mut self) {
        self.running.store(false, Ordering::Release);
        if let Some(worker) = self.worker.take() {
            let _ = worker.join();
        }
    }
}

pub fn start(target: Target, sender: FrameSender) -> Result<Capture, NativeError> {
    let running = Arc::new(AtomicBool::new(true));
    let flag = running.clone();
    let (ready, started) = mpsc::channel::<Result<(), String>>();

    let worker = std::thread::Builder::new()
        .name("colibri-capture-audio".to_string())
        .spawn(move || {
            let _ = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) };

            let stream = match open(target) {
                Ok(stream) => {
                    let _ = ready.send(Ok(()));
                    stream
                }
                Err(error) => {
                    let _ = ready.send(Err(error.to_string()));
                    return;
                }
            };

            pump(&stream, &sender, &flag);

            let _ = unsafe { stream.client.Stop() };
        })
        .map_err(|error| {
            NativeError::failed(format!("could not start capturing audio: {error}"))
        })?;

    match started.recv_timeout(std::time::Duration::from_millis(
        ACTIVATION_TIMEOUT_MS as u64 + 1_000,
    )) {
        Ok(Ok(())) => Ok(Capture {
            running,
            worker: Some(worker),
        }),
        Ok(Err(message)) => Err(NativeError::failed(format!(
            "could not capture that audio: {message}"
        ))),
        Err(_) => {
            running.store(false, Ordering::Release);
            Err(NativeError::failed("the audio capture never started"))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_activation_blob_points_at_the_callers_own_parameters() {
        let mut params = activation_params(Target::Process(4242));
        let expected = std::ptr::from_mut(&mut params).cast::<u8>();
        let blob = activation_blob(&mut params);

        let carried = unsafe { blob.Anonymous.Anonymous.Anonymous.blob };
        assert_eq!(carried.pBlobData, expected);
        assert_eq!(
            carried.cbSize as usize,
            std::mem::size_of::<AUDIOCLIENT_ACTIVATION_PARAMS>()
        );
        assert_eq!(unsafe { blob.Anonymous.Anonymous.vt }, VT_BLOB);
    }

    #[test]
    fn the_activation_blob_never_frees_the_stack_memory_it_points_at() {
        let mut params = activation_params(Target::EverythingExceptColibri);

        {
            let _blob = activation_blob(&mut params);
        }

        let loopback = unsafe { params.Anonymous.ProcessLoopbackParams };
        assert_eq!(
            loopback.ProcessLoopbackMode,
            PROCESS_LOOPBACK_MODE_EXCLUDE_TARGET_PROCESS_TREE
        );
    }

    fn samples(message: &CaptureMessage) -> Vec<f32> {
        let CaptureMessage::Audio { data, .. } = message else {
            panic!("audio messages carry audio");
        };

        data.chunks_exact(4)
            .map(|chunk| f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
            .collect()
    }

    #[test]
    fn interleaved_float_is_split_into_one_plane_per_channel() {
        let mut interleaved = Vec::new();
        for frame in 0..3 {
            interleaved.extend_from_slice(&(frame as f32).to_le_bytes());
            interleaved.extend_from_slice(&(-(frame as f32)).to_le_bytes());
        }

        let message = planar(&interleaved, 3, true).expect("converts");
        assert_eq!(samples(&message), vec![0.0, 1.0, 2.0, -0.0, -1.0, -2.0]);
    }

    #[test]
    fn sixteen_bit_input_is_scaled_into_the_float_range() {
        let mut interleaved = Vec::new();
        interleaved.extend_from_slice(&i16::MAX.to_le_bytes());
        interleaved.extend_from_slice(&0i16.to_le_bytes());

        let message = planar(&interleaved, 1, false).expect("converts");
        let values = samples(&message);
        assert!((values[0] - 1.0).abs() < 0.001);
        assert_eq!(values[1], 0.0);
    }

    #[test]
    fn a_short_buffer_is_rejected_rather_than_read_out_of_bounds() {
        assert!(planar(&[0u8; 4], 4, true).is_none());
    }

    #[test]
    fn an_empty_packet_produces_nothing() {
        assert!(planar(&[], 0, true).is_none());
    }

    #[test]
    fn a_silent_packet_is_the_right_length_for_its_frame_count() {
        let CaptureMessage::Audio {
            channels,
            frames,
            data,
        } = silence(480)
        else {
            panic!("audio messages carry audio");
        };

        assert_eq!(channels, 2);
        assert_eq!(frames, 480);
        assert_eq!(data.len(), 480 * 2 * 4);
    }

    #[test]
    fn a_display_share_excludes_colibris_own_process_tree() {
        let params = activation_params(Target::EverythingExceptColibri);
        let loopback = unsafe { params.Anonymous.ProcessLoopbackParams };

        assert_eq!(
            loopback.ProcessLoopbackMode,
            PROCESS_LOOPBACK_MODE_EXCLUDE_TARGET_PROCESS_TREE
        );
        assert_eq!(loopback.TargetProcessId, unsafe { GetCurrentProcessId() });
    }

    #[test]
    fn an_app_share_captures_only_that_apps_process_tree() {
        let params = activation_params(Target::Process(4242));
        let loopback = unsafe { params.Anonymous.ProcessLoopbackParams };

        assert_eq!(
            loopback.ProcessLoopbackMode,
            PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE
        );
        assert_eq!(loopback.TargetProcessId, 4242);
    }

    #[test]
    fn the_wave_format_matches_the_wire_format() {
        let format = wave_format(true);
        let (rate, channels, bits, block, bytes_per_second) = (
            { format.nSamplesPerSec },
            { format.nChannels },
            { format.wBitsPerSample },
            { format.nBlockAlign },
            { format.nAvgBytesPerSec },
        );

        assert_eq!(rate, 48_000);
        assert_eq!(channels, 2);
        assert_eq!(bits, 32);
        assert_eq!(block, 8);
        assert_eq!(bytes_per_second, 48_000 * 8);
    }
}
