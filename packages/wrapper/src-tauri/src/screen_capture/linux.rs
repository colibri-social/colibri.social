use std::collections::HashMap;

use super::{
    AudioApp, CapturePicker, CaptureQuality, CaptureSource, FrameSender, PickerKind, SourceId,
    SourceKind,
};
use crate::native_error::NativeError;

mod audio;
mod encoder;
mod portal;
mod x11;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Session {
    Wayland,
    X11,
}

fn session() -> Option<Session> {
    if std::env::var_os("WAYLAND_DISPLAY").is_some_and(|value| !value.is_empty()) {
        return Some(Session::Wayland);
    }
    if std::env::var_os("DISPLAY").is_some_and(|value| !value.is_empty()) {
        return Some(Session::X11);
    }
    None
}

pub struct StartOptions {
    pub quality: CaptureQuality,
    pub capture_audio: bool,
    pub audio_apps: Option<Vec<String>>,
}

pub enum Capture {
    Portal(portal::Capture),
    X11(x11::Capture),
}

impl Capture {
    pub fn stop(self) {
        match self {
            Capture::Portal(capture) => capture.stop(),
            Capture::X11(capture) => capture.stop(),
        }
    }
}

pub fn supported() -> bool {
    session().is_some()
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
    match session() {
        Some(Session::Wayland) => CapturePicker {
            kind: PickerKind::Portal,
        },
        _ => CapturePicker {
            kind: PickerKind::Sources,
        },
    }
}

pub async fn list_audio_apps(source: Option<SourceId>) -> Result<Vec<AudioApp>, NativeError> {
    let window_process_id = source.as_ref().and_then(window_process_id);
    tauri::async_runtime::spawn_blocking(move || audio::list_apps(window_process_id))
        .await
        .map_err(|error| NativeError::failed(format!("could not list audio apps: {error}")))?
}

fn window_process_id(source: &SourceId) -> Option<u32> {
    match (session()?, source.kind) {
        (Session::X11, SourceKind::Window | SourceKind::Application) => {
            x11::window_process_id(source)
        }
        _ => None,
    }
}

pub async fn list_sources() -> Result<(Vec<CaptureSource>, HashMap<String, Vec<u8>>), NativeError> {
    match session() {
        Some(Session::Wayland) => Ok((portal::sources(), HashMap::new())),
        Some(Session::X11) => tauri::async_runtime::spawn_blocking(x11::list_sources)
            .await
            .map_err(|error| NativeError::failed(error.to_string()))?,
        None => Err(NativeError::unsupported()),
    }
}

pub async fn start(
    source: &SourceId,
    options: StartOptions,
    sender: FrameSender,
) -> Result<Capture, NativeError> {
    match session() {
        Some(Session::Wayland) => portal::start(source, options, sender)
            .await
            .map(Capture::Portal),
        Some(Session::X11) => {
            let source = source.clone();
            tauri::async_runtime::spawn_blocking(move || x11::start(&source, options, sender))
                .await
                .map_err(|error| NativeError::failed(error.to_string()))?
                .map(Capture::X11)
        }
        None => Err(NativeError::unsupported()),
    }
}

fn start_audio(
    options: &StartOptions,
    shared: &audio::Shared,
    sender: &FrameSender,
) -> Option<audio::Capture> {
    if !options.capture_audio {
        return None;
    }
    let Some(target) = audio::choose_target(shared, options.audio_apps.as_deref()) else {
        eprintln!("screen share audio: no target for this share");
        return None;
    };
    eprintln!("screen share audio target: {}", target.describe());
    let began = std::time::Instant::now();
    match audio::start(target, sender.clone()) {
        Ok(capture) => {
            eprintln!(
                "screen share audio started in {} ms",
                began.elapsed().as_millis()
            );
            Some(capture)
        }
        Err(error) => {
            eprintln!(
                "screen share audio failed after {} ms: {}",
                began.elapsed().as_millis(),
                error.message
            );
            None
        }
    }
}
