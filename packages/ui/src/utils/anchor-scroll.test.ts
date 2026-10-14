import { describe, expect, it } from "vitest";
import { intersectBoxes, overlapsBox, scrollShift } from "./anchor-scroll";

const box = (top: number, left: number, bottom: number, right: number) => ({
	top,
	left,
	bottom,
	right,
});

describe("anchor scroll", () => {
	it("sums how far every scroll ancestor moved since the snapshot", () => {
		const list = { scrollTop: 140, scrollLeft: 0 } as Element;
		const page = { scrollTop: 10, scrollLeft: 4 } as Element;
		expect(
			scrollShift([
				{ element: list, top: 100, left: 0 },
				{ element: page, top: 0, left: 0 },
			]),
		).toEqual({ x: 4, y: 50 });
	});

	it("clips to the overlap of all scroll ancestors", () => {
		expect(
			intersectBoxes([box(0, 0, 720, 1280), box(100, 1000, 900, 1240)]),
		).toEqual(box(100, 1000, 720, 1240));
	});

	it("keeps a partly visible anchor and drops one scrolled fully out", () => {
		const clip = box(100, 1000, 580, 1240);
		expect(overlapsBox(box(80, 1000, 124, 1240), clip)).toBe(true);
		expect(overlapsBox(box(56, 1000, 100, 1240), clip)).toBe(false);
		expect(overlapsBox(box(580, 1000, 624, 1240), clip)).toBe(false);
	});
});
