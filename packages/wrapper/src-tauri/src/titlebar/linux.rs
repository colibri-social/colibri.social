use super::button_layout::{parse_button_layout, DEFAULT_BUTTON_LAYOUT};
use super::ButtonLayout;

pub fn read_button_layout() -> ButtonLayout {
    let raw = std::process::Command::new("gsettings")
        .args(["get", "org.gnome.desktop.wm.preferences", "button-layout"])
        .output()
        .ok()
        .filter(|output| output.status.success())
        .map(|output| String::from_utf8_lossy(&output.stdout).trim().to_owned())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| DEFAULT_BUTTON_LAYOUT.to_owned());

    parse_button_layout(&raw)
}
