import { createRoot } from "solid-js";
import { DEVICE_KEYS, devicePref } from "../device-prefs";
import { MAX_VOLUME } from "../voice-settings";

export type VolumeChannel = "voice" | "stream";

export type ParticipantVolume = Partial<Record<VolumeChannel, number>>;

export type ParticipantVolumes = Readonly<Record<string, ParticipantVolume>>;

export const DEFAULT_PARTICIPANT_VOLUME = 100;

const isVolume = (value: unknown) =>
	value === undefined ||
	(typeof value === "number" && value >= 0 && value <= MAX_VOLUME);

export const isParticipantVolumes = (
	value: unknown,
): value is ParticipantVolumes => {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return false;
	}
	return Object.values(value).every((entry) => {
		if (typeof entry !== "object" || entry === null) return false;
		const volume = entry as Record<string, unknown>;
		return isVolume(volume.voice) && isVolume(volume.stream);
	});
};

export const clampVolume = (value: number) =>
	Math.max(0, Math.min(MAX_VOLUME, Math.round(value)));

export const volumeOf = (
	volumes: ParticipantVolumes,
	did: string,
	channel: VolumeChannel,
) => volumes[did]?.[channel] ?? DEFAULT_PARTICIPANT_VOLUME;

export const withVolume = (
	volumes: ParticipantVolumes,
	did: string,
	channel: VolumeChannel,
	value: number,
): ParticipantVolumes => {
	const nextValue = clampVolume(value);
	const entry: ParticipantVolume = { ...volumes[did] };
	if (nextValue === DEFAULT_PARTICIPANT_VOLUME) delete entry[channel];
	else entry[channel] = nextValue;
	const next = { ...volumes };
	if (Object.keys(entry).length === 0) delete next[did];
	else next[did] = entry;
	return next;
};

export const playbackGain = (output: number, participant: number) =>
	Math.max(0, (output / 100) * (participant / 100));

export const createParticipantVolumes = () => {
	const [volumes, setVolumes] = devicePref<ParticipantVolumes>(
		DEVICE_KEYS.voiceVolumes,
		{},
		isParticipantVolumes,
	);
	return {
		volumes,
		volume: (did: string, channel: VolumeChannel) =>
			volumeOf(volumes(), did, channel),
		setVolume: (did: string, channel: VolumeChannel, value: number) =>
			setVolumes(withVolume(volumes(), did, channel, value)),
	};
};

export type ParticipantVolumeStore = ReturnType<
	typeof createParticipantVolumes
>;

let shared: ParticipantVolumeStore | undefined;

export const participantVolumes = () => {
	shared ??= createRoot(() => createParticipantVolumes());
	return shared;
};
