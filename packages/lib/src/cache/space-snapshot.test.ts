import { describe, expect, it } from "vitest";
import {
	capList,
	isSnapshotUsable,
	pruneSnapshotEntries,
	SPACE_SNAPSHOT_TTL_MS,
} from "./space-snapshot.js";

describe("space snapshot helpers", () => {
	it("keeps snapshots inside the age limit", () => {
		expect(isSnapshotUsable(1_000, 1_000 + SPACE_SNAPSHOT_TTL_MS)).toBe(true);
		expect(isSnapshotUsable(1_000, 1_001 + SPACE_SNAPSHOT_TTL_MS)).toBe(false);
		expect(isSnapshotUsable(Number.NaN, 0)).toBe(false);
	});

	it("drops entries for Spaces that are gone and keeps the newest", () => {
		const entries = {
			a: { ts: 1 },
			b: { ts: 3 },
			c: { ts: 2 },
			gone: { ts: 9 },
		};
		const pruned = pruneSnapshotEntries(entries, new Set(["a", "b", "c"]), 2);
		expect(Object.keys(pruned).sort()).toEqual(["b", "c"]);
	});

	it("keeps everything without a filter up to the limit", () => {
		const pruned = pruneSnapshotEntries(
			{ a: { ts: 1 }, b: { ts: 2 } },
			undefined,
			5,
		);
		expect(Object.keys(pruned).sort()).toEqual(["a", "b"]);
	});

	it("caps long lists", () => {
		expect(capList([1, 2, 3], 2)).toEqual([1, 2]);
		expect(capList([1], 2)).toEqual([1]);
	});
});
