use std::collections::HashMap;
use std::ffi::c_void;

use windows::core::{BOOL, HSTRING, PCWSTR, PWSTR};
use windows::Win32::Foundation::{CloseHandle, HWND, LPARAM, RECT};
use windows::Win32::Graphics::Dwm::{
    DwmGetWindowAttribute, DWMWA_CLOAKED, DWMWA_EXTENDED_FRAME_BOUNDS,
};
use windows::Win32::Graphics::Gdi::{
    EnumDisplayMonitors, GetMonitorInfoW, HDC, HMONITOR, MONITORINFO, MONITORINFOEXW,
};
use windows::Win32::Storage::FileSystem::{
    GetFileVersionInfoSizeW, GetFileVersionInfoW, VerQueryValueW,
};
use windows::Win32::System::Threading::{
    OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GetWindowLongPtrW, GetWindowTextLengthW, GetWindowTextW, GetWindowThreadProcessId,
    IsWindowVisible, GWL_EXSTYLE, MONITORINFOF_PRIMARY, WS_EX_TOOLWINDOW,
};

const MIN_WINDOW_EDGE: i32 = 80;

#[derive(Debug, Clone)]
pub struct MonitorInfo {
    pub handle: isize,
    pub device: String,
    pub width: u32,
    pub height: u32,
    pub primary: bool,
}

#[derive(Debug, Clone)]
pub struct WindowInfo {
    pub handle: isize,
    pub title: String,
    pub width: u32,
    pub height: u32,
    pub app_token: String,
    pub app_name: String,
}

#[derive(Debug, Clone)]
pub struct ApplicationInfo {
    pub token: String,
    pub name: String,
    pub primary_window: isize,
    pub width: u32,
    pub height: u32,
}

pub fn app_token(image_path: &str) -> String {
    let file = image_path
        .rsplit(['\\', '/'])
        .next()
        .unwrap_or(image_path)
        .to_ascii_lowercase();

    let token: String = file
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '.' || character == '_' {
                character
            } else {
                '_'
            }
        })
        .collect();

    if token.is_empty() {
        "unknown".to_string()
    } else {
        token
    }
}

fn stem(image_path: &str) -> String {
    let file = image_path.rsplit(['\\', '/']).next().unwrap_or(image_path);
    let base = file.strip_suffix(".exe").unwrap_or(file);
    if base.is_empty() {
        "Unnamed app".to_string()
    } else {
        base.to_string()
    }
}

fn wide_string(value: &[u16]) -> String {
    let end = value
        .iter()
        .position(|unit| *unit == 0)
        .unwrap_or(value.len());
    String::from_utf16_lossy(&value[..end])
}

fn image_path(process: u32) -> Option<String> {
    let handle = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, process) }.ok()?;

    let mut buffer = [0u16; 32_768];
    let mut length = buffer.len() as u32;
    let outcome = unsafe {
        QueryFullProcessImageNameW(
            handle,
            PROCESS_NAME_WIN32,
            PWSTR(buffer.as_mut_ptr()),
            &mut length,
        )
    };
    let _ = unsafe { CloseHandle(handle) };

    outcome.ok()?;
    Some(wide_string(&buffer[..length as usize]))
}

