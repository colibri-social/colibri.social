use jni::objects::JObject;
use jni::JNIEnv;
use tauri::{AppHandle, Manager, Runtime};

use crate::native_error::NativeError;

pub fn clear_exception(env: &mut JNIEnv<'_>, error: jni::errors::Error) -> NativeError {
    if env.exception_check().unwrap_or(false) {
        let _ = env.exception_clear();
    }
    NativeError::failed(error.to_string())
}

pub async fn on_activity<R, T, F>(app: &AppHandle<R>, work: F) -> Result<T, NativeError>
where
    R: Runtime,
    T: Send + 'static,
    F: FnOnce(&mut JNIEnv<'_>, &JObject<'_>) -> Result<T, NativeError> + Send + 'static,
{
    let window = app
        .webview_windows()
        .into_values()
        .next()
        .ok_or_else(|| NativeError::failed("the app window is not ready"))?;
    let (sender, receiver) = std::sync::mpsc::sync_channel(1);
    window
        .with_webview(move |webview| {
            webview.jni_handle().exec(move |env, activity, _| {
                let _ = sender.send(work(env, activity));
            });
        })
        .map_err(|error| NativeError::failed(error.to_string()))?;
    tauri::async_runtime::spawn_blocking(move || receiver.recv())
        .await
        .map_err(|error| NativeError::failed(error.to_string()))?
        .map_err(|_| NativeError::failed("the app window closed before the call finished"))?
}

pub async fn on_worker<R, T, F>(app: &AppHandle<R>, work: F) -> Result<T, NativeError>
where
    R: Runtime,
    T: Send + 'static,
    F: FnOnce(&mut JNIEnv<'_>, &JObject<'_>) -> Result<T, NativeError> + Send + 'static,
{
    let (vm, activity) = on_activity(app, |env, activity| {
        let vm = env
            .get_java_vm()
            .map_err(|error| clear_exception(env, error))?;
        let activity = env
            .new_global_ref(activity)
            .map_err(|error| clear_exception(env, error))?;
        Ok((vm, activity))
    })
    .await?;
    tauri::async_runtime::spawn_blocking(move || {
        let mut env = vm
            .attach_current_thread()
            .map_err(|error| NativeError::failed(error.to_string()))?;
        work(&mut env, activity.as_obj())
    })
    .await
    .map_err(|error| NativeError::failed(error.to_string()))?
}
