use tauri::ipc::{InvokeBody, Request};
use tauri::{AppHandle, Runtime};

use crate::native_error::NativeError;

const NAME_HEADER: &str = "x-colibri-file-name";
const TYPE_HEADER: &str = "x-colibri-file-type";
const FALLBACK_NAME: &str = "image.png";

fn percent_decode(value: &str) -> String {
    let bytes = value.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            if let Ok(byte) = u8::from_str_radix(&value[index + 1..index + 3], 16) {
                out.push(byte);
                index += 3;
                continue;
            }
        }
        out.push(bytes[index]);
        index += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

pub fn safe_name(raw: &str) -> String {
    let cleaned: String = raw
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '-',
            c if c.is_control() => '-',
            c => c,
        })
        .collect();
    let trimmed = cleaned.trim().trim_start_matches('.').trim();
    if trimmed.is_empty() {
        FALLBACK_NAME.to_string()
    } else {
        trimmed.chars().take(180).collect()
    }
}

#[derive(serde::Deserialize)]
struct JsonPayload {
    name: Option<String>,
    r#type: Option<String>,
    bytes: Vec<u8>,
}

fn header(request: &Request<'_>, key: &str) -> Option<String> {
    request
        .headers()
        .get(key)?
        .to_str()
        .ok()
        .map(percent_decode)
}

