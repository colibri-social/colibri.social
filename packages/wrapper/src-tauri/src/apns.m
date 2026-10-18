#import <TargetConditionals.h>
#import <objc/runtime.h>
#import <stdatomic.h>
#if TARGET_OS_IPHONE
#import <UIKit/UIKit.h>
#else
#import <AppKit/AppKit.h>
#endif
#import <UserNotifications/UserNotifications.h>

typedef void (*ColibriApnsRegisterCallback)(const char *token, const char *error, void *ctx);
typedef void (*ColibriApnsActivationCallback)(const char *channelUri, const char *threadUri, const char *messageUri);

typedef void (^ColibriApnsCompletion)(NSString *token, NSString *error);

static NSString *const ColibriApnsCategory = @"message";
static NSString *const ColibriApnsMarkReadAction = @"mark-read";
static NSString *const ColibriApnsRepostedKey = @"colibriPush";
static const NSTimeInterval ColibriApnsRequestTimeout = 20;

static NSMutableArray<ColibriApnsCompletion> *colibriApnsPending = nil;
static atomic_bool colibriApnsLive = false;

void colibri_apns_set_live(bool live) {
	atomic_store(&colibriApnsLive, live);
}

static BOOL colibri_apns_is_live(void) {
	return atomic_load(&colibriApnsLive);
}

static UNUserNotificationCenter *colibri_apns_center(void) {
#if !TARGET_OS_IPHONE
	NSBundle *bundle = NSBundle.mainBundle;
	if (bundle.bundleIdentifier.length == 0 || ![bundle.bundlePath hasSuffix:@".app"]) {
		return nil;
	}
#endif
	return UNUserNotificationCenter.currentNotificationCenter;
}

static NSString *colibri_apns_string(id value) {
	if ([value isKindOfClass:NSString.class] && [(NSString *)value length] > 0) {
		return value;
	}
	return nil;
}

static NSString *colibri_apns_target(NSDictionary *info, NSString *fallback) {
	return colibri_apns_string(info[@"threadUri"])
		?: colibri_apns_string(info[@"channelUri"])
		?: colibri_apns_string(info[@"channel"])
		?: colibri_apns_string(fallback);
}

static NSString *colibri_apns_notification_target(UNNotification *notification) {
	UNNotificationContent *content = notification.request.content;
	return colibri_apns_target(content.userInfo, content.threadIdentifier);
}

static NSString *colibri_apns_rkey(NSString *uri) {
	return [uri componentsSeparatedByString:@"/"].lastObject;
}

static BOOL colibri_apns_is_push(UNNotification *notification) {
	return [notification.request.trigger isKindOfClass:UNPushNotificationTrigger.class] ||
		[notification.request.content.userInfo[ColibriApnsRepostedKey] isEqual:@YES];
}

static BOOL colibri_apns_app_active(void) {
#if TARGET_OS_IPHONE
	return UIApplication.sharedApplication.applicationState == UIApplicationStateActive;
#else
	return NSApplication.sharedApplication.isActive;
#endif
}

static void colibri_apns_remove_matching(BOOL (^matches)(UNNotification *), void (^done)(void)) {
	UNUserNotificationCenter *center = colibri_apns_center();
	if (center == nil) {
		if (done != nil) {
			done();
		}
		return;
	}
	[center getDeliveredNotificationsWithCompletionHandler:^(NSArray<UNNotification *> *delivered) {
		NSMutableArray<NSString *> *doomed = [NSMutableArray array];
		for (UNNotification *notification in delivered) {
			if (matches(notification)) {
				[doomed addObject:notification.request.identifier];
			}
		}
		if (doomed.count > 0) {
			[center removeDeliveredNotificationsWithIdentifiers:doomed];
		}
		if (done != nil) {
			done();
		}
	}];
}

static void colibri_apns_remove_target(NSString *target, void (^done)(void)) {
	if (target == nil) {
		if (done != nil) {
			done();
		}
		return;
	}
	colibri_apns_remove_matching(^BOOL(UNNotification *notification) {
		return [colibri_apns_notification_target(notification) isEqualToString:target];
	}, done);
}

