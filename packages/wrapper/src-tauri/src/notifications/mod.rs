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

fn safe_file_stem(cid: &str) -> String {
    cid.chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

fn cache_avatar(cache_dir: &Path, cid: &str, bytes: &[u8]) -> Option<String> {
    let dir = cache_dir.join("notification-avatars");
    let path = dir.join(format!("{}.jpg", safe_file_stem(cid)));

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

#[cfg(windows)]
fn app_icon_path<R: Runtime>(app: &AppHandle<R>) -> Option<String> {
    const ICON: &[u8] = include_bytes!("../../icons/128x128.png");

    let dir = app.path().app_cache_dir().ok()?;
    let path = dir.join("notification-app-icon.png");

    if !path.exists() {
        std::fs::create_dir_all(&dir).ok()?;
        std::fs::write(&path, ICON).ok()?;
    }

    path.to_str().map(str::to_owned)
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
        let config = app.config();
        let display_name = config
            .product_name
            .clone()
            .unwrap_or_else(|| "Colibri".to_owned());

        imp::install_activation_handler(
            config.identifier.clone(),
            display_name,
            app_icon_path(app),
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
    fn safe_file_stem_strips_characters_windows_rejects() {
        assert_eq!(safe_file_stem("did:plc:abc123"), "did_plc_abc123");
        assert_eq!(safe_file_stem("did:web:example.com"), "did_web_example_com");
        assert_eq!(safe_file_stem("plain-name_1"), "plain-name_1");
    }

    #[test]
    fn cache_avatar_writes_a_did_keyed_avatar() {
        let dir = std::env::temp_dir().join("colibri-avatar-did-test");
        let _ = std::fs::remove_dir_all(&dir);

        let path = cache_avatar(&dir, "did:plc:abc123", b"payload").expect("writes");
        let written = Path::new(&path);
        assert!(written.exists());

        let name = written
            .file_name()
            .and_then(|name| name.to_str())
            .expect("file name");
        assert_eq!(name, "did_plc_abc123.jpg");

        let _ = std::fs::remove_dir_all(&dir);
    }

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
