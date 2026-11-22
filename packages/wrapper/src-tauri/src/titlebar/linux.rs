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
