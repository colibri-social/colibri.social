use std::sync::Mutex;

use tauri::{Emitter, Manager, WebviewWindow, WindowEvent};

use crate::native_error::NativeError;

#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "macos")]
mod macos;
#[cfg(windows)]
mod windows;

pub const STATE_EVENT: &str = "colibri-titlebar-state";
#[cfg(windows)]
pub const CONTROLS_EVENT: &str = "colibri-titlebar-controls";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TitlebarState {
    pub fullscreen: bool,
    pub maximized: bool,
    pub focused: bool,
    pub native_decorations: bool,
}

#[derive(Debug, Clone, Default, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ButtonLayout {
    pub left: Vec<String>,
    pub right: Vec<String>,
}

#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
mod button_layout {
    use super::ButtonLayout;

    pub const DEFAULT_BUTTON_LAYOUT: &str = "appmenu:minimize,maximize,close";

    const RENDERED_BUTTONS: [&str; 3] = ["minimize", "maximize", "close"];

    fn layout_side(raw: &str) -> Vec<String> {
        raw.split(',')
            .map(str::trim)
            .filter(|token| RENDERED_BUTTONS.contains(token))
            .map(str::to_owned)
            .collect()
    }

    pub fn parse_button_layout(raw: &str) -> ButtonLayout {
        let trimmed = raw.trim().trim_matches('\'').trim_matches('"');
        let source = if trimmed.is_empty() {
            DEFAULT_BUTTON_LAYOUT
        } else {
            trimmed
        };

        match source.split_once(':') {
            Some((left, right)) => ButtonLayout {
                left: layout_side(left),
                right: layout_side(right),
            },
            None => ButtonLayout {
                left: Vec::new(),
                right: layout_side(source),
            },
        }
    }
}


#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TitlebarInfo {
    pub state: TitlebarState,
    pub button_layout: Option<ButtonLayout>,
}

#[derive(Default)]
pub struct Titlebar {
    state: Mutex<TitlebarState>,
    button_layout: Mutex<Option<ButtonLayout>>,
}

fn read_state(window: &WebviewWindow) -> TitlebarState {
    TitlebarState {
        fullscreen: window.is_fullscreen().unwrap_or(false),
        maximized: window.is_maximized().unwrap_or(false),
        focused: window.is_focused().unwrap_or(false),
        native_decorations: native_decorations_enabled(window),
    }
}

#[cfg(target_os = "macos")]
fn native_decorations_enabled(window: &WebviewWindow) -> bool {
    macos::title_bar_visible(window)
}

#[cfg(not(target_os = "macos"))]
fn native_decorations_enabled(window: &WebviewWindow) -> bool {
    window.is_decorated().unwrap_or(true)
}

fn broadcast(window: &WebviewWindow) {
    let next = read_state(window);
    let Some(titlebar) = window.app_handle().try_state::<Titlebar>() else {
        return;
    };

    {
        let Ok(mut current) = titlebar.state.lock() else {
            return;
        };
        if *current == next {
            return;
        }
        *current = next;
    }

    let _ = window.emit(STATE_EVENT, next);
}

#[tauri::command]
pub async fn titlebar_init(window: WebviewWindow) -> Result<TitlebarInfo, NativeError> {
    let state = read_state(&window);

    if let Some(titlebar) = window.app_handle().try_state::<Titlebar>() {
        if let Ok(mut current) = titlebar.state.lock() {
            *current = state;
        }
    }

    let button_layout = window
        .app_handle()
        .try_state::<Titlebar>()
        .and_then(|titlebar| titlebar.button_layout.lock().ok().and_then(|l| l.clone()));

    Ok(TitlebarInfo {
        state,
        button_layout,
    })
}

#[tauri::command]
pub async fn titlebar_set_snap_rect(
    window: WebviewWindow,
    x: i32,
    y: i32,
    width: i32,
    height: i32,
) -> Result<(), NativeError> {
    #[cfg(windows)]
    {
        return windows::set_snap_rect(&window, x, y, width, height);
    }

    #[cfg(not(windows))]
    {
        let _ = (window, x, y, width, height);
        Ok(())
    }
}

#[tauri::command]
pub async fn titlebar_clear_snap_rect(window: WebviewWindow) -> Result<(), NativeError> {
    #[cfg(windows)]
    {
        return windows::clear_snap_rect(&window);
    }

    #[cfg(not(windows))]
    {
        let _ = window;
        Ok(())
    }
}