static void colibri_apns_set_badge(NSInteger count) {
	dispatch_async(dispatch_get_main_queue(), ^{
#if TARGET_OS_IPHONE
		if (@available(iOS 16.0, *)) {
			[colibri_apns_center() setBadgeCount:count withCompletionHandler:nil];
		} else {
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
			UIApplication.sharedApplication.applicationIconBadgeNumber = count;
#pragma clang diagnostic pop
		}
#else
		NSApplication.sharedApplication.dockTile.badgeLabel = count > 0 ? [NSString stringWithFormat:@"%ld", (long)count] : nil;
#endif
	});
}

static void colibri_apns_apply_badge(NSDictionary *info) {
	NSDictionary *aps = [info[@"aps"] isKindOfClass:NSDictionary.class] ? info[@"aps"] : nil;
	id badge = aps[@"badge"] ?: info[@"badge"];
	if ([badge isKindOfClass:NSNumber.class]) {
		colibri_apns_set_badge(MAX([badge integerValue], 0));
	} else if (colibri_apns_string(badge) != nil) {
		colibri_apns_set_badge(MAX([badge integerValue], 0));
	}
}

static BOOL colibri_apns_matches_message(UNNotification *notification, NSString *tag, NSString *messageUri) {
	if (tag != nil && [notification.request.identifier isEqualToString:tag]) {
		return YES;
	}
	NSString *delivered = colibri_apns_string(notification.request.content.userInfo[@"messageUri"]);
	return messageUri != nil && [delivered isEqualToString:messageUri];
}

static void colibri_apns_edit_delivered(NSDictionary *info, void (^done)(void)) {
	UNUserNotificationCenter *center = colibri_apns_center();
	NSString *tag = colibri_apns_string(info[@"tag"]);
	NSString *messageUri = colibri_apns_string(info[@"messageUri"]);
	NSString *body = colibri_apns_string(info[@"body"]);
	if (center == nil || body == nil || (tag == nil && messageUri == nil)) {
		done();
		return;
	}
	[center getDeliveredNotificationsWithCompletionHandler:^(NSArray<UNNotification *> *delivered) {
		UNNotification *match = nil;
		for (UNNotification *notification in delivered) {
			if (colibri_apns_matches_message(notification, tag, messageUri)) {
				match = notification;
				break;
			}
		}
		if (match == nil) {
			done();
			return;
		}
		UNMutableNotificationContent *content = [match.request.content mutableCopy];
		content.body = body;
		content.sound = nil;
		NSMutableDictionary *userInfo = [content.userInfo mutableCopy] ?: [NSMutableDictionary dictionary];
		userInfo[@"body"] = body;
		userInfo[ColibriApnsRepostedKey] = @YES;
		content.userInfo = userInfo;
		if (@available(iOS 15.0, macOS 12.0, *)) {
			content.interruptionLevel = UNNotificationInterruptionLevelPassive;
		}
		UNNotificationRequest *request = [UNNotificationRequest requestWithIdentifier:match.request.identifier content:content trigger:nil];
		[center addNotificationRequest:request withCompletionHandler:^(__unused NSError *error) {
			done();
		}];
	}];
}

static void colibri_apns_handle_background(NSDictionary *info, void (^done)(void)) {
	colibri_apns_apply_badge(info);
	NSString *type = colibri_apns_string(info[@"type"]);
	if ([type isEqualToString:@"read"]) {
		NSString *target = colibri_apns_target(info, nil);
		NSString *through = colibri_apns_string(info[@"through"]);
		if (target == nil) {
			done();
			return;
		}
		colibri_apns_remove_matching(^BOOL(UNNotification *notification) {
			if (![colibri_apns_notification_target(notification) isEqualToString:target]) {
				return NO;
			}
			NSString *messageUri = colibri_apns_string(notification.request.content.userInfo[@"messageUri"]);
			if (through == nil || messageUri == nil) {
				return YES;
			}
			return [colibri_apns_rkey(messageUri) compare:through] != NSOrderedDescending;
		}, done);
		return;
	}
	if ([type isEqualToString:@"delete"]) {
		NSString *tag = colibri_apns_string(info[@"tag"]);
		NSString *messageUri = colibri_apns_string(info[@"messageUri"]);
		if (tag == nil && messageUri == nil) {
			done();
			return;
		}
		colibri_apns_remove_matching(^BOOL(UNNotification *notification) {
			return colibri_apns_matches_message(notification, tag, messageUri);
		}, done);
		return;
	}
	if ([type isEqualToString:@"edit"]) {
		colibri_apns_edit_delivered(info, done);
		return;
	}
	done();
}

