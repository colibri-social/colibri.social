#import <TargetConditionals.h>
#import <objc/runtime.h>
#if TARGET_OS_IPHONE
#import <UIKit/UIKit.h>
#else
#import <AppKit/AppKit.h>
#endif
#import <UserNotifications/UserNotifications.h>

typedef void (*ColibriApnsRegisterCallback)(const char *token, const char *error, void *ctx);
typedef void (*ColibriApnsActivationCallback)(const char *channelUri, const char *messageUri);

typedef void (^ColibriApnsCompletion)(NSString *token, NSString *error);

static NSMutableArray<ColibriApnsCompletion> *colibriApnsPending = nil;

static void colibri_apns_finish(NSString *token, NSString *error) {
	NSArray<ColibriApnsCompletion> *pending = [colibriApnsPending copy];
	[colibriApnsPending removeAllObjects];
	for (ColibriApnsCompletion completion in pending) {
		completion(token, error);
	}
}

static NSString *colibri_apns_hex(NSData *data) {
	const unsigned char *bytes = data.bytes;
	NSMutableString *hex = [NSMutableString stringWithCapacity:data.length * 2];
	for (NSUInteger i = 0; i < data.length; i++) {
		[hex appendFormat:@"%02x", bytes[i]];
	}
	return hex;
}

static void colibri_apns_add_method(Class cls, SEL selector, id block, const char *types) {
	IMP replacement = imp_implementationWithBlock(block);
	if (!class_addMethod(cls, selector, replacement, types)) {
		Method existing = class_getInstanceMethod(cls, selector);
		IMP original = method_getImplementation(existing);
		IMP chained = imp_implementationWithBlock(^(id self, id app, id argument) {
			((void (*)(id, SEL, id, id))original)(self, selector, app, argument);
			((void (*)(id, SEL, id, id))replacement)(self, selector, app, argument);
		});
		method_setImplementation(existing, chained);
	}
}

static void colibri_apns_hook_app_delegate(void) {
	static BOOL hooked = NO;
	if (hooked) {
		return;
	}
#if TARGET_OS_IPHONE
	id delegate = UIApplication.sharedApplication.delegate;
#else
	id delegate = NSApplication.sharedApplication.delegate;
#endif
	if (delegate == nil) {
		return;
	}
	hooked = YES;
	Class cls = [delegate class];

	colibri_apns_add_method(
		cls,
		@selector(application:didRegisterForRemoteNotificationsWithDeviceToken:),
		^(__unused id self, __unused id app, NSData *deviceToken) {
			colibri_apns_finish(colibri_apns_hex(deviceToken), nil);
		},
		"v@:@@");

	colibri_apns_add_method(
		cls,
		@selector(application:didFailToRegisterForRemoteNotificationsWithError:),
		^(__unused id self, __unused id app, NSError *error) {
			colibri_apns_finish(nil, error.localizedDescription ?: @"registration failed");
		},
		"v@:@@");
}

void colibri_apns_register(ColibriApnsRegisterCallback callback, void *ctx) {
	dispatch_async(dispatch_get_main_queue(), ^{
		if (colibriApnsPending == nil) {
			colibriApnsPending = [NSMutableArray array];
		}
		colibri_apns_hook_app_delegate();
		[colibriApnsPending addObject:^(NSString *token, NSString *error) {
			callback(token.UTF8String, error.UTF8String, ctx);
		}];
#if TARGET_OS_IPHONE
		[UIApplication.sharedApplication registerForRemoteNotifications];
#else
		[NSApplication.sharedApplication registerForRemoteNotifications];
#endif
	});
}

static NSDictionary *colibri_apns_profile(void) {
#if TARGET_OS_IPHONE
	NSString *path = [NSBundle.mainBundle pathForResource:@"embedded" ofType:@"mobileprovision"];
#else
	NSString *path = [NSBundle.mainBundle.bundlePath stringByAppendingPathComponent:@"Contents/embedded.provisionprofile"];
#endif
	if (path == nil) {
		return nil;
	}
	NSData *data = [NSData dataWithContentsOfFile:path];
	if (data == nil) {
		return nil;
	}
	NSData *open = [@"<?xml" dataUsingEncoding:NSASCIIStringEncoding];
	NSData *close = [@"</plist>" dataUsingEncoding:NSASCIIStringEncoding];
	NSRange start = [data rangeOfData:open options:0 range:NSMakeRange(0, data.length)];
	if (start.location == NSNotFound) {
		return nil;
	}
	NSRange end = [data rangeOfData:close options:0 range:NSMakeRange(start.location, data.length - start.location)];
	if (end.location == NSNotFound) {
		return nil;
	}
	NSData *plist = [data subdataWithRange:NSMakeRange(start.location, NSMaxRange(end) - start.location)];
	id parsed = [NSPropertyListSerialization propertyListWithData:plist options:0 format:nil error:nil];
	return [parsed isKindOfClass:NSDictionary.class] ? parsed : nil;
}

const char *colibri_apns_environment(void) {
#if TARGET_OS_SIMULATOR
	return "sandbox";
#else
	NSDictionary *entitlements = colibri_apns_profile()[@"Entitlements"];
	NSString *value = entitlements[@"aps-environment"] ?: entitlements[@"com.apple.developer.aps-environment"];
	if ([value isEqualToString:@"development"]) {
		return "sandbox";
	}
	return "production";
#endif
}

