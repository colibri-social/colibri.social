import { skeyOf } from "../../data/ids";
import type { DataStore, SpaceData } from "../../data/store";
import type { SpaceRef, ThreadView } from "../../data/types";

export const SIDEBAR_THREAD_LIMIT = 5;
export const SIDEBAR_ACTIVITY_WINDOW_MS = 6 * 60 * 60 * 1000;

const newestFirst = (a: ThreadView, b: ThreadView) => {
	if (a.lastActivityAt === b.lastActivityAt) return a.space < b.space ? -1 : 1;
	return a.lastActivityAt < b.lastActivityAt ? 1 : -1;
};

export const belongsInSidebar = (
	thread: ThreadView,
	now: number,
	pinnedThread?: string,
) => {
	if (thread.viewer.hasUnread || thread.viewer.following) return true;
	if (pinnedThread === skeyOf(thread.space)) return true;
	const at = new Date(thread.lastActivityAt).getTime();
	return !Number.isNaN(at) && now - at <= SIDEBAR_ACTIVITY_WINDOW_MS;
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
	now: number,
	pinnedThread?: string,
): SidebarThreadState[] => {
	const unseen = data.notifications
		.items()
		.filter((entry) => !entry.seenAt && entry.thread);
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
		.filter(
			(state) =>
				state.unread ||
				state.mentions > 0 ||
				belongsInSidebar(state.thread, now, pinnedThread),
		)
		.sort((a, b) => newestFirst(a.thread, b.thread));
	return capKeepingPinned(listed, pinnedThread);
};
