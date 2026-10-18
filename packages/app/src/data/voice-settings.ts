import { createRoot } from "solid-js";
import { DEVICE_KEYS, devicePref } from "./device-prefs";
import {
	DEFAULT_SCREEN_SHARE,
	isScreenShareOptions,
	type ScreenShareOptions,
} from "./screen-share";

export const MAX_VOLUME = 200;

export type VoiceSettings = {
	microphone?: string;
	speaker?: string;
	camera?: string;
	inputVolume: number;
	outputVolume: number;
	noiseSuppression: boolean;
	voiceGate: boolean;
	screen: ScreenShareOptions;
};

type StoredVoiceSettings = Omit<VoiceSettings, "screen"> & {
	screen?: ScreenShareOptions;
};

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
	inputVolume: 100,
	outputVolume: 100,
	noiseSuppression: true,
	voiceGate: false,
	screen: DEFAULT_SCREEN_SHARE,
};

const optionalString = (value: unknown) =>
	value === undefined || typeof value === "string";

const volume = (value: unknown) =>
	typeof value === "number" && value >= 0 && value <= MAX_VOLUME;

export const isVoiceSettings = (
	value: unknown,
): value is StoredVoiceSettings => {
	if (typeof value !== "object" || value === null) return false;
	const settings = value as Record<string, unknown>;
	return (
		optionalString(settings.microphone) &&
		optionalString(settings.speaker) &&
		optionalString(settings.camera) &&
		volume(settings.inputVolume) &&
		volume(settings.outputVolume) &&
		typeof settings.noiseSuppression === "boolean" &&
		typeof settings.voiceGate === "boolean" &&
		(settings.screen === undefined || isScreenShareOptions(settings.screen))
	);
};

export const createVoiceSettings = () => {
	const [stored, setSettings] = devicePref<StoredVoiceSettings>(
		DEVICE_KEYS.voiceSettings,
		DEFAULT_VOICE_SETTINGS,
		isVoiceSettings,
	);
	const settings = (): VoiceSettings => {
		const current = stored();
		return { ...current, screen: current.screen ?? DEFAULT_SCREEN_SHARE };
	};
	const update = (patch: Partial<VoiceSettings>) =>
		setSettings({ ...settings(), ...patch });
	const updateScreen = (patch: Partial<ScreenShareOptions>) =>
		update({ screen: { ...settings().screen, ...patch } });
	return { settings, update, updateScreen };
};

export type VoiceSettingsStore = ReturnType<typeof createVoiceSettings>;

let shared: VoiceSettingsStore | undefined;

export const voiceSettings = () => {
	shared ??= createRoot(() => createVoiceSettings());
	return shared;
};
