use std::collections::HashMap;

use super::{
    AudioApp, CapturePicker, CaptureQuality, CaptureSource, FrameSender, PickerKind, SourceId,
    SourceKind,
};
use crate::native_error::NativeError;

mod audio;

fn has_display() -> bool {
    ["WAYLAND_DISPLAY", "DISPLAY"]
        .iter()
        .any(|name| std::env::var_os(name).is_some_and(|value| !value.is_empty()))
}

pub struct Capture {
    audio: Option<audio::Capture>,
}

impl Capture {
    pub fn stop(self) {
        if let Some(audio) = self.audio {
            audio.stop();
        }
    }
}

pub fn supported() -> bool {
    has_display()
}

pub fn permission_granted() -> bool {
    true
}

pub fn request_permission() -> bool {
    true
}

pub fn open_privacy_settings() -> Result<(), NativeError> {
    Ok(())
}

pub fn picker() -> CapturePicker {
    CapturePicker {
        kind: PickerKind::Browser,
    }
}

pub async fn list_audio_apps(_source: Option<SourceId>) -> Result<Vec<AudioApp>, NativeError> {
    tauri::async_runtime::spawn_blocking(|| audio::list_apps(None))
        .await
        .map_err(|error| NativeError::failed(format!("could not list audio apps: {error}")))?
}

pub async fn list_sources() -> Result<(Vec<CaptureSource>, HashMap<String, Vec<u8>>), NativeError> {
    Err(NativeError::unsupported())
}

pub fn start(
    _source: &SourceId,
    _quality: CaptureQuality,
    _capture_audio: bool,
    _audio_apps: Option<Vec<String>>,
    _sender: FrameSender,
) -> Result<Capture, NativeError> {
    Err(NativeError::unsupported())
}

pub async fn start_audio(
    kind: SourceKind,
    audio_apps: Option<Vec<String>>,
    sender: FrameSender,
) -> Result<Capture, NativeError> {
    let shared = audio::Shared::native(kind, None);
    let Some(target) = audio::choose_target(&shared, audio_apps.as_deref()) else {
        eprintln!("screen share audio: no target for this share");
        return Ok(Capture { audio: None });
    };
    eprintln!("screen share audio target: {}", target.describe());
    tauri::async_runtime::spawn_blocking(move || {
        let began = std::time::Instant::now();
        let result = audio::start(target, sender);
        match &result {
            Ok(_) => eprintln!(
                "screen share audio started in {} ms",
                began.elapsed().as_millis()
            ),
            Err(error) => eprintln!(
                "screen share audio failed after {} ms: {}",
                began.elapsed().as_millis(),
                error.message
            ),
        }
        result.map(|capture| Capture {
            audio: Some(capture),
        })
    })
    .await
    .map_err(|error| NativeError::failed(format!("could not start capturing audio: {error}")))?
}
