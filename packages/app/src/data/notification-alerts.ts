import type { SpaceNotificationLevel } from "./notifications";
import type { NotificationView } from "./types";

export const STALE_ALERT_MS = 5000;

export type NotificationAlertContext = {
	viewer: string;
	viewing: string | undefined;
	visible: boolean;
	doNotDisturb: boolean;
	spaceMuted: boolean;
	spaceLevel: SpaceNotificationLevel;
	channelMuted: boolean;
	threadMuted: boolean;
	now: number;
};

export const isPingNotification = (
	view: Pick<NotificationView, "kind">,
): boolean => view.kind === "mention" || view.kind === "reply";

export const notificationTarget = (
	view: Pick<NotificationView, "channel" | "thread">,
): string => view.thread ?? view.channel;

export const shouldAlertNotification = (
	view: NotificationView,
	context: NotificationAlertContext,
): boolean => {
	if (context.doNotDisturb) return false;
	if (view.seenAt) return false;
	if (view.author.did === context.viewer) return false;
	if (context.visible && notificationTarget(view) === context.viewing)
		return false;
	const indexedAt = Date.parse(view.indexedAt);
	if (Number.isFinite(indexedAt) && context.now - indexedAt > STALE_ALERT_MS)
		return false;
	if (context.spaceMuted || context.spaceLevel === "nothing") return false;
	if (isPingNotification(view)) return true;
	return (
		context.spaceLevel === "all" &&
		!context.channelMuted &&
		!context.threadMuted
	);
};
