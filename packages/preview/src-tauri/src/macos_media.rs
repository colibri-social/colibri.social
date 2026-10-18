use objc2::runtime::NSObjectProtocol;
use objc2::sel;
use objc2_web_kit::WKWebView;
use tauri::WebviewWindow;

pub fn enable_media(window: &WebviewWindow) {
    let result = window.with_webview(|platform| {
        let ptr = platform.inner() as *mut WKWebView;
        if ptr.is_null() {
            return;
        }

        let webview: &WKWebView = unsafe { &*ptr };
        let preferences = unsafe { webview.configuration().preferences() };

        if preferences.respondsToSelector(sel!(setElementFullscreenEnabled:)) {
            unsafe { preferences.setElementFullscreenEnabled(true) };
        } else {
            eprintln!(
                "this macOS predates the WKWebView fullscreen API, video fullscreen stays off"
            );
        }
    });

    if let Err(error) = result {
        eprintln!("could not configure the macOS webview: {error}");
    }
}
