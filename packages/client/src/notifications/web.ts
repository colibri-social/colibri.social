import { isWebRuntime } from "./environment";
import type {
	NotificationBackend,
	NotificationPayload,
	NotificationPermission,
} from "./types";

/** Default icon shown on notifications (matches the web app manifest). */
const DEFAULT_ICON = "/web-app-manifest-192x192.png";

/**
 * Foreground notification backend built on the browser `Notification` API.
 *
 * This shows notifications while a tab is open (the `NativeNotifications`
 * component only fires it when the tab is unfocused). Delivery while the app is
 * fully closed is handled separately by the Service Worker (`push-web.ts`).
 */
export const webBackend: NotificationBackend = {
	name: "web",

	isSupported() {
		return isWebRuntime();
	},

	async getPermission(): Promise<NotificationPermission> {
		if (!isWebRuntime()) return "denied";
		return Notification.permission as NotificationPermission;
	},

	async requestPermission(): Promise<NotificationPermission> {
		if (!isWebRuntime()) return "denied";
		return (await Notification.requestPermission()) as NotificationPermission;
	},

	async show(payload: NotificationPayload): Promise<void> {
		if (Notification.permission !== "granted") return;

		const notification = new Notification(payload.title, {
			body: payload.body,
			tag: payload.tag,
			icon: payload.icon ?? DEFAULT_ICON,
			data: payload.data,
		});

		notification.onclick = () => {
			window.focus();
			const channelUri = payload.data?.channelUri;
			if (channelUri) {
				window.location.href = `/app/c/${channelUri.replace("at://", "")}`;
			}
			notification.close();
		};
	},
};
