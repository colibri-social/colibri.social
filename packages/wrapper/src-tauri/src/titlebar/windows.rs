use tauri::{Emitter, WebviewWindow};
use windows::core::w;
use windows::Win32::Foundation::{HANDLE, HWND, LPARAM, LRESULT, POINT, WPARAM};
use windows::Win32::UI::Input::KeyboardAndMouse::{
    TrackMouseEvent, TRACKMOUSEEVENT, TME_LEAVE, TME_NONCLIENT,
};
use windows::Win32::UI::Shell::{DefSubclassProc, RemoveWindowSubclass, SetWindowSubclass};
use windows::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DestroyWindow, EnableMenuItem, GetCursorPos, GetPropW, GetSystemMenu,
    GetWindowLongPtrW, IsZoomed, LoadCursorW, PostMessageW, RemovePropW, SendMessageW, SetCursor,
    SetForegroundWindow, SetMenuDefaultItem, SetPropW, SetWindowPos, TrackPopupMenu, GWL_STYLE,
    HTMAXBUTTON, HWND_TOP, IDC_ARROW, MF_BYCOMMAND, MF_ENABLED, MF_GRAYED, SC_CLOSE, SC_MAXIMIZE,
    SC_MINIMIZE, SC_MOVE, SC_RESTORE, SC_SIZE, SWP_NOACTIVATE, TPM_RETURNCMD, TPM_RIGHTBUTTON,
    WM_ERASEBKGND, WM_NCDESTROY, WM_NCLBUTTONDOWN, WM_NCLBUTTONUP, WM_NCMOUSELEAVE, WM_NCHITTEST,
    WM_SETCURSOR, WM_SYSCOMMAND, WS_CHILD, WS_SIZEBOX, WS_VISIBLE,
};

use crate::native_error::NativeError;

use super::CONTROLS_EVENT;

const SNAP_CHILD_PROP: windows::core::PCWSTR = w!("ColibriSnapChild");
const SNAP_STATE_PROP: windows::core::PCWSTR = w!("ColibriSnapState");
const SUBCLASS_ID: usize = 0xC01B;
const SNAP_LAYOUTS_MIN_BUILD: u32 = 22000;

struct SnapState {
    window: WebviewWindow,
    parent: HWND,
    hovering: bool,
}

fn snap_layouts_supported() -> bool {
    windows_version::OsVersion::current().build >= SNAP_LAYOUTS_MIN_BUILD
}

fn parent_hwnd(window: &WebviewWindow) -> Result<HWND, NativeError> {
    window
        .hwnd()
        .map_err(|e| NativeError::failed(e.to_string()))
}

fn child_of(parent: HWND) -> Option<HWND> {
    let handle = unsafe { GetPropW(parent, SNAP_CHILD_PROP) };
    if handle.0.is_null() {
        None
    } else {
        Some(HWND(handle.0))
    }
}

fn emit_hover(window: &WebviewWindow, hovering: bool) {
    let _ = window.emit(
        CONTROLS_EVENT,
        serde_json::json!({
            "button": if hovering { Some("maximize") } else { None },
            "pressed": false,
        }),
    );
}

unsafe extern "system" fn snap_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
    _id: usize,
    _data: usize,
) -> LRESULT {
    if msg == WM_NCDESTROY {
        let _ = unsafe { RemoveWindowSubclass(hwnd, Some(snap_proc), SUBCLASS_ID) };
        if let Ok(handle) = unsafe { RemovePropW(hwnd, SNAP_STATE_PROP) } {
            if !handle.0.is_null() {
                drop(unsafe { Box::from_raw(handle.0 as *mut SnapState) });
            }
        }
        return unsafe { DefSubclassProc(hwnd, msg, wparam, lparam) };
    }

    let raw = unsafe { GetPropW(hwnd, SNAP_STATE_PROP) };
    if raw.0.is_null() {
        return unsafe { DefSubclassProc(hwnd, msg, wparam, lparam) };
    }
    let state = unsafe { &mut *(raw.0 as *mut SnapState) };

    match msg {
        WM_NCHITTEST => {
            if !state.hovering {
                state.hovering = true;
                emit_hover(&state.window, true);

                let mut track = TRACKMOUSEEVENT {
                    cbSize: std::mem::size_of::<TRACKMOUSEEVENT>() as u32,
                    dwFlags: TME_LEAVE | TME_NONCLIENT,
                    hwndTrack: hwnd,
                    dwHoverTime: 0,
                };
                let _ = unsafe { TrackMouseEvent(&mut track) };
            }
            LRESULT(HTMAXBUTTON as isize)
        }
        WM_NCMOUSELEAVE => {
            if state.hovering {
                state.hovering = false;
                emit_hover(&state.window, false);
            }
            LRESULT(0)
        }
        WM_NCLBUTTONDOWN => {
            if wparam.0 as u32 == HTMAXBUTTON {
                return LRESULT(0);
            }
            unsafe { DefSubclassProc(hwnd, msg, wparam, lparam) }
        }
        WM_NCLBUTTONUP => {
            if wparam.0 as u32 == HTMAXBUTTON {
                let command = if unsafe { IsZoomed(state.parent) }.as_bool() {
                    SC_RESTORE
                } else {
                    SC_MAXIMIZE
                };
                unsafe {
                    SendMessageW(
                        state.parent,
                        WM_SYSCOMMAND,
                        Some(WPARAM(command as usize)),
                        Some(LPARAM(0)),
                    )
                };
                return LRESULT(0);
            }
            unsafe { DefSubclassProc(hwnd, msg, wparam, lparam) }
        }
        WM_SETCURSOR => {
            if let Ok(cursor) = unsafe { LoadCursorW(None, IDC_ARROW) } {
                unsafe { SetCursor(Some(cursor)) };
            }
            LRESULT(1)
        }
        WM_ERASEBKGND => LRESULT(1),
        _ => unsafe { DefSubclassProc(hwnd, msg, wparam, lparam) },
    }
}

