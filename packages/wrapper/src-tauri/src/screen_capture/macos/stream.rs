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

pub struct OutputIvars {
    encoder: Arc<Encoder>,
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

            let Some(image) = (unsafe { sample_buffer.image_buffer() }) else {
                return;
            };

            let pts = unsafe { sample_buffer.presentation_time_stamp() };
            ivars.encoder.encode(&image, pts, ivars.frame_duration);
        }
    }
);

impl CaptureOutput {
    fn new(
        encoder: Arc<Encoder>,
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

pub struct Capture {
    stream: Retained<SCStream>,
    encoder: Arc<Encoder>,
    _output: Retained<CaptureOutput>,
    _queue: DispatchRetained<DispatchQueue>,
}

impl Capture {
    pub fn stop(self) {
        let handler = RcBlock::new(|_error: *mut NSError| {});
        unsafe {
            self.stream.stopCaptureWithCompletionHandler(Some(&handler));
        }
        self.encoder.finish();
    }
}

unsafe impl Send for Capture {}
unsafe impl Sync for Capture {}

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

        if capture_audio {
            config.setCapturesAudio(true);
            config.setSampleRate(AUDIO_SAMPLE_RATE);
            config.setChannelCount(audio::MAX_CHANNELS as isize);
            config.setExcludesCurrentProcessAudio(true);
        }
    }
    config
}

pub fn start(
    filter: &SCContentFilter,
    quality: CaptureQuality,
    capture_audio: bool,
    sender: FrameSender,
) -> Result<Capture, NativeError> {
    let encoder = Arc::new(Encoder::new(quality, sender.clone())?);
    let config = configuration(quality, capture_audio);
    let frame_duration = unsafe { CMTime::with_seconds(1.0 / quality.framerate as f64, 90_000) };

    let stream = unsafe {
        SCStream::initWithFilter_configuration_delegate(SCStream::alloc(), filter, &config, None)
    };

    let output = CaptureOutput::new(
        encoder.clone(),
        frame_duration,
        capture_audio.then_some(sender),
    );
    let queue = DispatchQueue::new("social.colibri.capture", DispatchQueueAttr::SERIAL);

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
        Ok(Ok(())) => Ok(Capture {
            stream,
            encoder,
            _output: output,
            _queue: queue,
        }),
        Ok(Err(message)) => {
            encoder.finish();
            Err(super::permission_error(&message))
        }
        Err(_) => {
            encoder.finish();
            Err(NativeError::failed("the screen capture never started"))
        }
    }
}
