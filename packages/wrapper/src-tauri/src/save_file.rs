use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_http::reqwest;

use crate::native_error::NativeError;

const FALLBACK_NAME: &str = "download";
const FALLBACK_TYPE: &str = "application/octet-stream";
const STAGING_FOLDER: &str = "downloads";

static STAGED_COUNT: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, PartialEq, Eq, serde::Serialize)]
pub struct SavedFile {
    name: String,
    r#type: String,
    destination: Option<String>,
}

struct Staged {
    dir: PathBuf,
    file: PathBuf,
}

impl Staged {
    fn rename(&mut self, name: &str) -> Result<(), NativeError> {
        let file = self.dir.join(name);
        if file != self.file {
            std::fs::rename(&self.file, &file).map_err(failed)?;
            self.file = file;
        }
        Ok(())
    }
}

impl Drop for Staged {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.dir);
    }
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

fn valid_mime(raw: &str) -> Option<String> {
    let value = raw.split(';').next()?.trim().to_ascii_lowercase();
    let mut parts = value.splitn(2, '/');
    let valid = |part: Option<&str>| {
        part.is_some_and(|part| {
            !part.is_empty()
                && part
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || "!#$&^_.+-".contains(c))
        })
    };
    if valid(parts.next()) && valid(parts.next()) {
        Some(value)
    } else {
        None
    }
}

pub fn resolve_mime(requested: Option<&str>, header: Option<&str>) -> String {
    let specific = |value: Option<&str>| {
        value
            .and_then(valid_mime)
            .filter(|value| value != FALLBACK_TYPE)
    };
    specific(requested)
        .or_else(|| specific(header))
        .unwrap_or_else(|| FALLBACK_TYPE.to_string())
}

fn extension_for(mime: &str) -> Option<&'static str> {
    Some(match mime {
        "image/png" => "png",
        "image/jpeg" => "jpg",
        "image/gif" => "gif",
        "image/webp" => "webp",
        "image/avif" => "avif",
        "video/mp4" => "mp4",
        "video/webm" => "webm",
        "video/quicktime" => "mov",
        "audio/mpeg" => "mp3",
        "audio/mp4" => "m4a",
        "audio/aac" => "aac",
        "audio/ogg" => "ogg",
        "audio/wav" => "wav",
        "audio/flac" => "flac",
        "application/pdf" => "pdf",
        "application/zip" => "zip",
        "text/plain" => "txt",
        _ => return None,
    })
}

fn has_extension(name: &str) -> bool {
    name.rsplit_once('.').is_some_and(|(stem, extension)| {
        !stem.is_empty()
            && (2..=5).contains(&extension.len())
            && extension.chars().all(|c| c.is_ascii_alphanumeric())
    })
}

pub fn file_name(raw: Option<&str>, mime: &str) -> String {
    let name = safe_name(raw.unwrap_or_default());
    match extension_for(mime) {
        Some(extension) if !has_extension(&name) => format!("{name}.{extension}"),
        _ => name,
    }
}

pub fn parse_source(raw: &str) -> Result<reqwest::Url, NativeError> {
    let url = reqwest::Url::parse(raw)
        .map_err(|_| NativeError::invalid_request("the download link is not valid"))?;
    match url.scheme() {
        "https" | "http" => Ok(url),
        _ => Err(NativeError::invalid_request(
            "only web links can be downloaded",
        )),
    }
}

fn failed(error: impl std::fmt::Display) -> NativeError {
    NativeError::failed(error.to_string())
}

fn stage<R: Runtime>(app: &AppHandle<R>, name: &str) -> Result<Staged, NativeError> {
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|elapsed| elapsed.as_nanos())
        .unwrap_or_default();
    let count = STAGED_COUNT.fetch_add(1, Ordering::Relaxed);
    let dir = app
        .path()
        .app_cache_dir()
        .map_err(failed)?
        .join(STAGING_FOLDER)
        .join(format!("{stamp}-{count}"));
    std::fs::create_dir_all(&dir).map_err(failed)?;
    let file = dir.join(name);
    Ok(Staged { dir, file })
}

async fn download(url: reqwest::Url, target: &Path) -> Result<Option<String>, NativeError> {
    download_reporting(url, target, |_, _| {}).await
}

