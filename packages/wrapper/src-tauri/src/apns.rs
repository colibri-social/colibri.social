use std::ffi::{c_char, c_void, CStr, CString};
use std::sync::mpsc;
use std::time::Duration;

use serde::Serialize;

use crate::native_error::{NativeError, NativeErrorCode};

type RegisterCallback = extern "C" fn(*const c_char, *const c_char, *mut c_void);
type ActivationCallback = extern "C" fn(*const c_char, *const c_char, *const c_char);

unsafe extern "C" {
    fn colibri_apns_register(callback: RegisterCallback, ctx: *mut c_void);
    fn colibri_apns_environment() -> *const c_char;
    fn colibri_apns_remove_delivered(thread_id: *const c_char);
    fn colibri_apns_remove_delivered_targets(targets: *const *const c_char, count: usize);
    fn colibri_apns_set_live(live: bool);
    fn colibri_apns_install_delegate(on_activate: Option<ActivationCallback>);
}

const REGISTER_TIMEOUT: Duration = Duration::from_secs(30);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApnsRegistration {
    pub token: String,
    pub environment: String,
}

fn owned(ptr: *const c_char) -> Option<String> {
    if ptr.is_null() {
        None
    } else {
        Some(unsafe { CStr::from_ptr(ptr) }.to_string_lossy().into_owned())
    }
}

extern "C" fn on_registered(token: *const c_char, error: *const c_char, ctx: *mut c_void) {
    let sender = unsafe { Box::from_raw(ctx as *mut mpsc::Sender<Result<String, String>>) };
    let result = match owned(token) {
        Some(token) => Ok(token),
        None => Err(owned(error).unwrap_or_else(|| "registration failed".to_string())),
    };
    let _ = sender.send(result);
}

fn environment() -> String {
    owned(unsafe { colibri_apns_environment() }).unwrap_or_else(|| "production".to_string())
}

#[tauri::command]
pub async fn apns_register() -> Result<ApnsRegistration, NativeError> {
    let (tx, rx) = mpsc::channel::<Result<String, String>>();
    let ctx = Box::into_raw(Box::new(tx)) as *mut c_void;
    unsafe { colibri_apns_register(on_registered, ctx) };
    let outcome = tauri::async_runtime::spawn_blocking(move || {
        rx.recv_timeout(REGISTER_TIMEOUT)
            .unwrap_or(Err("timed out waiting for a device token".to_string()))
    })
    .await
    .map_err(|e| NativeError::failed(e.to_string()))?;

    let token = outcome.map_err(|message| NativeError::new(NativeErrorCode::Unsupported, message))?;
    Ok(ApnsRegistration {
        token,
        environment: environment(),
    })
}

#[tauri::command]
pub fn apns_remove_delivered(channel_uri: String) -> Result<(), NativeError> {
    let thread_id =
        CString::new(channel_uri).map_err(|e| NativeError::invalid_request(e.to_string()))?;
    unsafe { colibri_apns_remove_delivered(thread_id.as_ptr()) };
    Ok(())
}

pub fn set_live(live: bool) {
    unsafe { colibri_apns_set_live(live) };
}

pub fn remove_delivered_targets(targets: &[String]) -> Result<(), NativeError> {
    let owned = targets
        .iter()
        .map(|target| CString::new(target.as_str()))
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| NativeError::invalid_request(e.to_string()))?;
    let pointers: Vec<*const c_char> = owned.iter().map(|target| target.as_ptr()).collect();
    unsafe { colibri_apns_remove_delivered_targets(pointers.as_ptr(), pointers.len()) };
    Ok(())
}

#[cfg(target_os = "macos")]
pub fn setup() {
    unsafe { colibri_apns_install_delegate(None) };
}

#[cfg(target_os = "ios")]
pub mod activation {
    use std::ffi::c_char;
    use std::sync::{Mutex, OnceLock};

    use serde::Serialize;
    use tauri::{AppHandle, Emitter};

    use super::{colibri_apns_install_delegate, owned};
    use crate::AppRuntime;

    const ACTIVATION_EVENT: &str = "colibri-notification-activated";

    #[derive(Debug, Clone, Serialize)]
    #[serde(rename_all = "camelCase")]
    pub struct Activation {
        pub channel_uri: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        pub thread_uri: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        pub message_uri: Option<String>,
    }

    static APP: OnceLock<AppHandle<AppRuntime>> = OnceLock::new();
    static PENDING: Mutex<Option<Activation>> = Mutex::new(None);

    extern "C" fn on_activate(
        channel_uri: *const c_char,
        thread_uri: *const c_char,
        message_uri: *const c_char,
    ) {
        let Some(channel_uri) = owned(channel_uri) else {
            return;
        };
        let activation = Activation {
            channel_uri,
            thread_uri: owned(thread_uri).filter(|uri| !uri.is_empty()),
            message_uri: owned(message_uri).filter(|uri| !uri.is_empty()),
        };
        if let Ok(mut slot) = PENDING.lock() {
            *slot = Some(activation.clone());
        }
        if let Some(app) = APP.get() {
            let _ = app.emit(ACTIVATION_EVENT, activation);
        }
    }

    pub fn setup(app: &AppHandle<AppRuntime>) {
        let _ = APP.set(app.clone());
        unsafe { colibri_apns_install_delegate(Some(on_activate)) };
    }

    #[tauri::command]
    pub fn apns_take_activation() -> Option<Activation> {
        PENDING.lock().ok().and_then(|mut slot| slot.take())
    }
}
