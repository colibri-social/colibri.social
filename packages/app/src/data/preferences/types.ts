import type { social } from "@colibri-social/lexicons";
import type { Datetime, Did, GifView, SpaceRef } from "../types";

export type PreferencesWire = social.colibri.beta.actor.defs.Preferences;
export type MuteWire = social.colibri.beta.actor.defs.Mute;
export type ClientPreferencesWire =
	social.colibri.beta.actor.defs.ClientPreferences;
export type ComposerStateWire = social.colibri.beta.actor.defs.ComposerState;

export const NOTIFICATION_LEVELS = [
	"all",
	"mentionsAndReplies",
	"nothing",
] as const;

export type NotificationLevel = (typeof NOTIFICATION_LEVELS)[number];

export const THEMES = ["system", "dark", "light"] as const;

export type Theme = (typeof THEMES)[number];

export const BLUESKY_CLIENTS = [
	"anisota",
	"blacksky",
	"bluesky",
	"deer",
	"mu",
	"northsky",
	"witchsky",
	"custom",
] as const;

export type BlueskyClient = (typeof BLUESKY_CLIENTS)[number];

export type MuteSubject =
	| { kind: "actor"; did: Did }
	| { kind: "channel"; channel: SpaceRef }
	| { kind: "thread"; thread: SpaceRef };

export type Mute = { subject: MuteSubject; createdAt: Datetime };

export const INBOX_PRESENTATIONS = ["popover", "modal"] as const;

export type InboxPresentation = (typeof INBOX_PRESENTATIONS)[number];

export type ClientPreferences = Omit<
	ClientPreferencesWire,
	"$type" | "controls" | "voiceView"
> & {
	controls?: Omit<NonNullable<ClientPreferencesWire["controls"]>, "$type">;
	voiceView?: Omit<NonNullable<ClientPreferencesWire["voiceView"]>, "$type">;
};

export type EmojiUse = { count: number; lastUsed: number };

export type ComposerState = {
	emojiUsage: Record<string, EmojiUse>;
	skinTone: number;
	recentGifs: GifView[];
};

export type Preferences = {
	notificationLevel: NotificationLevel;
	communityOrder: Did[];
	shareActivity: boolean;
	gifFavorites: GifView[];
	mutes: Mute[];
	spaceLevels: Readonly<Record<string, NotificationLevel>>;
	spaceModeration: Readonly<Record<string, boolean>>;
	client: ClientPreferences;
	composer: ComposerState;
};

export const SETTINGS_FIELDS = [
	"notificationLevel",
	"communityOrder",
	"shareActivity",
	"gifFavorites",
] as const;

export type SettingsRecord = Pick<
	Preferences,
	(typeof SETTINGS_FIELDS)[number]
>;

export type SettingsChange = Partial<
	SettingsRecord & Pick<Preferences, "client" | "composer">
>;

export type MuteRecord = { rkey: string; mute: Mute };

export type PreferenceBackend = {
	load: () => Promise<Preferences>;
	putSettings: (
		current: Preferences,
		change: SettingsChange,
	) => Promise<Preferences>;
	putSpaceLevel: (
		community: Did,
		level: NotificationLevel | undefined,
	) => Promise<Preferences>;
	putSpaceModeration: (
		community: Did,
		hideModeratedMessages: boolean | undefined,
	) => Promise<Preferences>;
	listMutes: () => Promise<MuteRecord[]>;
	createMute: (rkey: string, mute: Mute) => Promise<void>;
	deleteMute: (rkey: string) => Promise<void>;
	putMutes: (mutes: Mute[]) => Promise<Preferences>;
};

export const DEFAULT_COMPOSER: ComposerState = {
	emojiUsage: {},
	skinTone: 0,
	recentGifs: [],
};

export const DEFAULT_PREFERENCES: Preferences = {
	notificationLevel: "all",
	communityOrder: [],
	shareActivity: false,
	gifFavorites: [],
	mutes: [],
	spaceLevels: {},
	spaceModeration: {},
	client: {},
	composer: DEFAULT_COMPOSER,
};
