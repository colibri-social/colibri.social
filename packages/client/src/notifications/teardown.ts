import { discardPendingNotificationActivation } from "./activation";
import { isAndroidTauriRuntime, isWebRuntime } from "./environment";
import { unregisterAllPush } from "./index";
import { hasCachedApnsToken } from "./push-apns";
import { hasCachedFcmToken } from "./push-fcm";
import { hasWebPushSubscription } from "./push-web";
import { clearNativeNotifications } from "./tauri-native";

const TEARDOWN_TIMEOUT_MS = 3000;

type Unregister = (endpoint: string, provider?: string) => Promise<unknown>;

const clearWebNotifications = async (): Promise<void> => {
	if (!isWebRuntime() || !("serviceWorker" in navigator)) return;
	const registrations = await navigator.serviceWorker.getRegistrations();
	for (const registration of registrations) {
		for (const notification of await registration.getNotifications()) {
			notification.close();
		}
	}
};

const clearAndroidNotifications = async (): Promise<void> => {
	if (!(await isAndroidTauriRuntime())) return;
	const { removeAllActive } = await import("@tauri-apps/plugin-notification");
	await removeAllActive();
};

const clearDeliveredNotifications = async (): Promise<void> => {
	await Promise.allSettled([
		clearWebNotifications(),
		clearAndroidNotifications(),
		clearNativeNotifications(),
	]);
};

const withTimeout = (work: Promise<unknown>): Promise<void> =>
	new Promise((resolve) => {
		const timer = setTimeout(resolve, TEARDOWN_TIMEOUT_MS);
		work.finally(() => {
			clearTimeout(timer);
			resolve();
		});
	});

export const teardownNotifications = (
	unregister?: Unregister,
): Promise<void> => {
	discardPendingNotificationActivation();
	return withTimeout(
		Promise.allSettled([
			unregisterAllPush(unregister),
			clearDeliveredNotifications(),
		]),
	);
};

export const hasLeftoverPushRegistration = async (): Promise<boolean> => {
	if (hasCachedFcmToken() || hasCachedApnsToken()) return true;
	try {
		return await hasWebPushSubscription();
	} catch {
		return false;
	}
};
