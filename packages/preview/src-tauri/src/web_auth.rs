#[cfg(any(target_os = "macos", target_os = "ios"))]
mod platform {
    use std::ffi::{c_char, c_void, CStr, CString};
    use std::sync::mpsc;

    use crate::native_error::NativeError;

    type WebAuthCallback = extern "C" fn(*const c_char, *const c_char, *mut c_void);

    unsafe extern "C" {
        fn colibri_start_web_auth(
            url: *const c_char,
            scheme: *const c_char,
            callback: WebAuthCallback,
            ctx: *mut c_void,
        );
    }

    extern "C" fn on_web_auth_done(url: *const c_char, error: *const c_char, ctx: *mut c_void) {
        let sender = unsafe { Box::from_raw(ctx as *mut mpsc::Sender<Result<String, String>>) };
        let result = if url.is_null() {
            Err(if error.is_null() {
                "authentication failed".to_string()
            } else {
                unsafe { CStr::from_ptr(error) }
                    .to_string_lossy()
                    .into_owned()
            })
        } else {
            Ok(unsafe { CStr::from_ptr(url) }
                .to_string_lossy()
                .into_owned())
        };
        let _ = sender.send(result);
    }

    pub async fn start(url: String, scheme: String) -> Result<String, NativeError> {
        let c_url = CString::new(url).map_err(|e| NativeError::invalid_request(e.to_string()))?;
        let c_scheme =
            CString::new(scheme).map_err(|e| NativeError::invalid_request(e.to_string()))?;
        let (tx, rx) = mpsc::channel::<Result<String, String>>();
        let ctx = Box::into_raw(Box::new(tx)) as *mut c_void;
        unsafe { colibri_start_web_auth(c_url.as_ptr(), c_scheme.as_ptr(), on_web_auth_done, ctx) };
        let outcome = tauri::async_runtime::spawn_blocking(move || {
            rx.recv().unwrap_or(Err("canceled".to_string()))
        })
        .await
        .map_err(|e| NativeError::failed(e.to_string()))?;

        outcome.map_err(|message| NativeError::from_platform_message(&message))
    }
}

#[cfg(not(any(target_os = "macos", target_os = "ios")))]
mod platform {
    use crate::native_error::NativeError;

    pub async fn start(_url: String, _scheme: String) -> Result<String, NativeError> {
        Err(NativeError::unsupported())
    }
}

#[tauri::command]
pub async fn start_web_auth(
    url: String,
    scheme: String,
) -> Result<String, crate::native_error::NativeError> {
    platform::start(url, scheme).await
}
