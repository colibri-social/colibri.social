import { createActivationBus } from "./activation";
import { createNativeNotifier } from "./native";
import { createPluginNotifier } from "./plugin";
import { type TauriPort, tauriPort } from "./tauri-port";
import type { OsNotifier } from "./types";
import { createWebNotifier } from "./web";

export type {
	OsActivation,
	OsNotification,
	OsNotifier,
	OsPermission,
} from "./types";

const isTauri = () =>
	typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const isMobileAgent = () =>
	typeof navigator !== "undefined" &&
	/Android|iPhone|iPad/.test(navigator.userAgent);

const noopNotifier: OsNotifier = {
	kind: "none",
	permission: async () => "unsupported",
	requestPermission: async () => "unsupported",
	show: async () => {},
	dismiss: async () => {},
	clearAll: async () => {},
	onActivation: () => () => {},
};

export const resolveNotifier = async (
	options: { tauri?: boolean; mobile?: boolean; port?: TauriPort } = {},
): Promise<OsNotifier> => {
	const bus = createActivationBus();
	if (!(options.tauri ?? isTauri())) {
		return typeof Notification === "undefined"
			? noopNotifier
			: createWebNotifier(bus);
	}
	const port = options.port ?? tauriPort();
	if (options.mobile ?? isMobileAgent()) return createPluginNotifier(port, bus);
	const supported = await port
		.invoke<boolean>("native_notify_supported")
		.catch(() => false);
	return supported
		? createNativeNotifier(port, bus)
		: createPluginNotifier(port, bus);
};

let shared: Promise<OsNotifier> | undefined;

export const osNotifier = (): Promise<OsNotifier> => {
	shared ??= resolveNotifier();
	return shared;
};
