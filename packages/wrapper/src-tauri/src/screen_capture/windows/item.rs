use std::ffi::c_void;

use windows::core::Result;
use windows::Graphics::Capture::GraphicsCaptureItem;
use windows::Win32::Foundation::HWND;
use windows::Win32::Graphics::Gdi::HMONITOR;
use windows::Win32::System::Com::{CoInitializeEx, COINIT_MULTITHREADED};
use windows::Win32::System::WinRT::Graphics::Capture::IGraphicsCaptureItemInterop;

pub fn join_multithreaded_apartment() {
    let _ = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) };
}

fn interop() -> Result<IGraphicsCaptureItemInterop> {
    windows::core::factory::<GraphicsCaptureItem, IGraphicsCaptureItemInterop>()
}

pub fn for_window(handle: isize) -> Result<GraphicsCaptureItem> {
    unsafe { interop()?.CreateForWindow(HWND(handle as *mut c_void)) }
}

pub fn for_monitor(handle: isize) -> Result<GraphicsCaptureItem> {
    unsafe { interop()?.CreateForMonitor(HMONITOR(handle as *mut c_void)) }
}

pub fn measured(item: &GraphicsCaptureItem, fallback: (u32, u32)) -> (u32, u32) {
    let Ok(size) = item.Size() else {
        return fallback;
    };

    if size.Width >= 2 && size.Height >= 2 {
        (size.Width as u32, size.Height as u32)
    } else {
        fallback
    }
}
