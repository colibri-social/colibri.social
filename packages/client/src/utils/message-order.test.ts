import { describe, expect, it } from "vitest";
import {
	compareMessages,
	insertAt,
	placeMessage,
	sameDay,
} from "./message-order";

const msg = (rkey: string, createdAt: string) => ({
	uri: `at://did:plc:author/social.colibri.message/${rkey}`,
	createdAt,
});

const LOADED = [
	msg("aaa", "2026-08-03T09:00:00.000Z"),
	msg("bbb", "2026-08-06T09:00:00.000Z"),
	msg("ccc", "2026-08-10T12:00:00.000Z"),
];

const localIso = (
	year: number,
	monthIndex: number,
	day: number,
	hour: number,
) => new Date(year, monthIndex, day, hour).toISOString();

describe("sameDay", () => {
	it("matches two timestamps on the same local calendar day", () => {
		expect(sameDay(localIso(2026, 7, 10, 1), localIso(2026, 7, 10, 23))).toBe(
			true,
		);
	});

	it("separates timestamps on different local calendar days", () => {
		expect(sameDay(localIso(2026, 7, 10, 23), localIso(2026, 7, 11, 1))).toBe(
			false,
		);
	});
});

describe("compareMessages", () => {
	it("orders by createdAt", () => {
		expect(
			compareMessages(
				msg("zzz", "2026-08-03T09:00:00.000Z"),
				msg("aaa", "2026-08-06T09:00:00.000Z"),
			),
		).toBeLessThan(0);
	});

	it("falls back to the rkey when the timestamps are identical", () => {
		expect(
			compareMessages(
				msg("aaa", "2026-08-06T09:00:00.000Z"),
				msg("bbb", "2026-08-06T09:00:00.000Z"),
			),
		).toBeLessThan(0);
	});

	it("treats an identical message as equal to itself", () => {
		expect(compareMessages(LOADED[1]!, LOADED[1]!)).toBe(0);
	});
});

describe("placeMessage", () => {
	it("appends into an empty list", () => {
		expect(
			placeMessage([], msg("new", "2026-08-10T12:05:00.000Z"), {
				hasMore: true,
			}),
		).toEqual({ kind: "append" });
	});

	it("appends a message newer than the tail", () => {
		expect(
			placeMessage(LOADED, msg("ddd", "2026-08-10T12:05:00.000Z"), {
				hasMore: true,
			}),
		).toEqual({ kind: "append" });
	});

	it("appends a message that ties with the tail", () => {
		expect(
			placeMessage(LOADED, msg("ddd", "2026-08-10T12:00:00.000Z"), {
				hasMore: true,
			}),
		).toEqual({ kind: "append" });
	});

	it("splices a backfilled message that belongs inside the loaded window", () => {
		expect(
			placeMessage(LOADED, msg("mid", "2026-08-07T09:00:00.000Z"), {
				hasMore: true,
			}),
		).toEqual({ kind: "insert", index: 2 });
	});

	it("drops a message older than the loaded window when more can be paged in", () => {
		expect(
			placeMessage(LOADED, msg("old", "2026-07-12T09:00:00.000Z"), {
				hasMore: true,
			}),
		).toEqual({ kind: "drop" });
	});

	it("inserts at the head when the whole channel is already loaded", () => {
		expect(
			placeMessage(LOADED, msg("old", "2026-07-12T09:00:00.000Z"), {
				hasMore: false,
			}),
		).toEqual({ kind: "insert", index: 0 });
	});
});

describe("insertAt", () => {
	it("splices an item into the given position", () => {
		expect(insertAt(["a", "b", "c"], "x", 1)).toEqual(["a", "x", "b", "c"]);
	});

	it("inserts at the head", () => {
		expect(insertAt(["a"], "x", 0)).toEqual(["x", "a"]);
	});
});
