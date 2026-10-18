import { describe, expect, it } from "vitest";
import type { NotificationView, SpaceRef, ThreadView } from "../../data/types";
import {
	belongsInSidebar,
	capKeepingPinned,
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

	it("keeps followed threads and drops closed ones", () => {
		const followed = withViewer(threadAt("followed", 0), { following: true });
		expect(belongsInSidebar(followed, 0)).toBe(true);
		const closed = withViewer(
			followed,
			{},
			{ closedAt: new Date(NOW).toISOString() as ThreadView["closedAt"] },
		);
		expect(belongsInSidebar(closed, 0)).toBe(false);
	});

	it("keeps the thread that is open right now even when unfollowed", () => {
		const open = threadAt("open", 0);
		expect(belongsInSidebar(open, 0)).toBe(false);
		expect(belongsInSidebar(open, 0, "open")).toBe(true);
		const closed = withViewer(
			open,
			{},
			{ closedAt: new Date(NOW).toISOString() as ThreadView["closedAt"] },
		);
		expect(belongsInSidebar(closed, 0, "open")).toBe(true);
	});

	it("drops an unfollowed thread that is only unread or recently active", () => {
		const unread = withViewer(threadAt("unread", 0), { hasUnread: true });
		expect(belongsInSidebar(unread, 0)).toBe(false);
		expect(belongsInSidebar(threadAt("recent", 1000), 0)).toBe(false);
	});

	it("keeps an unfollowed thread that pings you", () => {
		const mentioned = threadAt("mentioned", 0);
		expect(belongsInSidebar(mentioned, 1)).toBe(true);
		const closed = withViewer(
			mentioned,
			{},
			{ closedAt: new Date(NOW).toISOString() as ThreadView["closedAt"] },
		);
		expect(belongsInSidebar(closed, 2)).toBe(true);
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
