import { describe, expect, it } from "vitest";
import type { NotificationView, SpaceRef, ThreadView } from "../../data/types";
import {
	belongsInSidebar,
	capKeepingPinned,
	SIDEBAR_ACTIVITY_WINDOW_MS,
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
	it("keeps a pinned thread that has gone quiet", () => {
		const quiet = threadAt("quiet", SIDEBAR_ACTIVITY_WINDOW_MS * 2);
		expect(belongsInSidebar(quiet, NOW)).toBe(false);
		expect(belongsInSidebar(quiet, NOW, "quiet")).toBe(true);
	});

	it("drops a closed thread unless it is unread or pinned", () => {
		const closed = (viewer: Partial<ThreadView["viewer"]> = {}) =>
			({
				...threadAt("closed", 0),
				closedAt: new Date(NOW).toISOString(),
				viewer: { hasUnread: false, following: true, ...viewer },
			}) as unknown as ThreadView;
		expect(belongsInSidebar(closed(), NOW)).toBe(false);
		expect(belongsInSidebar(closed({ hasUnread: true }), NOW)).toBe(true);
		expect(belongsInSidebar(closed(), NOW, "closed")).toBe(true);
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
