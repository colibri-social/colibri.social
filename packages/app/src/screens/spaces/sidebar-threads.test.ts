import { describe, expect, it } from "vitest";
import type { NotificationView, SpaceRef, ThreadView } from "../../data/types";
import {
	belongsInSidebar,
	capKeepingPinned,
	repliedThreads,
	SIDEBAR_STALE_MS,
	SIDEBAR_THREAD_LIMIT,
	sortableActivity,
	threadPingsAfter,
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
	const VIEWER = "did:plc:viewer";
	const at = (
		overrides: Partial<Parameters<typeof belongsInSidebar>[1]> = {},
	) => ({
		mentions: 0,
		repliedTo: false,
		viewer: VIEWER,
		now: NOW,
		...overrides,
	});
	const closedAt = new Date(NOW).toISOString() as ThreadView["closedAt"];

	it("keeps followed threads and drops closed ones", () => {
		const followed = withViewer(threadAt("followed", DAY), {
			following: true,
		});
		expect(belongsInSidebar(followed, at())).toBe(true);
		const closed = withViewer(followed, {}, { closedAt });
		expect(belongsInSidebar(closed, at())).toBe(false);
	});

	it("keeps the thread that is open right now even when unfollowed, closed or stale", () => {
		const open = threadAt("open", DAY);
		expect(belongsInSidebar(open, at())).toBe(false);
		expect(belongsInSidebar(open, at({ activeThread: "open" }))).toBe(true);
		const closed = withViewer(open, {}, { closedAt });
		expect(belongsInSidebar(closed, at({ activeThread: "open" }))).toBe(true);
		const stale = threadAt("open", SIDEBAR_STALE_MS + DAY);
		expect(belongsInSidebar(stale, at({ activeThread: "open" }))).toBe(true);
	});

	it("drops threads inactive for 3 days or more", () => {
		const followed = (ago: number) =>
			withViewer(threadAt("followed", ago), { following: true });
		expect(belongsInSidebar(followed(SIDEBAR_STALE_MS - 1), at())).toBe(true);
		expect(belongsInSidebar(followed(SIDEBAR_STALE_MS), at())).toBe(false);
		expect(
			belongsInSidebar(
				threadAt("pinged", SIDEBAR_STALE_MS),
				at({ mentions: 3 }),
			),
		).toBe(false);
	});

	it("leaves out unfollowed threads that are only unread or recently active", () => {
		const busy = withViewer(threadAt("busy", 0), {
			hasUnread: true,
			unreadMentions: 0,
		});
		expect(belongsInSidebar(busy, at())).toBe(false);
	});

	it("keeps an unfollowed thread that mentions you", () => {
		const mentioned = threadAt("mentioned", DAY);
		expect(belongsInSidebar(mentioned, at({ mentions: 1 }))).toBe(true);
		const closed = withViewer(mentioned, {}, { closedAt });
		expect(belongsInSidebar(closed, at({ mentions: 2 }))).toBe(false);
	});

	it("keeps an unfollowed thread where someone replied to you", () => {
		const replied = threadAt("replied", DAY);
		expect(belongsInSidebar(replied, at({ repliedTo: true }))).toBe(true);
		const closed = withViewer(replied, {}, { closedAt });
		expect(belongsInSidebar(closed, at({ repliedTo: true }))).toBe(false);
	});

	it("drops a thread you left, even one that pinged you or started from your message", () => {
		const anchor = {
			space:
				"at://did:plc:space/space/social.colibri.beta.channel.text/general",
			did: VIEWER,
			rkey: "3kanchor",
		};
		const left = withViewer(threadAt("left", DAY), {}, {
			anchor,
		} as Partial<ThreadView>);
		expect(belongsInSidebar(left, at({ left: true }))).toBe(false);
		expect(belongsInSidebar(left, at({ left: true, mentions: 2 }))).toBe(false);
		expect(belongsInSidebar(left, at({ left: true, repliedTo: true }))).toBe(
			false,
		);
	});

	it("keeps a left thread that is open right now or followed again", () => {
		const left = threadAt("left", DAY);
		expect(
			belongsInSidebar(left, at({ left: true, activeThread: "left" })),
		).toBe(true);
		const refollowed = withViewer(left, { following: true });
		expect(belongsInSidebar(refollowed, at({ left: true }))).toBe(true);
	});

	it("keeps a left thread once a ping after leaving brings you back", () => {
		const left = threadAt("left", DAY);
		expect(belongsInSidebar(left, at({ left: false, repliedTo: true }))).toBe(
			true,
		);
		expect(belongsInSidebar(left, at({ left: false, mentions: 1 }))).toBe(true);
	});

	it("keeps an unfollowed thread opened from your message", () => {
		const anchor = {
			space:
				"at://did:plc:space/space/social.colibri.beta.channel.text/general",
			did: VIEWER,
			rkey: "3kanchor",
		};
		const fromRef = withViewer(threadAt("mine", DAY), {}, {
			anchor,
		} as Partial<ThreadView>);
		expect(belongsInSidebar(fromRef, at())).toBe(true);
		expect(belongsInSidebar(fromRef, at({ viewer: "did:plc:other" }))).toBe(
			false,
		);
		const fromMessage = withViewer(threadAt("mine", DAY), {}, {
			anchor: { ...anchor, did: "did:plc:other" },
			anchorMessage: { author: { did: VIEWER } },
		} as unknown as Partial<ThreadView>);
		expect(belongsInSidebar(fromMessage, at())).toBe(true);
		const scratch = threadAt("scratch", DAY);
		expect(belongsInSidebar(scratch, at())).toBe(false);
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

	it("finds pings newer than the moment you left a thread", () => {
		const thread = threadAt("left", 0).space;
		const other = threadAt("other", 0).space;
		const leftAt = NOW - 1000;
		const entry = (
			id: string,
			kind: NotificationView["kind"],
			ago: number,
			on: SpaceRef = thread,
		) =>
			({
				id,
				kind,
				thread: on,
				indexedAt: new Date(NOW - ago).toISOString(),
			}) as NotificationView;
		const pings = threadPingsAfter(
			[
				entry("before", "reply", 5000),
				entry("message", "message", 0),
				entry("mention", "mention", 0),
				entry("reply", "reply", 500),
				entry("elsewhere", "mention", 0, other),
			],
			thread,
			leftAt,
		);
		expect(pings.map((view) => view.id)).toEqual(["mention", "reply"]);
	});

	it("collects threads with replies to you, seen or not", () => {
		const thread = threadAt("busy", 0).space;
		const other = threadAt("other", 0).space;
		const replied = repliedThreads([
			{ id: "a", kind: "reply", thread } as NotificationView,
			{
				id: "b",
				kind: "reply",
				thread,
				seenAt: new Date(NOW).toISOString(),
			} as NotificationView,
			{ id: "c", kind: "mention", thread: other } as NotificationView,
			{ id: "d", kind: "reply" } as NotificationView,
		]);
		expect([...replied]).toEqual([thread]);
	});
});

describe("sidebar thread order", () => {
	const MINUTE = 60 * 1000;

	it("sorts a thread whose activity is dated past the cutoff by its creation", () => {
		const created = new Date(NOW - 60 * MINUTE).toISOString();
		const ahead = {
			...threadAt("ahead", -20 * MINUTE),
			createdAt: created,
		} as ThreadView;
		const recent = threadAt("recent", 5 * MINUTE);
		expect(sortableActivity(ahead, NOW)).toBe(created);
		expect(sortableActivity(recent, NOW)).toBe(recent.lastActivityAt);
	});

	it("keeps activity within the 15 minute slack", () => {
		const slightlyAhead = threadAt("slightly", -10 * MINUTE);
		expect(sortableActivity(slightlyAhead, NOW)).toBe(
			slightlyAhead.lastActivityAt,
		);
	});
});
