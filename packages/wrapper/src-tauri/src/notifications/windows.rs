use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::OnceLock;

use tauri_winrt_notification::{IconCrop, Sound, Toast};

use super::{Activation, NotificationPayload};
use crate::native_error::NativeError;

type ActivationHandler = Box<dyn Fn(Activation) + Send + Sync>;

static HANDLER: OnceLock<ActivationHandler> = OnceLock::new();
static APP_ID: OnceLock<String> = OnceLock::new();
static UNAVAILABLE: AtomicBool = AtomicBool::new(false);

pub fn install_activation_handler(app_id: String, handler: ActivationHandler) {
    let _ = APP_ID.set(app_id);
    let _ = HANDLER.set(handler);
}

pub fn supported() -> bool {
    APP_ID.get().is_some() && !UNAVAILABLE.load(Ordering::Relaxed)
}

pub fn notify(payload: NotificationPayload) -> Result<(), NativeError> {
    let Some(app_id) = APP_ID.get() else {
        return Err(NativeError::unsupported());
    };

    if UNAVAILABLE.load(Ordering::Relaxed) {
        return Err(NativeError::unsupported());
    }

    let mut toast = Toast::new(app_id).title(&payload.title);

    toast = match payload.subtitle.as_deref() {
        Some(subtitle) => toast.text1(subtitle).text2(&payload.body),
        None => toast.text1(&payload.body),
    };

    if let Some(icon_path) = payload.icon_path.as_deref() {
        toast = toast.icon(Path::new(icon_path), IconCrop::Circular, "");
    }

    toast = toast.sound(Some(Sound::Default));

    let channel_uri = payload.channel_uri.clone();
    let message_uri = payload.message_uri.clone();

    toast = toast.on_activated(move |_action| {
        if let Some(handler) = HANDLER.get() {
            handler(Activation {
                channel_uri: channel_uri.clone(),
                message_uri: message_uri.clone(),
            });
        }
        Ok(())
    });

    toast.show().map_err(|err| {
        UNAVAILABLE.store(true, Ordering::Relaxed);
        NativeError::failed(err.to_string())
    })
}

pub fn dismiss_channel(_channel_uri: String) -> Result<(), NativeError> {
    Err(NativeError::unsupported())
}
