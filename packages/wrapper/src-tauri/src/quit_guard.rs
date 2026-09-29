use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager, Runtime};

pub const BEFORE_EXIT_EVENT: &str = "colibri-before-exit";

const GRACE: Duration = Duration::from_secs(2);

static HOLDING: AtomicBool = AtomicBool::new(false);
static RELEASED: AtomicBool = AtomicBool::new(false);

pub fn released() -> bool {
    RELEASED.load(Ordering::SeqCst)
}

pub fn hold<R: Runtime>(app: &AppHandle<R>) {
    if HOLDING.swap(true, Ordering::SeqCst) {
        return;
    }

    let Some(window) = app.get_webview_window("main") else {
        release(app);
        return;
    };

    if window.emit(BEFORE_EXIT_EVENT, ()).is_err() {
        release(app);
        return;
    }

    let handle = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(GRACE);
        release(&handle);
    });
}

pub fn release<R: Runtime>(app: &AppHandle<R>) {
    if RELEASED.swap(true, Ordering::SeqCst) {
        return;
    }
    app.exit(0);
}

#[tauri::command]
pub fn ready_to_exit<R: Runtime>(app: AppHandle<R>) {
    release(&app);
}