static NSString *const ColibriApnsPendingReadsKey = @"social.colibri.pendingMarkRead";
static const NSUInteger ColibriApnsPendingReadsLimit = 50;
static const NSTimeInterval ColibriApnsPendingReadsLifetime = 7 * 24 * 60 * 60;

static NSArray<NSDictionary *> *colibri_apns_pending_reads(void) {
	NSArray *stored = [NSUserDefaults.standardUserDefaults arrayForKey:ColibriApnsPendingReadsKey];
	return stored != nil ? stored : @[];
}

static void colibri_apns_store_pending_reads(NSArray<NSDictionary *> *entries) {
	NSUserDefaults *defaults = NSUserDefaults.standardUserDefaults;
	if (entries.count == 0) {
		[defaults removeObjectForKey:ColibriApnsPendingReadsKey];
		return;
	}
	NSUInteger start = entries.count > ColibriApnsPendingReadsLimit ? entries.count - ColibriApnsPendingReadsLimit : 0;
	[defaults setObject:[entries subarrayWithRange:NSMakeRange(start, entries.count - start)] forKey:ColibriApnsPendingReadsKey];
}

static void colibri_apns_update_pending_reads(NSArray<NSDictionary *> * (^change)(NSArray<NSDictionary *> *)) {
	@synchronized(ColibriApnsPendingReadsKey) {
		colibri_apns_store_pending_reads(change(colibri_apns_pending_reads()));
	}
}

static void colibri_apns_send_mark_read(NSString *readUrl, NSString *token, void (^done)(BOOL retry)) {
	NSURL *url = readUrl != nil ? [NSURL URLWithString:readUrl] : nil;
	NSData *body = token != nil ? [NSJSONSerialization dataWithJSONObject:@{@"token" : token} options:0 error:nil] : nil;
	if (url == nil || body == nil) {
		done(NO);
		return;
	}
	NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url
														  cachePolicy:NSURLRequestReloadIgnoringLocalCacheData
													  timeoutInterval:ColibriApnsRequestTimeout];
	request.HTTPMethod = @"POST";
	[request setValue:@"application/json" forHTTPHeaderField:@"content-type"];
	request.HTTPBody = body;
	[[NSURLSession.sharedSession dataTaskWithRequest:request
								   completionHandler:^(__unused NSData *data, NSURLResponse *response, NSError *error) {
									   NSInteger status = [response isKindOfClass:NSHTTPURLResponse.class] ? ((NSHTTPURLResponse *)response).statusCode : 0;
									   done(error != nil || status == 0 || status == 429 || status >= 500);
								   }] resume];
}

static void colibri_apns_post_mark_read(NSDictionary *info, void (^done)(void)) {
	NSString *readUrl = colibri_apns_string(info[@"readUrl"]);
	NSString *token = colibri_apns_string(info[@"readToken"]);
	colibri_apns_send_mark_read(readUrl, token, ^(BOOL retry) {
		if (retry) {
			colibri_apns_update_pending_reads(^NSArray<NSDictionary *> *(NSArray<NSDictionary *> *entries) {
				return [entries arrayByAddingObject:@{
					@"readUrl" : readUrl,
					@"readToken" : token,
					@"queuedAt" : @(NSDate.date.timeIntervalSince1970),
				}];
			});
		}
		done();
	});
}

static atomic_bool colibriApnsRetrying = false;

static void colibri_apns_retry_pending_reads(void) {
	if (atomic_exchange(&colibriApnsRetrying, true)) {
		return;
	}
	NSArray<NSDictionary *> *entries = colibri_apns_pending_reads();
	if (entries.count == 0) {
		atomic_store(&colibriApnsRetrying, false);
		return;
	}
	dispatch_group_t group = dispatch_group_create();
	NSMutableArray<NSDictionary *> *settled = [NSMutableArray array];
	NSTimeInterval now = NSDate.date.timeIntervalSince1970;
	for (NSDictionary *entry in entries) {
		NSNumber *queuedAt = [entry[@"queuedAt"] isKindOfClass:NSNumber.class] ? entry[@"queuedAt"] : nil;
		if (queuedAt == nil || now - queuedAt.doubleValue > ColibriApnsPendingReadsLifetime) {
			[settled addObject:entry];
			continue;
		}
		dispatch_group_enter(group);
		colibri_apns_send_mark_read(colibri_apns_string(entry[@"readUrl"]), colibri_apns_string(entry[@"readToken"]), ^(BOOL retry) {
			if (!retry) {
				@synchronized(settled) {
					[settled addObject:entry];
				}
			}
			dispatch_group_leave(group);
		});
	}
	dispatch_group_notify(group, dispatch_get_main_queue(), ^{
		colibri_apns_update_pending_reads(^NSArray<NSDictionary *> *(NSArray<NSDictionary *> *current) {
			NSMutableArray<NSDictionary *> *remaining = [current mutableCopy];
			[remaining removeObjectsInArray:settled];
			return remaining;
		});
		atomic_store(&colibriApnsRetrying, false);
	});
}

