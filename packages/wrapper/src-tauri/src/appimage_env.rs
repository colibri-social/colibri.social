use std::ffi::{OsStr, OsString};
use std::path::{Component, Path, PathBuf};

pub const RELAUNCH_GUARD: &str = "COLIBRI_APPIMAGE_RELAUNCHED";
pub const FORCED_GDK_BACKEND_MARKER: &str = "COLIBRI_FORCED_GDK_BACKEND";

const MOUNT_PREFIXES: [&str; 2] = [".mount_", "appimage_extracted_"];

const CHECKED: [&str; 3] = ["LD_LIBRARY_PATH", "APPDIR", "PATH"];

const INJECTED: [&str; 18] = [
    "APPDIR",
    "APPIMAGE",
    "ARGV0",
    "OWD",
    "GDK_BACKEND",
    "GDK_PIXBUF_MODULE_FILE",
    "GIO_EXTRA_MODULES",
    "GI_TYPELIB_PATH",
    "GSETTINGS_SCHEMA_DIR",
    "GTK_DATA_PREFIX",
    "GTK_EXE_PREFIX",
    "GTK_IM_MODULE_FILE",
    "GTK_PATH",
    "GTK_THEME",
    "PYTHONHOME",
    "PYTHONDONTWRITEBYTECODE",
    RELAUNCH_GUARD,
    FORCED_GDK_BACKEND_MARKER,
];

const LISTS: [&str; 9] = [
    "PATH",
    "LD_LIBRARY_PATH",
    "XDG_DATA_DIRS",
    "PYTHONPATH",
    "PERLLIB",
    "QT_PLUGIN_PATH",
    "GST_PLUGIN_SYSTEM_PATH",
    "GST_PLUGIN_SYSTEM_PATH_1_0",
    "GST_PLUGIN_PATH",
];

#[derive(Debug, PartialEq, Eq)]
pub struct Relaunch {
    pub program: OsString,
    pub env: Vec<(OsString, OsString)>,
    pub working_dir: Option<PathBuf>,
}

pub fn mount_root(path: &Path) -> Option<PathBuf> {
    let mut root = PathBuf::new();
    for component in path.components() {
        root.push(component);
        if let Component::Normal(name) = component {
            let name = name.to_string_lossy();
            if MOUNT_PREFIXES.iter().any(|prefix| name.starts_with(prefix)) {
                return Some(root);
            }
        }
    }
    None
}

fn is_stale(entry: &Path, current: &Path) -> bool {
    mount_root(entry).is_some_and(|root| root != current)
}

fn value<'a>(vars: &'a [(OsString, OsString)], key: &str) -> Option<&'a OsStr> {
    vars.iter()
        .find(|(name, _)| name == key)
        .map(|(_, value)| value.as_os_str())
        .filter(|value| !value.is_empty())
}

pub fn is_contaminated(vars: &[(OsString, OsString)], current_exe: &Path) -> bool {
    if value(vars, "APPIMAGE").is_none() || value(vars, RELAUNCH_GUARD).is_some() {
        return false;
    }
    let Some(current) = mount_root(current_exe) else {
        return false;
    };
    CHECKED.iter().any(|key| {
        value(vars, key).is_some_and(|value| {
            std::env::split_paths(value).any(|entry| is_stale(&entry, &current))
        })
    })
}

fn clean_list(value: &OsStr) -> Option<OsString> {
    let mut kept: Vec<PathBuf> = Vec::new();
    for entry in std::env::split_paths(value) {
        if entry.as_os_str().is_empty() || mount_root(&entry).is_some() || kept.contains(&entry) {
            continue;
        }
        kept.push(entry);
    }
    if kept.is_empty() {
        return None;
    }
    std::env::join_paths(kept).ok()
}

fn outside_mounts(dir: Option<&OsStr>) -> Option<PathBuf> {
    dir.map(PathBuf::from)
        .filter(|dir| dir.is_absolute() && mount_root(dir).is_none())
}

