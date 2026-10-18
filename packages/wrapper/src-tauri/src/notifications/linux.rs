use std::collections::HashMap;
use std::path::Path;
use std::sync::{Arc, Mutex, OnceLock};

use notify_rust::{Hint, Notification, NotificationHandle, NotificationResponse, Timeout};

use super::{Activation, NotificationPayload};
use crate::native_error::NativeError;

type ActivationHandler = Box<dyn Fn(Activation) + Send + Sync>;

const DEFAULT_ACTION: &str = "default";

static HANDLER: OnceLock<ActivationHandler> = OnceLock::new();
static APP_NAME: OnceLock<String> = OnceLock::new();
static SHOWN: Mutex<Option<HashMap<String, Vec<(u32, Arc<NotificationHandle>)>>>> =
    Mutex::new(None);

pub fn install_activation_handler(app_name: String, handler: ActivationHandler) {
    let _ = APP_NAME.set(app_name);
    let _ = HANDLER.set(handler);
}

pub fn supported() -> bool {
    HANDLER.get().is_some()
}

fn joined_body(payload: &NotificationPayload) -> String {
    match payload.subtitle.as_deref() {
        Some(subtitle) if !subtitle.is_empty() => format!("{subtitle}\n{}", payload.body),
        _ => payload.body.clone(),
    }
}

fn activation_for(
    response: &NotificationResponse,
    payload: &NotificationPayload,
) -> Option<Activation> {
    let opened = match response {
        NotificationResponse::Default => true,
        NotificationResponse::Action(action) => action == DEFAULT_ACTION,
        _ => false,
    };

    opened.then(|| Activation {
        channel_uri: payload.channel_uri.clone(),
        message_uri: payload.message_uri.clone(),
    })
}

fn remember(channel_uri: &str, id: u32, handle: Arc<NotificationHandle>) {
    if let Ok(mut shown) = SHOWN.lock() {
        shown
            .get_or_insert_with(HashMap::new)
            .entry(channel_uri.to_owned())
            .or_default()
            .push((id, handle));
    }
}

fn forget(channel_uri: &str, id: u32) {
    if let Ok(mut shown) = SHOWN.lock() {
        let Some(map) = shown.as_mut() else {
            return;
        };
        if let Some(handles) = map.get_mut(channel_uri) {
            handles.retain(|(shown_id, _)| *shown_id != id);
            if handles.is_empty() {
                map.remove(channel_uri);
            }
        }
    }
}

fn take_handles(channel_uri: Option<&str>) -> Vec<Arc<NotificationHandle>> {
    let Ok(mut shown) = SHOWN.lock() else {
        return Vec::new();
    };
    let Some(map) = shown.as_mut() else {
        return Vec::new();
    };

    let taken: Vec<_> = match channel_uri {
        Some(channel_uri) => map.remove(channel_uri).into_iter().flatten().collect(),
        None => map.drain().flat_map(|(_, handles)| handles).collect(),
    };

    taken.into_iter().map(|(_, handle)| handle).collect()
}

fn close(handles: Vec<Arc<NotificationHandle>>) {
    if handles.is_empty() {
        return;
    }

    tauri::async_runtime::spawn(async move {
        for handle in handles {
            handle.close_async().await;
        }
    });
}

pub fn notify(payload: NotificationPayload) -> Result<(), NativeError> {
    if HANDLER.get().is_none() {
        return Err(NativeError::unsupported());
    }

    let mut notification = Notification::new();
    notification
        .appname(APP_NAME.get().map(String::as_str).unwrap_or("Colibri"))
        .summary(&payload.title)
        .body(&joined_body(&payload))
        .action(DEFAULT_ACTION, "Open")
        .hint(Hint::SuppressSound(true))
        .timeout(Timeout::Default);

    if let Some(icon_path) = payload
        .icon_path
        .as_deref()
        .filter(|path| Path::new(path).is_file())
    {
        notification.icon(icon_path);
    }

    let handle = notification.show().map_err(|err| {
        let message = err.to_string();
        eprintln!("native notification failed: {message}");
        NativeError::failed(message)
    })?;

    let id = handle.id();
    let handle = Arc::new(handle);
    remember(&payload.channel_uri, id, handle.clone());

    tauri::async_runtime::spawn(async move {
        handle
            .wait_for_action_async(|response| {
                if let (Some(activation), Some(handler)) =
                    (activation_for(response, &payload), HANDLER.get())
                {
                    handler(activation);
                }
            })
            .await;
        forget(&payload.channel_uri, id);
    });

    Ok(())
}

pub fn dismiss_channel(channel_uri: String) -> Result<(), NativeError> {
    close(take_handles(Some(&channel_uri)));
    Ok(())
}

pub fn clear_all() -> Result<(), NativeError> {
    close(take_handles(None));
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use notify_rust::CloseReason;

    fn payload(subtitle: Option<&str>) -> NotificationPayload {
        NotificationPayload {
            title: "alice".to_owned(),
            body: "hello".to_owned(),
            subtitle: subtitle.map(str::to_owned),
            channel_uri: "at://did:plc:abc/social.colibri.channel/1".to_owned(),
            message_uri: "colibri-notification:channel=x".to_owned(),
            icon_path: None,
        }
    }

    #[test]
    fn joined_body_puts_the_subtitle_on_its_own_line() {
        assert_eq!(
            joined_body(&payload(Some("Space / #general"))),
            "Space / #general\nhello"
        );
        assert_eq!(joined_body(&payload(Some(""))), "hello");
        assert_eq!(joined_body(&payload(None)), "hello");
    }

    #[test]
    fn only_a_default_click_activates() {
        let payload = payload(None);

        let activation = activation_for(&NotificationResponse::Default, &payload).expect("opens");
        assert_eq!(activation.channel_uri, payload.channel_uri);
        assert_eq!(activation.message_uri, payload.message_uri);

        assert!(activation_for(
            &NotificationResponse::Action(DEFAULT_ACTION.to_owned()),
            &payload
        )
        .is_some());
        assert!(
            activation_for(&NotificationResponse::Action("other".to_owned()), &payload).is_none()
        );
        assert!(activation_for(
            &NotificationResponse::Closed(CloseReason::Dismissed),
            &payload
        )
        .is_none());
    }
}
