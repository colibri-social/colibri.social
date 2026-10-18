import { DEVICE_KEYS } from "../../data/device-prefs";
import type { OsActivation } from "../notifications/types";
import { parsePushActivation } from "./activation";
import {
	type PushProvider,
	retirePrevious,
	type StoredValue,
	storedValue,
} from "./types";

export const PUSH_WORKER_URL = "/push-sw.js";

export type PushWorkers = Pick<
	ServiceWorkerContainer,
	"register" | "getRegistration" | "addEventListener" | "removeEventListener"
> & { ready: Promise<unknown> };

export type WebPushEnvironment = {
	workers: PushWorkers;
	vapidKey: string;
};

export const webPushEnvironment = (): WebPushEnvironment | undefined => {
	if (typeof window === "undefined" || "__TAURI_INTERNALS__" in window) {
		return undefined;
	}
	if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
		return undefined;
	}
	const vapidKey = import.meta.env.PUBLIC_VAPID_KEY;
	if (!vapidKey) return undefined;
	return { workers: navigator.serviceWorker, vapidKey };
};

export const decodeVapidKey = (base64: string): Uint8Array<ArrayBuffer> => {
	const padding = "=".repeat((4 - (base64.length % 4)) % 4);
	const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
	const raw = atob(normalized);
	const output = new Uint8Array(new ArrayBuffer(raw.length));
	for (let index = 0; index < raw.length; index++) {
		output[index] = raw.charCodeAt(index);
	}
	return output;
};

const encodeKey = (buffer: ArrayBuffer | null): string => {
	if (!buffer) return "";
	let binary = "";
	for (const byte of new Uint8Array(buffer))
		binary += String.fromCharCode(byte);
	return btoa(binary);
};

const onWorkerMessage = (
	workers: PushWorkers,
	handler: (data: Record<string, unknown>) => void,
): (() => void) => {
	const listener = (event: Event) => {
		const data = (event as MessageEvent).data;
		if (typeof data === "object" && data !== null) {
			handler(data as Record<string, unknown>);
		}
	};
	workers.addEventListener("message", listener);
	return () => workers.removeEventListener("message", listener);
};

export const createWebPushProvider = (options: {
	environment: WebPushEnvironment;
	endpoint?: StoredValue;
}): PushProvider => {
	const { workers, vapidKey } = options.environment;
	const cached = options.endpoint ?? storedValue(DEVICE_KEYS.webPushEndpoint);

	const current = async () => {
		const registration = await workers.getRegistration(PUSH_WORKER_URL);
		return {
			registration,
			subscription: (await registration?.pushManager.getSubscription()) ?? null,
		};
	};

	return {
		kind: "web",
		subscribe: async (api) => {
			const registration = await workers.register(PUSH_WORKER_URL);
			await workers.ready;
			const subscription =
				(await registration.pushManager.getSubscription()) ??
				(await registration.pushManager.subscribe({
					userVisibleOnly: true,
					applicationServerKey: decodeVapidKey(vapidKey),
				}));
			const { endpoint } = subscription;
			await retirePrevious(cached, endpoint, (previous) =>
				api.unregisterPush({ provider: "webpush", endpoint: previous }),
			);
			await api.registerPush({
				provider: "webpush",
				platform: "web",
				endpoint,
				p256dh: encodeKey(subscription.getKey("p256dh")),
				auth: encodeKey(subscription.getKey("auth")),
			});
			cached.set(endpoint);
			return true;
		},
		unsubscribe: async (api) => {
			const previous = cached.get();
			cached.set(undefined);
			const { subscription } = await current();
			const endpoint = subscription?.endpoint ?? previous;
			await subscription?.unsubscribe();
			if (endpoint && api) {
				await api.unregisterPush({ provider: "webpush", endpoint });
			}
		},
		hasLeftover: async () => {
			if (cached.get() !== undefined) return true;
			try {
				return (await current()).subscription !== null;
			} catch {
				return false;
			}
		},
		watch: (onChange) =>
			onWorkerMessage(workers, (data) => {
				if (data.type === "colibri-push-subscription-changed") onChange();
			}),
		dismiss: async (target) => {
			const { registration } = await current();
			if (!registration) return;
			for (const notification of await registration.getNotifications()) {
				const data = notification.data as
					| { channelUri?: unknown; threadUri?: unknown }
					| null
					| undefined;
				const owner = data?.threadUri ?? data?.channelUri;
				if (!target || owner === target) notification.close();
			}
		},
	};
};

export const listenForWorkerActivations = (
	workers: PushWorkers,
	emit: (activation: OsActivation) => void,
): (() => void) =>
	onWorkerMessage(workers, (data) => {
		if (data.type !== "colibri-notification-activated") return;
		const activation = parsePushActivation(data);
		if (activation) emit(activation);
	});
