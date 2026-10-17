import { createSignal } from "solid-js";
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
	reportAttribution: "colibri:report-attribution",
	nativeNotifications: "colibri:native-notifications",
	notificationPrompt: "colibri:notification-prompt-answered",
	apnsToken: "colibri:apns:last-token",
	fcmToken: "colibri:fcm:last-token",
	webPushEndpoint: "colibri:webpush:last-endpoint",
	pendingLink: "colibri:pending-link",
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
