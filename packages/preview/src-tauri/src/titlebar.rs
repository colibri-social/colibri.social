#[cfg(target_os = "macos")]
mod macos;

#[derive(Debug, Clone, Default, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ButtonLayout {
    pub left: Vec<String>,
    pub right: Vec<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TitlebarInfo {
    pub button_layout: Option<ButtonLayout>,
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

#[cfg(target_os = "linux")]
mod linux {
    use std::path::PathBuf;

    use super::button_layout::{parse_button_layout, DEFAULT_BUTTON_LAYOUT};
    use super::ButtonLayout;

    pub fn read_button_layout() -> ButtonLayout {
        let raw = if running_on_cosmic() {
            cosmic_button_layout()
        } else {
            gnome_button_layout()
        };

        parse_button_layout(&raw)
    }

    fn running_on_cosmic() -> bool {
        std::env::var("XDG_CURRENT_DESKTOP").is_ok_and(|desktops| {
            desktops
                .split(':')
                .any(|desktop| desktop.eq_ignore_ascii_case("cosmic"))
        })
    }

    fn gnome_button_layout() -> String {
        std::process::Command::new("gsettings")
            .args(["get", "org.gnome.desktop.wm.preferences", "button-layout"])
            .output()
            .ok()
            .filter(|output| output.status.success())
            .map(|output| String::from_utf8_lossy(&output.stdout).trim().to_owned())
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| DEFAULT_BUTTON_LAYOUT.to_owned())
    }

    fn cosmic_button_layout() -> String {
        let mut right = Vec::new();
        if cosmic_flag("show_minimize") {
            right.push("minimize");
        }
        if cosmic_flag("show_maximize") {
            right.push("maximize");
        }
        right.push("close");

        format!(":{}", right.join(","))
    }

    fn cosmic_flag(key: &str) -> bool {
        let Some(config_dir) = std::env::var_os("XDG_CONFIG_HOME")
            .map(PathBuf::from)
            .or_else(|| std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".config")))
        else {
            return true;
        };

        std::fs::read_to_string(config_dir.join("cosmic/com.system76.CosmicTk/v1").join(key))
            .map(|value| value.trim() != "false")
            .unwrap_or(true)
    }
}

#[tauri::command]
pub fn titlebar_init() -> TitlebarInfo {
    #[cfg(target_os = "linux")]
    {
        TitlebarInfo {
            button_layout: Some(linux::read_button_layout()),
        }
    }

    #[cfg(not(target_os = "linux"))]
    {
        TitlebarInfo {
            button_layout: None,
        }
    }
}

#[tauri::command]
pub fn titlebar_set_title<R: tauri::Runtime>(
    window: tauri::WebviewWindow<R>,
    title: String,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        macos::set_title(&window, title);
        Ok(())
    }

    #[cfg(not(target_os = "macos"))]
    {
        window.set_title(&title).map_err(|error| error.to_string())
    }
}

#[cfg(desktop)]
pub fn setup<R: tauri::Runtime>(window: &tauri::WebviewWindow<R>) {
    #[cfg(any(target_os = "linux", windows))]
    let _ = window.set_decorations(false);

    #[cfg(target_os = "macos")]
    macos::setup(window);
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
}
