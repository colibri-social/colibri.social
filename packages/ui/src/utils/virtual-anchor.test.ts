import { describe, expect, it } from "vitest";
import { captureVirtualAnchor, resolveVirtualAnchor } from "./virtual-anchor";

const measureFor = (sizes: number[], startMargin = 0) => {
	const offsets = sizes.reduce<number[]>(
		(all, size, index) => {
			all.push((all[index] ?? 0) + size);
			return all;
		},
		[0],
	);
	return {
		findItemIndex: (offset: number) => {
			const relative = offset - startMargin;
			let found = 0;
			for (let index = 0; index < sizes.length; index++) {
				if ((offsets[index] ?? 0) <= relative) found = index;
			}
			return found;
		},
		getItemOffset: (index: number) => offsets[index] ?? 0,
	};
};

describe("virtual anchors", () => {
	it("keeps the first visible row in place when rows above are removed", () => {
		const before = measureFor([50, 50, 50, 50, 50], 20);
		const anchor = captureVirtualAnchor(
			before,
			["a", "b", "c", "d", "e"],
			145,
			20,
		);
		expect(anchor?.candidates[0]).toEqual({ key: "c", top: -25 });
		const after = measureFor([50, 50, 50, 50], 20);
		const keys = ["b", "c", "d", "e"];
		const target = resolveVirtualAnchor(
			anchor as NonNullable<typeof anchor>,
			(key) => {
				const index = keys.indexOf(key);
				return index === -1 ? undefined : index;
			},
			after,
			20,
		);
		expect(target).toBe(95);
	});

	it("falls back to the next candidate when the anchor row is gone", () => {
		const measure = measureFor([40, 40, 40, 40]);
		const anchor = captureVirtualAnchor(measure, ["a", "b", "c", "d"], 40, 0);
		const keys = ["a", "c", "d"];
		const target = resolveVirtualAnchor(
			anchor as NonNullable<typeof anchor>,
			(key) => {
				const index = keys.indexOf(key);
				return index === -1 ? undefined : index;
			},
			measureFor([40, 40, 40]),
			0,
		);
		expect(target).toBe(0);
	});

	it("returns nothing for an empty list", () => {
		expect(captureVirtualAnchor(measureFor([]), [], 0, 0)).toBeUndefined();
	});
});
