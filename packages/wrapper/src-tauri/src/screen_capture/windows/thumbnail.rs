use std::ffi::c_void;

use windows::core::{HSTRING, PCWSTR};
use windows::Win32::Foundation::HWND;
use windows::Win32::Graphics::Gdi::{
    CreateCompatibleDC, CreateDCW, CreateDIBSection, DeleteDC, DeleteObject, GetWindowDC,
    ReleaseDC, SelectObject, SetStretchBltMode, StretchBlt, BITMAPINFO, BITMAPINFOHEADER, BI_RGB,
    DIB_RGB_COLORS, HALFTONE, HBITMAP, HDC, SRCCOPY,
};
use windows::Win32::Graphics::Imaging::{
    CLSID_WICImagingFactory, GUID_ContainerFormatPng, GUID_WICPixelFormat32bppBGRA,
    IWICImagingFactory, WICBitmapEncoderNoCache,
};
use windows::Win32::Storage::Xps::{PrintWindow, PRINT_WINDOW_FLAGS};
use windows::Win32::System::Com::StructuredStorage::CreateStreamOnHGlobal;
use windows::Win32::System::Com::{
    CoCreateInstance, CLSCTX_INPROC_SERVER, STATFLAG_NONAME, STREAM_SEEK_SET,
};

use super::enumerate::MonitorInfo;

const PW_RENDERFULLCONTENT: PRINT_WINDOW_FLAGS = PRINT_WINDOW_FLAGS(0x0000_0002);

struct Surface {
    context: HDC,
    bitmap: HBITMAP,
    previous: isize,
    bits: *mut c_void,
    width: i32,
    height: i32,
}

impl Surface {
    fn new(reference: HDC, width: i32, height: i32) -> Option<Self> {
        let context = unsafe { CreateCompatibleDC(Some(reference)) };
        if context.is_invalid() {
            return None;
        }

        let info = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: width,
                biHeight: -height,
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                ..Default::default()
            },
            ..Default::default()
        };

        let mut bits: *mut c_void = std::ptr::null_mut();
        let bitmap =
            unsafe { CreateDIBSection(Some(context), &info, DIB_RGB_COLORS, &mut bits, None, 0) };

        let Ok(bitmap) = bitmap else {
            let _ = unsafe { DeleteDC(context) };
            return None;
        };

        if bits.is_null() {
            let _ = unsafe { DeleteObject(bitmap.into()) };
            let _ = unsafe { DeleteDC(context) };
            return None;
        }

        let previous = unsafe { SelectObject(context, bitmap.into()) };

        Some(Self {
            context,
            bitmap,
            previous: previous.0 as isize,
            bits,
            width,
            height,
        })
    }

    fn pixels(&self) -> Vec<u8> {
        let length = (self.width as usize) * (self.height as usize) * 4;
        let mut pixels = vec![0u8; length];
        unsafe {
            std::ptr::copy_nonoverlapping(self.bits.cast::<u8>(), pixels.as_mut_ptr(), length);
        }

        for chunk in pixels.chunks_exact_mut(4) {
            chunk[3] = 0xFF;
        }

        pixels
    }
}

impl Drop for Surface {
    fn drop(&mut self) {
        unsafe {
            SelectObject(
                self.context,
                windows::Win32::Graphics::Gdi::HGDIOBJ(self.previous as *mut c_void),
            );
            let _ = DeleteObject(self.bitmap.into());
            let _ = DeleteDC(self.context);
        }
    }
}

