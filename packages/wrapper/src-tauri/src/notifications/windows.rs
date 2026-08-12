use std::path::Path;
use std::sync::OnceLock;

use tauri_winrt_notification::{IconCrop, Sound, Toast};
use windows::core::PCWSTR;
use windows::Win32::Foundation::ERROR_SUCCESS;
use windows::Win32::System::Registry::{
    RegCloseKey, RegCreateKeyExW, RegOpenCurrentUser, RegSetValueExW, HKEY, KEY_WRITE,
    REG_OPTION_NON_VOLATILE, REG_SZ,
};

use super::{Activation, NotificationPayload};
use crate::native_error::NativeError;

type ActivationHandler = Box<dyn Fn(Activation) + Send + Sync>;

static HANDLER: OnceLock<ActivationHandler> = OnceLock::new();
static APP_ID: OnceLock<String> = OnceLock::new();

fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}

fn set_registry_string(key: HKEY, value_name: &str, value: &str) -> Result<(), u32> {
    let name = wide(value_name);
    let data = wide(value);
    let bytes = unsafe {
        std::slice::from_raw_parts(
            data.as_ptr().cast::<u8>(),
            std::mem::size_of_val(data.as_slice()),
        )
    };

    let status = unsafe { RegSetValueExW(key, PCWSTR(name.as_ptr()), None, REG_SZ, Some(bytes)) };

    if status == ERROR_SUCCESS {
        Ok(())
    } else {
        Err(status.0)
    }
}

fn register_app_id(app_id: &str, display_name: &str, icon_path: Option<&str>) -> Result<(), u32> {
    let mut user = HKEY::default();
    let status = unsafe { RegOpenCurrentUser(KEY_WRITE.0, &mut user) };
    if status != ERROR_SUCCESS {
        return Err(status.0);
    }

    let subkey = wide(&format!("Software\\Classes\\AppUserModelId\\{app_id}"));
    let mut key = HKEY::default();
    let status = unsafe {
        RegCreateKeyExW(
            user,
            PCWSTR(subkey.as_ptr()),
            None,
            PCWSTR::null(),
            REG_OPTION_NON_VOLATILE,
            KEY_WRITE,
            None,
            &mut key,
            None,
        )
    };

    if status != ERROR_SUCCESS {
        unsafe {
            let _ = RegCloseKey(user);
        }
        return Err(status.0);
    }

    let result = set_registry_string(key, "DisplayName", display_name).and_then(|()| {
        match icon_path {
            Some(icon_path) => set_registry_string(key, "IconUri", icon_path),
            None => Ok(()),
        }
    });

    unsafe {
        let _ = RegCloseKey(key);
        let _ = RegCloseKey(user);
    }

    result
}

pub fn install_activation_handler(
    app_id: String,
    display_name: String,
    icon_path: Option<String>,
    handler: ActivationHandler,
) {
    if let Err(code) = register_app_id(&app_id, &display_name, icon_path.as_deref()) {
        eprintln!("notification app id registration failed: {code}");
    }

    let _ = APP_ID.set(app_id);
    let _ = HANDLER.set(handler);
}

pub fn supported() -> bool {
    APP_ID.get().is_some()
}

pub fn notify(payload: NotificationPayload) -> Result<(), NativeError> {
    let Some(app_id) = APP_ID.get() else {
        return Err(NativeError::unsupported());
    };

    let mut toast = Toast::new(app_id).title(&payload.title);

    toast = match payload.subtitle.as_deref() {
        Some(subtitle) => toast.text1(subtitle).text2(&payload.body),
        None => toast.text1(&payload.body),
    };

    let icon_uri = payload
        .icon_path
        .as_deref()
        .filter(|path| Path::new(path).is_file())
        .map(|path| path.replace('\\', "/"));

    if let Some(icon_uri) = icon_uri.as_deref() {
        toast = toast.icon(Path::new(icon_uri), IconCrop::Circular, "");
    }

    toast = toast.sound(Some(Sound::Default));

    let channel_uri = payload.channel_uri.clone();
    let message_uri = payload.message_uri.clone();

    toast = toast.on_activated(move |_action| {
        if let Some(handler) = HANDLER.get() {
            handler(Activation {
                channel_uri: channel_uri.clone(),
                message_uri: message_uri.clone(),
            });
        }
        Ok(())
    });

    toast.show().map_err(|err| {
        let message = err.to_string();
        eprintln!("native notification failed: {message}");
        NativeError::failed(message)
    })
}

pub fn dismiss_channel(_channel_uri: String) -> Result<(), NativeError> {
    Err(NativeError::unsupported())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wide_is_null_terminated() {
        assert_eq!(wide("ab"), vec![0x61, 0x62, 0x00]);
    }
}
