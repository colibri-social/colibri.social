use tauri::Manager;

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

    Some(sentry::init((
        dsn,
        sentry::ClientOptions {
            release: sentry::release_name!(),
            ..Default::default()
        },
    )))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(feature = "sentry")]
    let _sentry = init_sentry();

    let mut builder = tauri::Builder::default();

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
                    if let Some(url) = _argv.iter().find(|arg| {
                        arg.starts_with("social.colibri:")
                            || arg.starts_with("social.colibri.next:")
                    }) {
                        app.deep_link()
                            .handle_cli_arguments([String::new(), url.clone()].into_iter());
                    }
                }
            }))
            .plugin(tauri_plugin_window_state::Builder::default().build());

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
        .setup(|app| {
            // On Linux and Windows deep-link schemes aren't registered by an
            // installer during development, so register them at runtime.
            #[cfg(any(target_os = "linux", windows))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                let _ = app.deep_link().register_all();
            }
            #[cfg(not(any(target_os = "linux", windows)))]
            let _ = app;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