pub fn relaunch(vars: &[(OsString, OsString)], current_exe: &Path) -> Option<Relaunch> {
    if !is_contaminated(vars, current_exe) {
        return None;
    }
    let program = value(vars, "APPIMAGE")?.to_owned();
    let working_dir =
        outside_mounts(value(vars, "OWD")).or_else(|| outside_mounts(value(vars, "HOME")));
    let mut env: Vec<(OsString, OsString)> = vars
        .iter()
        .filter(|(key, _)| !INJECTED.iter().any(|name| key == *name))
        .filter_map(|(key, value)| {
            if LISTS.iter().any(|name| key == *name) {
                clean_list(value).map(|value| (key.clone(), value))
            } else {
                Some((key.clone(), value.clone()))
            }
        })
        .collect();
    env.push((RELAUNCH_GUARD.into(), "1".into()));
    Some(Relaunch {
        program,
        env,
        working_dir,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const OLD: &str = "/tmp/.mount_ColibrOLD";
    const NEW_EXE: &str = "/tmp/.mount_ColibrNEW/usr/bin/colibri-social";

    fn vars(pairs: &[(&str, String)]) -> Vec<(OsString, OsString)> {
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

    fn restarted_env() -> Vec<(OsString, OsString)> {
        let new = "/tmp/.mount_ColibrNEW";
        vars(&[
            ("APPIMAGE", "/home/me/Applications/Colibri.AppImage".into()),
            ("APPDIR", OLD.into()),
            ("ARGV0", "/home/me/Applications/Colibri.AppImage".into()),
            ("OWD", format!("{OLD}/usr")),
            ("HOME", "/home/me".into()),
            (
                "LD_LIBRARY_PATH",
                format!("{new}/usr/lib/:{new}/lib/:{OLD}/usr/lib/:{OLD}/lib/:/opt/custom/lib"),
            ),
            (
                "PATH",
                format!("{new}/usr/bin/:{new}/bin/:{OLD}/usr/bin/:/usr/local/bin:/usr/bin:"),
            ),
            (
                "XDG_DATA_DIRS",
                format!("{new}/usr/share:/usr/share:{OLD}/usr/share:/usr/share:/usr/local/share"),
            ),
            ("PYTHONHOME", format!("{new}/usr/")),
            ("PYTHONDONTWRITEBYTECODE", "1".into()),
            (
                "PERLLIB",
                format!("{new}/usr/share/perl5/:{OLD}/usr/share/perl5/:"),
            ),
            ("GTK_THEME", "Adwaita:dark".into()),
            ("GTK_PATH", format!("{OLD}//usr/lib/gtk-3.0")),
            (
                "GSETTINGS_SCHEMA_DIR",
                format!("{OLD}//usr/share/glib-2.0/schemas"),
            ),
            ("GDK_BACKEND", "x11".into()),
            (FORCED_GDK_BACKEND_MARKER, "x11".into()),
            ("WAYLAND_DISPLAY", "wayland-0".into()),
            ("APPIMAGE_GTK_THEME", "Adwaita:light".into()),
        ])
    }

    #[test]
    fn mount_roots_are_found_by_directory_name() {
        assert_eq!(
            mount_root(Path::new("/tmp/.mount_ColibrX//usr/lib/gtk-3.0")),
            Some(PathBuf::from("/tmp/.mount_ColibrX"))
        );
        assert_eq!(
            mount_root(Path::new(
                "/run/user/1000/appimage_extracted_ab12/usr/bin/app"
            )),
            Some(PathBuf::from("/run/user/1000/appimage_extracted_ab12"))
        );
        assert_eq!(mount_root(Path::new("/usr/lib/colibri-social")), None);
    }

    #[test]
    fn a_restart_from_an_older_mount_is_contaminated() {
        assert!(is_contaminated(&restarted_env(), Path::new(NEW_EXE)));
    }

    #[test]
    fn a_stale_appdir_alone_is_contaminated() {
        let env = vars(&[
            ("APPIMAGE", "/home/me/Colibri.AppImage".into()),
            ("APPDIR", OLD.into()),
            ("LD_LIBRARY_PATH", "/tmp/.mount_ColibrNEW/usr/lib/".into()),
        ]);
        assert!(is_contaminated(&env, Path::new(NEW_EXE)));
    }

    #[test]
    fn a_fresh_launch_is_clean() {
        let new = "/tmp/.mount_ColibrNEW";
        let env = vars(&[
            ("APPIMAGE", "/home/me/Colibri.AppImage".into()),
            ("APPDIR", new.into()),
            ("LD_LIBRARY_PATH", format!("{new}/usr/lib/:{new}/lib/:")),
            ("PATH", format!("{new}/usr/bin/:/usr/bin")),
        ]);
        assert!(!is_contaminated(&env, Path::new(NEW_EXE)));
        assert_eq!(relaunch(&env, Path::new(NEW_EXE)), None);
    }

    #[test]
    fn the_guard_prevents_a_second_relaunch() {
        let mut env = restarted_env();
        env.push((RELAUNCH_GUARD.into(), "1".into()));
        assert!(!is_contaminated(&env, Path::new(NEW_EXE)));
        assert_eq!(relaunch(&env, Path::new(NEW_EXE)), None);
    }

    #[test]
    fn non_appimage_installs_are_never_relaunched() {
        let mut env = restarted_env();
        env.retain(|(key, _)| key != "APPIMAGE");
        assert!(!is_contaminated(&env, Path::new(NEW_EXE)));
        assert!(!is_contaminated(
            &restarted_env(),
            Path::new("/usr/bin/colibri-social")
        ));
    }

    #[test]
    fn the_relaunch_starts_the_appimage_with_a_clean_environment() {
        let plan = relaunch(&restarted_env(), Path::new(NEW_EXE)).expect("relaunch");
        assert_eq!(plan.program, "/home/me/Applications/Colibri.AppImage");
        assert_eq!(plan.working_dir, Some(PathBuf::from("/home/me")));

        let env = plan.env;
        for key in [
            "APPIMAGE",
            "APPDIR",
            "ARGV0",
            "OWD",
            "PYTHONHOME",
            "PYTHONDONTWRITEBYTECODE",
            "PERLLIB",
            "GTK_THEME",
            "GTK_PATH",
            "GSETTINGS_SCHEMA_DIR",
            "GDK_BACKEND",
            FORCED_GDK_BACKEND_MARKER,
        ] {
            assert_eq!(get(&env, key), None, "{key}");
        }
        assert_eq!(get(&env, "LD_LIBRARY_PATH"), Some("/opt/custom/lib"));
        assert_eq!(get(&env, "PATH"), Some("/usr/local/bin:/usr/bin"));
        assert_eq!(
            get(&env, "XDG_DATA_DIRS"),
            Some("/usr/share:/usr/local/share")
        );
        assert_eq!(get(&env, "HOME"), Some("/home/me"));
        assert_eq!(get(&env, "WAYLAND_DISPLAY"), Some("wayland-0"));
        assert_eq!(get(&env, "APPIMAGE_GTK_THEME"), Some("Adwaita:light"));
        assert_eq!(get(&env, RELAUNCH_GUARD), Some("1"));
    }

    #[test]
    fn the_original_working_dir_is_kept_when_it_is_outside_a_mount() {
        let mut env = restarted_env();
        env.retain(|(key, _)| key != "OWD");
        env.push(("OWD".into(), "/home/me/projects".into()));
        let plan = relaunch(&env, Path::new(NEW_EXE)).expect("relaunch");
        assert_eq!(plan.working_dir, Some(PathBuf::from("/home/me/projects")));
    }
}
