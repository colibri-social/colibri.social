import type { Datetime, Did, GifView, SpaceRef } from "../types";
import {
	DEFAULT_PREFERENCES,
	type Mute,
	type MuteSubject,
	type MuteWire,
	NOTIFICATION_LEVELS,
	type NotificationLevel,
	type Preferences,
	type PreferencesWire,
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

const asLevel = (value: string | undefined): NotificationLevel =>
	(NOTIFICATION_LEVELS as readonly string[]).includes(value ?? "")
		? (value as NotificationLevel)
		: DEFAULT_PREFERENCES.notificationLevel;

export const fromWire = (wire: Partial<PreferencesWire>): Preferences => ({
	notificationLevel: asLevel(wire.notificationLevel),
	communityOrder: [...(wire.communityOrder ?? [])] as Did[],
	shareActivity: wire.shareActivity ?? DEFAULT_PREFERENCES.shareActivity,
	gifFavorites: [...(wire.gifFavorites ?? [])] as GifView[],
	mutes: (wire.mutes ?? []).flatMap((entry) => {
		const mute = decodeMute(entry);
		return mute ? [mute] : [];
	}),
});
