use std::sync::atomic::{AtomicBool, Ordering};

use crate::native_error::NativeError;

static LIVE: AtomicBool = AtomicBool::new(false);

#[cfg(target_os = "android")]
fn is_live() -> bool {
    LIVE.load(Ordering::Relaxed)
}

#[tauri::command]
pub fn push_set_live(live: bool) {
    LIVE.store(live, Ordering::Relaxed);
    #[cfg(any(target_os = "macos", target_os = "ios"))]
    crate::apns::set_live(live);
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
pub fn push_dismiss_read(channels: Vec<String>) -> Result<(), NativeError> {
    if channels.is_empty() {
        return Ok(());
    }
    #[cfg(any(target_os = "macos", target_os = "ios"))]
    return crate::apns::remove_delivered_targets(&channels);
    #[cfg(not(any(target_os = "macos", target_os = "ios")))]
    Ok(())
}

#[cfg(target_os = "android")]
#[tauri::command]
pub async fn push_dismiss_read<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    channels: Vec<String>,
) -> Result<(), NativeError> {
    if channels.is_empty() {
        return Ok(());
    }
    android::dismiss(&app, channels).await
}

#[cfg(target_os = "android")]
mod android {
    use jni::objects::{JClass, JObject, JValue};
    use jni::sys::jboolean;
    use jni::JNIEnv;
    use tauri::{AppHandle, Runtime};

    use crate::native_error::NativeError;

    const TRAY_CLASS: &str = "social.colibri.app.NotificationTray";

    #[no_mangle]
    pub extern "system" fn Java_social_colibri_app_NotificationTray_nativeIsLive(
        _env: JNIEnv,
        _class: JClass,
    ) -> jboolean {
        super::is_live() as jboolean
    }

    pub async fn dismiss<R: Runtime>(
        app: &AppHandle<R>,
        targets: Vec<String>,
    ) -> Result<(), NativeError> {
        crate::android_jni::on_activity(app, move |env, activity| {
            let result = (|| -> jni::errors::Result<()> {
                let loader = env
                    .call_method(activity, "getClassLoader", "()Ljava/lang/ClassLoader;", &[])?
                    .l()?;
                let name = env.new_string(TRAY_CLASS)?;
                let class = env
                    .call_method(
                        &loader,
                        "loadClass",
                        "(Ljava/lang/String;)Ljava/lang/Class;",
                        &[JValue::Object(&name)],
                    )?
                    .l()?;
                let class = JClass::from(class);
                let array = env.new_object_array(
                    targets.len() as i32,
                    "java/lang/String",
                    JObject::null(),
                )?;
                for (index, target) in targets.iter().enumerate() {
                    let value = env.new_string(target)?;
                    env.set_object_array_element(&array, index as i32, value)?;
                }
                env.call_static_method(
                    &class,
                    "dismiss",
                    "(Landroid/content/Context;[Ljava/lang/String;)V",
                    &[JValue::Object(activity), JValue::Object(&array)],
                )?;
                Ok(())
            })();
            result.map_err(|error| crate::android_jni::clear_exception(env, error))
        })
        .await
    }
}
