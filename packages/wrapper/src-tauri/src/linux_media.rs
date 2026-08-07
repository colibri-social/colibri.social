use tauri::WebviewWindow;
use webkit2gtk::glib::prelude::Cast;
use webkit2gtk::{PermissionRequestExt, SettingsExt, UserMediaPermissionRequest, WebViewExt};

pub fn enable_media(window: &WebviewWindow) {
    let result = window.with_webview(|platform| {
        let view = platform.inner();

        if let Some(settings) = WebViewExt::settings(&view) {
            settings.set_enable_webrtc(true);
            settings.set_enable_media_stream(true);
            settings.set_enable_mediasource(true);
            settings.set_enable_encrypted_media(true);

            if std::env::var_os("COLIBRI_DEVTOOLS").is_some() {
                settings.set_enable_developer_extras(true);
            }
        }

        view.connect_permission_request(|_, request| {
            let Some(media) = request.downcast_ref::<UserMediaPermissionRequest>() else {
                return false;
            };
            media.allow();
            true
        });
    });

    if let Err(error) = result {
        eprintln!("could not enable media capture on the webview: {error}");
    }
}