#[tauri::command]
pub async fn titlebar_set_title(
    window: WebviewWindow,
    title: String,
) -> Result<(), NativeError> {
    #[cfg(target_os = "macos")]
    {
        macos::set_title(&window, title);
        Ok(())
    }

    #[cfg(not(target_os = "macos"))]
    {
        window
            .set_title(&title)
            .map_err(|e| NativeError::failed(e.to_string()))
    }
}

#[tauri::command]
pub async fn titlebar_show_system_menu(window: WebviewWindow) -> Result<(), NativeError> {
    #[cfg(windows)]
    {
        return windows::show_system_menu(&window);
    }

    #[cfg(not(windows))]
    {
        let _ = window;
        Err(NativeError::unsupported())
    }
}

#[tauri::command]
pub async fn titlebar_set_native_decorations(
    window: WebviewWindow,
    enabled: bool,
) -> Result<TitlebarState, NativeError> {
    #[cfg(target_os = "macos")]
    macos::set_native_decorations(&window, enabled)?;

    #[cfg(any(target_os = "linux", windows))]
    window
        .set_decorations(enabled)
        .map_err(|e| NativeError::failed(e.to_string()))?;

    #[cfg(windows)]
    if enabled {
        windows::clear_snap_rect(&window)?;
    }

    let next = read_state(&window);

    if let Some(titlebar) = window.app_handle().try_state::<Titlebar>() {
        if let Ok(mut current) = titlebar.state.lock() {
            *current = next;
        }
    }

    let _ = window.emit(STATE_EVENT, next);

    Ok(next)
}

pub fn setup(window: &WebviewWindow) {
    #[cfg(any(target_os = "linux", windows))]
    let _ = window.set_decorations(false);

    #[cfg(target_os = "macos")]
    macos::setup(window);

    #[cfg(target_os = "linux")]
    if let Some(titlebar) = window.app_handle().try_state::<Titlebar>() {
        if let Ok(mut layout) = titlebar.button_layout.lock() {
            *layout = Some(linux::read_button_layout());
        }
    }

    if let Some(titlebar) = window.app_handle().try_state::<Titlebar>() {
        if let Ok(mut current) = titlebar.state.lock() {
            *current = read_state(window);
        }
    }

    let listener = window.clone();
    window.on_window_event(move |event| match event {
        WindowEvent::Resized(_)
        | WindowEvent::Moved(_)
        | WindowEvent::Focused(_)
        | WindowEvent::ThemeChanged(_) => {
            #[cfg(target_os = "macos")]
            macos::reapply(&listener);

            #[cfg(windows)]
            if listener.is_fullscreen().unwrap_or(false) {
                let _ = windows::clear_snap_rect(&listener);
            }

            broadcast(&listener);
        }
        _ => {}
    });
}

#[cfg(test)]
mod tests {
    use super::button_layout::parse_button_layout;

    #[test]
    fn the_gnome_default_puts_every_button_on_the_right() {
        let layout = parse_button_layout("'appmenu:minimize,maximize,close'");
        assert!(layout.left.is_empty());
        assert_eq!(layout.right, ["minimize", "maximize", "close"]);
    }

    #[test]
    fn upstream_gnome_renders_close_alone() {
        let layout = parse_button_layout("appmenu:close");
        assert!(layout.left.is_empty());
        assert_eq!(layout.right, ["close"]);
    }

    #[test]
    fn buttons_can_live_on_the_left() {
        let layout = parse_button_layout("close,minimize,maximize:");
        assert_eq!(layout.left, ["close", "minimize", "maximize"]);
        assert!(layout.right.is_empty());
    }

    #[test]
    fn tokens_we_do_not_render_are_dropped() {
        let layout = parse_button_layout("icon,menu:spacer,minimize,close");
        assert!(layout.left.is_empty());
        assert_eq!(layout.right, ["minimize", "close"]);
    }

    #[test]
    fn an_empty_value_falls_back_to_the_default() {
        let layout = parse_button_layout("");
        assert_eq!(layout.right, ["minimize", "maximize", "close"]);
    }

    #[test]
    fn garbage_yields_no_buttons_rather_than_a_panic() {
        let layout = parse_button_layout("not a layout at all");
        assert!(layout.left.is_empty());
        assert!(layout.right.is_empty());
    }
}
