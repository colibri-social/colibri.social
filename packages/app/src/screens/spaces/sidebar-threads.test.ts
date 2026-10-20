import { describe, expect, it } from "vitest";
import type { NotificationView, SpaceRef, ThreadView } from "../../data/types";
import {
	belongsInSidebar,
	capKeepingPinned,
	SIDEBAR_ACTIVITY_WINDOW_MS,
	SIDEBAR_OPENED_WINDOW_MS,
	SIDEBAR_THREAD_LIMIT,
	unseenThreadPings,
} from "./sidebar-threads";

const NOW = Date.parse("2026-10-15T12:00:00Z");

const threadAt = (tkey: string, ago: number): ThreadView =>
	({
		space:
			`at://did:plc:space/space/social.colibri.beta.channel.thread/${tkey}` as SpaceRef,
		name: tkey,
		lastActivityAt: new Date(NOW - ago).toISOString(),
		viewer: { hasUnread: false, following: false },
	}) as unknown as ThreadView;

describe("sidebar threads", () => {
	const withViewer = (
		thread: ThreadView,
		viewer: Partial<ThreadView["viewer"]>,
		extra: Partial<ThreadView> = {},
	) =>
		({
			...thread,
			...extra,
			viewer: { ...thread.viewer, ...viewer },
		}) as ThreadView;

	const DAY = 24 * 60 * 60 * 1000;
	const at = (
		overrides: Partial<Parameters<typeof belongsInSidebar>[1]> = {},
	) => ({ mentions: 0, unread: false, now: NOW, ...overrides });
	const closedAt = new Date(NOW).toISOString() as ThreadView["closedAt"];

	it("keeps followed threads and drops closed ones", () => {
		const followed = withViewer(threadAt("followed", DAY), {
			following: true,
		});
		expect(belongsInSidebar(followed, at())).toBe(true);
		const closed = withViewer(followed, {}, { closedAt });
		expect(belongsInSidebar(closed, at())).toBe(false);
	});

	it("keeps the thread that is open right now even when unfollowed or closed", () => {
		const open = threadAt("open", DAY);
		expect(belongsInSidebar(open, at())).toBe(false);
		expect(belongsInSidebar(open, at({ activeThread: "open" }))).toBe(true);
		const closed = withViewer(open, {}, { closedAt });
		expect(belongsInSidebar(closed, at({ activeThread: "open" }))).toBe(true);
	});

	it("keeps an unfollowed thread that is unread", () => {
		const unread = threadAt("unread", DAY);
		expect(belongsInSidebar(unread, at({ unread: true }))).toBe(true);
		const closed = withViewer(unread, {}, { closedAt });
		expect(belongsInSidebar(closed, at({ unread: true }))).toBe(false);
	});

	it("keeps an unfollowed thread active within the last 6 hours", () => {
		expect(
			belongsInSidebar(threadAt("recent", SIDEBAR_ACTIVITY_WINDOW_MS), at()),
		).toBe(true);
		expect(
			belongsInSidebar(threadAt("stale", SIDEBAR_ACTIVITY_WINDOW_MS + 1), at()),
		).toBe(false);
		const closed = withViewer(threadAt("recent", 0), {}, { closedAt });
		expect(belongsInSidebar(closed, at())).toBe(false);
	});

	it("keeps an unfollowed thread opened within the last 24 hours", () => {
		const old = threadAt("old", 2 * DAY);
		expect(
			belongsInSidebar(old, at({ openedAt: NOW - SIDEBAR_OPENED_WINDOW_MS })),
		).toBe(true);
		expect(
			belongsInSidebar(
				old,
				at({ openedAt: NOW - SIDEBAR_OPENED_WINDOW_MS - 1 }),
			),
		).toBe(false);
		const closed = withViewer(old, {}, { closedAt });
		expect(belongsInSidebar(closed, at({ openedAt: NOW }))).toBe(false);
	});

	it("keeps an unfollowed thread that pings you", () => {
		const mentioned = threadAt("mentioned", DAY);
		expect(belongsInSidebar(mentioned, at({ mentions: 1 }))).toBe(true);
		const closed = withViewer(mentioned, {}, { closedAt });
		expect(belongsInSidebar(closed, at({ mentions: 2 }))).toBe(true);
	});

	it("keeps a pinned thread past the row limit in the last slot", () => {
		const listed = Array.from(
			{ length: SIDEBAR_THREAD_LIMIT + 2 },
			(_, index) => ({ thread: threadAt(`t${index}`, index * 1000) }),
		);
		const pinned = `t${SIDEBAR_THREAD_LIMIT + 1}`;
		const shown = capKeepingPinned(listed, pinned);
		expect(shown).toHaveLength(SIDEBAR_THREAD_LIMIT);
		expect(shown.map((state) => state.thread.name)).toEqual([
			...listed.slice(0, SIDEBAR_THREAD_LIMIT - 1).map((s) => s.thread.name),
			pinned,
		]);
	});

	it("leaves the order alone when the pinned thread already fits", () => {
		const listed = [0, 1, 2].map((index) => ({
			thread: threadAt(`t${index}`, index * 1000),
		}));
		expect(capKeepingPinned(listed, "t1")).toEqual(listed);
		expect(capKeepingPinned(listed)).toEqual(listed);
	});

	it("counts only unseen mentions and replies as thread pings", () => {
		const thread = threadAt("busy", 0).space;
		const entry = (
			id: string,
			kind: NotificationView["kind"],
			seenAt?: string,
		) =>
			({ id, kind, thread, ...(seenAt ? { seenAt } : {}) }) as NotificationView;
		const pings = unseenThreadPings([
			entry("message", "message"),
			entry("mention", "mention"),
			entry("reply", "reply"),
			entry("seen", "mention", new Date(NOW).toISOString()),
		]);
		expect(pings.map((view) => view.id)).toEqual(["mention", "reply"]);
	});
});
