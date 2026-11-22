use std::collections::{HashMap, HashSet};

use windows::core::Interface;
use windows::Win32::Foundation::{CloseHandle, S_OK};
use windows::Win32::Media::Audio::{
    eRender, AudioSessionStateExpired, IAudioSessionControl2, IAudioSessionManager2,
    IMMDeviceEnumerator, MMDeviceEnumerator, DEVICE_STATE_ACTIVE,
};
use windows::Win32::System::Com::{CoCreateInstance, CLSCTX_ALL};
use windows::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS,
};
use windows::Win32::System::Threading::GetCurrentProcessId;

use super::enumerate;
use crate::native_error::NativeError;
use crate::screen_capture::{matches_router, AudioApp};

const ROUTER_PROCESSES: &[&str] = &[
    "voicemeeter",
    "vbaudio",
    "vb-audio",
    "vbmatrix",
    "steelseriessonar",
    "wavelink",
    "nvidia broadcast",
];
const ANCESTRY_LIMIT: usize = 64;
const PROCESS_PREFIX: &str = "process-";
const PROCESS_SEPARATOR: char = '.';

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Process {
    pub parent: u32,
    pub exe: String,
}

pub type ProcessTable = HashMap<u32, Process>;

struct Snapshot(windows::Win32::Foundation::HANDLE);

impl Drop for Snapshot {
    fn drop(&mut self) {
        let _ = unsafe { CloseHandle(self.0) };
    }
}

fn wide_string(value: &[u16]) -> String {
    let end = value
        .iter()
        .position(|unit| *unit == 0)
        .unwrap_or(value.len());
    String::from_utf16_lossy(&value[..end])
}

pub fn process_table() -> ProcessTable {
    let mut table = ProcessTable::new();
    let Ok(handle) = (unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) }) else {
        return table;
    };
    let snapshot = Snapshot(handle);

    let mut entry = PROCESSENTRY32W {
        dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
        ..Default::default()
    };
    if unsafe { Process32FirstW(snapshot.0, &mut entry) }.is_err() {
        return table;
    }
    loop {
        table.insert(
            entry.th32ProcessID,
            Process {
                parent: entry.th32ParentProcessID,
                exe: wide_string(&entry.szExeFile),
            },
        );
        if unsafe { Process32NextW(snapshot.0, &mut entry) }.is_err() {
            break;
        }
    }
    table
}

fn descends_from(pid: u32, ancestor: u32, table: &ProcessTable) -> bool {
    let mut current = pid;
    for _ in 0..ANCESTRY_LIMIT {
        if current == ancestor {
            return true;
        }
        match table.get(&current) {
            Some(process) if process.parent != current && process.parent != 0 => {
                current = process.parent
            }
            _ => return false,
        }
    }
    false
}

fn session_processes() -> windows::core::Result<HashSet<u32>> {
    let enumerator: IMMDeviceEnumerator =
        unsafe { CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL) }?;
    let devices = unsafe { enumerator.EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE) }?;
    let mut found = HashSet::new();

    for index in 0..unsafe { devices.GetCount() }? {
        let Ok(device) = (unsafe { devices.Item(index) }) else {
            continue;
        };
        let Ok(manager) = (unsafe { device.Activate::<IAudioSessionManager2>(CLSCTX_ALL, None) })
        else {
            continue;
        };
        let Ok(sessions) = (unsafe { manager.GetSessionEnumerator() }) else {
            continue;
        };
        let count = unsafe { sessions.GetCount() }.unwrap_or(0);
        for position in 0..count {
            let Ok(control) = (unsafe { sessions.GetSession(position) }) else {
                continue;
            };
            if unsafe { control.GetState() }.is_ok_and(|state| state == AudioSessionStateExpired) {
                continue;
            }
            let Ok(control) = control.cast::<IAudioSessionControl2>() else {
                continue;
            };
            if unsafe { control.IsSystemSoundsSession() } == S_OK {
                continue;
            }
            if let Ok(pid) = unsafe { control.GetProcessId() } {
                if pid != 0 {
                    found.insert(pid);
                }
            }
        }
    }
    Ok(found)
}

fn encode(roots: &[u32]) -> String {
    let joined: Vec<String> = roots.iter().map(u32::to_string).collect();
    format!(
        "{PROCESS_PREFIX}{}",
        joined.join(&PROCESS_SEPARATOR.to_string())
    )
}

fn decode(id: &str) -> Vec<u32> {
    id.strip_prefix(PROCESS_PREFIX)
        .map(|rest| {
            rest.split(PROCESS_SEPARATOR)
                .filter_map(|pid| pid.parse().ok())
                .filter(|pid| *pid != 0)
                .collect()
        })
        .unwrap_or_default()
}

pub fn is_router(exe: &str) -> bool {
    matches_router(exe, ROUTER_PROCESSES)
}

struct Group {
    exe: String,
    roots: Vec<u32>,
    router: bool,
}

