use std::sync::Arc;

use block2::RcBlock;
use dispatch2::{DispatchQueue, DispatchQueueAttr, DispatchRetained};
use objc2::rc::Retained;
use objc2::runtime::ProtocolObject;
use objc2::{define_class, msg_send, AllocAnyThread, DefinedClass};
use objc2_core_media::{CMSampleBuffer, CMTime};
use objc2_foundation::{NSError, NSObject, NSObjectProtocol};
use objc2_screen_capture_kit::{
    SCContentFilter, SCStream, SCStreamConfiguration, SCStreamOutput, SCStreamOutputType,
};

use super::audio;
use super::encoder::Encoder;
use crate::native_error::NativeError;
use crate::screen_capture::{CaptureQuality, FrameSender};

const QUEUE_DEPTH: isize = 6;
const PIXEL_FORMAT_420V: u32 = u32::from_be_bytes(*b"420v");
const AUDIO_SAMPLE_RATE: isize = 48_000;

const AUDIO_ONLY_EDGE: usize = 2;
const AUDIO_ONLY_FRAMERATE: i32 = 1;

pub struct OutputIvars {
    encoder: Option<Arc<Encoder>>,
    frame_duration: CMTime,
    audio: Option<FrameSender>,
}

define_class!(
    #[unsafe(super(NSObject))]
    #[name = "ColibriCaptureOutput"]
    #[ivars = OutputIvars]
    struct CaptureOutput;

    unsafe impl NSObjectProtocol for CaptureOutput {}

    unsafe impl SCStreamOutput for CaptureOutput {
        #[unsafe(method(stream:didOutputSampleBuffer:ofType:))]
        unsafe fn did_output_sample_buffer(
            &self,
            _stream: &SCStream,
            sample_buffer: &CMSampleBuffer,
            output_type: SCStreamOutputType,
        ) {
            if !unsafe { sample_buffer.is_valid() } {
                return;
            }

            let ivars = self.ivars();

            if output_type == SCStreamOutputType::Audio {
                let Some(sender) = ivars.audio.as_ref() else {
                    return;
                };
                if let Some(message) = audio::pcm_message(sample_buffer) {
                    let _ = sender.send(message);
                }
                return;
            }

            if output_type != SCStreamOutputType::Screen {
                return;
            }

            let Some(encoder) = ivars.encoder.as_ref() else {
                return;
            };

            let Some(image) = (unsafe { sample_buffer.image_buffer() }) else {
                return;
            };

            let pts = unsafe { sample_buffer.presentation_time_stamp() };
            encoder.encode(&image, pts, ivars.frame_duration);
        }
    }
);

impl CaptureOutput {
    fn new(
        encoder: Option<Arc<Encoder>>,
        frame_duration: CMTime,
        audio: Option<FrameSender>,
    ) -> Retained<Self> {
        let this = Self::alloc().set_ivars(OutputIvars {
            encoder,
            frame_duration,
            audio,
        });
        unsafe { msg_send![super(this), init] }
    }
}

struct Running {
    stream: Retained<SCStream>,
    _output: Retained<CaptureOutput>,
    _queue: DispatchRetained<DispatchQueue>,
}

impl Running {
    fn stop(&self) {
        let handler = RcBlock::new(|_error: *mut NSError| {});
        unsafe {
            self.stream.stopCaptureWithCompletionHandler(Some(&handler));
        }
    }
}

pub enum AudioSource<'a> {
    Silent,
    Shared,
    Separate(&'a SCContentFilter),
}

pub struct Capture {
    video: Running,
    audio: Option<Running>,
    encoder: Arc<Encoder>,
}

impl Capture {
    pub fn stop(self) {
        if let Some(audio) = &self.audio {
            audio.stop();
        }
        self.video.stop();
        self.encoder.finish();
    }
}

unsafe impl Send for Capture {}
unsafe impl Sync for Capture {}

fn with_audio(config: &SCStreamConfiguration) {
    unsafe {
        config.setCapturesAudio(true);
        config.setSampleRate(AUDIO_SAMPLE_RATE);
        config.setChannelCount(audio::MAX_CHANNELS as isize);
        config.setExcludesCurrentProcessAudio(true);
    }
}

