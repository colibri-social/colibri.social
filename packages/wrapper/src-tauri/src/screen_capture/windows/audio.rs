use std::collections::VecDeque;
use std::mem::ManuallyDrop;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

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
const MIX_TICK: Duration = Duration::from_millis(10);
const MIX_DELAY: Duration = Duration::from_millis(40);
const MIX_BACKLOG_FRAMES: usize = SAMPLE_RATE as usize / 5;

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

fn interleaved_samples(interleaved: &[u8], frames: u32, float: bool) -> Option<Vec<f32>> {
    let count = frames as usize * usize::from(MAX_CHANNELS);
    let width = if float { 4 } else { 2 };
    let bytes = interleaved.get(..count * width)?;

    Some(
        bytes
            .chunks_exact(width)
            .map(|sample| {
                if float {
                    f32::from_le_bytes([sample[0], sample[1], sample[2], sample[3]])
                } else {
                    f32::from(i16::from_le_bytes([sample[0], sample[1]])) / f32::from(i16::MAX)
                }
            })
            .collect(),
    )
}

fn planar_message(samples: &[f32]) -> Option<CaptureMessage> {
    let channels = usize::from(MAX_CHANNELS);
    let count = samples.len() / channels;
    if count == 0 {
        return None;
    }

    let mut data = Vec::with_capacity(count * channels * std::mem::size_of::<f32>());

    for channel in 0..channels {
        for frame in 0..count {
            data.extend_from_slice(&samples[frame * channels + channel].to_le_bytes());
        }
    }

    Some(CaptureMessage::Audio {
        channels: MAX_CHANNELS as u8,
        frames: count as u32,
        data,
    })
}

fn planar(interleaved: &[u8], frames: u32, float: bool) -> Option<CaptureMessage> {
    planar_message(&interleaved_samples(interleaved, frames, float)?)
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

fn pump(
    stream: &Stream,
    running: &AtomicBool,
    mut deliver: impl FnMut(u32, Option<&[u8]>) -> bool,
) {
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
                let bytes = if flags & AUDCLNT_BUFFERFLAGS_SILENT.0 as u32 != 0 || data.is_null() {
                    None
                } else {
                    let width = if stream.float { 4 } else { 2 };
                    Some(unsafe {
                        std::slice::from_raw_parts(
                            data,
                            frames as usize * usize::from(MAX_CHANNELS) * width,
                        )
                    })
                };

                if !deliver(frames, bytes) {
                    let _ = unsafe { stream.capture.ReleaseBuffer(frames) };
                    return;
                }
            }

            if unsafe { stream.capture.ReleaseBuffer(frames) }.is_err() {
                return;
            }
        }
    }
}

fn send_packet(sender: &FrameSender, frames: u32, bytes: Option<&[u8]>, float: bool) -> bool {
    let message = match bytes {
        None => Some(silence(frames)),
        Some(bytes) => planar(bytes, frames, float),
    };
    match message {
        Some(message) => sender.send(message).is_ok(),
        None => true,
    }
}

struct Mixer {
    sources: Vec<Mutex<VecDeque<f32>>>,
}

impl Mixer {
    fn with_sources(count: usize) -> Self {
        Self {
            sources: (0..count).map(|_| Mutex::default()).collect(),
        }
    }

    fn push(&self, source: usize, frames: u32, bytes: Option<&[u8]>, float: bool) {
        let Some(buffer) = self.sources.get(source) else {
            return;
        };
        let samples = match bytes {
            None => vec![0.0; frames as usize * usize::from(MAX_CHANNELS)],
            Some(bytes) => match interleaved_samples(bytes, frames, float) {
                Some(samples) => samples,
                None => return,
            },
        };
        let Ok(mut buffer) = buffer.lock() else {
            return;
        };
        buffer.extend(samples);
        let limit = MIX_BACKLOG_FRAMES * usize::from(MAX_CHANNELS);
        if buffer.len() > limit {
            let excess = buffer.len() - limit;
            buffer.drain(..excess);
        }
    }

    fn take(&self, frames: usize) -> Vec<f32> {
        let wanted = frames * usize::from(MAX_CHANNELS);
        let mut mixed = vec![0.0f32; wanted];
        for buffer in &self.sources {
            let Ok(mut buffer) = buffer.lock() else {
                continue;
            };
            let available = buffer.len().min(wanted);
            for (slot, sample) in mixed.iter_mut().zip(buffer.drain(..available)) {
                *slot += sample;
            }
        }
        for sample in &mut mixed {
            *sample = sample.clamp(-1.0, 1.0);
        }
        mixed
    }
}

fn frames_due(elapsed: Duration) -> u64 {
    let delayed = elapsed.saturating_sub(MIX_DELAY);
    (delayed.as_micros() * u128::from(SAMPLE_RATE) / 1_000_000) as u64
}

fn run_mixer(mixer: &Mixer, sender: &FrameSender, running: &AtomicBool) {
    let started = Instant::now();
    let mut emitted = 0u64;
    while running.load(Ordering::Acquire) {
        std::thread::sleep(MIX_TICK);
        let due = frames_due(started.elapsed());
        if due <= emitted {
            continue;
        }
        let frames = (due - emitted) as usize;
        emitted = due;
        if let Some(message) = planar_message(&mixer.take(frames)) {
            if sender.send(message).is_err() {
                return;
            }
        }
    }
}

