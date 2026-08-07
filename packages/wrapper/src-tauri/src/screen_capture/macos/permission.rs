use objc2_app_kit::NSWorkspace;
use objc2_core_graphics::{CGPreflightScreenCaptureAccess, CGRequestScreenCaptureAccess};
use objc2_foundation::{NSString, NSURL};

use crate::native_error::NativeError;

const SETTINGS_URL: &str =
    "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture";

pub fn granted() -> bool {
    CGPreflightScreenCaptureAccess()
}

pub fn request() -> bool {
    if granted() {
        return true;
    }
    CGRequestScreenCaptureAccess()
}

pub fn open_settings() -> Result<(), NativeError> {
    let url = NSURL::URLWithString(&NSString::from_str(SETTINGS_URL))
        .ok_or_else(|| NativeError::failed("could not build the settings url"))?;

    let opened = NSWorkspace::sharedWorkspace().openURL(&url);
    if opened {
        Ok(())
    } else {
        Err(NativeError::failed(
            "macOS declined to open System Settings",
        ))
    }
}
