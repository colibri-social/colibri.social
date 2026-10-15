import type { social } from "@colibri-social/lexicons";
import type { Datetime, Did, GifView, SpaceRef } from "../types";

export type PreferencesWire = social.colibri.beta.actor.defs.Preferences;
export type MuteWire = social.colibri.beta.actor.defs.Mute;

export const NOTIFICATION_LEVELS = [
	"all",
	"mentionsAndReplies",
	"nothing",
] as const;

export type NotificationLevel = (typeof NOTIFICATION_LEVELS)[number];

export type MuteSubject =
	| { kind: "actor"; did: Did }
	| { kind: "channel"; channel: SpaceRef }
	| { kind: "thread"; thread: SpaceRef };

export type Mute = { subject: MuteSubject; createdAt: Datetime };

export type Preferences = {
	notificationLevel: NotificationLevel;
	communityOrder: Did[];
	shareActivity: boolean;
	gifFavorites: GifView[];
	mutes: Mute[];
};

export type SettingsRecord = Pick<
	Preferences,
	"notificationLevel" | "communityOrder" | "shareActivity" | "gifFavorites"
>;

export type SettingsChange = Partial<SettingsRecord>;

export type MuteRecord = { rkey: string; mute: Mute };

export type PreferenceBackend = {
	load: () => Promise<Preferences>;
	putSettings: (
		settings: SettingsRecord,
		change: SettingsChange,
	) => Promise<Preferences>;
	listMutes: () => Promise<MuteRecord[]>;
	createMute: (rkey: string, mute: Mute) => Promise<void>;
	deleteMute: (rkey: string) => Promise<void>;
	putMutes: (mutes: Mute[]) => Promise<Preferences>;
};

export const DEFAULT_PREFERENCES: Preferences = {
	notificationLevel: "all",
	communityOrder: [],
	shareActivity: false,
	gifFavorites: [],
	mutes: [],
};
