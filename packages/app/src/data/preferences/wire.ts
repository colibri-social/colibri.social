import type { Datetime, Did, GifView, SpaceRef } from "../types";
import {
	type ClientPreferences,
	type ClientPreferencesWire,
	type ComposerState,
	type ComposerStateWire,
	DEFAULT_COMPOSER,
	DEFAULT_PREFERENCES,
	type EmojiUse,
	type LeftThread,
	type Mute,
	type MuteSubject,
	type MuteWire,
	NOTIFICATION_LEVELS,
	type NotificationLevel,
	type Preferences,
	type PreferencesWire,
	type SettingsChange,
} from "./types";

const MUTED_ACTOR = "social.colibri.beta.actor.defs#mutedActor";
const MUTED_CHANNEL = "social.colibri.beta.actor.defs#mutedChannel";
const MUTED_THREAD = "social.colibri.beta.actor.defs#mutedThread";

export const muteKey = (subject: MuteSubject): string => {
	if (subject.kind === "actor") return `actor:${subject.did}`;
	if (subject.kind === "thread") return `thread:${subject.thread}`;
	return `channel:${subject.channel}`;
};

export const encodeMuteSubject = (subject: MuteSubject) => {
	if (subject.kind === "actor") return { $type: MUTED_ACTOR, did: subject.did };
	if (subject.kind === "thread")
		return { $type: MUTED_THREAD, thread: subject.thread };
	return { $type: MUTED_CHANNEL, channel: subject.channel };
};

export const encodeMute = (mute: Mute) => ({
	subject: encodeMuteSubject(mute.subject),
	createdAt: mute.createdAt,
});

export const decodeMuteSubject = (
	subject: { $type?: string } & Record<string, unknown>,
): MuteSubject | undefined => {
	if (subject.$type === MUTED_ACTOR && typeof subject.did === "string")
		return { kind: "actor", did: subject.did as Did };
	if (subject.$type === MUTED_CHANNEL && typeof subject.channel === "string")
		return { kind: "channel", channel: subject.channel as SpaceRef };
	if (subject.$type === MUTED_THREAD && typeof subject.thread === "string")
		return { kind: "thread", thread: subject.thread as SpaceRef };
	return undefined;
};

export const decodeMute = (
	value: Partial<Pick<MuteWire, "createdAt">> & { subject?: unknown },
): Mute | undefined => {
	if (!value.subject || typeof value.subject !== "object") return undefined;
	const subject = decodeMuteSubject(
		value.subject as { $type?: string } & Record<string, unknown>,
	);
	if (!subject) return undefined;
	return {
		subject,
		createdAt: (value.createdAt ?? new Date(0).toISOString()) as Datetime,
	};
};

export const MAX_EMOJI_USAGE = 50;
export const MAX_RECENT_GIFS = 24;

const isLevel = (value: unknown): value is NotificationLevel =>
	(NOTIFICATION_LEVELS as readonly unknown[]).includes(value);

const asLevel = (value: string | undefined): NotificationLevel =>
	isLevel(value) ? value : DEFAULT_PREFERENCES.notificationLevel;

const withoutType = <T extends { $type?: string }>(
	value: T,
): Omit<T, "$type"> => {
	const { $type: _, ...rest } = value;
	return rest;
};

export const decodeClient = (
	wire: ClientPreferencesWire | undefined,
): ClientPreferences => {
	if (!wire || typeof wire !== "object") return {};
	const { controls, voiceView, ...rest } = withoutType(wire);
	return {
		...rest,
		...(controls ? { controls: withoutType(controls) } : {}),
		...(voiceView ? { voiceView: withoutType(voiceView) } : {}),
	};
};

export const pruneEmojiUsage = (
	usage: Record<string, EmojiUse>,
	limit = MAX_EMOJI_USAGE,
): Record<string, EmojiUse> => {
	const entries = Object.entries(usage);
	if (entries.length <= limit) return usage;
	return Object.fromEntries(
		entries
			.sort(([, a], [, b]) => b.count - a.count || b.lastUsed - a.lastUsed)
			.slice(0, limit),
	);
};

