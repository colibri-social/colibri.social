use std::sync::Mutex;

use objc2_app_kit::{NSWindow, NSWindowButton, NSWindowTitleVisibility};
use objc2_foundation::{NSPoint, NSRect, NSSize, NSString};
use tauri::{Manager, WebviewWindow};

use crate::native_error::NativeError;

const BAR_HEIGHT: f64 = 36.0;
const LEFT_INSET: f64 = 10.0;

const BUTTONS: [NSWindowButton; 3] = [
    NSWindowButton::CloseButton,
    NSWindowButton::MiniaturizeButton,
    NSWindowButton::ZoomButton,
];

#[derive(Debug, Clone, Copy)]
struct Snapshot {
    container: NSRect,
    origins: [NSPoint; 3],
}

#[derive(Default)]
struct MacTitlebar {
    snapshot: Mutex<Option<Snapshot>>,
    was_fullscreen: Mutex<bool>,
}

fn state(window: &WebviewWindow) -> tauri::State<'_, MacTitlebar> {
    let app = window.app_handle();
    if app.try_state::<MacTitlebar>().is_none() {
        app.manage(MacTitlebar::default());
    }
    app.state::<MacTitlebar>()
}

fn with_ns_window<T>(window: &WebviewWindow, f: impl FnOnce(&NSWindow) -> T) -> Option<T> {
    let ptr = window.ns_window().ok()? as *mut NSWindow;
    if ptr.is_null() {
        return None;
    }
    Some(f(unsafe { &*ptr }))
}

fn capture(window: &WebviewWindow) {
    let mac = state(window);
    let Ok(mut slot) = mac.snapshot.lock() else {
        return;
    };
    if slot.is_some() {
        return;
    }

    *slot = with_ns_window(window, |ns_window| {
        let close = ns_window.standardWindowButton(NSWindowButton::CloseButton)?;
        let titlebar = unsafe { close.superview() }?;
        let container = unsafe { titlebar.superview() }?;

        let mut origins = [NSPoint::new(0.0, 0.0); 3];
        for (index, button) in BUTTONS.iter().enumerate() {
            let view = ns_window.standardWindowButton(*button)?;
            origins[index] = view.frame().origin;
        }

        Some(Snapshot {
            container: container.frame(),
            origins,
        })
    })
    .flatten();
}

fn position(window: &WebviewWindow) {
    with_ns_window(window, |ns_window| {
        let Some(close) = ns_window.standardWindowButton(NSWindowButton::CloseButton) else {
            return;
        };
        let Some(titlebar) = (unsafe { close.superview() }) else {
            return;
        };
        let Some(container) = (unsafe { titlebar.superview() }) else {
            return;
        };

        let button_height = close.frame().size.height;
        let spacing = ns_window
            .standardWindowButton(NSWindowButton::MiniaturizeButton)
            .map(|m| m.frame().origin.x - close.frame().origin.x)
            .filter(|s| *s > 0.0)
            .unwrap_or(20.0);

        let window_height = ns_window.frame().size.height;
        let container_width = container.frame().size.width;
        container.setFrame(NSRect::new(
            NSPoint::new(0.0, window_height - BAR_HEIGHT),
            NSSize::new(container_width, BAR_HEIGHT),
        ));

        let y = ((BAR_HEIGHT - button_height) / 2.0).max(0.0);
        for (index, button) in BUTTONS.iter().enumerate() {
            let Some(view) = ns_window.standardWindowButton(*button) else {
                continue;
            };
            view.setFrameOrigin(NSPoint::new(LEFT_INSET + spacing * index as f64, y));
        }
    });
}

fn restore(window: &WebviewWindow) {
    let mac = state(window);
    let Ok(slot) = mac.snapshot.lock() else {
        return;
    };
    let Some(snapshot) = *slot else {
        return;
    };

    with_ns_window(window, |ns_window| {
        if let Some(close) = ns_window.standardWindowButton(NSWindowButton::CloseButton) {
            if let Some(titlebar) = unsafe { close.superview() } {
                if let Some(container) = unsafe { titlebar.superview() } {
                    container.setFrame(snapshot.container);
                }
            }
        }

        for (index, button) in BUTTONS.iter().enumerate() {
            if let Some(view) = ns_window.standardWindowButton(*button) {
                view.setFrameOrigin(snapshot.origins[index]);
            }
        }
    });
}

pub fn title_bar_visible(window: &WebviewWindow) -> bool {
    with_ns_window(window, |ns_window| {
        ns_window.titleVisibility() == NSWindowTitleVisibility::Visible
    })
    .unwrap_or(false)
}

fn set_title_visible(window: &WebviewWindow, visible: bool) {
    with_ns_window(window, |ns_window| {
        ns_window.setTitleVisibility(if visible {
            NSWindowTitleVisibility::Visible
        } else {
            NSWindowTitleVisibility::Hidden
        });
    });
}

pub fn set_title(window: &WebviewWindow, title: String) {
    let target = window.clone();
    let _ = window.run_on_main_thread(move || {
        with_ns_window(&target, |ns_window| {
            ns_window.setTitle(&NSString::from_str(&title));
        });

        if !title_bar_visible(&target) && !target.is_fullscreen().unwrap_or(false) {
            position(&target);
        }
    });
}

pub fn setup(window: &WebviewWindow) {
    let target = window.clone();
    let _ = window.run_on_main_thread(move || {
        capture(&target);
        position(&target);
    });
}

pub fn reapply(window: &WebviewWindow) {
    if title_bar_visible(window) {
        return;
    }

    let fullscreen = window.is_fullscreen().unwrap_or(false);
    let mac = state(window);
    let left_fullscreen = match mac.was_fullscreen.lock() {
        Ok(mut was) => {
            let left = *was && !fullscreen;
            *was = fullscreen;
            left
        }
        Err(_) => false,
    };

    if fullscreen {
        return;
    }

    let target = window.clone();
    let _ = window.run_on_main_thread(move || position(&target));

    if left_fullscreen {
        let trailing = window.clone();
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(80));
            let inner = trailing.clone();
            let _ = trailing.run_on_main_thread(move || position(&inner));
        });
    }
}

pub fn set_native_decorations(
    window: &WebviewWindow,
    enabled: bool,
) -> Result<(), NativeError> {
    window
        .set_title_bar_style(if enabled {
            tauri::TitleBarStyle::Visible
        } else {
            tauri::TitleBarStyle::Overlay
        })
        .map_err(|e| NativeError::failed(e.to_string()))?;

    let target = window.clone();
    window
        .run_on_main_thread(move || {
            set_title_visible(&target, enabled);
            if enabled {
                restore(&target);
            } else {
                capture(&target);
                position(&target);
            }
        })
        .map_err(|e| NativeError::failed(e.to_string()))
}