async fn download_reporting(
    url: reqwest::Url,
    target: &Path,
    mut report: impl FnMut(usize, Option<u64>),
) -> Result<Option<String>, NativeError> {
    let mut response = reqwest::Client::new()
        .get(url)
        .send()
        .await
        .map_err(failed)?;
    let status = response.status();
    if !status.is_success() {
        return Err(NativeError::failed(format!(
            "the download failed with status {status}"
        )));
    }
    let header = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(str::to_string);
    let length = response.content_length();
    let mut output = std::io::BufWriter::new(std::fs::File::create(target).map_err(failed)?);
    let mut total = 0usize;
    while let Some(chunk) = response.chunk().await.map_err(failed)? {
        output.write_all(&chunk).map_err(failed)?;
        total += chunk.len();
        report(total, length);
    }
    output.flush().map_err(failed)?;
    if total == 0 {
        return Err(NativeError::invalid_request("the file is empty"));
    }
    Ok(header)
}

#[tauri::command]
pub async fn save_url<R: Runtime>(
    app: AppHandle<R>,
    url: String,
    name: Option<String>,
    r#type: Option<String>,
) -> Result<Option<SavedFile>, NativeError> {
    let source = parse_source(&url)?;
    let requested = r#type.as_deref().and_then(valid_mime);
    let staging_mime = resolve_mime(requested.as_deref(), None);
    let mut staged = stage(&app, &file_name(name.as_deref(), &staging_mime))?;
    let header = download(source, &staged.file).await?;
    let mime = resolve_mime(requested.as_deref(), header.as_deref());
    if mime != staging_mime {
        staged.rename(&file_name(name.as_deref(), &mime))?;
    }
    persist(&app, &staged, mime).await
}

#[cfg(desktop)]
const PLAYER_FOLDER: &str = "player";

#[cfg(desktop)]
const PROGRESS_STEPS: u64 = 100;

#[cfg(desktop)]
#[derive(Clone, serde::Serialize)]
pub struct DownloadProgress {
    received: u64,
    total: Option<u64>,
}

#[cfg(desktop)]
#[tauri::command]
pub async fn open_media_url<R: Runtime>(
    app: AppHandle<R>,
    url: String,
    name: Option<String>,
    r#type: Option<String>,
    on_progress: tauri::ipc::Channel<DownloadProgress>,
) -> Result<(), NativeError> {
    let source = parse_source(&url)?;
    let requested = r#type.as_deref().and_then(valid_mime);
    let dir = app
        .path()
        .app_cache_dir()
        .map_err(failed)?
        .join(PLAYER_FOLDER);
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).map_err(failed)?;
    let partial = dir.join(".partial");
    let mut last_step = None;
    let header = download_reporting(source, &partial, |received, total| {
        let received = received as u64;
        let step = total
            .filter(|total| *total > 0)
            .map_or(received >> 20, |total| {
                received.min(total) * PROGRESS_STEPS / total
            });
        if last_step == Some(step) {
            return;
        }
        last_step = Some(step);
        let _ = on_progress.send(DownloadProgress { received, total });
    })
    .await?;
    let mime = resolve_mime(requested.as_deref(), header.as_deref());
    let file = dir.join(file_name(name.as_deref(), &mime));
    std::fs::rename(&partial, &file).map_err(failed)?;
    crate::open_external::open_path(&app, &file)
}

fn staged_name(staged: &Staged) -> String {
    staged
        .file
        .file_name()
        .map(|value| value.to_string_lossy().into_owned())
        .unwrap_or_else(|| FALLBACK_NAME.to_string())
}

#[cfg(desktop)]
async fn persist<R: Runtime>(
    app: &AppHandle<R>,
    staged: &Staged,
    mime: String,
) -> Result<Option<SavedFile>, NativeError> {
    use tauri_plugin_dialog::DialogExt;
    let name = staged_name(staged);
    let Some(target) = app
        .dialog()
        .file()
        .set_file_name(&name)
        .blocking_save_file()
    else {
        return Ok(None);
    };
    let path = target.into_path().map_err(failed)?;
    if std::fs::rename(&staged.file, &path).is_err() {
        std::fs::copy(&staged.file, &path).map_err(failed)?;
    }
    Ok(Some(SavedFile {
        name: path
            .file_name()
            .map(|value| value.to_string_lossy().into_owned())
            .unwrap_or(name),
        r#type: mime,
        destination: None,
    }))
}

#[cfg(target_os = "android")]
async fn persist<R: Runtime>(
    app: &AppHandle<R>,
    staged: &Staged,
    mime: String,
) -> Result<Option<SavedFile>, NativeError> {
    let name = staged_name(staged);
    let source = staged.file.clone();
    let worker_mime = mime.clone();
    let saved = crate::android_jni::on_worker(app, move |env, activity| {
        android::save_to_media_store(env, activity, &name, &worker_mime, &source)
    })
    .await?;
    Ok(Some(SavedFile {
        name: saved,
        r#type: mime,
        destination: None,
    }))
}

