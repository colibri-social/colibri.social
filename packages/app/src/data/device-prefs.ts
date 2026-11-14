import {
	clampStripHeight,
	DEFAULT_VOICE_STRIP_HEIGHT,
} from "@colibri-social/lib";
import { createRoot, createSignal } from "solid-js";
import {
	readStored,
	readStoredJSON,
	writeStored,
	writeStoredJSON,
} from "./persist";

export const DEVICE_KEYS = {
	lastSpace: "colibri:last-space",
	lastChannel: (space: string) => `colibri:last-channel:${space}`,
	voiceSettings: "colibri:voice-settings",
	voiceVolumes: "colibri:voice-volumes",
	voiceStripHeight: "colibri:voice-strip-height",
	voiceStripHidden: "colibri:voice-strip-hidden",
	reportAttribution: "colibri:report-attribution",
	systemWindowControls: "colibri:system-window-controls",
	nativeNotifications: "colibri:native-notifications",
	notificationPrompt: "colibri:notification-prompt-answered",
	apnsToken: "colibri:apns:last-token",
	fcmToken: "colibri:fcm:last-token",
	webPushEndpoint: "colibri:webpush:last-endpoint",
	pendingLink: "colibri:pending-link",
	customRecordExplorer: "colibri:custom-record-explorer",
} as const;

export const deviceString = (key: string) => {
	const [value, setValue] = createSignal(readStored(key));
	const set = (next: string | undefined) => {
		setValue(next);
		writeStored(key, next);
	};
	return [value, set] as const;
};

export const devicePref = <T>(
	key: string,
	fallback: T,
	accept: (value: unknown) => value is T,
) => {
	const [value, setValue] = createSignal<T>(
		readStoredJSON(key, accept) ?? fallback,
	);
	const set = (next: T) => {
		setValue(() => next);
		writeStoredJSON(key, next);
	};
	return [value, set] as const;
};

const isFiniteNumber = (value: unknown): value is number =>
	typeof value === "number" && Number.isFinite(value);

const isBoolean = (value: unknown): value is boolean =>
	typeof value === "boolean";

const createVoiceStripPrefs = () => {
	const [height, setHeight] = devicePref(
		DEVICE_KEYS.voiceStripHeight,
		DEFAULT_VOICE_STRIP_HEIGHT,
		isFiniteNumber,
	);
	const [hidden, setHidden] = devicePref(
		DEVICE_KEYS.voiceStripHidden,
		false,
		isBoolean,
	);
	return {
		height: () => clampStripHeight(height()),
		setHeight: (next: number) => setHeight(clampStripHeight(next)),
		hidden,
		setHidden,
	};
};

let voiceStrip: ReturnType<typeof createVoiceStripPrefs> | undefined;

export const voiceStripPrefs = () => {
	voiceStrip ??= createRoot(createVoiceStripPrefs);
	return voiceStrip;
};
