use tauri::{
  plugin::{Builder, TauriPlugin},
  Runtime,
};

#[cfg(target_os = "ios")]
use tauri::{
  plugin::{mobile::PluginInvokeError, PluginHandle},
  Manager,
};

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_keyboard_inset);

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_save_file);

#[derive(Debug, serde::Serialize)]
pub struct SaveRequest {
  pub path: String,
  pub name: String,
  pub r#type: String,
}

#[derive(Debug, serde::Deserialize)]
pub struct SavedToDevice {
  pub name: String,
  pub destination: Option<String>,
}

#[cfg(target_os = "ios")]
pub struct SaveFile<R: Runtime>(PluginHandle<R>);

#[cfg(target_os = "ios")]
impl<R: Runtime> SaveFile<R> {
  pub async fn save(&self, request: SaveRequest) -> Result<SavedToDevice, PluginInvokeError> {
    self.0.run_mobile_plugin_async("saveFile", request).await
  }
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
  Builder::new("keyboard-inset")
    .setup(|_app, api| {
      #[cfg(target_os = "ios")]
      api.register_ios_plugin(init_plugin_keyboard_inset)?;
      Ok(())
    })
    .build()
}

pub fn init_save_file<R: Runtime>() -> TauriPlugin<R> {
  Builder::new("save-file")
    .setup(|_app, _api| {
      #[cfg(target_os = "ios")]
      {
        let handle = _api.register_ios_plugin(init_plugin_save_file)?;
        _app.manage(SaveFile(handle));
      }
      Ok(())
    })
    .build()
}
