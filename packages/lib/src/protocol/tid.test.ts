import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTid, tidMillis } from "./tid.js";

const S32_CHARS = "234567abcdefghijklmnopqrstuvwxyz";

describe("nextTid", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-07-26T12:00:00.000Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("produces a 13 character identifier", () => {
		expect(nextTid()).toHaveLength(13);
	});

	it("uses only base32-sortable characters", () => {
		const tid = nextTid();
		for (const char of tid) {
			expect(S32_CHARS).toContain(char);
		}
	});

	it("never repeats within the same clock millisecond", () => {
		const tids = Array.from({ length: 500 }, () => nextTid());
		expect(new Set(tids).size).toBe(tids.length);
	});

	it("increases monotonically even when the clock does not advance", () => {
		const tids = Array.from({ length: 100 }, () => nextTid());
		const sorted = [...tids].sort();
		expect(tids).toEqual(sorted);
	});

	it("keeps sorting lexicographically as the clock advances", () => {
		const before = nextTid();
		vi.advanceTimersByTime(5_000);
		const after = nextTid();
		expect(before < after).toBe(true);
	});

	it("stays below the rkeys the appview compares cursors against", () => {
		expect(nextTid() < "undefined").toBe(true);
	});
});

describe("tidMillis", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("reads the time a key was minted at", () => {
		const minted = Date.parse("2026-10-20T12:00:00.000Z");
		vi.useFakeTimers();
		vi.setSystemTime(minted + 7_000);
		expect(Math.floor(tidMillis(nextTid()) ?? 0)).toBe(minted + 7_000);
	});

	it("returns undefined for a key that is not a TID", () => {
		expect(tidMillis("self")).toBeUndefined();
		expect(tidMillis("zzzzzzzzzzzzz")).toBeUndefined();
	});
});
