use tauri::Manager;

#[cfg(target_os = "linux")]
mod linux_media;
#[cfg(desktop)]
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
mod screen_capture;
#[cfg(desktop)]
mod titlebar;

pub mod native_error {
    #[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
    pub enum NativeErrorCode {
        Cancelled,
        Unsupported,
        InvalidRequest,
        Failed,
    }

    #[derive(Debug, serde::Serialize)]
    pub struct NativeError {
        pub code: NativeErrorCode,
        pub message: String,
    }

    impl NativeError {
        pub fn new(code: NativeErrorCode, message: impl Into<String>) -> Self {
            Self {
                code,
                message: message.into(),
            }
        }

        pub fn cancelled() -> Self {
            Self::new(NativeErrorCode::Cancelled, "the sign-in window was closed")
        }

        pub fn unsupported() -> Self {
            Self::new(
                NativeErrorCode::Unsupported,
                "native web authentication is not available on this platform",
            )
        }

        pub fn invalid_request(message: impl Into<String>) -> Self {
            Self::new(NativeErrorCode::InvalidRequest, message)
        }

        pub fn failed(message: impl Into<String>) -> Self {
            Self::new(NativeErrorCode::Failed, message)
        }

        pub fn from_platform_message(message: &str) -> Self {
            match message {
                "canceled" => Self::cancelled(),
                "invalid authorization url" => Self::invalid_request(message),
                _ => Self::failed(message),
            }
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn a_closed_window_is_cancelled_rather_than_a_failure() {
            assert_eq!(
                NativeError::from_platform_message("canceled").code,
                NativeErrorCode::Cancelled
            );
        }

        #[test]
        fn a_bad_url_is_the_callers_mistake() {
            assert_eq!(
                NativeError::from_platform_message("invalid authorization url").code,
                NativeErrorCode::InvalidRequest
            );
        }

        #[test]
        fn anything_else_is_a_failure() {
            assert_eq!(
                NativeError::from_platform_message("authentication failed").code,
                NativeErrorCode::Failed
            );
        }

        #[test]
        fn the_code_serializes_as_its_name() {
            let json = serde_json::to_string(&NativeError::cancelled()).expect("serializes");
            assert!(json.contains("\"code\":\"Cancelled\""), "{json}");
        }
    }
}

#[cfg(any(target_os = "macos", target_os = "ios"))]
mod web_auth {
    use std::ffi::{c_char, c_void, CStr, CString};
    use std::sync::mpsc;

    use crate::native_error::NativeError;

    type WebAuthCallback = extern "C" fn(*const c_char, *const c_char, *mut c_void);

    unsafe extern "C" {
        fn colibri_start_web_auth(
            url: *const c_char,
            scheme: *const c_char,
            callback: WebAuthCallback,
            ctx: *mut c_void,
        );
    }

    extern "C" fn on_web_auth_done(url: *const c_char, error: *const c_char, ctx: *mut c_void) {
        let sender = unsafe { Box::from_raw(ctx as *mut mpsc::Sender<Result<String, String>>) };
        let result = if url.is_null() {
            Err(if error.is_null() {
                "authentication failed".to_string()
            } else {
                unsafe { CStr::from_ptr(error) }
                    .to_string_lossy()
                    .into_owned()
            })
        } else {
            Ok(unsafe { CStr::from_ptr(url) }
                .to_string_lossy()
                .into_owned())
        };
        let _ = sender.send(result);
    }

    #[tauri::command]
    pub async fn start_web_auth(url: String, scheme: String) -> Result<String, NativeError> {
        let c_url = CString::new(url).map_err(|e| NativeError::invalid_request(e.to_string()))?;
        let c_scheme =
            CString::new(scheme).map_err(|e| NativeError::invalid_request(e.to_string()))?;
        let (tx, rx) = mpsc::channel::<Result<String, String>>();
        let ctx = Box::into_raw(Box::new(tx)) as *mut c_void;
        unsafe { colibri_start_web_auth(c_url.as_ptr(), c_scheme.as_ptr(), on_web_auth_done, ctx) };
        let outcome = tauri::async_runtime::spawn_blocking(move || {
            rx.recv().unwrap_or(Err("canceled".to_string()))
        })
        .await
        .map_err(|e| NativeError::failed(e.to_string()))?;

        outcome.map_err(|message| NativeError::from_platform_message(&message))
    }
}

#[cfg(not(any(target_os = "macos", target_os = "ios")))]
mod web_auth {
    use crate::native_error::NativeError;

    #[tauri::command]
    pub async fn start_web_auth(_url: String, _scheme: String) -> Result<String, NativeError> {
        Err(NativeError::unsupported())
    }
}

/// Initialize the native Sentry client. The DSN is read at runtime from
/// `SENTRY_DSN`, falling back to a value baked in at build time. When neither
/// is set, the guard is `None` and no events are sent. The returned guard must
/// be held for the lifetime of the process, so it lives in `run`.
///
/// Compiled out entirely when the `sentry` feature is disabled.
#[cfg(feature = "sentry")]
fn init_sentry() -> Option<sentry::ClientInitGuard> {
    let dsn = std::env::var("SENTRY_DSN")
        .ok()
        .or_else(|| option_env!("SENTRY_DSN").map(str::to_owned))?;

    let environment = if cfg!(debug_assertions) {
        "development"
    } else {
        "production"
    };

    Some(sentry::init((
        dsn,
        sentry::ClientOptions {
            release: sentry::release_name!(),
            environment: Some(environment.into()),
            ..Default::default()
        },
    )))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(feature = "sentry")]
    let _sentry = init_sentry();

