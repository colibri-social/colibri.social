#import <TargetConditionals.h>
#if TARGET_OS_IPHONE
#import <UIKit/UIKit.h>
#else
#import <AppKit/AppKit.h>
#endif
#import <AuthenticationServices/AuthenticationServices.h>

typedef void (*ColibriWebAuthCallback)(const char *url, const char *error, void *ctx);

@interface ColibriWebAuthContextProvider : NSObject <ASWebAuthenticationPresentationContextProviding>
@end

@implementation ColibriWebAuthContextProvider
#if TARGET_OS_IPHONE
- (ASPresentationAnchor)presentationAnchorForWebAuthenticationSession:(ASWebAuthenticationSession *)session {
	UIWindow *activeWindow = nil;
	UIWindow *anyWindow = nil;

	for (UIScene *scene in UIApplication.sharedApplication.connectedScenes) {
		if (![scene isKindOfClass:UIWindowScene.class]) {
			continue;
		}

		BOOL active = scene.activationState == UISceneActivationStateForegroundActive;

		for (UIWindow *window in ((UIWindowScene *)scene).windows) {
			if (active && window.isKeyWindow) {
				return window;
			}
			if (active && activeWindow == nil) {
				activeWindow = window;
			}
			if (anyWindow == nil) {
				anyWindow = window;
			}
		}
	}

	return activeWindow != nil ? activeWindow : anyWindow;
}
#else
- (ASPresentationAnchor)presentationAnchorForWebAuthenticationSession:(ASWebAuthenticationSession *)session {
	NSWindow *window = NSApplication.sharedApplication.keyWindow;
	if (window == nil) {
		window = NSApplication.sharedApplication.windows.firstObject;
	}
	return window;
}
#endif
@end

static ASWebAuthenticationSession *colibriCurrentSession = nil;
static ColibriWebAuthContextProvider *colibriContextProvider = nil;

void colibri_start_web_auth(const char *cUrl, const char *cScheme, ColibriWebAuthCallback callback, void *ctx) {
	NSString *urlString = [NSString stringWithUTF8String:cUrl];
	NSString *scheme = [NSString stringWithUTF8String:cScheme];

	dispatch_async(dispatch_get_main_queue(), ^{
		if (colibriCurrentSession != nil) {
			[colibriCurrentSession cancel];
		}

		NSURL *url = [NSURL URLWithString:urlString];
		if (url == nil) {
			callback(NULL, "invalid authorization url", ctx);
			return;
		}

		colibriContextProvider = [ColibriWebAuthContextProvider new];
		colibriCurrentSession = [[ASWebAuthenticationSession alloc]
			initWithURL:url
			callbackURLScheme:scheme
			completionHandler:^(NSURL *callbackURL, NSError *error) {
				dispatch_async(dispatch_get_main_queue(), ^{
					colibriCurrentSession = nil;
					colibriContextProvider = nil;
				});
				if (callbackURL != nil) {
					callback(callbackURL.absoluteString.UTF8String, NULL, ctx);
				} else {
					BOOL canceled = [error.domain isEqualToString:ASWebAuthenticationSessionErrorDomain] &&
						error.code == ASWebAuthenticationSessionErrorCodeCanceledLogin;
					const char *message = canceled ? "canceled" : error.localizedDescription.UTF8String;
					callback(NULL, message != NULL ? message : "authentication failed", ctx);
				}
			}];
		colibriCurrentSession.presentationContextProvider = colibriContextProvider;

		if (![colibriCurrentSession start]) {
			colibriCurrentSession = nil;
			colibriContextProvider = nil;
			callback(NULL, "failed to start authentication session", ctx);
		}
	});
}
