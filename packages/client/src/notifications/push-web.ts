import { isWebRuntime } from "./environment";

const SW_URL = "/push-sw.js";

/** Serializable push subscription sent to the AppView. */
export type WebPushSubscription = {
	platform: "web";
	endpoint: string;
	keys: {
		p256dh: string;
		auth: string;
	};
};

/**
 * Resolve the VAPID public key. Accessed defensively because the client is
 * built by tsup but re-bundled by the host (Astro uses `PUBLIC_*`, a standalone
 * Vite dev server uses `VITE_*`); a host may also inject it as a global.
 */
const getVapidPublicKey = (): string | undefined => {
	const env = (import.meta as { env?: Record<string, string | undefined> }).env;
	return (
		env?.PUBLIC_VAPID_KEY ??
		env?.VITE_VAPID_KEY ??
		(typeof window !== "undefined"
			? (window as { __COLIBRI_VAPID_KEY__?: string }).__COLIBRI_VAPID_KEY__
			: undefined)
	);
};

const isPushSupported = (): boolean =>
	isWebRuntime() && "serviceWorker" in navigator && "PushManager" in window;

/** Decode a base64url VAPID key into the Uint8Array the Push API expects. */
const urlBase64ToUint8Array = (base64: string): Uint8Array => {
	const padding = "=".repeat((4 - (base64.length % 4)) % 4);
	const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
	const raw = atob(normalized);
	const output = new Uint8Array(raw.length);
	for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
	return output;
};

const arrayBufferToBase64 = (buffer: ArrayBuffer | null): string => {
	if (!buffer) return "";
	const bytes = new Uint8Array(buffer);
	let binary = "";
	for (const b of bytes) binary += String.fromCharCode(b);
	return btoa(binary);
};

const toSerializable = (sub: PushSubscription): WebPushSubscription => ({
	platform: "web",
	endpoint: sub.endpoint,
	keys: {
		p256dh: arrayBufferToBase64(sub.getKey("p256dh")),
		auth: arrayBufferToBase64(sub.getKey("auth")),
	},
});

/**
 * Register the push Service Worker, create (or reuse) a Push subscription, and
 * hand the serialized subscription to `register` (which stores it on the
 * AppView). No-op when push isn't supported or no VAPID key is configured.
 */
export const subscribeWebPush = async (
	register: (sub: WebPushSubscription) => Promise<unknown>,
): Promise<boolean> => {
	if (!isPushSupported()) return false;

	const vapidKey = getVapidPublicKey();
	if (!vapidKey) {
		console.warn("[notifications] No VAPID key configured; skipping web push.");
		return false;
	}

	const registration = await navigator.serviceWorker.register(SW_URL);
	await navigator.serviceWorker.ready;

	const existing = await registration.pushManager.getSubscription();
	const subscription =
		existing ??
		(await registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: urlBase64ToUint8Array(vapidKey),
		}));

	await register(toSerializable(subscription));
	return true;
};

/**
 * Tear down the local push subscription and notify the AppView to drop it.
 */
export const unsubscribeWebPush = async (
	unregister: (endpoint: string) => Promise<unknown>,
): Promise<void> => {
	if (!isPushSupported()) return;

	const registration = await navigator.serviceWorker.getRegistration(SW_URL);
	const subscription = await registration?.pushManager.getSubscription();
	if (!subscription) return;

	const { endpoint } = subscription;
	await subscription.unsubscribe();
	await unregister(endpoint);
};