pub fn set_snap_rect(
    window: &WebviewWindow,
    x: i32,
    y: i32,
    width: i32,
    height: i32,
) -> Result<(), NativeError> {
    if !snap_layouts_supported() || width <= 0 || height <= 0 {
        return Ok(());
    }

    let parent_bits = parent_hwnd(window)?.0 as isize;
    let target = window.clone();

    window
        .run_on_main_thread(move || {
            let parent = HWND(parent_bits as *mut _);

            if let Some(child) = child_of(parent) {
                let _ = unsafe {
                    SetWindowPos(child, Some(HWND_TOP), x, y, width, height, SWP_NOACTIVATE)
                };
                return;
            }

            let Ok(child) = (unsafe {
                CreateWindowExW(
                    Default::default(),
                    w!("STATIC"),
                    windows::core::PCWSTR::null(),
                    WS_CHILD | WS_VISIBLE,
                    x,
                    y,
                    width,
                    height,
                    Some(parent),
                    None,
                    None,
                    None,
                )
            }) else {
                return;
            };

            let state = Box::into_raw(Box::new(SnapState {
                window: target,
                parent,
                hovering: false,
            }));

            unsafe {
                if SetPropW(child, SNAP_STATE_PROP, Some(HANDLE(state as *mut _))).is_err() {
                    drop(Box::from_raw(state));
                    let _ = DestroyWindow(child);
                    return;
                }

                if !SetWindowSubclass(child, Some(snap_proc), SUBCLASS_ID, 0).as_bool() {
                    let _ = RemovePropW(child, SNAP_STATE_PROP);
                    drop(Box::from_raw(state));
                    let _ = DestroyWindow(child);
                    return;
                }

                let _ = SetPropW(parent, SNAP_CHILD_PROP, Some(HANDLE(child.0)));
            }
        })
        .map_err(|e| NativeError::failed(e.to_string()))
}

pub fn clear_snap_rect(window: &WebviewWindow) -> Result<(), NativeError> {
    let parent_bits = parent_hwnd(window)?.0 as isize;

    window
        .run_on_main_thread(move || {
            let parent = HWND(parent_bits as *mut _);
            let Some(child) = child_of(parent) else {
                return;
            };

            unsafe {
                let _ = RemovePropW(parent, SNAP_CHILD_PROP);
                let _ = DestroyWindow(child);
            }
        })
        .map_err(|e| NativeError::failed(e.to_string()))
}

pub fn show_system_menu(window: &WebviewWindow) -> Result<(), NativeError> {
    let parent_bits = parent_hwnd(window)?.0 as isize;

    window
        .run_on_main_thread(move || unsafe {
            let parent = HWND(parent_bits as *mut _);
            let menu = GetSystemMenu(parent, false);
            if menu.0.is_null() {
                return;
            }

            let zoomed = IsZoomed(parent).as_bool();
            let sizable = (GetWindowLongPtrW(parent, GWL_STYLE) as u32 & WS_SIZEBOX.0) != 0;

            let enable = |id: u32, on: bool| {
                let _ = EnableMenuItem(
                    menu,
                    id,
                    if on {
                        MF_BYCOMMAND | MF_ENABLED
                    } else {
                        MF_BYCOMMAND | MF_GRAYED
                    },
                );
            };
            enable(SC_RESTORE, zoomed);
            enable(SC_MOVE, !zoomed);
            enable(SC_SIZE, sizable && !zoomed);
            enable(SC_MINIMIZE, true);
            enable(SC_MAXIMIZE, sizable && !zoomed);
            enable(SC_CLOSE, true);
            let _ = SetMenuDefaultItem(menu, u32::MAX, 0);

            let mut point = POINT::default();
            if GetCursorPos(&mut point).is_err() {
                return;
            }
            let _ = SetForegroundWindow(parent);

            let chosen = TrackPopupMenu(
                menu,
                TPM_RETURNCMD | TPM_RIGHTBUTTON,
                point.x,
                point.y,
                None,
                parent,
                None,
            );

            let command = chosen.0 as u32;
            if command != 0 {
                let _ = PostMessageW(
                    Some(parent),
                    WM_SYSCOMMAND,
                    WPARAM(command as usize),
                    LPARAM(0),
                );
            }
        })
        .map_err(|e| NativeError::failed(e.to_string()))
}