fn configuration(quality: CaptureQuality, capture_audio: bool) -> Retained<SCStreamConfiguration> {
    let config = unsafe { SCStreamConfiguration::new() };
    unsafe {
        config.setWidth(quality.width as usize);
        config.setHeight(quality.height as usize);
        config.setMinimumFrameInterval(CMTime::with_seconds(
            1.0 / quality.framerate as f64,
            quality.framerate as i32,
        ));
        config.setPixelFormat(PIXEL_FORMAT_420V);
        config.setQueueDepth(QUEUE_DEPTH);
        config.setShowsCursor(true);
        config.setScalesToFit(true);
        config.setIgnoreShadowsSingleWindow(true);
    }
    if capture_audio {
        with_audio(&config);
    }
    config
}

fn audio_only_configuration() -> Retained<SCStreamConfiguration> {
    let config = unsafe { SCStreamConfiguration::new() };
    unsafe {
        config.setWidth(AUDIO_ONLY_EDGE);
        config.setHeight(AUDIO_ONLY_EDGE);
        config.setMinimumFrameInterval(CMTime::with_seconds(
            1.0 / f64::from(AUDIO_ONLY_FRAMERATE),
            AUDIO_ONLY_FRAMERATE,
        ));
        config.setShowsCursor(false);
    }
    with_audio(&config);
    config
}

fn run(
    filter: &SCContentFilter,
    config: &SCStreamConfiguration,
    output: Retained<CaptureOutput>,
    capture_audio: bool,
    label: &str,
) -> Result<Running, NativeError> {
    let stream = unsafe {
        SCStream::initWithFilter_configuration_delegate(SCStream::alloc(), filter, config, None)
    };
    let queue = DispatchQueue::new(label, DispatchQueueAttr::SERIAL);

    let protocol_output = ProtocolObject::from_ref(&*output);
    unsafe {
        stream
            .addStreamOutput_type_sampleHandlerQueue_error(
                protocol_output,
                SCStreamOutputType::Screen,
                Some(&queue),
            )
            .map_err(|error| NativeError::failed(error.localizedDescription().to_string()))?;

        if capture_audio {
            stream
                .addStreamOutput_type_sampleHandlerQueue_error(
                    protocol_output,
                    SCStreamOutputType::Audio,
                    Some(&queue),
                )
                .map_err(|error| NativeError::failed(error.localizedDescription().to_string()))?;
        }
    }

    let (tx, rx) = std::sync::mpsc::channel::<Result<(), String>>();
    let handler = RcBlock::new(move |error: *mut NSError| {
        let outcome = if error.is_null() {
            Ok(())
        } else {
            Err(unsafe { &*error }.localizedDescription().to_string())
        };
        let _ = tx.send(outcome);
    });

    unsafe {
        stream.startCaptureWithCompletionHandler(Some(&handler));
    }

    match rx.recv_timeout(std::time::Duration::from_secs(10)) {
        Ok(Ok(())) => Ok(Running {
            stream,
            _output: output,
            _queue: queue,
        }),
        Ok(Err(message)) => Err(super::permission_error(&message)),
        Err(_) => Err(NativeError::failed("the screen capture never started")),
    }
}

pub fn start(
    filter: &SCContentFilter,
    quality: CaptureQuality,
    audio: AudioSource,
    sender: FrameSender,
) -> Result<Capture, NativeError> {
    let encoder = Arc::new(Encoder::new(quality, sender.clone())?);
    let shared_audio = matches!(audio, AudioSource::Shared);
    let config = configuration(quality, shared_audio);
    let frame_duration = unsafe { CMTime::with_seconds(1.0 / quality.framerate as f64, 90_000) };

    let output = CaptureOutput::new(
        Some(encoder.clone()),
        frame_duration,
        shared_audio.then(|| sender.clone()),
    );
    let video = match run(
        filter,
        &config,
        output,
        shared_audio,
        "social.colibri.capture",
    ) {
        Ok(video) => video,
        Err(error) => {
            encoder.finish();
            return Err(error);
        }
    };

    let audio = match audio {
        AudioSource::Separate(app_filter) => {
            let output = CaptureOutput::new(None, frame_duration, Some(sender));
            match run(
                app_filter,
                &audio_only_configuration(),
                output,
                true,
                "social.colibri.capture-audio",
            ) {
                Ok(audio) => Some(audio),
                Err(error) => {
                    eprintln!("screen capture audio did not start: {}", error.message);
                    None
                }
            }
        }
        AudioSource::Silent | AudioSource::Shared => None,
    };

    Ok(Capture {
        video,
        audio,
        encoder,
    })
}
