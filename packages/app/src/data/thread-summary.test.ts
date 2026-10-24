import { describe, expect, it } from "vitest";
import { servedThreadSummary, withoutFutureActivity } from "./thread-summary";
import type { ThreadView } from "./types";

const NOW = Date.parse("2026-10-24T12:00:00Z");
const MINUTE = 60 * 1000;
const iso = (offset: number) => new Date(NOW + offset).toISOString();

const served = (createdAt: string) => ({
	channel: "at://did:plc:space/space/social.colibri.beta.channel.thread/t",
	rkey: "3m5abcdefgh22",
	author: "did:plc:alice",
	text: "hi",
	attachmentCount: 0,
	forward: false,
	createdAt,
});

const thread = (fields: Partial<Record<string, unknown>>): ThreadView =>
	({
		space: "at://did:plc:space/space/social.colibri.beta.channel.thread/t",
		createdAt: iso(-60 * MINUTE),
		lastActivityAt: iso(-5 * MINUTE),
		viewer: { hasUnread: false },
		...fields,
	}) as unknown as ThreadView;

describe("thread previews", () => {
	it("keeps a thread that is on time untouched", () => {
		const current = thread({ lastMessage: served(iso(-5 * MINUTE)) });
		expect(withoutFutureActivity(current, undefined, NOW)).toBe(current);
	});

	it("keeps the previous activity when a live frame jumps past the cutoff", () => {
		const previous = thread({ lastMessage: served(iso(-5 * MINUTE)) });
		const next = thread({
			lastActivityAt: iso(20 * MINUTE),
			lastMessage: served(iso(20 * MINUTE)),
		});
		const guarded = withoutFutureActivity(next, previous, NOW);
		expect(guarded.lastActivityAt).toBe(previous.lastActivityAt);
		expect(guarded.lastMessage).toEqual(previous.lastMessage);
	});

	it("falls back to the creation time and drops the preview without a previous state", () => {
		const next = thread({
			lastActivityAt: iso(20 * MINUTE),
			lastMessage: served(iso(20 * MINUTE)),
		});
		const guarded = withoutFutureActivity(next, undefined, NOW);
		expect(guarded.lastActivityAt).toBe(next.createdAt);
		expect(guarded.lastMessage).toBeUndefined();
	});

	it("hides a served preview dated past the cutoff", () => {
		const ahead = new Date(Date.now() + 20 * MINUTE).toISOString();
		expect(servedThreadSummary(thread({ lastMessage: served(ahead) }))).toBe(
			undefined,
		);
		const onTime = new Date(Date.now()).toISOString();
		expect(
			servedThreadSummary(thread({ lastMessage: served(onTime) }))?.text,
		).toBe("hi");
	});
});