    let mut builder = tauri::Builder::default();

    #[cfg(target_os = "ios")]
    {
        builder = builder
            .plugin(tauri_plugin_ios_webview_insets::init())
            .plugin(tauri_plugin_keyboard_inset::init());
    }

    // The single-instance plugin must be the first one registered. With the
    // `deep-link` feature it also forwards deep links opened while the app is
    // already running to the deep-link plugin.
    #[cfg(desktop)]
    {
        builder = builder
            .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }

                #[cfg(any(target_os = "linux", windows))]
                if _argv.len() != 2 {
                    use tauri_plugin_deep_link::DeepLinkExt;
                    if let Some(url) = _argv.iter().find(|arg| arg.starts_with("social.colibri:")) {
                        app.deep_link()
                            .handle_cli_arguments([String::new(), url.clone()].into_iter());
                    }
                }
            }))
            .plugin(
                tauri_plugin_window_state::Builder::default()
                    .with_state_flags(
                        tauri_plugin_window_state::StateFlags::all()
                            - tauri_plugin_window_state::StateFlags::DECORATIONS,
                    )
                    .build(),
            )
            .plugin(tauri_plugin_dialog::init())
            .manage(titlebar::Titlebar::default())
            .manage(screen_capture::CaptureState::default());

        #[cfg(feature = "updater")]
        {
            builder = builder
                .plugin(tauri_plugin_updater::Builder::new().build())
                .plugin(tauri_plugin_process::init())
                .plugin(tauri_plugin_fs::init());
        }
    }

    #[cfg(target_os = "android")]
    {
        builder = builder.plugin(tauri_plugin_fcm::init());
    }

    builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_os::init())
        .invoke_handler(tauri::generate_handler![
            web_auth::start_web_auth,
            #[cfg(desktop)]
            titlebar::titlebar_init,
            #[cfg(desktop)]
            titlebar::titlebar_set_snap_rect,
            #[cfg(desktop)]
            titlebar::titlebar_clear_snap_rect,
            #[cfg(desktop)]
            titlebar::titlebar_set_title,
            #[cfg(desktop)]
            titlebar::titlebar_show_system_menu,
            #[cfg(desktop)]
            titlebar::titlebar_set_native_decorations,
            #[cfg(desktop)]
            screen_capture::screen_capture_supported,
            #[cfg(desktop)]
            screen_capture::screen_capture_list_sources,
            #[cfg(desktop)]
            screen_capture::screen_capture_start,
            #[cfg(desktop)]
            screen_capture::screen_capture_stop,
            #[cfg(desktop)]
            screen_capture::screen_capture_permission,
            #[cfg(desktop)]
            screen_capture::screen_capture_open_settings
        ])
        .register_uri_scheme_protocol("emoji", |ctx, request| {
            let not_found = || {
                tauri::http::Response::builder()
                    .status(404)
                    .body(Vec::new())
                    .unwrap()
            };
            let rel = request.uri().path().trim_start_matches('/').to_string();
            if rel.contains("..") {
                return not_found();
            }
            let Ok(dir) = ctx.app_handle().path().resource_dir() else {
                return not_found();
            };
            let candidates = [
                dir.join("twemoji").join(&rel),
                dir.join("assets").join("twemoji").join(&rel),
            ];
            for path in candidates {
                if let Ok(bytes) = std::fs::read(&path) {
                    return tauri::http::Response::builder()
                        .header("Content-Type", "image/png")
                        .header("Access-Control-Allow-Origin", "*")
                        .body(bytes)
                        .unwrap();
                }
            }
            not_found()
        })
        .register_uri_scheme_protocol("capture-thumb", |ctx, request| {
            let not_found = || {
                tauri::http::Response::builder()
                    .status(404)
                    .body(Vec::new())
                    .unwrap()
            };

            #[cfg(desktop)]
            {
                use tauri::Manager as _;
                let id = request.uri().path().trim_start_matches('/').to_string();
                let state = ctx.app_handle().state::<screen_capture::CaptureState>();
                if let Some(bytes) = state.thumbnail(&id) {
                    return tauri::http::Response::builder()
                        .header("Content-Type", "image/png")
                        .header("Cache-Control", "no-store")
                        .header("Access-Control-Allow-Origin", "*")
                        .body(bytes)
                        .unwrap();
                }
            }

            #[cfg(not(desktop))]
            let _ = (ctx, request);

            not_found()
        })
        .setup(|app| {
            // On Linux and Windows deep-link schemes aren't registered by an
            // installer during development, so register them at runtime.
            #[cfg(any(target_os = "linux", windows))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                if let Err(error) = app.deep_link().register_all() {
                    eprintln!("deep-link scheme registration failed: {error}");
                }
            }
            #[cfg(desktop)]
            if let Some(window) = app.get_webview_window("main") {
                titlebar::setup(&window);

                #[cfg(target_os = "linux")]
                linux_media::enable_media(&window);
            }

            #[cfg(not(any(target_os = "linux", windows, desktop)))]
            let _ = app;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
