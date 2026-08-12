import { classifyNativeError } from "../errors/native";
import { createLogger } from "../utils/logger";
import { isMacOS } from "../utils/platform";
import { isAndroidTauriRuntime, isTauriRuntime } from "./environment";
import {
	dismissNativeChannel,
	isNativeNotificationSupported,
	showNativeNotification,
} from "./tauri-native";
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

const log = createLogger("notifications");

const withoutNativeFailure = async <T>(
	command: string,
	run: () => Promise<T>,
	fallback: T,
): Promise<T> => {
	try {
		return await run();
	} catch (err) {
		const failure = classifyNativeError(err, command);
		log.warn("the native notification plugin refused a call", {
			code: failure.code,
		});
		return fallback;
	}
};

const javaStringHashCode = (value: string): number => {
	let hash = 0;
	for (let i = 0; i < value.length; i++) {
		hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
	}
	return hash;
};

export const cancelChannelTrayNotification = async (
	channelUri: string,
): Promise<void> => {
	if (await isAndroidTauriRuntime()) {
		try {
			const { removeActive } = await loadPlugin();
			await removeActive([{ id: javaStringHashCode(channelUri) }]);
		} catch {}
		return;
	}

	if (isMacOS() && (await isNativeNotificationSupported())) {
		try {
			await dismissNativeChannel(channelUri);
		} catch {}
	}
};

export const tauriBackend: NotificationBackend = {
	name: "tauri",

	isSupported() {
		return isTauriRuntime();
	},

	async getPermission(): Promise<NotificationPermission> {
		if (!isTauriRuntime()) return "denied";
		if (await isNativeNotificationSupported()) return "granted";

		return withoutNativeFailure(
			"notification.isPermissionGranted",
			async () => {
				const { isPermissionGranted } = await loadPlugin();
				return (await isPermissionGranted()) ? "granted" : "default";
			},
			"denied",
		);
	},

	async requestPermission(): Promise<NotificationPermission> {
		if (!isTauriRuntime()) return "denied";
		if (await isNativeNotificationSupported()) return "granted";

		return withoutNativeFailure(
			"notification.requestPermission",
			async () => {
				const { isPermissionGranted, requestPermission } = await loadPlugin();
				if (await isPermissionGranted()) return "granted";
				return (await requestPermission()) as NotificationPermission;
			},
			"denied",
		);
	},

	async show(payload: NotificationPayload): Promise<void> {
		const channelUri = payload.data?.channelUri;
		const messageUri = payload.data?.messageUri;

		if (channelUri && messageUri && (await isNativeNotificationSupported())) {
			try {
				await showNativeNotification({
					title: payload.title,
					body: payload.body,
					subtitle: payload.subtitle,
					channelUri,
					messageUri,
					iconPath: payload.iconPath,
				});
				return;
			} catch {}
		}

		const { isPermissionGranted, sendNotification } = await loadPlugin();
		if (!(await isPermissionGranted())) return;

		sendNotification({
			title: payload.title,
			body: payload.body,
			icon: payload.icon,
		});
	},
};
