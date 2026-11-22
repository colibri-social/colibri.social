import { type Accessor, createRoot, createSignal } from "solid-js";
import { currentReleasePlatform } from "../data/release-notes";

export type AndroidHapticsBridge = {
	perform: (kind: string) => void;
	enabled: () => boolean;
};

export const androidHapticsBridge = () =>
	typeof window === "undefined"
		? undefined
		: (window as unknown as { __colibriHaptics?: AndroidHapticsBridge })
				.__colibriHaptics;

export const hapticsAvailable = (platform: string = currentReleasePlatform()) =>
	platform === "ios" || platform === "android";

export const createSystemHaptics = (
	bridge: AndroidHapticsBridge | undefined,
): Accessor<boolean> => {
	const read = () => bridge?.enabled() ?? true;
	const [enabled, setEnabled] = createSignal(read());
	document.addEventListener("visibilitychange", () => setEnabled(read()));
	return enabled;
};

let shared: Accessor<boolean> | undefined;

export const systemHapticsEnabled = () => {
	shared ??= createRoot(() => createSystemHaptics(androidHapticsBridge()));
	return shared();
};
