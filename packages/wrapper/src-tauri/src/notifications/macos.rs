use std::cell::RefCell;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::OnceLock;

use block2::RcBlock;
use objc2::rc::Retained;
use objc2::runtime::ProtocolObject;
use objc2::{define_class, msg_send, DefinedClass, MainThreadOnly};
use objc2_foundation::{
    MainThreadMarker, NSArray, NSBundle, NSError, NSObject, NSObjectProtocol, NSString, NSURL,
};
use objc2_user_notifications::{
    UNAuthorizationOptions, UNMutableNotificationContent, UNNotification, UNNotificationAttachment,
    UNNotificationPresentationOptions, UNNotificationRequest, UNNotificationResponse,
    UNNotificationSound, UNUserNotificationCenter, UNUserNotificationCenterDelegate,
};

use super::{NotificationPayload, Activation};
use crate::native_error::NativeError;

fn is_bundled() -> bool {
    static BUNDLED: OnceLock<bool> = OnceLock::new();

    *BUNDLED.get_or_init(|| {
        let bundle = NSBundle::mainBundle();

        let has_identifier = bundle
            .bundleIdentifier()
            .map(|id| !id.to_string().is_empty())
            .unwrap_or(false);

        if !has_identifier {
            return false;
        }

        bundle.bundlePath().to_string().ends_with(".app")
    })
}

static AUTHORIZED: AtomicBool = AtomicBool::new(false);

fn request_authorization() {
    if !is_bundled() {
        return;
    }

    let handler = RcBlock::new(move |granted: objc2::runtime::Bool, error: *mut NSError| {
        AUTHORIZED.store(granted.as_bool() && error.is_null(), Ordering::Relaxed);
    });

    UNUserNotificationCenter::currentNotificationCenter()
        .requestAuthorizationWithOptions_completionHandler(
            UNAuthorizationOptions::Alert
                | UNAuthorizationOptions::Sound
                | UNAuthorizationOptions::Badge,
            &handler,
        );
}

pub fn supported() -> bool {
    is_bundled() && AUTHORIZED.load(Ordering::Relaxed)
}

type ActivationHandler = Box<dyn Fn(Activation)>;

pub struct DelegateIvars {
    on_activate: RefCell<Option<ActivationHandler>>,
}

define_class!(
    #[unsafe(super(NSObject))]
    #[thread_kind = MainThreadOnly]
    #[name = "ColibriNotificationDelegate"]
    #[ivars = DelegateIvars]
    struct Delegate;

    unsafe impl NSObjectProtocol for Delegate {}

    unsafe impl UNUserNotificationCenterDelegate for Delegate {
        #[unsafe(method(userNotificationCenter:willPresentNotification:withCompletionHandler:))]
        fn will_present(
            &self,
            _center: &UNUserNotificationCenter,
            _notification: &UNNotification,
            completion_handler: &block2::DynBlock<dyn Fn(UNNotificationPresentationOptions)>,
        ) {
            completion_handler.call((
                UNNotificationPresentationOptions::Banner
                    | UNNotificationPresentationOptions::Sound
                    | UNNotificationPresentationOptions::List,
            ));
        }

        #[unsafe(method(userNotificationCenter:didReceiveNotificationResponse:withCompletionHandler:))]
        fn did_receive(
            &self,
            _center: &UNUserNotificationCenter,
            response: &UNNotificationResponse,
            completion_handler: &block2::DynBlock<dyn Fn()>,
        ) {
            let content = response.notification().request().content();
            let activation = Activation {
                message_uri: response.notification().request().identifier().to_string(),
                channel_uri: content.threadIdentifier().to_string(),
            };

            if let Some(callback) = self.ivars().on_activate.borrow().as_ref() {
                callback(activation);
            }

            completion_handler.call(());
        }
    }
);

thread_local! {
    static DELEGATE: RefCell<Option<Retained<Delegate>>> = const { RefCell::new(None) };
}

pub fn install_delegate<F>(mtm: MainThreadMarker, on_activate: F)
where
    F: Fn(Activation) + 'static,
{
    if !is_bundled() {
        return;
    }

    let this = Delegate::alloc(mtm).set_ivars(DelegateIvars {
        on_activate: RefCell::new(Some(Box::new(on_activate))),
    });
    let delegate: Retained<Delegate> = unsafe { msg_send![super(this), init] };

    let center = UNUserNotificationCenter::currentNotificationCenter();
    center.setDelegate(Some(ProtocolObject::from_ref(&*delegate)));

    DELEGATE.with(|slot| *slot.borrow_mut() = Some(delegate));

    request_authorization();
}

pub fn notify(payload: NotificationPayload) -> Result<(), NativeError> {
    if !supported() {
        return Err(NativeError::unsupported());
    }

    let content = UNMutableNotificationContent::new();
    content.setTitle(&NSString::from_str(&payload.title));
    content.setBody(&NSString::from_str(&payload.body));
    content.setThreadIdentifier(&NSString::from_str(&payload.channel_uri));
    let sound = UNNotificationSound::defaultSound();
    content.setSound(Some(&sound));

    if let Some(subtitle) = payload.subtitle.as_deref() {
        content.setSubtitle(&NSString::from_str(subtitle));
    }

    if let Some(icon_path) = payload.icon_path.as_deref() {
        let url = NSURL::fileURLWithPath(&NSString::from_str(icon_path));
        let attachment = unsafe {
            UNNotificationAttachment::attachmentWithIdentifier_URL_options_error(
                &NSString::from_str("avatar"),
                &url,
                None,
            )
        };
        if let Ok(attachment) = attachment {
            content.setAttachments(&NSArray::from_retained_slice(&[attachment]));
        }
    }

    let request = UNNotificationRequest::requestWithIdentifier_content_trigger(
        &NSString::from_str(&payload.message_uri),
        &content,
        None,
    );

    UNUserNotificationCenter::currentNotificationCenter()
        .addNotificationRequest_withCompletionHandler(&request, None);

    Ok(())
}

pub fn dismiss_channel(channel_uri: String) -> Result<(), NativeError> {
    if !is_bundled() {
        return Err(NativeError::unsupported());
    }

    let center = UNUserNotificationCenter::currentNotificationCenter();
    let wanted = NSString::from_str(&channel_uri);

    let handler = RcBlock::new(move |delivered: std::ptr::NonNull<NSArray<UNNotification>>| {
        let delivered = unsafe { delivered.as_ref() };
        let mut doomed: Vec<Retained<NSString>> = Vec::new();

        for notification in delivered {
            let request = notification.request();
            if request.content().threadIdentifier() == wanted {
                doomed.push(request.identifier());
            }
        }

        if !doomed.is_empty() {
            UNUserNotificationCenter::currentNotificationCenter()
                .removeDeliveredNotificationsWithIdentifiers(&NSArray::from_retained_slice(&doomed));
        }
    });

    center.getDeliveredNotificationsWithCompletionHandler(&handler);

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unbundled_processes_are_unsupported() {
        assert!(!supported());
    }

    #[test]
    fn is_bundled_is_stable_across_calls() {
        assert_eq!(is_bundled(), is_bundled());
    }

    #[test]
    fn notify_refuses_to_run_unbundled() {
        let result = notify(NotificationPayload {
            title: "t".into(),
            body: "b".into(),
            subtitle: None,
            channel_uri: "at://c".into(),
            message_uri: "at://m".into(),
            icon_path: None,
        });
        assert!(result.is_err());
    }

}