fn group(sessions: &HashSet<u32>, table: &ProcessTable, colibri: u32) -> Vec<Group> {
    let visible: HashSet<u32> = sessions
        .iter()
        .copied()
        .filter(|pid| table.contains_key(pid) && !descends_from(*pid, colibri, table))
        .collect();

    let root_of = |pid: u32| {
        let mut root = pid;
        let mut current = pid;
        for _ in 0..ANCESTRY_LIMIT {
            match table.get(&current) {
                Some(process) if process.parent != current && process.parent != 0 => {
                    current = process.parent;
                    if visible.contains(&current) {
                        root = current;
                    }
                }
                _ => break,
            }
        }
        root
    };

    let mut ordered: Vec<u32> = visible.iter().copied().collect();
    ordered.sort_unstable();

    let mut groups: Vec<Group> = Vec::new();
    for pid in ordered {
        let root = root_of(pid);
        let router = table
            .get(&pid)
            .is_some_and(|process| is_router(&process.exe));
        let exe = table
            .get(&root)
            .map(|process| process.exe.clone())
            .unwrap_or_default();
        let key = exe.to_lowercase();

        if let Some(existing) = groups
            .iter_mut()
            .find(|candidate| candidate.exe.to_lowercase() == key)
        {
            if !existing.roots.contains(&root) {
                existing.roots.push(root);
            }
            existing.router |= router;
            continue;
        }

        groups.push(Group {
            router: router || is_router(&exe),
            exe,
            roots: vec![root],
        });
    }
    groups
}

fn stem(exe: &str) -> String {
    let base = exe
        .strip_suffix(".exe")
        .or_else(|| exe.strip_suffix(".EXE"))
        .unwrap_or(exe);
    if base.trim().is_empty() {
        "Unnamed app".to_string()
    } else {
        base.to_string()
    }
}

pub fn list_apps() -> Result<Vec<AudioApp>, NativeError> {
    super::item::join_multithreaded_apartment();
    let sessions = session_processes()
        .map_err(|error| NativeError::failed(format!("could not list audio apps: {error}")))?;
    let table = process_table();
    let colibri = unsafe { GetCurrentProcessId() };

    let mut apps: Vec<AudioApp> = group(&sessions, &table, colibri)
        .into_iter()
        .map(|group| {
            let first = group.roots[0];
            AudioApp {
                id: encode(&group.roots),
                name: enumerate::process_name(first).unwrap_or_else(|| stem(&group.exe)),
                process_id: Some(first),
                icon_name: None,
                binary: Some(group.exe),
                preselected: false,
                router: group.router,
            }
        })
        .collect();

    apps.sort_by_key(|app| app.name.to_lowercase());
    Ok(apps)
}

fn outermost(chosen: &[u32], table: &ProcessTable, colibri: u32) -> Vec<u32> {
    let mut unique: Vec<u32> = Vec::new();
    for pid in chosen {
        if !unique.contains(pid) {
            unique.push(*pid);
        }
    }
    unique
        .iter()
        .copied()
        .filter(|pid| !descends_from(*pid, colibri, table))
        .filter(|pid| {
            !unique
                .iter()
                .any(|other| other != pid && descends_from(*pid, *other, table))
        })
        .collect()
}

pub fn chosen_processes(ids: &[String]) -> Vec<u32> {
    let chosen: Vec<u32> = ids.iter().flat_map(|id| decode(id)).collect();
    outermost(&chosen, &process_table(), unsafe { GetCurrentProcessId() })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn table(entries: &[(u32, u32, &str)]) -> ProcessTable {
        entries
            .iter()
            .map(|(pid, parent, exe)| {
                (
                    *pid,
                    Process {
                        parent: *parent,
                        exe: exe.to_string(),
                    },
                )
            })
            .collect()
    }

    #[test]
    fn known_routers_are_recognised_by_their_executable() {
        for exe in [
            "voicemeeter8x64.exe",
            "VoicemeeterPro_x64.exe",
            "SteelSeriesSonar.exe",
            "WaveLink.exe",
            "NVIDIA Broadcast.exe",
        ] {
            assert!(is_router(exe), "{exe}");
        }
        assert!(!is_router("Spotify.exe"));
    }

    #[test]
    fn an_app_id_survives_a_round_trip() {
        assert_eq!(decode(&encode(&[12, 34])), vec![12, 34]);
        assert!(decode("name-Spotify").is_empty());
        assert!(decode("process-").is_empty());
    }

    #[test]
    fn sessions_are_grouped_by_executable_and_colibri_is_hidden() {
        let processes = table(&[
            (10, 1, "colibri.exe"),
            (11, 10, "msedgewebview2.exe"),
            (20, 1, "chrome.exe"),
            (21, 20, "chrome.exe"),
            (22, 20, "chrome.exe"),
            (30, 1, "voicemeeter8x64.exe"),
        ]);
        let sessions: HashSet<u32> = [11, 21, 22, 30].into_iter().collect();

        let groups = group(&sessions, &processes, 10);
        let summary: Vec<(&str, Vec<u32>, bool)> = groups
            .iter()
            .map(|group| (group.exe.as_str(), group.roots.clone(), group.router))
            .collect();
        assert_eq!(
            summary,
            vec![
                ("chrome.exe", vec![21, 22], false),
                ("voicemeeter8x64.exe", vec![30], true),
            ]
        );
    }

    #[test]
    fn a_child_session_folds_into_its_parent_session() {
        let processes = table(&[(40, 1, "obs64.exe"), (41, 40, "obs-browser-page.exe")]);
        let sessions: HashSet<u32> = [40, 41].into_iter().collect();

        let groups = group(&sessions, &processes, 10);
        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].roots, vec![40]);
    }

    #[test]
    fn a_chosen_child_is_dropped_when_its_parent_is_chosen_too() {
        let processes = table(&[(20, 1, "a.exe"), (21, 20, "b.exe"), (10, 1, "colibri.exe")]);
        assert_eq!(outermost(&[21, 20, 20, 10], &processes, 10), vec![20]);
    }
}
