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

#[tauri::command]
pub fn push_dismiss_read(channels: Vec<String>) -> Result<(), NativeError> {
    if channels.is_empty() {
        return Ok(());
    }
    #[cfg(any(target_os = "macos", target_os = "ios"))]
    return crate::apns::remove_delivered_targets(&channels);
    #[cfg(target_os = "android")]
    return android::dismiss(&channels);
    #[cfg(not(any(target_os = "macos", target_os = "ios", target_os = "android")))]
    Ok(())
}

#[cfg(target_os = "android")]
mod android {
    use jni::objects::{JClass, JObject, JValue};
    use jni::sys::jboolean;
    use jni::{JNIEnv, JavaVM};

    use crate::native_error::NativeError;

    const TRAY_CLASS: &str = "social.colibri.app.NotificationTray";

    #[no_mangle]
    pub extern "system" fn Java_social_colibri_app_NotificationTray_nativeIsLive(
        _env: JNIEnv,
        _class: JClass,
    ) -> jboolean {
        super::is_live() as jboolean
    }

    pub fn dismiss(targets: &[String]) -> Result<(), NativeError> {
        let context = ndk_context::android_context();
        let vm = unsafe { JavaVM::from_raw(context.vm().cast()) }
            .map_err(|error| NativeError::failed(error.to_string()))?;
        let mut env = vm
            .attach_current_thread()
            .map_err(|error| NativeError::failed(error.to_string()))?;
        let activity = unsafe { JObject::from_raw(context.context().cast()) };

        let result = (|| -> jni::errors::Result<()> {
            let loader = env
                .call_method(&activity, "getClassLoader", "()Ljava/lang/ClassLoader;", &[])?
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
            let array =
                env.new_object_array(targets.len() as i32, "java/lang/String", JObject::null())?;
            for (index, target) in targets.iter().enumerate() {
                let value = env.new_string(target)?;
                env.set_object_array_element(&array, index as i32, value)?;
            }
            env.call_static_method(
                &class,
                "dismiss",
                "(Landroid/content/Context;[Ljava/lang/String;)V",
                &[JValue::Object(&activity), JValue::Object(&array)],
            )?;
            Ok(())
        })();

        result.map_err(|error| {
            if env.exception_check().unwrap_or(false) {
                let _ = env.exception_clear();
            }
            NativeError::failed(error.to_string())
        })
    }
}
