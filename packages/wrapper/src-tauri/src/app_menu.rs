use tauri::menu::{Menu, MenuEvent, MenuItem, MenuItemKind, PredefinedMenuItem};
use tauri::{AppHandle, Emitter, Manager, Runtime};

const SETTINGS_ID: &str = "colibri-open-settings";
const SETTINGS_EVENT: &str = "colibri-open-settings";
const SETTINGS_POSITION: usize = 1;

pub fn build<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let menu = Menu::default(app)?;
    let settings = MenuItem::with_id(app, SETTINGS_ID, "Settings...", true, Some("CmdOrCtrl+,"))?;
    let separator = PredefinedMenuItem::separator(app)?;
    if let Some(MenuItemKind::Submenu(app_menu)) = menu.items()?.into_iter().next() {
        app_menu.insert_items(&[&separator, &settings], SETTINGS_POSITION)?;
    }
    Ok(menu)
}

pub fn handle<R: Runtime>(app: &AppHandle<R>, event: MenuEvent) {
    if event.id() != SETTINGS_ID {
        return;
    }
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
    if let Err(error) = app.emit(SETTINGS_EVENT, ()) {
        eprintln!("opening settings from the menu failed: {error}");
    }
}
