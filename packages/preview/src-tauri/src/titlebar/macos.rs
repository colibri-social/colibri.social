use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use objc2_app_kit::{NSWindow, NSWindowButton};
use objc2_foundation::{NSPoint, NSRect, NSSize, NSString};
use tauri::{Runtime, WebviewWindow, WindowEvent};

const BAR_HEIGHT: f64 = 36.0;
const LEFT_INSET: f64 = 10.0;
const FALLBACK_SPACING: f64 = 20.0;
const FULLSCREEN_EXIT_SETTLE: Duration = Duration::from_millis(80);

const BUTTONS: [NSWindowButton; 3] = [
    NSWindowButton::CloseButton,
    NSWindowButton::MiniaturizeButton,
    NSWindowButton::ZoomButton,
];

fn button_offset(bar_height: f64, button_height: f64) -> f64 {
    ((bar_height - button_height) / 2.0).max(0.0)
}

fn with_ns_window<R: Runtime, T>(
    window: &WebviewWindow<R>,
    f: impl FnOnce(&NSWindow) -> T,
) -> Option<T> {
    let ptr = window.ns_window().ok()? as *mut NSWindow;
    if ptr.is_null() {
        return None;
    }
    Some(f(unsafe { &*ptr }))
}

fn position<R: Runtime>(window: &WebviewWindow<R>) {
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

        let spacing = ns_window
            .standardWindowButton(NSWindowButton::MiniaturizeButton)
            .map(|button| button.frame().origin.x - close.frame().origin.x)
            .filter(|spacing| *spacing > 0.0)
            .unwrap_or(FALLBACK_SPACING);

        let window_height = ns_window.frame().size.height;
        let container_width = container.frame().size.width;
        container.setFrame(NSRect::new(
            NSPoint::new(0.0, window_height - BAR_HEIGHT),
            NSSize::new(container_width, BAR_HEIGHT),
        ));

        for (index, button) in BUTTONS.iter().enumerate() {
            let Some(view) = ns_window.standardWindowButton(*button) else {
                continue;
            };
            let y = button_offset(BAR_HEIGHT, view.frame().size.height);
            view.setFrameOrigin(NSPoint::new(LEFT_INSET + spacing * index as f64, y));
        }
    });
}

fn schedule<R: Runtime>(window: &WebviewWindow<R>) {
    let target = window.clone();
    let _ = window.run_on_main_thread(move || {
        if !target.is_fullscreen().unwrap_or(false) {
            position(&target);
        }
    });
}

pub fn set_title<R: Runtime>(window: &WebviewWindow<R>, title: String) {
    let target = window.clone();
    let _ = window.run_on_main_thread(move || {
        with_ns_window(&target, |ns_window| {
            ns_window.setTitle(&NSString::from_str(&title));
        });
        if !target.is_fullscreen().unwrap_or(false) {
            position(&target);
        }
    });
}

pub fn setup<R: Runtime>(window: &WebviewWindow<R>) {
    schedule(window);

    let was_fullscreen = Arc::new(AtomicBool::new(window.is_fullscreen().unwrap_or(false)));
    let listener = window.clone();
    window.on_window_event(move |event| match event {
        WindowEvent::Resized(_)
        | WindowEvent::Moved(_)
        | WindowEvent::Focused(_)
        | WindowEvent::ThemeChanged(_)
        | WindowEvent::ScaleFactorChanged { .. } => {
            let fullscreen = listener.is_fullscreen().unwrap_or(false);
            let left_fullscreen = was_fullscreen.swap(fullscreen, Ordering::Relaxed) && !fullscreen;
            if fullscreen {
                return;
            }

            schedule(&listener);

            if left_fullscreen {
                let trailing = listener.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(FULLSCREEN_EXIT_SETTLE);
                    schedule(&trailing);
                });
            }
        }
        _ => {}
    });
}

#[cfg(test)]
mod tests {
    use super::{button_offset, BAR_HEIGHT};

    #[test]
    fn buttons_share_the_bar_center() {
        assert_eq!(button_offset(BAR_HEIGHT, 16.0) + 8.0, BAR_HEIGHT / 2.0);
        assert_eq!(button_offset(BAR_HEIGHT, 14.0) + 7.0, BAR_HEIGHT / 2.0);
    }

    #[test]
    fn a_button_taller_than_the_bar_stays_on_screen() {
        assert_eq!(button_offset(BAR_HEIGHT, 40.0), 0.0);
    }
}
