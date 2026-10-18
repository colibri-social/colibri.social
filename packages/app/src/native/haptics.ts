import { classifyThrown, createLogger } from "@colibri-social/lib";
import type {
	HapticImpact,
	HapticNotification,
	Haptics,
} from "@colibri-social/ui";
import { currentReleasePlatform } from "../data/release-notes";

const log = createLogger("haptics");

type HapticsPlugin = {
	impactFeedback: (style: HapticImpact) => Promise<unknown>;
	notificationFeedback: (type: HapticNotification) => Promise<unknown>;
	selectionFeedback: () => Promise<unknown>;
};

const loadPlugin = (): Promise<HapticsPlugin> =>
	import("@tauri-apps/plugin-haptics");

const vibrate = (pattern: number | number[]) => {
	if (typeof navigator !== "undefined" && "vibrate" in navigator) {
		navigator.vibrate(pattern);
	}
};

export const webHaptics: Haptics = {
	impact: (style) => vibrate(style === "heavy" || style === "rigid" ? 14 : 8),
	selection: () => {},
	notification: (type) => vibrate(type === "error" ? [10, 40, 10] : 10),
};

export const createNativeHaptics = (
	load: () => Promise<HapticsPlugin> = loadPlugin,
): Haptics => {
	let plugin: Promise<HapticsPlugin> | undefined;
	let reported = false;
	const run = (method: string, call: (loaded: HapticsPlugin) => unknown) => {
		plugin ??= load();
		void plugin.then(call).catch((thrown: unknown) => {
			if (reported) return;
			reported = true;
			log.warn("haptic feedback failed", {
				code: classifyThrown(thrown, { method }).code,
			});
		});
	};
	return {
		impact: (style) =>
			run("haptics.impact", (loaded) => loaded.impactFeedback(style)),
		selection: () =>
			run("haptics.selection", (loaded) => loaded.selectionFeedback()),
		notification: (type) =>
			run("haptics.notification", (loaded) =>
				loaded.notificationFeedback(type),
			),
	};
};

export const resolveHaptics = (
	platform: string = currentReleasePlatform(),
	native: () => Haptics = createNativeHaptics,
): Haptics =>
	platform === "ios" || platform === "android" ? native() : webHaptics;
