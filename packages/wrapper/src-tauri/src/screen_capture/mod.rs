use std::collections::HashMap;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::native_error::NativeError;

mod server;

#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "macos")]
use macos as backend;

#[cfg(target_os = "windows")]
mod windows;
#[cfg(target_os = "windows")]
use self::windows as backend;

#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "linux")]
use linux as backend;

#[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
mod unsupported;
#[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
use unsupported as backend;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SourceKind {
    Display,
    Window,
    Application,
}

impl SourceKind {
    fn prefix(self) -> &'static str {
        match self {
            SourceKind::Display => "display",
            SourceKind::Window => "window",
            SourceKind::Application => "app",
        }
    }

    fn from_prefix(value: &str) -> Option<Self> {
        match value {
            "display" => Some(SourceKind::Display),
            "window" => Some(SourceKind::Window),
            "app" => Some(SourceKind::Application),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SourceId {
    pub kind: SourceKind,
    pub native: String,
}

impl SourceId {
    pub fn new(kind: SourceKind, native: impl Into<String>) -> Self {
        Self {
            kind,
            native: native.into(),
        }
    }

    pub fn encode(&self) -> String {
        format!("{}-{}", self.kind.prefix(), self.native)
    }

    pub fn parse(value: &str) -> Option<Self> {
        let (prefix, native) = value.split_once('-')?;
        if native.is_empty() {
            return None;
        }
        Some(Self {
            kind: SourceKind::from_prefix(prefix)?,
            native: native.to_string(),
        })
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureSource {
    pub id: String,
    pub kind: SourceKind,
    pub name: String,
    pub application: Option<String>,
    pub width: u32,
    pub height: u32,
    pub has_thumbnail: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioApp {
    pub id: String,
    pub name: String,
    pub process_id: Option<u32>,
    pub icon_name: Option<String>,
    pub binary: Option<String>,
    pub preselected: bool,
    pub router: bool,
}

pub fn matches_router(value: &str, prefixes: &[&str]) -> bool {
    let lowered = value.trim().to_lowercase();
    !lowered.is_empty()
        && prefixes
            .iter()
            .any(|prefix| lowered.starts_with(&prefix.to_lowercase()))
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureQuality {
    pub width: u32,
    pub height: u32,
    pub framerate: u32,
    pub max_bitrate: u32,
}

impl CaptureQuality {
    fn sanitized(self) -> Self {
        Self {
            width: self.width.clamp(160, 7680) & !1,
            height: self.height.clamp(120, 4320) & !1,
            framerate: self.framerate.clamp(1, 120),
            max_bitrate: self.max_bitrate.clamp(200_000, 60_000_000),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum PickerKind {
    Sources,
    #[cfg_attr(not(target_os = "linux"), allow(dead_code))]
    Portal,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CapturePicker {
    pub kind: PickerKind,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureSession {
    pub url: String,
    pub token: String,
}

#[derive(Debug, Clone)]
pub struct EncodedConfig {
    pub codec: String,
    pub description: Vec<u8>,
    pub coded_width: u32,
    pub coded_height: u32,
}

#[derive(Debug)]
pub enum CaptureMessage {
    Config(EncodedConfig),
    Frame {
        keyframe: bool,
        timestamp_micros: i64,
        data: Vec<u8>,
    },
    Audio {
        channels: u8,
        frames: u32,
        data: Vec<u8>,
    },
}

pub type FrameSender = tokio::sync::mpsc::UnboundedSender<CaptureMessage>;

struct ActiveCapture {
    capture: backend::Capture,
    shutdown: server::ServerHandle,
}

#[derive(Default)]
pub struct CaptureState {
    thumbnails: Mutex<HashMap<String, Vec<u8>>>,
    active: Mutex<Option<ActiveCapture>>,
}

impl CaptureState {
    pub fn thumbnail(&self, id: &str) -> Option<Vec<u8>> {
        self.thumbnails.lock().ok()?.get(id).cloned()
    }

    fn replace_thumbnails(&self, next: HashMap<String, Vec<u8>>) {
        if let Ok(mut guard) = self.thumbnails.lock() {
            *guard = next;
        }
    }

    fn stop_active(&self) {
        let Ok(mut guard) = self.active.lock() else {
            return;
        };
        if let Some(active) = guard.take() {
            active.capture.stop();
            active.shutdown.stop();
        }
    }
}

#[tauri::command]
pub fn screen_capture_supported() -> bool {
    backend::supported()
}

#[tauri::command]
pub async fn screen_capture_permission(request: bool) -> bool {
    tauri::async_runtime::spawn_blocking(move || {
        if request {
            backend::request_permission()
        } else {
            backend::permission_granted()
        }
    })
    .await
    .unwrap_or(false)
}

#[tauri::command]
pub fn screen_capture_open_settings() -> Result<(), NativeError> {
    backend::open_privacy_settings()
}

#[tauri::command]
pub async fn screen_capture_list_sources(
    state: State<'_, CaptureState>,
) -> Result<Vec<CaptureSource>, NativeError> {
    let (sources, thumbnails) = backend::list_sources().await?;
    state.replace_thumbnails(thumbnails);
    Ok(sources)
}

#[tauri::command]
pub async fn screen_capture_list_audio_apps(
    source_id: Option<String>,
) -> Result<Vec<AudioApp>, NativeError> {
    let source = source_id.as_deref().and_then(SourceId::parse);
    backend::list_audio_apps(source).await
}

#[cfg(target_os = "linux")]
#[tauri::command]
pub fn screen_capture_picker() -> Result<CapturePicker, NativeError> {
    Ok(backend::picker())
}

#[cfg(not(target_os = "linux"))]
#[tauri::command]
pub fn screen_capture_picker() -> Result<CapturePicker, NativeError> {
    Ok(CapturePicker {
        kind: PickerKind::Sources,
    })
}

#[cfg(target_os = "linux")]
async fn start_backend(
    _app: &tauri::AppHandle<crate::AppRuntime>,
    source: &SourceId,
    quality: CaptureQuality,
    capture_audio: bool,
    audio_apps: Option<Vec<String>>,
    sender: FrameSender,
) -> Result<backend::Capture, NativeError> {
    let options = backend::StartOptions {
        quality,
        capture_audio,
        audio_apps,
    };
    backend::start(source, options, sender).await
}

#[cfg(not(target_os = "linux"))]
async fn start_backend(
    _app: &tauri::AppHandle<crate::AppRuntime>,
    source: &SourceId,
    quality: CaptureQuality,
    capture_audio: bool,
    audio_apps: Option<Vec<String>>,
    sender: FrameSender,
) -> Result<backend::Capture, NativeError> {
    backend::start(source, quality, capture_audio, audio_apps, sender)
}

#[tauri::command]
pub async fn screen_capture_start(
    app: tauri::AppHandle<crate::AppRuntime>,
    state: State<'_, CaptureState>,
    source_id: String,
    quality: CaptureQuality,
    capture_audio: bool,
    audio_apps: Option<Vec<String>>,
) -> Result<CaptureSession, NativeError> {
    let source = SourceId::parse(&source_id)
        .ok_or_else(|| NativeError::invalid_request("unrecognised capture source"))?;

    state.stop_active();

    let (sender, receiver) = tokio::sync::mpsc::unbounded_channel();
    let server = server::spawn(receiver).await?;
    let capture = match start_backend(
        &app,
        &source,
        quality.sanitized(),
        capture_audio,
        audio_apps,
        sender,
    )
    .await
    {
        Ok(capture) => capture,
        Err(error) => {
            server.handle.stop();
            return Err(error);
        }
    };

    if let Ok(mut guard) = state.active.lock() {
        *guard = Some(ActiveCapture {
            capture,
            shutdown: server.handle,
        });
    }

    Ok(server.session)
}

#[tauri::command]
pub async fn screen_capture_stop(state: State<'_, CaptureState>) -> Result<(), NativeError> {
    state.stop_active();
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_source_id_survives_a_round_trip() {
        let id = SourceId::new(SourceKind::Window, "1234");
        assert_eq!(SourceId::parse(&id.encode()), Some(id));
    }

    #[test]
    fn a_bundle_identifier_keeps_its_hyphens() {
        let id = SourceId::new(SourceKind::Application, "com.foo-bar.baz");
        let parsed = SourceId::parse(&id.encode()).expect("parses");
        assert_eq!(parsed.native, "com.foo-bar.baz");
        assert_eq!(parsed.kind, SourceKind::Application);
    }

    #[test]
    fn a_malformed_source_id_is_rejected() {
        for value in ["", "display", "display-", "nonsense-1", "-1"] {
            assert_eq!(SourceId::parse(value), None, "{value}");
        }
    }

    #[test]
    fn a_router_matches_by_prefix_and_ignores_case() {
        let table = ["voicemeeter", "com.rogueamoeba.loopback"];
        assert!(matches_router("VoiceMeeterPro_x64", &table));
        assert!(matches_router("com.rogueamoeba.Loopback", &table));
        assert!(!matches_router("spotify", &table));
        assert!(!matches_router("  ", &table));
    }

    #[test]
    fn quality_is_clamped_to_something_an_encoder_accepts() {
        let quality = CaptureQuality {
            width: 1921,
            height: 4,
            framerate: 9000,
            max_bitrate: 1,
        }
        .sanitized();

        assert_eq!(quality.width, 1920);
        assert_eq!(quality.height, 120);
        assert_eq!(quality.framerate, 120);
        assert_eq!(quality.max_bitrate, 200_000);
    }

    #[test]
    fn sane_quality_passes_through_untouched() {
        let quality = CaptureQuality {
            width: 1920,
            height: 1080,
            framerate: 30,
            max_bitrate: 4_500_000,
        };

        let sanitized = quality.sanitized();
        assert_eq!(sanitized.width, 1920);
        assert_eq!(sanitized.height, 1080);
        assert_eq!(sanitized.framerate, 30);
        assert_eq!(sanitized.max_bitrate, 4_500_000);
    }
}