fn encode_png(pixels: &[u8], width: u32, height: u32) -> Option<Vec<u8>> {
    let factory: IWICImagingFactory =
        unsafe { CoCreateInstance(&CLSID_WICImagingFactory, None, CLSCTX_INPROC_SERVER) }.ok()?;

    let stream =
        unsafe { CreateStreamOnHGlobal(windows::Win32::Foundation::HGLOBAL::default(), true) }
            .ok()?;
    let encoder =
        unsafe { factory.CreateEncoder(&GUID_ContainerFormatPng, std::ptr::null()) }.ok()?;
    unsafe { encoder.Initialize(&stream, WICBitmapEncoderNoCache) }.ok()?;

    let mut frame = None;
    unsafe { encoder.CreateNewFrame(&mut frame, std::ptr::null_mut()) }.ok()?;
    let frame = frame?;

    unsafe { frame.Initialize(None) }.ok()?;
    unsafe { frame.SetSize(width, height) }.ok()?;

    let mut format = GUID_WICPixelFormat32bppBGRA;
    unsafe { frame.SetPixelFormat(&mut format) }.ok()?;
    if format != GUID_WICPixelFormat32bppBGRA {
        return None;
    }

    unsafe { frame.WritePixels(height, width * 4, pixels) }.ok()?;
    unsafe { frame.Commit() }.ok()?;
    unsafe { encoder.Commit() }.ok()?;

    let mut stat = Default::default();
    unsafe { stream.Stat(&mut stat, STATFLAG_NONAME) }.ok()?;

    let length = stat.cbSize as usize;
    if length == 0 {
        return None;
    }

    unsafe { stream.Seek(0, STREAM_SEEK_SET, None) }.ok()?;

    let mut encoded = vec![0u8; length];
    let mut read = 0u32;
    unsafe {
        stream.Read(
            encoded.as_mut_ptr().cast::<c_void>(),
            length as u32,
            Some(&mut read),
        )
    }
    .ok()
    .ok()?;

    encoded.truncate(read as usize);
    if encoded.is_empty() {
        None
    } else {
        Some(encoded)
    }
}

pub fn for_window(handle: isize, width: u32, height: u32) -> Option<Vec<u8>> {
    if width < 2 || height < 2 {
        return None;
    }

    let window = HWND(handle as *mut c_void);
    let (thumb_width, thumb_height) = super::thumbnail_size(width, height);

    let reference = unsafe { GetWindowDC(Some(window)) };
    if reference.is_invalid() {
        return None;
    }

    let outcome = (|| {
        let full = Surface::new(reference, width as i32, height as i32)?;
        if !unsafe { PrintWindow(window, full.context, PW_RENDERFULLCONTENT) }.as_bool() {
            return None;
        }

        let thumb = Surface::new(reference, thumb_width as i32, thumb_height as i32)?;
        unsafe { SetStretchBltMode(thumb.context, HALFTONE) };
        unsafe {
            StretchBlt(
                thumb.context,
                0,
                0,
                thumb_width as i32,
                thumb_height as i32,
                Some(full.context),
                0,
                0,
                width as i32,
                height as i32,
                SRCCOPY,
            )
        }
        .as_bool()
        .then_some(())?;

        encode_png(&thumb.pixels(), thumb_width as u32, thumb_height as u32)
    })();

    unsafe { ReleaseDC(Some(window), reference) };
    outcome
}

pub fn for_monitor(monitor: &MonitorInfo) -> Option<Vec<u8>> {
    if monitor.width < 2 || monitor.height < 2 {
        return None;
    }

    let device = HSTRING::from(monitor.device.as_str());
    let screen = unsafe {
        CreateDCW(
            PCWSTR(device.as_ptr()),
            PCWSTR(device.as_ptr()),
            PCWSTR::null(),
            None,
        )
    };
    if screen.is_invalid() {
        return None;
    }

    let (thumb_width, thumb_height) = super::thumbnail_size(monitor.width, monitor.height);

    let outcome = (|| {
        let thumb = Surface::new(screen, thumb_width as i32, thumb_height as i32)?;
        unsafe { SetStretchBltMode(thumb.context, HALFTONE) };
        unsafe {
            StretchBlt(
                thumb.context,
                0,
                0,
                thumb_width as i32,
                thumb_height as i32,
                Some(screen),
                0,
                0,
                monitor.width as i32,
                monitor.height as i32,
                SRCCOPY,
            )
        }
        .as_bool()
        .then_some(())?;

        encode_png(&thumb.pixels(), thumb_width as u32, thumb_height as u32)
    })();

    let _ = unsafe { DeleteDC(screen) };
    outcome
}
