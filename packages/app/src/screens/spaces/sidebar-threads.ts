import { skeyOf } from "../../data/ids";
import { isPingNotification } from "../../data/notification-alerts";
import type { DataStore, SpaceData } from "../../data/store";
import type { NotificationView, SpaceRef, ThreadView } from "../../data/types";

export const SIDEBAR_THREAD_LIMIT = 5;

const newestFirst = (a: ThreadView, b: ThreadView) => {
	if (a.lastActivityAt === b.lastActivityAt) return a.space < b.space ? -1 : 1;
	return a.lastActivityAt < b.lastActivityAt ? 1 : -1;
};

export const belongsInSidebar = (
	thread: ThreadView,
	mentions: number,
	activeThread?: string,
) => {
	if (activeThread === skeyOf(thread.space)) return true;
	if (mentions > 0) return true;
	return !!thread.viewer.following && !thread.closedAt;
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
			belongsInSidebar(state.thread, state.mentions, activeThread),
		)
		.sort((a, b) => newestFirst(a.thread, b.thread));
	return capKeepingPinned(listed, activeThread);
};
