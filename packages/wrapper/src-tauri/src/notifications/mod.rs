#[cfg(target_os = "macos")]
mod macos;
#[cfg(not(any(target_os = "macos", windows)))]
mod unsupported;
#[cfg(windows)]
mod windows;

#[cfg(target_os = "macos")]
use macos as imp;
#[cfg(not(any(target_os = "macos", windows)))]
use unsupported as imp;
#[cfg(windows)]
use windows as imp;

use std::path::Path;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, Runtime};

use crate::native_error::NativeError;

pub const ACTIVATION_EVENT: &str = "colibri-notification-activated";

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationPayload {
    pub title: String,
    pub body: String,
    pub subtitle: Option<String>,
    pub channel_uri: String,
    pub message_uri: String,
    pub icon_path: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Activation {
    pub channel_uri: String,
    pub message_uri: String,
}

fn cache_avatar(cache_dir: &Path, cid: &str, bytes: &[u8]) -> Option<String> {
    let dir = cache_dir.join("notification-avatars");
    let path = dir.join(format!("{cid}.jpg"));

    if path.exists() {
        return path.to_str().map(str::to_owned);
    }

    std::fs::create_dir_all(&dir).ok()?;
    std::fs::write(&path, bytes).ok()?;
    path.to_str().map(str::to_owned)
}

#[tauri::command]
pub fn native_notify_supported() -> bool {
    imp::supported()
}

#[tauri::command]
pub fn native_notify(payload: NotificationPayload) -> Result<(), NativeError> {
    imp::notify(payload)
}

#[tauri::command]
pub fn native_notify_dismiss(channel_uri: String) -> Result<(), NativeError> {
    imp::dismiss_channel(channel_uri)
}

#[tauri::command]
pub fn native_notify_cache_avatar<R: Runtime>(
    app: AppHandle<R>,
    cid: String,
    bytes: Vec<u8>,
) -> Result<Option<String>, NativeError> {
    let cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|err| NativeError::failed(err.to_string()))?;

    Ok(cache_avatar(&cache_dir, &cid, &bytes))
}

#[cfg(any(target_os = "macos", windows))]
fn emit_activation<R: Runtime>(app: &AppHandle<R>, activation: Activation) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.set_focus();
        let _ = window.emit(ACTIVATION_EVENT, activation);
    }
}

pub fn setup<R: Runtime>(app: &AppHandle<R>) {
    #[cfg(target_os = "macos")]
    {
        let Some(mtm) = objc2_foundation::MainThreadMarker::new() else {
            return;
        };

        let handle = app.clone();
        imp::install_delegate(mtm, move |activation| {
            emit_activation(&handle, activation);
        });
    }

    #[cfg(windows)]
    {
        let handle = app.clone();
        imp::install_activation_handler(
            app.config().identifier.clone(),
            Box::new(move |activation| {
                emit_activation(&handle, activation);
            }),
        );
    }

    #[cfg(not(any(target_os = "macos", windows)))]
    let _ = app;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cache_avatar_writes_once_and_reuses() {
        let dir = std::env::temp_dir().join("colibri-avatar-cache-test");
        let _ = std::fs::remove_dir_all(&dir);

        let first = cache_avatar(&dir, "abc", b"payload").expect("first write");
        assert!(Path::new(&first).exists());

        std::fs::write(&first, b"changed").expect("overwrite");
        let second = cache_avatar(&dir, "abc", b"payload").expect("second call");

        assert_eq!(first, second);
        assert_eq!(std::fs::read(&second).expect("read"), b"changed");

        let _ = std::fs::remove_dir_all(&dir);
    }
}