#[cfg(target_os = "ios")]
async fn persist<R: Runtime>(
    app: &AppHandle<R>,
    staged: &Staged,
    mime: String,
) -> Result<Option<SavedFile>, NativeError> {
    use crate::native_error::NativeErrorCode;
    use tauri::plugin::mobile::PluginInvokeError;
    use tauri_plugin_keyboard_inset::{SaveFile, SaveRequest};

    let request = SaveRequest {
        path: staged.file.to_string_lossy().into_owned(),
        name: staged_name(staged),
        r#type: mime.clone(),
    };
    match app.state::<SaveFile<R>>().save(request).await {
        Ok(saved) => Ok(Some(SavedFile {
            name: saved.name,
            r#type: mime,
            destination: saved.destination,
        })),
        Err(PluginInvokeError::InvokeRejected(rejection)) => {
            let message = rejection.message.unwrap_or_default();
            Err(match rejection.code.as_deref() {
                Some("Cancelled") => NativeError::new(NativeErrorCode::Cancelled, message),
                Some("PermissionDenied") => {
                    NativeError::new(NativeErrorCode::PermissionDenied, message)
                }
                _ => NativeError::failed(message),
            })
        }
        Err(error) => Err(failed(error)),
    }
}

#[cfg(target_os = "android")]
mod android {
    use std::io::Read;
    use std::path::Path;

    use jni::objects::{JObject, JValue};
    use jni::JNIEnv;

    use crate::android_jni::clear_exception as fail;
    use crate::native_error::{NativeError, NativeErrorCode};

    const CHUNK_SIZE: usize = 256 * 1024;

    struct Collection {
        class: &'static str,
        path: &'static str,
    }

    fn collection_for(mime: &str) -> Collection {
        let (class, path) = match mime.split('/').next() {
            Some("image") => ("android/provider/MediaStore$Images$Media", "Pictures/"),
            Some("video") => ("android/provider/MediaStore$Video$Media", "Movies/"),
            Some("audio") => ("android/provider/MediaStore$Audio$Media", "Music/"),
            _ => ("android/provider/MediaStore$Downloads", "Download/"),
        };
        Collection { class, path }
    }

    enum CopyError {
        Java(jni::errors::Error),
        Io(std::io::Error),
    }

    impl From<jni::errors::Error> for CopyError {
        fn from(error: jni::errors::Error) -> Self {
            Self::Java(error)
        }
    }

    fn copy_in_chunks(
        env: &mut JNIEnv<'_>,
        stream: &JObject<'_>,
        source: &Path,
    ) -> Result<(), CopyError> {
        let mut file = std::fs::File::open(source).map_err(CopyError::Io)?;
        let mut buffer = vec![0u8; CHUNK_SIZE];
        let mut signed = Vec::with_capacity(CHUNK_SIZE);
        let array = env.new_byte_array(CHUNK_SIZE as i32)?;
        loop {
            let read = file.read(&mut buffer).map_err(CopyError::Io)?;
            if read == 0 {
                return Ok(());
            }
            signed.clear();
            signed.extend(buffer[..read].iter().map(|byte| *byte as i8));
            env.set_byte_array_region(&array, 0, &signed)?;
            env.call_method(
                stream,
                "write",
                "([BII)V",
                &[
                    JValue::Object(&array),
                    JValue::Int(0),
                    JValue::Int(read as i32),
                ],
            )?;
        }
    }

    fn discard(env: &mut JNIEnv<'_>, resolver: &JObject<'_>, uri: &JObject<'_>) {
        if env.exception_check().unwrap_or(false) {
            let _ = env.exception_clear();
        }
        let _ = env.call_method(
            resolver,
            "delete",
            "(Landroid/net/Uri;Ljava/lang/String;[Ljava/lang/String;)I",
            &[
                JValue::Object(uri),
                JValue::Object(&JObject::null()),
                JValue::Object(&JObject::null()),
            ],
        );
        if env.exception_check().unwrap_or(false) {
            let _ = env.exception_clear();
        }
    }

