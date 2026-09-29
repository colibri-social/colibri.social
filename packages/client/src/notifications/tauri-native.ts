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

export const clearNativeNotifications = async (): Promise<void> => {
	if (!(await isNativeNotificationSupported())) return;
	const { invoke } = await loadCore();
	await invoke("native_notify_clear_all");
};

const takeLaunchActivation = async (): Promise<
	NativeNotificationActivation | undefined
> => {
	if (!(await isNativeNotificationSupported())) return undefined;
	try {
		const { invoke } = await loadCore();
		const activation = await invoke<NativeNotificationActivation | null>(
			"native_notify_take_activation",
		);
		return activation ?? undefined;
	} catch {
		return undefined;
	}
};

export const listenForNativeActivation = async (
	handler: (activation: NativeNotificationActivation) => void,
): Promise<() => void> => {
	if (!isTauriRuntime()) return () => {};

	let unlisten = () => {};
	let delivered: string | undefined;
	try {
		const { listen } = await import("@tauri-apps/api/event");
		unlisten = await listen<NativeNotificationActivation>(
			ACTIVATION_EVENT,
			(event) => {
				delivered = event.payload.messageUri;
				void takeLaunchActivation();
				handler(event.payload);
			},
		);
	} catch {}

	const launch = await takeLaunchActivation();
	if (launch && launch.messageUri !== delivered) handler(launch);

	return unlisten;
};
