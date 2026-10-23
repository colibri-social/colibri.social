use tauri::{AppHandle, Runtime};

use crate::native_error::NativeError;

const ALLOWED_SCHEMES: [&str; 4] = ["http", "https", "mailto", "tel"];

fn has_allowed_scheme(url: &str) -> bool {
    url.split_once(':').is_some_and(|(scheme, _)| {
        ALLOWED_SCHEMES
            .iter()
            .any(|allowed| scheme.eq_ignore_ascii_case(allowed))
    })
}

#[tauri::command]
pub fn open_external_url<R: Runtime>(app: AppHandle<R>, url: String) -> Result<(), NativeError> {
    if !has_allowed_scheme(&url) {
        return Err(NativeError::invalid_request("unsupported link scheme"));
    }

    #[cfg(target_os = "linux")]
    {
        let _ = app;
        linux::open(&url).map_err(|error| NativeError::failed(error.to_string()))
    }

    #[cfg(not(target_os = "linux"))]
    {
        use tauri_plugin_opener::OpenerExt;
        app.opener()
            .open_url(url, None::<&str>)
            .map_err(|error| NativeError::failed(error.to_string()))
    }
}

#[cfg(any(target_os = "linux", test))]
mod child_env {
    use std::ffi::{OsStr, OsString};
    use std::path::{Path, PathBuf};

    const APPIMAGE_ONLY: [&str; 6] = [
        "APPDIR",
        "APPIMAGE",
        "ARGV0",
        "OWD",
        "GDK_BACKEND",
        "PYTHONDONTWRITEBYTECODE",
    ];
    const LIBRARY_PATH: &str = "LD_LIBRARY_PATH";

    pub fn clean(
        vars: impl IntoIterator<Item = (OsString, OsString)>,
        appdir: Option<&Path>,
        cef_dir: Option<&Path>,
    ) -> Vec<(OsString, OsString)> {
        vars.into_iter()
            .filter(|(key, _)| appdir.is_none() || !APPIMAGE_ONLY.iter().any(|name| key == *name))
            .filter_map(|(key, value)| {
                let cef_dir = cef_dir.filter(|_| key == LIBRARY_PATH);
                clean_value(&value, appdir, cef_dir).map(|value| (key, value))
            })
            .collect()
    }

