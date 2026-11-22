use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager, Runtime};

pub const BEFORE_EXIT_EVENT: &str = "colibri-before-exit";

const GRACE: Duration = Duration::from_secs(5);

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
    #[cfg(target_os = "macos")]
    if macos::reply_to_pending_terminate() {
        return;
    }
    app.exit(0);
}

#[tauri::command]
pub fn ready_to_exit<R: Runtime>(app: AppHandle<R>) {
    release(&app);
}

#[cfg(target_os = "macos")]
pub use macos::install_terminate_guard;

#[cfg(target_os = "macos")]
mod macos {
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::OnceLock;

    use dispatch2::DispatchQueue;
    use objc2::runtime::{AnyClass, AnyObject, Imp, Sel};
    use objc2::{sel, MainThreadMarker};
    use objc2_app_kit::NSApplication;
    use tauri::AppHandle;

    use super::GRACE;
    use crate::AppRuntime;

    const TERMINATE_NOW: usize = 1;
    const TERMINATE_LATER: usize = 2;
    const SAFETY_MARGIN: std::time::Duration = std::time::Duration::from_secs(2);

    type TerminateHandler = extern "C-unwind" fn(&AnyObject, Sel, *mut AnyObject) -> usize;

    static APP: OnceLock<AppHandle<AppRuntime>> = OnceLock::new();
    static PENDING: AtomicBool = AtomicBool::new(false);

    pub fn install_terminate_guard(app: &AppHandle<AppRuntime>) {
        let _ = APP.set(app.clone());
        let Some(mtm) = MainThreadMarker::new() else {
            return;
        };
        let application = NSApplication::sharedApplication(mtm);
        let Some(delegate) = application.delegate() else {
            return;
        };
        let object: &AnyObject = delegate.as_ref();
        let class = object.class() as *const AnyClass as *mut AnyClass;
        let handler: TerminateHandler = should_terminate;
        let added = unsafe {
            objc2::ffi::class_addMethod(
                class,
                sel!(applicationShouldTerminate:),
                std::mem::transmute::<TerminateHandler, Imp>(handler),
                c"Q@:@".as_ptr(),
            )
        };
        if added.as_bool() {
            application.setDelegate(Some(&delegate));
        }
    }

    pub fn reply_to_pending_terminate() -> bool {
        if !PENDING.swap(false, Ordering::SeqCst) {
            return false;
        }
        DispatchQueue::main().exec_async(|| {
            if let Some(mtm) = MainThreadMarker::new() {
                NSApplication::sharedApplication(mtm).replyToApplicationShouldTerminate(true);
            }
        });
        true
    }

    extern "C-unwind" fn should_terminate(_: &AnyObject, _: Sel, _: *mut AnyObject) -> usize {
        let Some(app) = APP.get() else {
            return TERMINATE_NOW;
        };
        if super::released() {
            return TERMINATE_NOW;
        }
        PENDING.store(true, Ordering::SeqCst);
        super::hold(app);
        std::thread::spawn(|| {
            std::thread::sleep(GRACE + SAFETY_MARGIN);
            reply_to_pending_terminate();
        });
        TERMINATE_LATER
    }
}
