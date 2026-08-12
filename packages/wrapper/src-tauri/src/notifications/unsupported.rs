use super::NotificationPayload;
use crate::native_error::NativeError;

pub fn supported() -> bool {
    false
}

pub fn notify(_payload: NotificationPayload) -> Result<(), NativeError> {
    Err(NativeError::unsupported())
}

pub fn dismiss_channel(_channel_uri: String) -> Result<(), NativeError> {
    Err(NativeError::unsupported())
}