static void colibri_apns_watch_pending_reads(void) {
	static dispatch_once_t once;
	dispatch_once(&once, ^{
#if TARGET_OS_IPHONE
		NSNotificationName name = UIApplicationDidBecomeActiveNotification;
#else
		NSNotificationName name = NSApplicationDidBecomeActiveNotification;
#endif
		[NSNotificationCenter.defaultCenter addObserverForName:name
														object:nil
														 queue:NSOperationQueue.mainQueue
													usingBlock:^(__unused NSNotification *notification) {
														colibri_apns_retry_pending_reads();
													}];
		colibri_apns_retry_pending_reads();
	});
}

static void colibri_apns_register_category(void) {
	UNUserNotificationCenter *center = colibri_apns_center();
	if (center == nil) {
		return;
	}
	UNNotificationAction *markRead = [UNNotificationAction actionWithIdentifier:ColibriApnsMarkReadAction
																		 title:@"Mark as read"
																	   options:UNNotificationActionOptionNone];
	UNNotificationCategory *category = [UNNotificationCategory categoryWithIdentifier:ColibriApnsCategory
																			  actions:@[ markRead ]
																	intentIdentifiers:@[]
																			  options:UNNotificationCategoryOptionNone];
	[center getNotificationCategoriesWithCompletionHandler:^(NSSet<UNNotificationCategory *> *existing) {
		NSMutableSet<UNNotificationCategory *> *next = [NSMutableSet setWithObject:category];
		for (UNNotificationCategory *other in existing) {
			if (![other.identifier isEqualToString:ColibriApnsCategory]) {
				[next addObject:other];
			}
		}
		[center setNotificationCategories:next];
	}];
}

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

#if TARGET_OS_IPHONE
typedef void (^ColibriApnsFetchHandler)(UIBackgroundFetchResult);

static void colibri_apns_add_fetch_method(Class cls) {
	SEL selector = @selector(application:didReceiveRemoteNotification:fetchCompletionHandler:);
	const char *types = "v@:@@@?";
	void (^handle)(NSDictionary *, ColibriApnsFetchHandler) = ^(NSDictionary *info, ColibriApnsFetchHandler handler) {
		colibri_apns_handle_background(info, ^{
			dispatch_async(dispatch_get_main_queue(), ^{
				handler(UIBackgroundFetchResultNewData);
			});
		});
	};
	IMP replacement = imp_implementationWithBlock(^(__unused id self, __unused id app, NSDictionary *info, ColibriApnsFetchHandler handler) {
		handle(info, handler);
	});
	if (!class_addMethod(cls, selector, replacement, types)) {
		Method existing = class_getInstanceMethod(cls, selector);
		IMP original = method_getImplementation(existing);
		IMP chained = imp_implementationWithBlock(^(id self, id app, NSDictionary *info, ColibriApnsFetchHandler handler) {
			((void (*)(id, SEL, id, id, id))original)(self, selector, app, info, ^(__unused UIBackgroundFetchResult result) {
			});
			handle(info, handler);
		});
		method_setImplementation(existing, chained);
	}
}
#endif

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

#if TARGET_OS_IPHONE
	colibri_apns_add_fetch_method(cls);
	UIApplication.sharedApplication.delegate = delegate;
#else
	colibri_apns_add_method(
		cls,
		@selector(application:didReceiveRemoteNotification:),
		^(__unused id self, __unused id app, NSDictionary *info) {
			colibri_apns_handle_background(info, ^{
			});
		},
		"v@:@@");