#[tauri::command]
pub async fn save_image<R: Runtime>(
    app: AppHandle<R>,
    request: Request<'_>,
) -> Result<Option<String>, NativeError> {
    let (raw_name, raw_type, bytes) = match request.body() {
        InvokeBody::Raw(bytes) => (
            header(&request, NAME_HEADER),
            header(&request, TYPE_HEADER),
            bytes.clone(),
        ),
        InvokeBody::Json(value) => {
            let payload: JsonPayload = serde_json::from_value(value.clone())
                .map_err(|error| NativeError::invalid_request(error.to_string()))?;
            (payload.name, payload.r#type, payload.bytes)
        }
    };
    if bytes.is_empty() {
        return Err(NativeError::invalid_request("the image is empty"));
    }
    let name = safe_name(&raw_name.unwrap_or_default());
    let mime = raw_type
        .filter(|value| value.starts_with("image/"))
        .unwrap_or_else(|| "image/png".to_string());
    save(&app, name, mime, bytes).await
}

#[cfg(desktop)]
async fn save<R: Runtime>(
    app: &AppHandle<R>,
    name: String,
    _mime: String,
    bytes: Vec<u8>,
) -> Result<Option<String>, NativeError> {
    use tauri_plugin_dialog::DialogExt;
    let Some(target) = app.dialog().file().set_file_name(&name).blocking_save_file() else {
        return Ok(None);
    };
    let path = target
        .into_path()
        .map_err(|error| NativeError::failed(error.to_string()))?;
    std::fs::write(&path, bytes).map_err(|error| NativeError::failed(error.to_string()))?;
    Ok(Some(
        path.file_name()
            .map(|value| value.to_string_lossy().into_owned())
            .unwrap_or(name),
    ))
}

#[cfg(target_os = "android")]
async fn save<R: Runtime>(
    app: &AppHandle<R>,
    name: String,
    mime: String,
    bytes: Vec<u8>,
) -> Result<Option<String>, NativeError> {
    crate::android_jni::on_activity(app, move |env, activity| {
        android::save_to_downloads(env, activity, &name, &mime, &bytes)
    })
    .await
    .map(Some)
}

#[cfg(target_os = "ios")]
async fn save<R: Runtime>(
    _app: &AppHandle<R>,
    _name: String,
    _mime: String,
    _bytes: Vec<u8>,
) -> Result<Option<String>, NativeError> {
    Err(NativeError::new(
        crate::native_error::NativeErrorCode::Unsupported,
        "saving images is not available on this platform yet",
    ))
}

#[cfg(target_os = "android")]
mod android {
    use jni::objects::{JObject, JValue};
    use jni::JNIEnv;

    use crate::android_jni::clear_exception as fail;
    use crate::native_error::{NativeError, NativeErrorCode};

    const DOWNLOADS_PATH: &str = "Download/";

    pub fn save_to_downloads(
        env: &mut JNIEnv<'_>,
        activity: &JObject<'_>,
        name: &str,
        mime: &str,
        bytes: &[u8],
    ) -> Result<String, NativeError> {
        let sdk = env
            .get_static_field("android/os/Build$VERSION", "SDK_INT", "I")
            .and_then(|value| value.i())
            .map_err(|error| fail(env, error))?;
        if sdk < 29 {
            return Err(NativeError::new(
                NativeErrorCode::Unsupported,
                "saving to Downloads needs Android 10 or newer",
            ));
        }

        let result = (|| -> jni::errors::Result<String> {
            let resolver = env
                .call_method(
                    activity,
                    "getContentResolver",
                    "()Landroid/content/ContentResolver;",
                    &[],
                )?
                .l()?;
            let values = env.new_object("android/content/ContentValues", "()V", &[])?;
            for (key, value) in [
                ("_display_name", name),
                ("mime_type", mime),
                ("relative_path", DOWNLOADS_PATH),
            ] {
                let key = env.new_string(key)?;
                let value = env.new_string(value)?;
                env.call_method(
                    &values,
                    "put",
                    "(Ljava/lang/String;Ljava/lang/String;)V",
                    &[JValue::Object(&key), JValue::Object(&value)],
                )?;
            }
            let collection = env
                .get_static_field(
                    "android/provider/MediaStore$Downloads",
                    "EXTERNAL_CONTENT_URI",
                    "Landroid/net/Uri;",
                )?
                .l()?;
            let uri = env
                .call_method(
                    &resolver,
                    "insert",
                    "(Landroid/net/Uri;Landroid/content/ContentValues;)Landroid/net/Uri;",
                    &[JValue::Object(&collection), JValue::Object(&values)],
                )?
                .l()?;
            if uri.is_null() {
                return Err(jni::errors::Error::NullPtr("MediaStore insert returned no uri"));
            }
            let stream = env
                .call_method(
                    &resolver,
                    "openOutputStream",
                    "(Landroid/net/Uri;)Ljava/io/OutputStream;",
                    &[JValue::Object(&uri)],
                )?
                .l()?;
            if stream.is_null() {
                return Err(jni::errors::Error::NullPtr("no output stream for the download"));
            }
            let array = env.byte_array_from_slice(bytes)?;
            let written = env.call_method(&stream, "write", "([B)V", &[JValue::Object(&array)]);
            let closed = env.call_method(&stream, "close", "()V", &[]);
            written?;
            closed?;
            let column = env.new_string("_display_name")?;
            let projection = env.new_object_array(1, "java/lang/String", &column)?;
            let cursor = env
                .call_method(
                    &resolver,
                    "query",
                    "(Landroid/net/Uri;[Ljava/lang/String;Ljava/lang/String;[Ljava/lang/String;Ljava/lang/String;)Landroid/database/Cursor;",
                    &[
                        JValue::Object(&uri),
                        JValue::Object(&projection),
                        JValue::Object(&JObject::null()),
                        JValue::Object(&JObject::null()),
                        JValue::Object(&JObject::null()),
                    ],
                )?
                .l()?;
            if cursor.is_null() {
                return Ok(name.to_string());
            }
            let mut saved = name.to_string();
            if env.call_method(&cursor, "moveToFirst", "()Z", &[])?.z()? {
                let value = env
                    .call_method(&cursor, "getString", "(I)Ljava/lang/String;", &[JValue::Int(0)])?
                    .l()?;
                if !value.is_null() {
                    saved = env.get_string(&value.into())?.into();
                }
            }
            env.call_method(&cursor, "close", "()V", &[])?;
            Ok(saved)
        })();
        result.map_err(|error| fail(env, error))
    }
}

#[cfg(test)]
mod tests {
    use super::{percent_decode, safe_name};

    #[test]
    fn decodes_percent_escapes() {
        assert_eq!(percent_decode("caf%C3%A9%20photo.png"), "café photo.png");
        assert_eq!(percent_decode("100%"), "100%");
    }

    #[test]
    fn strips_path_parts_from_names() {
        assert_eq!(safe_name("../../etc/passwd"), "-..-etc-passwd");
        assert_eq!(safe_name("  "), "image.png");
        assert_eq!(safe_name("photo.png"), "photo.png");
        assert_eq!(safe_name(".hidden.png"), "hidden.png");
    }
}
