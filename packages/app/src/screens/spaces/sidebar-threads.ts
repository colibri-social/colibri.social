import { isFutureDated } from "@colibri-social/lib";
import { skeyOf } from "../../data/ids";
import { isPingNotification } from "../../data/notification-alerts";
import { spaceNotificationPrefs } from "../../data/notifications";
import type { DataStore, SpaceData } from "../../data/store";
import type {
	CommunityView,
	NotificationView,
	SpaceRef,
	ThreadView,
} from "../../data/types";

export const SIDEBAR_THREAD_LIMIT = 5;
export const SIDEBAR_STALE_MS = 3 * 24 * 60 * 60 * 1000;

export const sortableActivity = (thread: ThreadView, now: number): string =>
	isFutureDated({ createdAt: thread.lastActivityAt }, now)
		? isFutureDated({ createdAt: thread.createdAt }, now)
			? ""
			: thread.createdAt
		: thread.lastActivityAt;

const newestFirst = (a: ThreadView, b: ThreadView, now: number) => {
	const aAt = sortableActivity(a, now);
	const bAt = sortableActivity(b, now);
	if (aAt === bAt) return a.space < b.space ? -1 : 1;
	return aAt < bAt ? 1 : -1;
};

export type ThreadRelevance = {
	mentions: number;
	repliedTo: boolean;
	viewer?: string;
	left?: boolean;
};

export type SidebarThreadContext = ThreadRelevance & {
	now: number;
	activeThread?: string;
};

export type ThreadDotState = ThreadRelevance & {
	unread: boolean;
	muted: boolean;
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

const isRelevantThread = (thread: ThreadView, relevance: ThreadRelevance) => {
	if (relevance.left && !thread.viewer.following) return false;
	if (thread.closedAt) return false;
	return (
		!!thread.viewer.following ||
		relevance.mentions > 0 ||
		relevance.repliedTo ||
		(!!relevance.viewer && anchorAuthorOf(thread) === relevance.viewer)
	);
};

export const belongsInSidebar = (
	thread: ThreadView,
	context: SidebarThreadContext,
) => {
	if (context.activeThread === skeyOf(thread.space)) return true;
	if (isStale(thread, context.now)) return false;
	return isRelevantThread(thread, context);
};

export const lightsThreadsDot = (thread: ThreadView, state: ThreadDotState) => {
	return state.unread && !state.muted && isRelevantThread(thread, state);
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

export const threadPingsAfter = (
	notifications: readonly NotificationView[],
	thread: SpaceRef,
	after: number,
): NotificationView[] =>
	notifications.filter(
		(entry) =>
			entry.thread === thread &&
			isPingNotification(entry) &&
			Date.parse(entry.indexedAt) > after,
	);

const sidebarThreads = (data: DataStore, channel: SpaceRef) =>
	(data.threadsOf(channel).value() ?? []).map(
		(thread) => data.threads.find(thread.space) ?? thread,
	);

export type SidebarThreadState = {
	thread: ThreadView;
	unread: boolean;
	mentions: number;
};

type ThreadState = SidebarThreadState & { relevance: ThreadRelevance };

const threadStatesFor = (
	data: DataStore,
	space: SpaceData | undefined,
	channel: SpaceRef,
): ThreadState[] => {
	const notifications = data.notifications.items();
	const unseen = unseenThreadPings(notifications);
	const replied = repliedThreads(notifications);
	return sidebarThreads(data, channel).map((thread) => {
		const live = space?.unread(skeyOf(thread.space));
		const leftAt = data.threads.leftAt(thread.space);
		const sinceLeft =
			leftAt === undefined
				? undefined
				: threadPingsAfter(notifications, thread.space, leftAt);
		const mentions = sinceLeft
			? sinceLeft.filter((entry) => !entry.seenAt).length
			: Math.max(
					thread.viewer.unreadMentions ?? 0,
					unseen.filter((entry) => entry.thread === thread.space).length,
				);
		return {
			thread,
			unread: thread.viewer.hasUnread || !!live?.hasUnread,
			mentions,
			relevance: {
				mentions,
				repliedTo: sinceLeft
					? sinceLeft.some((entry) => entry.kind === "reply")
					: replied.has(thread.space),
				viewer: data.viewer.did,
				left: sinceLeft !== undefined && sinceLeft.length === 0,
			},
		};
	});
};

export const sidebarThreadsFor = (
	data: DataStore,
	space: SpaceData | undefined,
	channel: SpaceRef,
	activeThread?: string,
	now: number = Date.now(),
): SidebarThreadState[] => {
	const listed = threadStatesFor(data, space, channel)
		.filter((state) =>
			belongsInSidebar(state.thread, {
				...state.relevance,
				now,
				activeThread,
			}),
		)
		.map(({ thread, unread, mentions }) => ({ thread, unread, mentions }))
		.sort((a, b) => newestFirst(a.thread, b.thread, now));

	return capKeepingPinned(listed, activeThread);
};

export const channelThreadsUnread = (
	data: DataStore,
	community: CommunityView | undefined,
	channel: SpaceRef | undefined,
) => {
	if (!community || !channel) return false;
	if (spaceNotificationPrefs(data).isMuted(community.did)) return false;

	return threadStatesFor(data, data.space(community), channel).some((state) =>
		lightsThreadsDot(state.thread, {
			...state.relevance,
			unread: state.unread,
			muted: data.isMuted(state.thread.space),
		}),
	);
};
