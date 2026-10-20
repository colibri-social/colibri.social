import { skeyOf } from "../../data/ids";
import { isPingNotification } from "../../data/notification-alerts";
import type { DataStore, SpaceData } from "../../data/store";
import type { NotificationView, SpaceRef, ThreadView } from "../../data/types";

export const SIDEBAR_THREAD_LIMIT = 5;
export const SIDEBAR_ACTIVITY_WINDOW_MS = 6 * 60 * 60 * 1000;
export const SIDEBAR_OPENED_WINDOW_MS = 24 * 60 * 60 * 1000;

const newestFirst = (a: ThreadView, b: ThreadView) => {
	if (a.lastActivityAt === b.lastActivityAt) return a.space < b.space ? -1 : 1;
	return a.lastActivityAt < b.lastActivityAt ? 1 : -1;
};

export type SidebarThreadContext = {
	mentions: number;
	unread: boolean;
	now: number;
	activeThread?: string;
	openedAt?: number;
};

const isRecentlyActive = (thread: ThreadView, now: number) => {
	const at = Date.parse(thread.lastActivityAt);
	return !Number.isNaN(at) && now - at <= SIDEBAR_ACTIVITY_WINDOW_MS;
};

const wasRecentlyOpened = (openedAt: number | undefined, now: number) =>
	openedAt !== undefined && now - openedAt <= SIDEBAR_OPENED_WINDOW_MS;

export const belongsInSidebar = (
	thread: ThreadView,
	context: SidebarThreadContext,
) => {
	if (context.activeThread === skeyOf(thread.space)) return true;
	if (context.mentions > 0) return true;
	if (thread.closedAt) return false;
	return (
		!!thread.viewer.following ||
		context.unread ||
		wasRecentlyOpened(context.openedAt, context.now) ||
		isRecentlyActive(thread, context.now)
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
	const unseen = unseenThreadPings(data.notifications.items());
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
				unread: state.unread,
				now,
				activeThread,
				openedAt: data.threads.openedAt(state.thread.space),
			}),
		)
		.sort((a, b) => newestFirst(a.thread, b.thread));
	return capKeepingPinned(listed, activeThread);
};
