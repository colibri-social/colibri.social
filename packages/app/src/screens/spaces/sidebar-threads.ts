import { skeyOf } from "../../data/ids";
import { isPingNotification } from "../../data/notification-alerts";
import type { DataStore, SpaceData } from "../../data/store";
import type { NotificationView, SpaceRef, ThreadView } from "../../data/types";

export const SIDEBAR_THREAD_LIMIT = 5;
export const SIDEBAR_STALE_MS = 3 * 24 * 60 * 60 * 1000;

const newestFirst = (a: ThreadView, b: ThreadView) => {
	if (a.lastActivityAt === b.lastActivityAt) return a.space < b.space ? -1 : 1;
	return a.lastActivityAt < b.lastActivityAt ? 1 : -1;
};

export type SidebarThreadContext = {
	mentions: number;
	repliedTo: boolean;
	viewer?: string;
	now: number;
	activeThread?: string;
};

const isStale = (thread: ThreadView, now: number) => {
	const at = Date.parse(thread.lastActivityAt);
	return !Number.isNaN(at) && now - at >= SIDEBAR_STALE_MS;
};

const anchorAuthorOf = (thread: ThreadView): string | undefined => {
	const message = thread.anchorMessage;
	if (message && "author" in message) return message.author.did;
	return thread.anchor?.did;
};

export const belongsInSidebar = (
	thread: ThreadView,
	context: SidebarThreadContext,
) => {
	if (context.activeThread === skeyOf(thread.space)) return true;
	if (thread.closedAt || isStale(thread, context.now)) return false;
	return (
		!!thread.viewer.following ||
		context.mentions > 0 ||
		context.repliedTo ||
		(!!context.viewer && anchorAuthorOf(thread) === context.viewer)
	);
};

export const capKeepingPinned = <T extends { thread: ThreadView }>(
	listed: T[],
	pinnedThread?: string,
	limit = SIDEBAR_THREAD_LIMIT,
): T[] => {
	const shown = listed.slice(0, limit);
	const pinned = listed.find(
		(state) => skeyOf(state.thread.space) === pinnedThread,
	);
	if (pinned && !shown.includes(pinned)) shown[shown.length - 1] = pinned;
	return shown;
};

export const unseenThreadPings = (
	notifications: readonly NotificationView[],
): NotificationView[] =>
	notifications.filter(
		(entry) => !entry.seenAt && entry.thread && isPingNotification(entry),
	);

export const repliedThreads = (
	notifications: readonly NotificationView[],
): Set<string> =>
	new Set(
		notifications.flatMap((entry) =>
			entry.kind === "reply" && entry.thread ? [entry.thread] : [],
		),
	);

export const sidebarThreads = (data: DataStore, channel: SpaceRef) =>
	(data.threadsOf(channel).value() ?? []).map(
		(thread) => data.threads.find(thread.space) ?? thread,
	);

export type SidebarThreadState = {
	thread: ThreadView;
	unread: boolean;
	mentions: number;
};

export const sidebarThreadsFor = (
	data: DataStore,
	space: SpaceData | undefined,
	channel: SpaceRef,
	activeThread?: string,
	now: number = Date.now(),
): SidebarThreadState[] => {
	const notifications = data.notifications.items();
	const unseen = unseenThreadPings(notifications);
	const replied = repliedThreads(notifications);
	const listed = sidebarThreads(data, channel)
		.map((thread) => {
			const live = space?.unread(skeyOf(thread.space));
			const pings = unseen.filter(
				(entry) => entry.thread === thread.space,
			).length;
			return {
				thread,
				unread: thread.viewer.hasUnread || !!live?.hasUnread,
				mentions: Math.max(thread.viewer.unreadMentions ?? 0, pings),
			};
		})
		.filter((state) =>
			belongsInSidebar(state.thread, {
				mentions: state.mentions,
				repliedTo: replied.has(state.thread.space),
				viewer: data.viewer.did,
				now,
				activeThread,
			}),
		)
		.sort((a, b) => newestFirst(a.thread, b.thread));
	return capKeepingPinned(listed, activeThread);
};
