import { createRoot } from "solid-js";
import { DEVICE_KEYS, devicePref } from "./device-prefs";

export const MAX_VOLUME = 200;

export type VoiceSettings = {
	microphone?: string;
	speaker?: string;
	camera?: string;
	inputVolume: number;
	outputVolume: number;
	noiseSuppression: boolean;
	voiceGate: boolean;
};

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
	inputVolume: 100,
	outputVolume: 100,
	noiseSuppression: true,
	voiceGate: false,
};

const optionalString = (value: unknown) =>
	value === undefined || typeof value === "string";

const volume = (value: unknown) =>
	typeof value === "number" && value >= 0 && value <= MAX_VOLUME;

export const isVoiceSettings = (value: unknown): value is VoiceSettings => {
	if (typeof value !== "object" || value === null) return false;
	const settings = value as Record<string, unknown>;
	return (
		optionalString(settings.microphone) &&
		optionalString(settings.speaker) &&
		optionalString(settings.camera) &&
		volume(settings.inputVolume) &&
		volume(settings.outputVolume) &&
		typeof settings.noiseSuppression === "boolean" &&
		typeof settings.voiceGate === "boolean"
	);
};

export const createVoiceSettings = () => {
	const [settings, setSettings] = devicePref(
		DEVICE_KEYS.voiceSettings,
		DEFAULT_VOICE_SETTINGS,
		isVoiceSettings,
	);
	const update = (patch: Partial<VoiceSettings>) =>
		setSettings({ ...settings(), ...patch });
	return { settings, update };
};

export type VoiceSettingsStore = ReturnType<typeof createVoiceSettings>;

let shared: VoiceSettingsStore | undefined;

export const voiceSettings = () => {
	shared ??= createRoot(() => createVoiceSettings());
	return shared;
};
