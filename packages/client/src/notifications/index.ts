import { toast } from "somoto";
import { isTauriRuntime, isWebRuntime } from "./environment";
import { tauriBackend } from "./tauri";
import type { NotificationBackend, NotificationPayload } from "./types";
import { webBackend } from "./web";

const noopBackend: NotificationBackend = {
	name: "noop",
	isSupported: () => false,
	getPermission: async () => "denied",
	requestPermission: async () => "denied",
	show: async () => {},
};

const STALE_NOTIFICATION_PING_MS = 5000;

/** Whether a `notification_event` arrived too long after `indexedAt` to still show a live ping for. */
export const isStaleNotificationEvent = (
	indexedAt: string,
	thresholdMs = STALE_NOTIFICATION_PING_MS,
): boolean => Date.now() - Date.parse(indexedAt) > thresholdMs;

let cached: NotificationBackend | undefined;

/** The notification backend for the current runtime (memoized). */
export const getBackend = (): NotificationBackend => {
	if (cached) return cached;

	cached = isTauriRuntime()
		? tauriBackend
		: isWebRuntime()
			? webBackend
			: noopBackend;

	return cached;
};

/**
 * Show a native OS notification, falling back to an in-app toast when native
 * notifications are unsupported or permission has not been granted.
 */
export const notify = async (payload: NotificationPayload): Promise<void> => {
	const backend = getBackend();

	if (backend.isSupported() && (await backend.getPermission()) === "granted") {
		try {
			await backend.show(payload);
			return;
		} catch {
			// Fall through to the toast fallback below.
		}
	}

	toast(payload.title, { description: payload.body });
};

export {
	isAndroidTauriRuntime,
	isTauriRuntime,
	isWebRuntime,
} from "./environment";
export type {
	NotificationBackend,
	NotificationPayload,
	NotificationPermission,
} from "./types";