#endif
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
	colibri_apns_remove_matching(^BOOL(UNNotification *notification) {
		return [notification.request.content.threadIdentifier isEqualToString:threadId] ||
			[colibri_apns_notification_target(notification) isEqualToString:threadId];
	}, nil);
}

void colibri_apns_remove_delivered_targets(const char *const *cTargets, size_t count) {
	NSMutableSet<NSString *> *targets = [NSMutableSet setWithCapacity:count];
	for (size_t i = 0; i < count; i++) {
		NSString *target = [NSString stringWithUTF8String:cTargets[i]];
		if (target.length > 0) {
			[targets addObject:target];
		}
	}
	if (targets.count == 0) {
		return;
	}
	colibri_apns_remove_matching(^BOOL(UNNotification *notification) {
		NSString *target = colibri_apns_notification_target(notification);
		return target != nil && [targets containsObject:target];
	}, nil);
}

static UNNotificationPresentationOptions colibri_apns_presentation(void) {
	return UNNotificationPresentationOptionBanner | UNNotificationPresentationOptionSound | UNNotificationPresentationOptionList;
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
	if (colibri_apns_is_push(notification) && colibri_apns_app_active() && colibri_apns_is_live()) {
		completionHandler(UNNotificationPresentationOptionNone);
		return;
	}
	completionHandler(colibri_apns_presentation());
}

- (void)markReadFromResponse:(UNNotificationResponse *)response completion:(void (^)(void))completionHandler {
	UNNotificationContent *content = response.notification.request.content;
	NSDictionary *info = content.userInfo;
	NSString *target = colibri_apns_target(info, content.threadIdentifier);
#if TARGET_OS_IPHONE
	UIApplication *application = UIApplication.sharedApplication;
	__block UIBackgroundTaskIdentifier task = UIBackgroundTaskInvalid;
	void (^endTask)(void) = ^{
		if (task != UIBackgroundTaskInvalid) {
			[application endBackgroundTask:task];
			task = UIBackgroundTaskInvalid;
		}
	};
	task = [application beginBackgroundTaskWithName:@"social.colibri.mark-read" expirationHandler:endTask];
#endif
	colibri_apns_post_mark_read(info, ^{
		colibri_apns_remove_target(target, ^{
			dispatch_async(dispatch_get_main_queue(), ^{
				completionHandler();
#if TARGET_OS_IPHONE
				endTask();
#endif
			});
		});
	});
}

- (void)userNotificationCenter:(UNUserNotificationCenter *)center
	didReceiveNotificationResponse:(UNNotificationResponse *)response
			 withCompletionHandler:(void (^)(void))completionHandler {
	if ([response.actionIdentifier isEqualToString:ColibriApnsMarkReadAction]) {
		[self markReadFromResponse:response completion:completionHandler];
		return;
	}
	if (!colibri_apns_is_push(response.notification) || self.onActivate == NULL) {
		if ([self.previous respondsToSelector:@selector(userNotificationCenter:didReceiveNotificationResponse:withCompletionHandler:)]) {
			[self.previous userNotificationCenter:center didReceiveNotificationResponse:response withCompletionHandler:completionHandler];
		} else {
			completionHandler();
		}
		return;
	}
	NSDictionary *info = response.notification.request.content.userInfo;
	NSString *channelUri = colibri_apns_string(info[@"channelUri"]) ?: colibri_apns_string(info[@"channel"]);
	NSString *threadUri = colibri_apns_string(info[@"threadUri"]);
	NSString *messageUri = colibri_apns_string(info[@"messageUri"]);
	if (channelUri != nil) {
		self.onActivate(channelUri.UTF8String, threadUri.UTF8String ?: "", messageUri.UTF8String ?: "");
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
		UNUserNotificationCenter *center = colibri_apns_center();
		if (center == nil) {
			return;
		}
		colibri_apns_hook_app_delegate();
		colibri_apns_register_category();
		colibri_apns_watch_pending_reads();
		if (colibriApnsCenterDelegate == nil) {
			colibriApnsCenterDelegate = [ColibriApnsCenterDelegate new];
			Method setDelegate = class_getInstanceMethod(UNUserNotificationCenter.class, @selector(setDelegate:));
			colibriApnsOriginalSetDelegate = method_setImplementation(setDelegate, (IMP)colibri_apns_set_delegate);
		}
		colibriApnsCenterDelegate.onActivate = onActivate;
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