fn file_description(path: &str) -> Option<String> {
    let wide = HSTRING::from(path);
    let size = unsafe { GetFileVersionInfoSizeW(PCWSTR(wide.as_ptr()), None) };
    if size == 0 {
        return None;
    }

    let mut block = vec![0u8; size as usize];
    unsafe {
        GetFileVersionInfoW(
            PCWSTR(wide.as_ptr()),
            None,
            size,
            block.as_mut_ptr().cast::<c_void>(),
        )
    }
    .ok()?;

    let mut translation: *mut c_void = std::ptr::null_mut();
    let mut translation_len: u32 = 0;
    let translation_key = HSTRING::from("\\VarFileInfo\\Translation");
    let found = unsafe {
        VerQueryValueW(
            block.as_ptr().cast::<c_void>(),
            PCWSTR(translation_key.as_ptr()),
            &mut translation,
            &mut translation_len,
        )
    };

    if !found.as_bool() || translation.is_null() || translation_len < 4 {
        return None;
    }

    let language = unsafe { *translation.cast::<u16>() };
    let codepage = unsafe { *translation.cast::<u16>().add(1) };

    let description_key = HSTRING::from(format!(
        "\\StringFileInfo\\{language:04x}{codepage:04x}\\FileDescription"
    ));
    let mut description: *mut c_void = std::ptr::null_mut();
    let mut description_len: u32 = 0;
    let found = unsafe {
        VerQueryValueW(
            block.as_ptr().cast::<c_void>(),
            PCWSTR(description_key.as_ptr()),
            &mut description,
            &mut description_len,
        )
    };

    if !found.as_bool() || description.is_null() || description_len == 0 {
        return None;
    }

    let text = wide_string(unsafe {
        std::slice::from_raw_parts(description.cast::<u16>(), description_len as usize)
    });

    let trimmed = text.trim().to_string();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed)
    }
}

fn is_cloaked(handle: HWND) -> bool {
    let mut cloaked: u32 = 0;
    let outcome = unsafe {
        DwmGetWindowAttribute(
            handle,
            DWMWA_CLOAKED,
            std::ptr::addr_of_mut!(cloaked).cast::<c_void>(),
            std::mem::size_of::<u32>() as u32,
        )
    };

    outcome.is_ok() && cloaked != 0
}

fn frame_bounds(handle: HWND) -> Option<RECT> {
    let mut bounds = RECT::default();
    unsafe {
        DwmGetWindowAttribute(
            handle,
            DWMWA_EXTENDED_FRAME_BOUNDS,
            std::ptr::addr_of_mut!(bounds).cast::<c_void>(),
            std::mem::size_of::<RECT>() as u32,
        )
    }
    .ok()?;
    Some(bounds)
}

fn title(handle: HWND) -> String {
    let length = unsafe { GetWindowTextLengthW(handle) };
    if length <= 0 {
        return String::new();
    }

    let mut buffer = vec![0u16; length as usize + 1];
    let written = unsafe { GetWindowTextW(handle, &mut buffer) };
    if written <= 0 {
        return String::new();
    }

    wide_string(&buffer[..written as usize])
}

unsafe extern "system" fn collect_window(handle: HWND, lparam: LPARAM) -> BOOL {
    let handles = unsafe { &mut *(lparam.0 as *mut Vec<HWND>) };
    handles.push(handle);
    BOOL(1)
}

unsafe extern "system" fn collect_monitor(
    handle: HMONITOR,
    _context: HDC,
    _clip: *mut RECT,
    lparam: LPARAM,
) -> BOOL {
    let handles = unsafe { &mut *(lparam.0 as *mut Vec<HMONITOR>) };
    handles.push(handle);
    BOOL(1)
}

pub fn monitors() -> Vec<MonitorInfo> {
    let mut handles: Vec<HMONITOR> = Vec::new();

    let _ = unsafe {
        EnumDisplayMonitors(
            None,
            None,
            Some(collect_monitor),
            LPARAM(std::ptr::addr_of_mut!(handles) as isize),
        )
    };

    handles
        .into_iter()
        .filter_map(|handle| {
            let mut info = MONITORINFOEXW {
                monitorInfo: MONITORINFO {
                    cbSize: std::mem::size_of::<MONITORINFOEXW>() as u32,
                    ..Default::default()
                },
                ..Default::default()
            };

            if !unsafe {
                GetMonitorInfoW(handle, std::ptr::addr_of_mut!(info).cast::<MONITORINFO>())
            }
            .as_bool()
            {
                return None;
            }

            let bounds = info.monitorInfo.rcMonitor;
            let width = (bounds.right - bounds.left).max(0) as u32;
            let height = (bounds.bottom - bounds.top).max(0) as u32;
            if width < 2 || height < 2 {
                return None;
            }

            Some(MonitorInfo {
                handle: handle.0 as isize,
                device: wide_string(&info.szDevice),
                width,
                height,
                primary: info.monitorInfo.dwFlags & MONITORINFOF_PRIMARY != 0,
            })
        })
        .collect()
}

