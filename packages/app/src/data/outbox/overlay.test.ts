import { describe, expect, it } from "vitest";
import type { Did, MessageView, SpaceRef } from "../types";
import { applyQueuedWrites, withQueuedWrites } from "./overlay";
import type { OutboxEntry, OutboxOp } from "./types";

const CHANNEL = "at://did:plc:space/space/general" as SpaceRef;
const OTHER = "at://did:plc:space/space/random" as SpaceRef;
const ME = "did:plc:me" as Did;
const YOU = "did:plc:you" as Did;

const message = (rkey: string, text = "hi"): MessageView =>
	({
		rkey,
		channel: CHANNEL,
		text,
		reactions: [],
	}) as unknown as MessageView;

let seq = 0;
const entry = (op: OutboxOp, failed = false): OutboxEntry => ({
	seq: ++seq,
	op,
	createdAt: 1_700_000_000_000,
	attempts: 0,
	...(failed ? { failed: true } : {}),
});

describe("applyQueuedWrites", () => {
	it("returns the same list when nothing is queued for the channel", () => {
		const list = [message("a")];
		const queued = [
			entry({ t: "edit", channel: OTHER, rkey: "a", text: "elsewhere" }),
		];
		expect(applyQueuedWrites(list, queued, CHANNEL, ME)).toBe(list);
	});

	it("shows the latest queued edit text", () => {
		const list = [message("a"), message("b")];
		const queued = [
			entry({ t: "edit", channel: CHANNEL, rkey: "a", text: "first" }),
			entry({ t: "edit", channel: CHANNEL, rkey: "a", text: "second" }),
		];
		const shown = applyQueuedWrites(list, queued, CHANNEL, ME);
		expect(shown[0]?.text).toBe("second");
		expect(shown[0]?.updatedAt).toBe(new Date(1_700_000_000_000).toISOString());
		expect(shown[1]).toBe(list[1]);
	});

	it("adds and removes queued reactions from the viewer", () => {
		const reacted = {
			...message("b"),
			reactions: [{ emoji: "👋", count: 2, reactors: [ME, YOU] }],
		} as unknown as MessageView;
		const list = [message("a"), reacted];
		const queued = [
			entry({
				t: "react",
				channel: CHANNEL,
				rkey: "a",
				emoji: "🪺",
				add: true,
				author: YOU,
			}),
			entry({
				t: "react",
				channel: CHANNEL,
				rkey: "b",
				emoji: "👋",
				add: false,
				author: YOU,
			}),
		];
		const shown = applyQueuedWrites(list, queued, CHANNEL, ME);
		expect(shown[0]?.reactions).toEqual([
			{ emoji: "🪺", count: 1, reactors: [ME], viewerReacted: true },
		]);
		expect(shown[1]?.reactions).toEqual([
			{ emoji: "👋", count: 1, reactors: [YOU], viewerReacted: false },
		]);
	});

	it("skips writes that already failed", () => {
		const list = [message("a")];
		const queued = [
			entry({ t: "edit", channel: CHANNEL, rkey: "a", text: "nope" }, true),
		];
		expect(applyQueuedWrites(list, queued, CHANNEL, ME)).toBe(list);
	});
});

describe("withQueuedWrites", () => {
	it("reuses the previous result while its inputs are unchanged", () => {
		const list = [message("a")];
		const queued = [
			entry({ t: "edit", channel: CHANNEL, rkey: "a", text: "changed" }),
		];
		const read = withQueuedWrites(
			() => list,
			() => queued,
			CHANNEL,
			ME,
		);
		const first = read();
		expect(first[0]?.text).toBe("changed");
		expect(read()).toBe(first);
	});
});
