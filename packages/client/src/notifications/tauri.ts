import { isTauriRuntime } from "./environment";
import type {
	NotificationBackend,
	NotificationPayload,
	NotificationPermission,
} from "./types";

/**
 * Notification backend for the Tauri v2 webview.
 *
 * `@tauri-apps/plugin-notification` is imported lazily so the dependency never
 * ends up in the eager web bundle — in a browser this module's import simply
 * never runs.
 */
const loadPlugin = () => import("@tauri-apps/plugin-notification");

export const tauriBackend: NotificationBackend = {
	name: "tauri",

	isSupported() {
		return isTauriRuntime();
	},

	async getPermission(): Promise<NotificationPermission> {
		if (!isTauriRuntime()) return "denied";
		const { isPermissionGranted } = await loadPlugin();
		return (await isPermissionGranted()) ? "granted" : "default";
	},

	async requestPermission(): Promise<NotificationPermission> {
		if (!isTauriRuntime()) return "denied";
		const { isPermissionGranted, requestPermission } = await loadPlugin();
		if (await isPermissionGranted()) return "granted";
		return (await requestPermission()) as NotificationPermission;
	},

	async show(payload: NotificationPayload): Promise<void> {
		const { isPermissionGranted, sendNotification } = await loadPlugin();
		if (!(await isPermissionGranted())) return;

		sendNotification({
			title: payload.title,
			body: payload.body,
			icon: payload.icon,
		});
	},
};