pub fn windows() -> Vec<WindowInfo> {
    let mut handles: Vec<HWND> = Vec::new();

    let _ = unsafe {
        EnumWindows(
            Some(collect_window),
            LPARAM(std::ptr::addr_of_mut!(handles) as isize),
        )
    };

    let mut descriptions: HashMap<String, (String, String)> = HashMap::new();
    let mut listed = Vec::new();

    for handle in handles {
        if !unsafe { IsWindowVisible(handle) }.as_bool() || is_cloaked(handle) {
            continue;
        }

        let styles = unsafe { GetWindowLongPtrW(handle, GWL_EXSTYLE) } as u32;
        if styles & WS_EX_TOOLWINDOW.0 != 0 {
            continue;
        }

        let name = title(handle);
        if name.trim().is_empty() {
            continue;
        }

        let Some(bounds) = frame_bounds(handle) else {
            continue;
        };
        let width = bounds.right - bounds.left;
        let height = bounds.bottom - bounds.top;
        if width < MIN_WINDOW_EDGE || height < MIN_WINDOW_EDGE {
            continue;
        }

        let mut process = 0u32;
        unsafe { GetWindowThreadProcessId(handle, Some(&mut process)) };
        let Some(path) = image_path(process) else {
            continue;
        };

        let (token, app_name) = descriptions
            .entry(path.clone())
            .or_insert_with(|| {
                (
                    app_token(&path),
                    file_description(&path).unwrap_or_else(|| stem(&path)),
                )
            })
            .clone();

        listed.push(WindowInfo {
            handle: handle.0 as isize,
            title: name,
            width: width as u32,
            height: height as u32,
            app_token: token,
            app_name,
        });
    }

    listed
}

pub fn applications(windows: &[WindowInfo]) -> Vec<ApplicationInfo> {
    let mut grouped: Vec<ApplicationInfo> = Vec::new();

    for window in windows {
        let area = u64::from(window.width) * u64::from(window.height);

        if let Some(existing) = grouped
            .iter_mut()
            .find(|candidate| candidate.token == window.app_token)
        {
            if area > u64::from(existing.width) * u64::from(existing.height) {
                existing.primary_window = window.handle;
                existing.width = window.width;
                existing.height = window.height;
            }
            continue;
        }

        grouped.push(ApplicationInfo {
            token: window.app_token.clone(),
            name: window.app_name.clone(),
            primary_window: window.handle,
            width: window.width,
            height: window.height,
        });
    }

    grouped
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_app_token_is_url_safe_and_case_insensitive() {
        assert_eq!(
            app_token("C:\\Program Files\\Foo\\Chrome.EXE"),
            "chrome.exe"
        );
    }

    #[test]
    fn an_app_token_replaces_characters_that_would_need_escaping() {
        assert_eq!(app_token("C:/apps/My App!.exe"), "my_app_.exe");
    }

    #[test]
    fn an_app_token_survives_a_path_with_no_separator() {
        assert_eq!(app_token("notepad.exe"), "notepad.exe");
    }

    #[test]
    fn a_stem_drops_the_executable_suffix() {
        assert_eq!(stem("C:\\Windows\\notepad.exe"), "notepad");
    }

    #[test]
    fn a_wide_string_stops_at_the_first_terminator() {
        let units: Vec<u16> = "hi\0there".encode_utf16().collect();
        assert_eq!(wide_string(&units), "hi");
    }

    #[test]
    fn applications_group_by_token_and_keep_the_largest_window() {
        let windows = vec![
            WindowInfo {
                handle: 1,
                title: "small".to_string(),
                width: 200,
                height: 200,
                app_token: "foo.exe".to_string(),
                app_name: "Foo".to_string(),
            },
            WindowInfo {
                handle: 2,
                title: "large".to_string(),
                width: 1920,
                height: 1080,
                app_token: "foo.exe".to_string(),
                app_name: "Foo".to_string(),
            },
        ];

        let grouped = applications(&windows);
        assert_eq!(grouped.len(), 1);
        assert_eq!(grouped[0].primary_window, 2);
        assert_eq!(grouped[0].width, 1920);
    }
}
