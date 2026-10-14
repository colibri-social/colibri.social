mod titlebar;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![titlebar::titlebar_init])
        .setup(|app| {
            #[cfg(desktop)]
            {
                use tauri::Manager;
                if let Some(window) = app.get_webview_window("main") {
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
