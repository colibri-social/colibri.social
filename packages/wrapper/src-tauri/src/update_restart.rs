use tauri::{AppHandle, Manager, ResourceId, Runtime, Webview};
use tauri_plugin_updater::Update;

use crate::native_error::{NativeError, NativeErrorCode};

#[tauri::command]
pub fn update_installs_on_restart() -> bool {
    installs_on_restart()
}

#[tauri::command]
pub async fn update_stage<R: Runtime>(
    webview: Webview<R>,
    rid: ResourceId,
) -> Result<(), NativeError> {
    if !installs_on_restart() {
        return Err(NativeError::new(
            NativeErrorCode::Unsupported,
            "this install applies updates in the background",
        ));
    }
    let update: Update = webview
        .resources_table()
        .get::<Update>(rid)
        .map_err(|error| NativeError::invalid_request(error.to_string()))?
        .as_ref()
        .clone();
    let bytes = update
        .download(|_, _| {}, || {})
        .await
        .map_err(|error| NativeError::failed(error.to_string()))?;
    let folder = webview
        .app_handle()
        .path()
        .app_cache_dir()
        .map_err(|error| NativeError::failed(error.to_string()))?
        .join("updates");
    staging::stage(update, &bytes, &folder).map_err(|error| NativeError::failed(error.to_string()))
}

#[cfg(target_os = "linux")]
pub fn discard_stale<R: Runtime>(app: &AppHandle<R>) {
    if let Ok(cache) = app.path().app_cache_dir() {
        staging::discard(&cache.join("updates"));
    }
}

#[tauri::command]
pub fn restart_app<R: Runtime>(app: AppHandle<R>) {
    #[cfg(target_os = "linux")]
    {
        let env = app.env();
        match tauri::process::current_binary(&env) {
            Ok(program) => {
                staging::plan_relaunch(program, env.args_os.into_iter().skip(1).collect());
                app.exit(0);
                return;
            }
            Err(error) => eprintln!("could not resolve the binary to relaunch: {error}"),
        }
    }
    app.request_restart();
}

#[cfg(target_os = "linux")]
pub fn after_exit() {
    staging::after_exit();
}

#[cfg(target_os = "linux")]
fn installs_on_restart() -> bool {
    use tauri::utils::config::BundleType;
    matches!(
        tauri::utils::platform::bundle_type(),
        Some(BundleType::Deb | BundleType::Rpm)
    )
}

#[cfg(not(target_os = "linux"))]
fn installs_on_restart() -> bool {
    false
}

#[cfg(target_os = "linux")]
mod staging {
    use std::ffi::OsString;
    use std::fs::{self, OpenOptions};
    use std::io::{self, Write};
    use std::os::unix::fs::OpenOptionsExt;
    use std::path::{Path, PathBuf};
    use std::process::Command;
    use std::sync::Mutex;

    use sha2::{Digest, Sha256};
    use tauri_plugin_updater::Update;

    struct Staged {
        update: Update,
        folder: PathBuf,
        file: PathBuf,
        digest: [u8; 32],
    }

    struct Relaunch {
        program: PathBuf,
        args: Vec<OsString>,
    }

    static STAGED: Mutex<Option<Staged>> = Mutex::new(None);
    static RELAUNCH: Mutex<Option<Relaunch>> = Mutex::new(None);

    fn take<T>(slot: &Mutex<Option<T>>) -> Option<T> {
        slot.lock().ok().and_then(|mut value| value.take())
    }

    fn digest_of(bytes: &[u8]) -> [u8; 32] {
        Sha256::digest(bytes).into()
    }

    pub fn discard(folder: &Path) {
        if let Err(error) = fs::remove_dir_all(folder) {
            if error.kind() != io::ErrorKind::NotFound {
                eprintln!("could not remove {}: {error}", folder.display());
            }
        }
    }

    pub fn stage(update: Update, bytes: &[u8], folder: &Path) -> io::Result<()> {
        if let Ok(mut staged) = STAGED.lock() {
            staged.take();
        }
        discard(folder);
        fs::create_dir_all(folder)?;
        let file = folder.join(format!("colibri-social-{}.pkg", update.version));
        OpenOptions::new()
            .write(true)
            .create_new(true)
            .mode(0o600)
            .open(&file)?
            .write_all(bytes)?;
        let staged = Staged {
            update,
            folder: folder.to_path_buf(),
            file,
            digest: digest_of(bytes),
        };
        if let Ok(mut slot) = STAGED.lock() {
            *slot = Some(staged);
        }
        Ok(())
    }

    pub fn plan_relaunch(program: PathBuf, args: Vec<OsString>) {
        if let Ok(mut relaunch) = RELAUNCH.lock() {
            *relaunch = Some(Relaunch { program, args });
        }
    }

    fn install(staged: &Staged) -> Result<(), String> {
        let bytes = fs::read(&staged.file).map_err(|error| error.to_string())?;
        if digest_of(&bytes) != staged.digest {
            return Err("the downloaded update changed on disk".into());
        }
        staged
            .update
            .install(&bytes)
            .map_err(|error| error.to_string())
    }

    pub fn after_exit() {
        let Some(relaunch) = take(&RELAUNCH) else {
            return;
        };
        if let Some(staged) = take(&STAGED) {
            let version = staged.update.version.clone();
            match install(&staged) {
                Ok(()) => eprintln!("installed update {version}"),
                Err(error) => eprintln!(
                    "could not install update {version}, relaunching the current version: {error}"
                ),
            }
            discard(&staged.folder);
        }
        crate::linux_cef::release_instance_socket();
        if let Err(error) = Command::new(&relaunch.program).args(&relaunch.args).spawn() {
            eprintln!("could not relaunch {}: {error}", relaunch.program.display());
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn digest_detects_changed_bytes() {
            assert_eq!(digest_of(b"package"), digest_of(b"package"));
            assert_ne!(digest_of(b"package"), digest_of(b"packagf"));
        }

        #[test]
        fn discard_ignores_a_missing_folder() {
            let folder = std::env::temp_dir().join(format!("colibri-missing-{}", std::process::id()));
            discard(&folder);
            assert!(!folder.exists());
        }
    }
}

#[cfg(not(target_os = "linux"))]
mod staging {
    use std::io;
    use std::path::Path;

    use tauri_plugin_updater::Update;

    pub fn stage(_update: Update, _bytes: &[u8], _folder: &Path) -> io::Result<()> {
        Ok(())
    }
}