const asSkinTone = (value: unknown) =>
	typeof value === "number" &&
	Number.isInteger(value) &&
	value >= 0 &&
	value <= 5
		? value
		: DEFAULT_COMPOSER.skinTone;

export const decodeComposer = (
	wire: ComposerStateWire | undefined,
): ComposerState => {
	if (!wire || typeof wire !== "object") return DEFAULT_COMPOSER;
	const emojiUsage: Record<string, EmojiUse> = {};
	for (const entry of wire.emojiUsage ?? []) {
		const lastUsed = Date.parse(entry.lastUsed);
		if (!entry.emoji || !(entry.count >= 1)) continue;
		emojiUsage[entry.emoji] = {
			count: entry.count,
			lastUsed: Number.isNaN(lastUsed) ? 0 : lastUsed,
		};
	}
	return {
		emojiUsage,
		skinTone: asSkinTone(wire.skinTone),
		recentGifs: [...(wire.recentGifs ?? [])] as GifView[],
	};
};

export const encodeComposer = (composer: ComposerState) => ({
	emojiUsage: Object.entries(pruneEmojiUsage(composer.emojiUsage)).map(
		([emoji, use]) => ({
			emoji,
			count: Math.max(1, Math.round(use.count)),
			lastUsed: new Date(use.lastUsed).toISOString() as Datetime,
		}),
	),
	skinTone: asSkinTone(composer.skinTone),
	recentGifs: composer.recentGifs.slice(0, MAX_RECENT_GIFS),
});

export const encodeChange = (change: SettingsChange) => {
	const { client, composer, ...settings } = change;
	return {
		...settings,
		...(client ? { clientPreferences: client } : {}),
		...(composer ? { composerState: encodeComposer(composer) } : {}),
	};
};

const decodeSpaceLevels = (
	entries: PreferencesWire["spaceNotifications"],
): Record<string, NotificationLevel> => {
	const levels: Record<string, NotificationLevel> = {};
	for (const entry of entries ?? [])
		if (isLevel(entry.level)) levels[entry.community] = entry.level;
	return levels;
};
const decodeSpaceModeration = (
	entries: PreferencesWire["spaceModerations"],
): Record<string, boolean> => {
	const options: Record<string, boolean> = {};
	for (const entry of entries ?? [])
		if (typeof entry.hideModeratedMessages === "boolean")
			options[entry.community] = entry.hideModeratedMessages;
	return options;
};

const isDatetime = (value: unknown): value is Datetime =>
	typeof value === "string" && !Number.isNaN(Date.parse(value));

export const decodeLeftThreads = (entries: unknown): LeftThread[] => {
	if (!Array.isArray(entries)) return [];
	return entries.flatMap((entry: { thread?: unknown; leftAt?: unknown }) =>
		entry && typeof entry.thread === "string" && isDatetime(entry.leftAt)
			? [{ thread: entry.thread as SpaceRef, leftAt: entry.leftAt }]
			: [],
	);
};

export const encodeLeftThread = (entry: LeftThread) => ({
	thread: entry.thread,
	leftAt: entry.leftAt,
});

export const fromWire = (wire: Partial<PreferencesWire>): Preferences => ({
	notificationLevel: asLevel(wire.notificationLevel),
	communityOrder: [...(wire.communityOrder ?? [])] as Did[],
	shareActivity: wire.shareActivity ?? DEFAULT_PREFERENCES.shareActivity,
	gifFavorites: [...(wire.gifFavorites ?? [])] as GifView[],
	mutes: (wire.mutes ?? []).flatMap((entry) => {
		const mute = decodeMute(entry);
		return mute ? [mute] : [];
	}),
	leftThreads: decodeLeftThreads(wire.leftThreads),
	spaceLevels: decodeSpaceLevels(wire.spaceNotifications),
	spaceModeration: decodeSpaceModeration(wire.spaceModerations),
	client: decodeClient(wire.clientPreferences),
	composer: decodeComposer(wire.composerState),
});
