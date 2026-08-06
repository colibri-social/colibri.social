use std::collections::HashMap;

use super::{CaptureQuality, CaptureSource, FrameSender, SourceId};
use crate::native_error::NativeError;

pub struct Capture;

impl Capture {
    pub fn stop(self) {}
}

pub fn supported() -> bool {
    false
}

pub fn permission_granted() -> bool {
    false
}

pub fn request_permission() -> bool {
    false
}

pub fn open_privacy_settings() -> Result<(), NativeError> {
    Err(unavailable())
}

pub async fn list_sources() -> Result<(Vec<CaptureSource>, HashMap<String, Vec<u8>>), NativeError> {
    Err(unavailable())
}

pub fn start(
    _source: &SourceId,
    _quality: CaptureQuality,
    _capture_audio: bool,
    _sender: FrameSender,
) -> Result<Capture, NativeError> {
    Err(unavailable())
}

fn unavailable() -> NativeError {
    NativeError::unsupported()
}