pub struct Capture {
    running: Arc<AtomicBool>,
    workers: Vec<JoinHandle<()>>,
}

impl Capture {
    pub fn stop(self) {
        self.running.store(false, Ordering::Release);
        for worker in self.workers {
            let _ = worker.join();
        }
    }
}

type Ready = mpsc::Sender<Result<(), String>>;

fn spawn_source(
    target: Target,
    running: Arc<AtomicBool>,
    ready: Ready,
    deliver: impl FnMut(u32, Option<&[u8]>, bool) -> bool + Send + 'static,
) -> std::io::Result<JoinHandle<()>> {
    std::thread::Builder::new()
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

            let float = stream.float;
            let mut deliver = deliver;
            pump(&stream, &running, |frames, bytes| {
                deliver(frames, bytes, float)
            });

            let _ = unsafe { stream.client.Stop() };
        })
}

pub fn start(targets: Vec<Target>, sender: FrameSender) -> Result<Capture, NativeError> {
    if targets.is_empty() {
        return Err(NativeError::invalid_request("no app was chosen for sound"));
    }

    let running = Arc::new(AtomicBool::new(true));
    let (ready, started) = mpsc::channel::<Result<(), String>>();
    let mut workers = Vec::new();
    let spawn_failed = |error: std::io::Error| {
        NativeError::failed(format!("could not start capturing audio: {error}"))
    };

    let mixer = if targets.len() == 1 {
        let sender = sender.clone();
        workers.push(
            spawn_source(
                targets[0],
                running.clone(),
                ready,
                move |frames, bytes, float| send_packet(&sender, frames, bytes, float),
            )
            .map_err(spawn_failed)?,
        );
        None
    } else {
        let mixer = Arc::new(Mixer::with_sources(targets.len()));
        for (index, target) in targets.iter().enumerate() {
            let mixer = mixer.clone();
            let spawned = spawn_source(
                *target,
                running.clone(),
                ready.clone(),
                move |frames, bytes, float| {
                    mixer.push(index, frames, bytes, float);
                    true
                },
            );
            match spawned {
                Ok(worker) => workers.push(worker),
                Err(error) => {
                    running.store(false, Ordering::Release);
                    return Err(spawn_failed(error));
                }
            }
        }
        drop(ready);
        Some(mixer)
    };

    let deadline = Instant::now() + Duration::from_millis(ACTIVATION_TIMEOUT_MS as u64 + 1_000);
    let mut opened = 0usize;
    let mut failure: Option<String> = None;
    for _ in 0..targets.len() {
        let remaining = deadline.saturating_duration_since(Instant::now());
        match started.recv_timeout(remaining) {
            Ok(Ok(())) => opened += 1,
            Ok(Err(message)) => failure = Some(message),
            Err(_) => break,
        }
    }

    if opened == 0 {
        running.store(false, Ordering::Release);
        return Err(match failure {
            Some(message) => {
                NativeError::failed(format!("could not capture that audio: {message}"))
            }
            None => NativeError::failed("the audio capture never started"),
        });
    }

    if let Some(mixer) = mixer {
        let flag = running.clone();
        let spawned = std::thread::Builder::new()
            .name("colibri-capture-audio-mix".to_string())
            .spawn(move || run_mixer(&mixer, &sender, &flag));
        match spawned {
            Ok(worker) => workers.push(worker),
            Err(error) => {
                running.store(false, Ordering::Release);
                return Err(spawn_failed(error));
            }
        }
    }

    Ok(Capture { running, workers })
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
    fn mixed_sources_are_summed_and_clamped() {
        let mixer = Mixer::with_sources(2);
        let first: Vec<u8> = [0.25f32, -0.5, 0.75, 0.0]
            .iter()
            .flat_map(|sample| sample.to_le_bytes())
            .collect();
        let second: Vec<u8> = [0.5f32, -0.75, 0.5, 0.0]
            .iter()
            .flat_map(|sample| sample.to_le_bytes())
            .collect();
        mixer.push(0, 2, Some(&first), true);
        mixer.push(1, 2, Some(&second), true);

        assert_eq!(mixer.take(2), vec![0.75, -1.0, 1.0, 0.0]);
    }

    #[test]
    fn a_quiet_source_is_filled_with_silence() {
        let mixer = Mixer::with_sources(2);
        let first: Vec<u8> = [0.5f32, 0.5]
            .iter()
            .flat_map(|sample| sample.to_le_bytes())
            .collect();
        mixer.push(0, 1, Some(&first), true);

        assert_eq!(mixer.take(2), vec![0.5, 0.5, 0.0, 0.0]);
        assert_eq!(mixer.take(1), vec![0.0, 0.0]);
    }

    #[test]
    fn a_source_that_runs_ahead_keeps_only_its_newest_audio() {
        let mixer = Mixer::with_sources(1);
        mixer.push(0, (MIX_BACKLOG_FRAMES * 2) as u32, None, true);
        let held = mixer.sources[0].lock().expect("unlocked").len();
        assert_eq!(held, MIX_BACKLOG_FRAMES * usize::from(MAX_CHANNELS));
    }

    #[test]
    fn the_mix_runs_behind_the_clock_by_a_fixed_delay() {
        assert_eq!(frames_due(Duration::from_millis(10)), 0);
        assert_eq!(frames_due(MIX_DELAY + Duration::from_millis(10)), 480);
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
