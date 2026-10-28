use std::ffi::c_void;

use objc2::rc::Retained;
use objc2_foundation::NSString;
use objc2_screen_capture_kit::SCRunningApplication;

use crate::screen_capture::{matches_router, AudioApp};

const ROUTER_BUNDLES: &[&str] = &[
    "com.rogueamoeba.loopback",
    "com.rogueamoeba.soundsource",
    "com.rogueamoeba.audiohijack",
    "com.rogueamoeba.ace",
    "com.bearisdriving.bgm",
    "com.bitgapp.eqmac",
];
const BUNDLE_PREFIX: &str = "bundle-";

const SYSTEM_OBJECT: u32 = 1;
const SCOPE_GLOBAL: u32 = u32::from_be_bytes(*b"glob");
const ELEMENT_MAIN: u32 = 0;
const PROCESS_OBJECT_LIST: u32 = u32::from_be_bytes(*b"prs#");
const PROCESS_PID: u32 = u32::from_be_bytes(*b"ppid");
const PROCESS_BUNDLE_ID: u32 = u32::from_be_bytes(*b"pbid");
const PROCESS_RUNNING_OUTPUT: u32 = u32::from_be_bytes(*b"piro");

#[repr(C)]
struct PropertyAddress {
    selector: u32,
    scope: u32,
    element: u32,
}

#[link(name = "CoreAudio", kind = "framework")]
extern "C" {
    fn AudioObjectGetPropertyDataSize(
        object: u32,
        address: *const PropertyAddress,
        qualifier_size: u32,
        qualifier: *const c_void,
        size: *mut u32,
    ) -> i32;

    fn AudioObjectGetPropertyData(
        object: u32,
        address: *const PropertyAddress,
        qualifier_size: u32,
        qualifier: *const c_void,
        size: *mut u32,
        data: *mut c_void,
    ) -> i32;
}

fn address(selector: u32) -> PropertyAddress {
    PropertyAddress {
        selector,
        scope: SCOPE_GLOBAL,
        element: ELEMENT_MAIN,
    }
}

fn read<T: Copy + Default>(object: u32, selector: u32) -> Option<T> {
    let address = address(selector);
    let mut value = T::default();
    let mut size = std::mem::size_of::<T>() as u32;
    let status = unsafe {
        AudioObjectGetPropertyData(
            object,
            &address,
            0,
            std::ptr::null(),
            &mut size,
            std::ptr::from_mut(&mut value).cast::<c_void>(),
        )
    };
    (status == 0 && size as usize == std::mem::size_of::<T>()).then_some(value)
}

fn process_objects() -> Option<Vec<u32>> {
    let address = address(PROCESS_OBJECT_LIST);
    let mut size = 0u32;
    let status = unsafe {
        AudioObjectGetPropertyDataSize(SYSTEM_OBJECT, &address, 0, std::ptr::null(), &mut size)
    };
    if status != 0 {
        return None;
    }
    let mut objects = vec![0u32; size as usize / std::mem::size_of::<u32>()];
    if objects.is_empty() {
        return Some(objects);
    }
    let status = unsafe {
        AudioObjectGetPropertyData(
            SYSTEM_OBJECT,
            &address,
            0,
            std::ptr::null(),
            &mut size,
            objects.as_mut_ptr().cast::<c_void>(),
        )
    };
    if status != 0 {
        return None;
    }
    objects.truncate(size as usize / std::mem::size_of::<u32>());
    Some(objects)
}

