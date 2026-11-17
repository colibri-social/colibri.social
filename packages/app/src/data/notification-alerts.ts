import type { SpaceNotificationLevel } from "./notifications";
import { type NotificationView, VOICE_CHANNEL } from "./types";

export const STALE_ALERT_MS = 5000;
export const RENDERED_MESSAGE_TTL_MS = 60_000;
export const RENDERED_MESSAGE_LIMIT = 200;

export type NotificationAlertContext = {
	viewer: string;
	preferencesLoaded: boolean;
	viewing: string | undefined;
	visible: boolean;
	doNotDisturb: boolean;
	spaceMuted: boolean;
	spaceLevel: SpaceNotificationLevel;
	channelMuted: boolean;
	threadMuted: boolean;
	authorBlocked: boolean;
	renderedOnScreen: boolean;
	voiceChannel: string | undefined;
	now: number;
};

export type RenderedMessages = {
	record: (target: string, rkey: string) => void;
	has: (target: string, rkey: string) => boolean;
};

export const isPingNotification = (
	view: Pick<NotificationView, "kind">,
): boolean => view.kind === "mention" || view.kind === "reply";

export const notificationTarget = (
	view: Pick<NotificationView, "channel" | "thread">,
): string => view.thread ?? view.channel;

const isVoiceChannelRef = (ref: string): boolean =>
	ref.includes(`/${VOICE_CHANNEL}/`);

export const shouldAlertNotification = (
	view: NotificationView,
	context: NotificationAlertContext,
): boolean => {
	if (!context.preferencesLoaded) return false;
	if (context.doNotDisturb) return false;
	if (view.seenAt) return false;
	if (view.author.did === context.viewer) return false;
	if (context.authorBlocked) return false;
	if (context.renderedOnScreen) return false;
	if (context.visible && notificationTarget(view) === context.viewing)
		return false;
	const indexedAt = Date.parse(view.indexedAt);
	if (Number.isFinite(indexedAt) && context.now - indexedAt > STALE_ALERT_MS)
		return false;
	if (context.spaceMuted || context.spaceLevel === "nothing") return false;
	if (isVoiceChannelRef(view.channel) && context.voiceChannel !== view.channel)
		return false;
	if (isPingNotification(view)) return true;
	return (
		context.spaceLevel === "all" &&
		!context.channelMuted &&
		!context.threadMuted
	);
};

export const createRenderedMessages = (
	now: () => number = Date.now,
	ttl = RENDERED_MESSAGE_TTL_MS,
	limit = RENDERED_MESSAGE_LIMIT,
): RenderedMessages => {
	const entries = new Map<string, number>();

	const keyOf = (target: string, rkey: string) => {
		return `${target} ${rkey}`;
	};

	const prune = (at: number) => {
		for (const [key, recordedAt] of entries) {
			if (at - recordedAt < ttl && entries.size <= limit) return;
			entries.delete(key);
		}
	};

	return {
		record: (target, rkey) => {
			const at = now();
			const key = keyOf(target, rkey);

			entries.delete(key);
			entries.set(key, at);
			prune(at);
		},
		has: (target, rkey) => {
			prune(now());

			return entries.has(keyOf(target, rkey));
		},
	};
};
