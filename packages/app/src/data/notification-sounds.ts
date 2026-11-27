import pingUrl from "../../../assets/files/sounds/ping.wav";
import type { SoundGroup } from "./preferences/types";
import {
	createSoundPlayer,
	type SoundPlayer,
	VOICE_SOUNDS,
} from "./voice-sounds";

const NOTIFICATION_SOUNDS = { ping: pingUrl } as const;

const PREVIEW_SOUNDS = { ...NOTIFICATION_SOUNDS, ...VOICE_SOUNDS } as const;

type PreviewSound = keyof typeof PREVIEW_SOUNDS;

export type NotificationSound = keyof typeof NOTIFICATION_SOUNDS;

const SOUND_GROUP_PREVIEWS = {
	ping: "ping",
	presence: "join",
	mic: "mute",
	video: "camOn",
} as const satisfies Record<SoundGroup, PreviewSound>;

export const createNotificationSoundPlayer = () => {
	return createSoundPlayer(NOTIFICATION_SOUNDS);
};

let previewPlayer: SoundPlayer<PreviewSound> | undefined;

export const previewSoundGroup = (group: SoundGroup, volume: number) => {
	previewPlayer ??= createSoundPlayer(PREVIEW_SOUNDS);
	previewPlayer(SOUND_GROUP_PREVIEWS[group], volume);
};