void colibri_apns_remove_delivered(const char *cThreadId) {
	NSString *threadId = [NSString stringWithUTF8String:cThreadId];
	UNUserNotificationCenter *center = UNUserNotificationCenter.currentNotificationCenter;
	[center getDeliveredNotificationsWithCompletionHandler:^(NSArray<UNNotification *> *delivered) {
		NSMutableArray<NSString *> *doomed = [NSMutableArray array];
		for (UNNotification *notification in delivered) {
			if ([notification.request.content.threadIdentifier isEqualToString:threadId]) {
				[doomed addObject:notification.request.identifier];
			}
		}
		if (doomed.count > 0) {
			[center removeDeliveredNotificationsWithIdentifiers:doomed];
		}
	}];
}

#if TARGET_OS_IPHONE
static BOOL colibri_apns_is_push(UNNotification *notification) {
	return [notification.request.trigger isKindOfClass:UNPushNotificationTrigger.class];
}

@interface ColibriApnsCenterDelegate : NSObject <UNUserNotificationCenterDelegate>
@property(nonatomic, strong) id<UNUserNotificationCenterDelegate> previous;
@property(nonatomic, assign) ColibriApnsActivationCallback onActivate;
@end

@implementation ColibriApnsCenterDelegate
- (void)userNotificationCenter:(UNUserNotificationCenter *)center
	   willPresentNotification:(UNNotification *)notification
		 withCompletionHandler:(void (^)(UNNotificationPresentationOptions))completionHandler {
	if (!colibri_apns_is_push(notification) &&
		[self.previous respondsToSelector:@selector(userNotificationCenter:willPresentNotification:withCompletionHandler:)]) {
		[self.previous userNotificationCenter:center willPresentNotification:notification withCompletionHandler:completionHandler];
		return;
	}
	if (colibri_apns_is_push(notification) &&
		UIApplication.sharedApplication.applicationState == UIApplicationStateActive) {
		completionHandler(UNNotificationPresentationOptionNone);
		return;
	}
	completionHandler(UNNotificationPresentationOptionBanner | UNNotificationPresentationOptionSound | UNNotificationPresentationOptionList);
}

- (void)userNotificationCenter:(UNUserNotificationCenter *)center
	didReceiveNotificationResponse:(UNNotificationResponse *)response
			 withCompletionHandler:(void (^)(void))completionHandler {
	if (!colibri_apns_is_push(response.notification)) {
		if ([self.previous respondsToSelector:@selector(userNotificationCenter:didReceiveNotificationResponse:withCompletionHandler:)]) {
			[self.previous userNotificationCenter:center didReceiveNotificationResponse:response withCompletionHandler:completionHandler];
		} else {
			completionHandler();
		}
		return;
	}
	NSDictionary *info = response.notification.request.content.userInfo;
	id channelUri = info[@"channelUri"] ?: info[@"channel"];
	id messageUri = info[@"messageUri"];
	if ([channelUri isKindOfClass:NSString.class] && self.onActivate != NULL) {
		self.onActivate(
			[channelUri UTF8String],
			[messageUri isKindOfClass:NSString.class] ? [messageUri UTF8String] : "");
	}
	completionHandler();
}

- (void)userNotificationCenter:(UNUserNotificationCenter *)center
	openSettingsForNotification:(UNNotification *)notification {
	if ([self.previous respondsToSelector:@selector(userNotificationCenter:openSettingsForNotification:)]) {
		[self.previous userNotificationCenter:center openSettingsForNotification:notification];
	}
}
@end

static ColibriApnsCenterDelegate *colibriApnsCenterDelegate = nil;
static IMP colibriApnsOriginalSetDelegate = NULL;

static void colibri_apns_set_delegate(id center, SEL selector, id<UNUserNotificationCenterDelegate> delegate) {
	if (colibriApnsCenterDelegate != nil && delegate != nil && delegate != colibriApnsCenterDelegate) {
		colibriApnsCenterDelegate.previous = delegate;
		delegate = colibriApnsCenterDelegate;
	}
	((void (*)(id, SEL, id))colibriApnsOriginalSetDelegate)(center, selector, delegate);
}

void colibri_apns_install_delegate(ColibriApnsActivationCallback onActivate) {
	void (^install)(void) = ^{
		if (colibriApnsCenterDelegate == nil) {
			colibriApnsCenterDelegate = [ColibriApnsCenterDelegate new];
			Method setDelegate = class_getInstanceMethod(UNUserNotificationCenter.class, @selector(setDelegate:));
			colibriApnsOriginalSetDelegate = method_setImplementation(setDelegate, (IMP)colibri_apns_set_delegate);
		}
		colibriApnsCenterDelegate.onActivate = onActivate;
		UNUserNotificationCenter *center = UNUserNotificationCenter.currentNotificationCenter;
		id<UNUserNotificationCenterDelegate> existing = center.delegate;
		if (existing == colibriApnsCenterDelegate) {
			return;
		}
		colibriApnsCenterDelegate.previous = existing;
		((void (*)(id, SEL, id))colibriApnsOriginalSetDelegate)(center, @selector(setDelegate:), colibriApnsCenterDelegate);
	};
	if (NSThread.isMainThread) {
		install();
	} else {
		dispatch_sync(dispatch_get_main_queue(), install);
	}
}
#endif
