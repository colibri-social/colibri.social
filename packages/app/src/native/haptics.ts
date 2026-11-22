import { classifyThrown, createLogger } from "@colibri-social/lib";
import type {
	HapticImpact,
	HapticNotification,
	Haptics,
} from "@colibri-social/ui";
import { hapticsSetting } from "../data/haptics-setting";
import { currentReleasePlatform } from "../data/release-notes";
import {
	type AndroidHapticsBridge,
	androidHapticsBridge,
	systemHapticsEnabled,
} from "./haptics-system";

const log = createLogger("haptics");

type HapticsPlugin = {
	impactFeedback: (style: HapticImpact) => Promise<unknown>;
	notificationFeedback: (type: HapticNotification) => Promise<unknown>;
	selectionFeedback: () => Promise<unknown>;
};

const loadPlugin = (): Promise<HapticsPlugin> =>
	import("@tauri-apps/plugin-haptics");

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

export const silentHaptics: Haptics = {
	impact: () => {},
	selection: () => {},
	notification: () => {},
};

export const createAndroidHaptics = (
	bridge: AndroidHapticsBridge | undefined = androidHapticsBridge(),
): Haptics => {
	const perform = (kind: string) => bridge?.perform(kind);
	return {
		impact: (style) => perform(`impact:${style}`),
		selection: () => perform("selection"),
		notification: (type) => perform(`notification:${type}`),
	};
};

export const gateHaptics = (
	haptics: Haptics,
	allowed: () => boolean,
): Haptics => ({
	impact: (style) => {
		if (allowed()) haptics.impact(style);
	},
	selection: () => {
		if (allowed()) haptics.selection();
	},
	notification: (type) => {
		if (allowed()) haptics.notification(type);
	},
});

const hapticsAllowed = () => hapticsSetting()[0]() && systemHapticsEnabled();

export const resolveHaptics = (
	platform: string = currentReleasePlatform(),
	allowed: () => boolean = hapticsAllowed,
): Haptics => {
	if (platform === "ios") return gateHaptics(createNativeHaptics(), allowed);
	if (platform === "android") {
		return gateHaptics(createAndroidHaptics(), allowed);
	}
	return silentHaptics;
};
