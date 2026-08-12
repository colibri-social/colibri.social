import { isTauriRuntime } from "./environment";

export type NativeNotificationRequest = {
	title: string;
	body: string;
	subtitle?: string;
	channelUri: string;
	messageUri: string;
	iconPath?: string;
};

export type NativeNotificationActivation = {
	channelUri: string;
	messageUri: string;
};

export const ACTIVATION_EVENT = "colibri-notification-activated";

const loadCore = () => import("@tauri-apps/api/core");

let supported = false;

export const isNativeNotificationSupported = async (): Promise<boolean> => {
	if (supported) return true;
	if (!isTauriRuntime()) return false;

	try {
		const { invoke } = await loadCore();
		supported = await invoke<boolean>("native_notify_supported");
	} catch {
		supported = false;
	}

	return supported;
};

export const showNativeNotification = async (
	payload: NativeNotificationRequest,
): Promise<void> => {
	const { invoke } = await loadCore();
	await invoke("native_notify", { payload });
};

export const dismissNativeChannel = async (
	channelUri: string,
): Promise<void> => {
	const { invoke } = await loadCore();
	await invoke("native_notify_dismiss", { channelUri });
};

export const cacheNativeAvatar = async (
	cid: string,
	bytes: Uint8Array,
): Promise<string | undefined> => {
	const { invoke } = await loadCore();
	const path = await invoke<string | null>("native_notify_cache_avatar", {
		cid,
		bytes: Array.from(bytes),
	});
	return path ?? undefined;
};

export const listenForNativeActivation = async (
	handler: (activation: NativeNotificationActivation) => void,
): Promise<() => void> => {
	if (!isTauriRuntime()) return () => {};

	try {
		const { listen } = await import("@tauri-apps/api/event");
		return await listen<NativeNotificationActivation>(
			ACTIVATION_EVENT,
			(event) => handler(event.payload),
		);
	} catch {
		return () => {};
	}
};