    pub fn save_to_media_store(
        env: &mut JNIEnv<'_>,
        activity: &JObject<'_>,
        name: &str,
        mime: &str,
        source: &Path,
    ) -> Result<String, NativeError> {
        let sdk = env
            .get_static_field("android/os/Build$VERSION", "SDK_INT", "I")
            .and_then(|value| value.i())
            .map_err(|error| fail(env, error))?;
        if sdk < 29 {
            return Err(NativeError::new(
                NativeErrorCode::Unsupported,
                "saving files needs Android 10 or newer",
            ));
        }

        let target = collection_for(mime);
        let mut io_failure = None;
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
                ("relative_path", target.path),
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
                .get_static_field(target.class, "EXTERNAL_CONTENT_URI", "Landroid/net/Uri;")?
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
                return Err(jni::errors::Error::NullPtr(
                    "MediaStore insert returned no uri",
                ));
            }
            let stream = match env.call_method(
                &resolver,
                "openOutputStream",
                "(Landroid/net/Uri;)Ljava/io/OutputStream;",
                &[JValue::Object(&uri)],
            ) {
                Ok(value) => value.l()?,
                Err(error) => {
                    discard(env, &resolver, &uri);
                    return Err(error);
                }
            };
            if stream.is_null() {
                discard(env, &resolver, &uri);
                return Err(jni::errors::Error::NullPtr(
                    "no output stream for the download",
                ));
            }
            let copied = copy_in_chunks(env, &stream, source);
            if env.exception_check().unwrap_or(false) {
                let _ = env.exception_clear();
            }
            let closed = env.call_method(&stream, "close", "()V", &[]);
            let outcome = match (copied, closed) {
                (Ok(()), Ok(_)) => Ok(()),
                (Err(CopyError::Io(error)), _) => {
                    io_failure = Some(error.to_string());
                    Err(jni::errors::Error::JavaException)
                }
                (Err(CopyError::Java(error)), _) | (Ok(()), Err(error)) => Err(error),
            };
            if let Err(error) = outcome {
                discard(env, &resolver, &uri);
                return Err(error);
            }
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
                    .call_method(
                        &cursor,
                        "getString",
                        "(I)Ljava/lang/String;",
                        &[JValue::Int(0)],
                    )?
                    .l()?;
                if !value.is_null() {
                    saved = env.get_string(&value.into())?.into();
                }
            }
            env.call_method(&cursor, "close", "()V", &[])?;
            Ok(saved)
        })();
        match (result, io_failure) {
            (Ok(saved), _) => Ok(saved),
            (Err(_), Some(message)) => Err(NativeError::failed(message)),
            (Err(error), None) => Err(fail(env, error)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{file_name, has_extension, parse_source, resolve_mime, safe_name};
    use crate::native_error::NativeErrorCode;

    #[test]
    fn strips_path_parts_from_names() {
        assert_eq!(safe_name("../../etc/passwd"), "-..-etc-passwd");
        assert_eq!(safe_name("  "), "download");
        assert_eq!(safe_name("photo.png"), "photo.png");
        assert_eq!(safe_name(".hidden.png"), "hidden.png");
    }

    #[test]
    fn prefers_the_requested_type() {
        assert_eq!(
            resolve_mime(Some("video/MP4"), Some("image/png")),
            "video/mp4"
        );
        assert_eq!(
            resolve_mime(Some("application/vnd.ms-excel"), None),
            "application/vnd.ms-excel"
        );
    }

    #[test]
    fn falls_back_to_the_response_type() {
        assert_eq!(
            resolve_mime(
                Some("application/octet-stream"),
                Some("image/png; charset=binary")
            ),
            "image/png"
        );
        assert_eq!(
            resolve_mime(Some("nonsense"), Some("audio/ogg")),
            "audio/ogg"
        );
        assert_eq!(
            resolve_mime(None, Some("text/plain; charset=utf-8")),
            "text/plain"
        );
    }

    #[test]
    fn uses_the_generic_type_when_nothing_is_known() {
        assert_eq!(resolve_mime(None, None), "application/octet-stream");
        assert_eq!(
            resolve_mime(Some("nonsense"), Some("")),
            "application/octet-stream"
        );
    }

    #[test]
    fn detects_extensions() {
        assert!(has_extension("photo.png"));
        assert!(has_extension("clip.webm"));
        assert!(!has_extension("photo"));
        assert!(!has_extension("photo.toolongext"));
        assert!(!has_extension(".png"));
    }

    #[test]
    fn adds_a_missing_extension_from_the_type() {
        assert_eq!(file_name(Some("photo"), "image/jpeg"), "photo.jpg");
        assert_eq!(file_name(Some("photo.png"), "image/jpeg"), "photo.png");
        assert_eq!(file_name(Some("notes"), "application/x-unknown"), "notes");
        assert_eq!(file_name(None, "video/mp4"), "download.mp4");
    }

    #[test]
    fn accepts_only_web_links() {
        assert!(parse_source("https://cdn.example.com/a.png").is_ok());
        assert!(parse_source("http://localhost:5173/a.png").is_ok());
        for raw in ["file:///etc/passwd", "blob:https://x/1", "not a url"] {
            let error = parse_source(raw).expect_err(raw);
            assert_eq!(error.code, NativeErrorCode::InvalidRequest);
        }
    }
}
