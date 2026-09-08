import type { ThreadFilter, ThreadView } from "../atproto/views";

export const SIDEBAR_ACTIVITY_WINDOW_MS = 6 * 60 * 60 * 1000;
export const SIDEBAR_OPENED_WINDOW_MS = 24 * 60 * 60 * 1000;

export type SidebarThreadContext = {
	open?: string;
	openedAt?: Readonly<Record<string, number>>;
};

const newestFirst = (a: ThreadView, b: ThreadView): number => {
	if (a.lastActivityAt === b.lastActivityAt) return a.space < b.space ? -1 : 1;
	return a.lastActivityAt > b.lastActivityAt ? -1 : 1;
};

export const sortThreads = (
	threads: ReadonlyArray<ThreadView>,
): Array<ThreadView> => [...threads].sort(newestFirst);

export const upsertThread = (
	threads: ReadonlyArray<ThreadView>,
	next: ThreadView,
): Array<ThreadView> => {
	const held = threads.find((t) => t.space === next.space);
	const merged: ThreadView =
		held?.anchorMessage !== undefined && next.anchorMessage === undefined
			? { ...next, anchorMessage: held.anchorMessage }
			: next;
	return sortThreads([
		...threads.filter((t) => t.space !== next.space),
		merged,
	]);
};

export const removeThread = (
	threads: ReadonlyArray<ThreadView>,
	space: string,
): Array<ThreadView> => threads.filter((t) => t.space !== space);

export const touchThread = (
	threads: ReadonlyArray<ThreadView>,
	space: string,
	lastActivityAt: ThreadView["lastActivityAt"],
	options: { markUnread: boolean },
): Array<ThreadView> => {
	const target = threads.find((t) => t.space === space);
	if (!target || target.lastActivityAt >= lastActivityAt) return [...threads];

	return upsertThread(threads, {
		...target,
		lastActivityAt,
		viewer: options.markUnread
			? { ...target.viewer, hasUnread: true }
			: target.viewer,
	});
};

export const markThreadRead = (
	threads: ReadonlyArray<ThreadView>,
	space: string,
): Array<ThreadView> => {
	const target = threads.find((t) => t.space === space);
	if (!target) return threads as Array<ThreadView>;
	if (!target.viewer.hasUnread && target.viewer.unreadMentions === 0) {
		return threads as Array<ThreadView>;
	}

	return threads.map((t) =>
		t.space === space
			? { ...t, viewer: { ...t.viewer, hasUnread: false, unreadMentions: 0 } }
			: t,
	);
};

export const matchesFilter = (
	thread: ThreadView,
	filter: ThreadFilter,
): boolean => {
	if (filter === "unread") return thread.viewer.hasUnread;
	if (filter === "following") return thread.viewer.following;
	return true;
};

export const threadsInChannel = (
	threads: ReadonlyArray<ThreadView>,
	channel: string,
): Array<ThreadView> => threads.filter((t) => t.channel === channel);

export const anchorKey = (
	channel: string,
	author: string,
	rkey: string,
): string => `${channel}|${author}|${rkey}`;

export const indexThreadAnchors = (
	threads: ReadonlyArray<ThreadView>,
): Map<string, ThreadView> => {
	const byKey = new Map<string, ThreadView>();
	for (const thread of threads) {
		const anchor = thread.anchor;
		if (anchor === undefined) continue;
		const key = anchorKey(anchor.space, anchor.did, anchor.rkey);
		if (!byKey.has(key)) byKey.set(key, thread);
	}
	return byKey;
};

export const threadAnchoredAt = (
	threads: ReadonlyArray<ThreadView>,
	channel: string,
	author: string,
	rkey: string,
): ThreadView | undefined =>
	threads.find(
		(t) =>
			t.anchor !== undefined &&
			t.anchor.space === channel &&
			t.anchor.did === author &&
			t.anchor.rkey === rkey,
	);

export const isRecentlyActive = (
	thread: ThreadView,
	now: number,
	windowMs: number = SIDEBAR_ACTIVITY_WINDOW_MS,
): boolean => {
	const at = new Date(thread.lastActivityAt).getTime();
	if (Number.isNaN(at)) return false;
	return now - at <= windowMs;
};

const wasRecentlyOpened = (
	thread: ThreadView,
	now: number,
	context: SidebarThreadContext,
): boolean => {
	if (context.open === thread.space) return true;
	const at = context.openedAt?.[thread.space];
	return at !== undefined && now - at <= SIDEBAR_OPENED_WINDOW_MS;
};

export const belongsInSidebar = (
	thread: ThreadView,
	now: number,
	context: SidebarThreadContext = {},
): boolean =>
	thread.viewer.hasUnread ||
	thread.viewer.following ||
	wasRecentlyOpened(thread, now, context) ||
	isRecentlyActive(thread, now);

export const sidebarThreads = (
	threads: ReadonlyArray<ThreadView>,
	channel: string,
	now: number,
	limit: number,
	context: SidebarThreadContext = {},
): Array<ThreadView> =>
	threadsInChannel(threads, channel)
		.filter((t) => belongsInSidebar(t, now, context))
		.slice(0, limit);
