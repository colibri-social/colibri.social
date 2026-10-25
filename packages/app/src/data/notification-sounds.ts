import pingUrl from "../../../assets/files/sounds/ping.wav";
import { createSoundPlayer } from "./voice-sounds";

export const NOTIFICATION_SOUNDS = { ping: pingUrl } as const;

export type NotificationSound = keyof typeof NOTIFICATION_SOUNDS;

export const createNotificationSoundPlayer = () =>
	createSoundPlayer(NOTIFICATION_SOUNDS);