    fn clean_value(
        value: &OsStr,
        appdir: Option<&Path>,
        cef_dir: Option<&Path>,
    ) -> Option<OsString> {
        if appdir.is_none() && cef_dir.is_none() {
            return Some(value.to_owned());
        }
        let foreign = |entry: &PathBuf| {
            appdir.is_some_and(|dir| entry.starts_with(dir))
                || cef_dir.is_some_and(|dir| entry == dir)
        };
        let entries: Vec<PathBuf> = std::env::split_paths(value).collect();
        if !entries.iter().any(foreign) {
            return Some(value.to_owned());
        }
        let kept: Vec<PathBuf> = entries
            .into_iter()
            .filter(|entry| !foreign(entry) && !entry.as_os_str().is_empty())
            .collect();
        if kept.is_empty() {
            return None;
        }
        std::env::join_paths(kept).ok()
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        fn vars(pairs: &[(&str, &str)]) -> Vec<(OsString, OsString)> {
            pairs
                .iter()
                .map(|(key, value)| (OsString::from(key), OsString::from(value)))
                .collect()
        }

        fn get<'a>(env: &'a [(OsString, OsString)], key: &str) -> Option<&'a str> {
            env.iter()
                .find(|(name, _)| name == key)
                .and_then(|(_, value)| value.to_str())
        }

        #[test]
        fn appimage_entries_are_removed_from_path_lists() {
            let env = clean(
                vars(&[
                    (
                        "PATH",
                        "/tmp/.mount_X/usr/bin/:/tmp/.mount_X//usr/sbin/:/usr/bin:/bin",
                    ),
                    ("XDG_DATA_DIRS", "/tmp/.mount_X/usr/share/:/usr/share:"),
                ]),
                Some(Path::new("/tmp/.mount_X")),
                None,
            );
            assert_eq!(get(&env, "PATH"), Some("/usr/bin:/bin"));
            assert_eq!(get(&env, "XDG_DATA_DIRS"), Some("/usr/share"));
        }

        #[test]
        fn variables_that_only_point_into_the_appimage_are_dropped() {
            let env = clean(
                vars(&[
                    (
                        "LD_LIBRARY_PATH",
                        "/tmp/.mount_X/usr/lib/:/tmp/.mount_X/lib/",
                    ),
                    ("PYTHONHOME", "/tmp/.mount_X/usr/"),
                    ("APPIMAGE", "/home/me/Colibri.AppImage"),
                    ("GDK_BACKEND", "x11"),
                ]),
                Some(Path::new("/tmp/.mount_X")),
                None,
            );
            assert!(env.is_empty(), "{env:?}");
        }

        #[test]
        fn unrelated_values_are_left_alone() {
            let env = clean(
                vars(&[("GTK_THEME", "Adwaita:dark"), ("HOME", "/home/me")]),
                Some(Path::new("/tmp/.mount_X")),
                None,
            );
            assert_eq!(get(&env, "GTK_THEME"), Some("Adwaita:dark"));
            assert_eq!(get(&env, "HOME"), Some("/home/me"));
        }

        #[test]
        fn the_cef_library_dir_is_removed_outside_an_appimage() {
            let env = clean(
                vars(&[
                    ("LD_LIBRARY_PATH", "/usr/lib/colibri-social:/opt/custom/lib"),
                    ("PATH", "/usr/lib/colibri-social:/usr/bin"),
                    ("GDK_BACKEND", "wayland"),
                ]),
                None,
                Some(Path::new("/usr/lib/colibri-social")),
            );
            assert_eq!(get(&env, "LD_LIBRARY_PATH"), Some("/opt/custom/lib"));
            assert_eq!(get(&env, "PATH"), Some("/usr/lib/colibri-social:/usr/bin"));
            assert_eq!(get(&env, "GDK_BACKEND"), Some("wayland"));
        }
    }
}

#[cfg(target_os = "linux")]
mod linux {
    use std::io::{Error, ErrorKind};
    use std::os::unix::process::CommandExt;
    use std::path::PathBuf;
    use std::process::Stdio;

    pub fn open(url: &str) -> std::io::Result<()> {
        let appdir = std::env::var_os("APPDIR")
            .filter(|dir| !dir.is_empty())
            .map(PathBuf::from);
        let env = super::child_env::clean(
            std::env::vars_os(),
            appdir.as_deref(),
            crate::linux_cef::injected_library_dir(),
        );

        let mut last_error = Error::new(ErrorKind::NotFound, "no program to open links with");
        for mut command in open::commands(url) {
            command
                .env_clear()
                .envs(env.iter().map(|(key, value)| (key, value)))
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .process_group(0);
            match command.spawn() {
                Ok(mut child) => {
                    std::thread::spawn(move || {
                        let _ = child.wait();
                    });
                    return Ok(());
                }
                Err(error) => last_error = error,
            }
        }
        Err(last_error)
    }
}

#[cfg(test)]
mod tests {
    use super::has_allowed_scheme;

    #[test]
    fn web_mail_and_phone_links_are_allowed() {
        for url in [
            "https://bsky.app",
            "HTTP://x.y",
            "mailto:a@b.c",
            "tel:+491234",
        ] {
            assert!(has_allowed_scheme(url), "{url}");
        }
    }

    #[test]
    fn other_schemes_are_rejected() {
        for url in [
            "file:///etc/passwd",
            "javascript:alert(1)",
            "social.colibri:/x",
            "no-scheme",
        ] {
            assert!(!has_allowed_scheme(url), "{url}");
        }
    }
}
