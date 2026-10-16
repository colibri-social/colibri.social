import type { social } from "@colibri-social/lexicons";
import type { NowPlayingCardProps } from "@colibri-social/ui";
import type { Presence } from "./types";

export type Activity = social.colibri.beta.actor.defs.Activity;

export type ActivityKind = "listening" | "playing" | "streaming";

const KIND_LABELS: Record<ActivityKind, (source: string) => string> = {
	listening: (source) => `Listening to ${source}`,
	playing: () => "Playing",
	streaming: (source) => `Streaming on ${source}`,
};

const isKnownKind = (kind: string): kind is ActivityKind => kind in KIND_LABELS;

export const activityLabel = (activity: Activity) =>
	isKnownKind(activity.kind)
		? KIND_LABELS[activity.kind](activity.source)
		: activity.source;

export const activityIsLive = (
	activity: Activity | undefined,
	now = Date.now(),
) => {
	if (!activity) return false;
	if (activity.endsAt === undefined) return true;
	const endsAt = Date.parse(activity.endsAt);
	return Number.isNaN(endsAt) || endsAt > now;
};

const startedAt = (activity: Activity) => {
	const value = activity.startedAt ? Date.parse(activity.startedAt) : 0;
	return Number.isNaN(value) ? 0 : value;
};

export const liveActivitiesOf = (
	presence: Presence | undefined,
	now = Date.now(),
): Activity[] =>
	(presence?.activities ?? [])
		.filter((activity) => activityIsLive(activity, now))
		.sort((a, b) => startedAt(b) - startedAt(a));

export const activitySummary = (activity: Activity) => {
	if (!activity.subtitle) return activity.title;
	if (activity.kind === "listening") return activity.subtitle;
	return `${activity.title} · ${activity.subtitle}`;
};

export type NowPlaying = Omit<NowPlayingCardProps, "tone" | "class">;

export const toNowPlaying = (
	activity: Activity,
	onOpen?: (href: string, label: string) => void,
): NowPlaying => {
	const card: NowPlaying = {
		kind: activity.kind,
		label: activityLabel(activity),
		source: activity.source,
		title: activity.title,
	};
	if (activity.subtitle) card.artist = activity.subtitle;
	if (activity.detail) card.album = activity.detail;
	if (activity.imageUri) card.artSrc = activity.imageUri;
	const link = activity.linkUri;
	if (link && onOpen) {
		card.href = link;
		card.onOpen = (event) => {
			event.preventDefault();
			onOpen(link, activity.title);
		};
	}
	return card;
};

export const nowPlayingOf = (
	presence: Presence | undefined,
	onOpen?: (href: string, label: string) => void,
	now = Date.now(),
) => {
	const live = liveActivitiesOf(presence, now);
	return live.length > 0
		? live.map((activity) => toNowPlaying(activity, onOpen))
		: undefined;
};

export type MemberActivityLine = {
	kind: string;
	summary: string;
	more: number;
};

export const memberActivityOf = (
	presence: Presence | undefined,
	now = Date.now(),
): MemberActivityLine | undefined => {
	const live = liveActivitiesOf(presence, now);
	const [current] = live;
	if (!current) return undefined;
	return {
		kind: current.kind,
		summary: activitySummary(current),
		more: live.length - 1,
	};
};
