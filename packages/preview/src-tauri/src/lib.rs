#[cfg(target_os = "macos")]
mod macos_media;
mod native_error;
mod save_image;
#[cfg(any(target_os = "android", test))]
mod received_files;
mod titlebar;
mod web_auth;

#[cfg(any(target_os = "linux", windows))]
const DEEP_LINK_SCHEMES: [&str; 2] = ["social.colibri:", "social.colibri.spaces:"];

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        use tauri::Manager;
        builder = builder
            .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }

                #[cfg(any(target_os = "linux", windows))]
                if argv.len() != 2 {
                    use tauri_plugin_deep_link::DeepLinkExt;
                    if let Some(url) = argv.iter().find(|arg| {
                        DEEP_LINK_SCHEMES
                            .iter()
                            .any(|scheme| arg.starts_with(scheme))
                    }) {
                        app.deep_link()
                            .handle_cli_arguments([String::new(), url.clone()].into_iter());
                    }
                }

                #[cfg(not(any(target_os = "linux", windows)))]
                let _ = argv;
            }))
            .plugin(
                tauri_plugin_window_state::Builder::default()
                    .with_state_flags(
                        tauri_plugin_window_state::StateFlags::all()
                            - tauri_plugin_window_state::StateFlags::DECORATIONS,
                    )
                    .build(),
            )
            .plugin(tauri_plugin_dialog::init());
    }

    #[cfg(target_os = "android")]
    {
        builder = builder.register_asynchronous_uri_scheme_protocol(
            received_files::SCHEME,
            received_files::serve,
        );
    }

    builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            web_auth::start_web_auth,
            save_image::save_image,
            titlebar::titlebar_init,
            titlebar::titlebar_set_title
        ])
        .setup(|app| {
            #[cfg(any(target_os = "linux", windows))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                if let Err(error) = app.deep_link().register_all() {
                    eprintln!("deep-link scheme registration failed: {error}");
                }
            }

            #[cfg(desktop)]
            {
                use tauri::Manager;
                if let Some(window) = app.get_webview_window("main") {
                    #[cfg(target_os = "macos")]
                    macos_media::enable_media(&window);

                    titlebar::setup(&window);
                }
            }

            #[cfg(mobile)]
            let _ = app;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Colibri Preview");
}