fn bundle_id(object: u32) -> Option<String> {
    let raw: usize = read(object, PROCESS_BUNDLE_ID)?;
    let string = unsafe { Retained::from_raw(raw as *mut NSString) }?;
    let value = string.to_string();
    (!value.trim().is_empty()).then_some(value)
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AudioProcess {
    pub pid: i32,
    pub bundle: Option<String>,
}

pub fn playing_processes() -> Option<Vec<AudioProcess>> {
    Some(
        process_objects()?
            .into_iter()
            .filter(|object| read::<u32>(*object, PROCESS_RUNNING_OUTPUT).is_some_and(|on| on != 0))
            .filter_map(|object| {
                Some(AudioProcess {
                    pid: read::<i32>(object, PROCESS_PID)?,
                    bundle: bundle_id(object),
                })
            })
            .collect(),
    )
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RunningApp {
    pub pid: i32,
    pub bundle: String,
    pub name: String,
}

impl RunningApp {
    pub fn from_application(app: &SCRunningApplication) -> Option<Self> {
        let (pid, bundle, name) = unsafe {
            (
                app.processID(),
                app.bundleIdentifier().to_string(),
                app.applicationName().to_string(),
            )
        };
        if bundle.trim().is_empty() {
            return None;
        }
        Some(Self {
            pid,
            name: if name.trim().is_empty() {
                bundle.clone()
            } else {
                name
            },
            bundle,
        })
    }

    fn owns(&self, process: &AudioProcess) -> bool {
        if process.pid == self.pid {
            return true;
        }
        process.bundle.as_deref().is_some_and(|bundle| {
            let bundle = bundle.to_lowercase();
            let own = self.bundle.to_lowercase();
            bundle == own || bundle.starts_with(&format!("{own}."))
        })
    }
}

pub fn is_router(bundle: &str) -> bool {
    matches_router(bundle, ROUTER_BUNDLES)
}

pub fn app_id(bundle: &str) -> String {
    format!("{BUNDLE_PREFIX}{bundle}")
}

pub fn audio_apps(
    running: &[RunningApp],
    playing: Option<&[AudioProcess]>,
    colibri: i32,
) -> Vec<AudioApp> {
    let mut apps: Vec<AudioApp> = Vec::new();
    for app in running {
        if app.pid == colibri {
            continue;
        }
        let router = is_router(&app.bundle);
        let audible =
            playing.is_some_and(|processes| processes.iter().any(|process| app.owns(process)));
        if !router && !audible {
            continue;
        }
        let id = app_id(&app.bundle);
        if apps.iter().any(|existing| existing.id == id) {
            continue;
        }
        apps.push(AudioApp {
            id,
            name: app.name.clone(),
            process_id: u32::try_from(app.pid).ok(),
            icon_name: None,
            binary: Some(app.bundle.clone()),
            preselected: false,
            router,
        });
    }
    apps.sort_by_key(|app| app.name.to_lowercase());
    apps
}

pub fn excluded_bundles(listed: &[AudioApp], chosen: &[String]) -> Vec<String> {
    listed
        .iter()
        .filter(|app| !chosen.contains(&app.id))
        .filter_map(|app| app.id.strip_prefix(BUNDLE_PREFIX).map(str::to_string))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn app(pid: i32, bundle: &str, name: &str) -> RunningApp {
        RunningApp {
            pid,
            bundle: bundle.to_string(),
            name: name.to_string(),
        }
    }

    fn playing(pid: i32, bundle: Option<&str>) -> AudioProcess {
        AudioProcess {
            pid,
            bundle: bundle.map(str::to_string),
        }
    }

    #[test]
    fn rogue_amoeba_tools_are_routers() {
        assert!(is_router("com.rogueamoeba.Loopback"));
        assert!(is_router("com.rogueamoeba.audiohijack"));
        assert!(is_router("com.rogueamoeba.soundsource"));
        assert!(!is_router("com.spotify.client"));
    }

    #[test]
    fn a_helper_process_counts_for_the_app_that_owns_it() {
        let chrome = app(10, "com.google.Chrome", "Google Chrome");
        assert!(chrome.owns(&playing(99, Some("com.google.Chrome.helper"))));
        assert!(chrome.owns(&playing(10, None)));
        assert!(!chrome.owns(&playing(98, Some("com.google.Chromecast"))));
    }

    #[test]
    fn only_playing_apps_and_routers_are_listed_and_colibri_is_hidden() {
        let running = vec![
            app(1, "social.colibri", "Colibri"),
            app(2, "com.spotify.client", "Spotify"),
            app(3, "com.apple.finder", "Finder"),
            app(4, "com.rogueamoeba.Loopback", "Loopback"),
        ];
        let processes = vec![playing(2, None), playing(1, Some("social.colibri"))];

        let apps = audio_apps(&running, Some(&processes), 1);
        let listed: Vec<(&str, bool)> = apps
            .iter()
            .map(|app| (app.id.as_str(), app.router))
            .collect();
        assert_eq!(
            listed,
            vec![
                ("bundle-com.rogueamoeba.Loopback", true),
                ("bundle-com.spotify.client", false),
            ]
        );
    }

    #[test]
    fn routers_are_still_listed_without_the_audio_process_list() {
        let running = vec![
            app(2, "com.spotify.client", "Spotify"),
            app(4, "com.rogueamoeba.Loopback", "Loopback"),
        ];
        let apps = audio_apps(&running, None, 1);
        assert_eq!(apps.len(), 1);
        assert!(apps[0].router);
    }

    #[test]
    fn unticked_apps_are_the_ones_left_out() {
        let running = vec![
            app(2, "com.spotify.client", "Spotify"),
            app(4, "com.rogueamoeba.Loopback", "Loopback"),
        ];
        let listed = audio_apps(&running, Some(&[playing(2, None)]), 1);
        let chosen = vec!["bundle-com.spotify.client".to_string()];
        assert_eq!(
            excluded_bundles(&listed, &chosen),
            vec!["com.rogueamoeba.Loopback".to_string()]
        );
    }
}
