import { describe, expect, it } from "vitest";
import {
	keyboardSlot,
	placeAt,
	positionText,
	reconcileOrder,
	sameOrder,
	shiftOf,
	slotAt,
} from "./rail-order";

describe("rail order", () => {
	it("compares orders by position", () => {
		expect(sameOrder(["a", "b"], ["a", "b"])).toBe(true);
		expect(sameOrder(["a", "b"], ["b", "a"])).toBe(false);
		expect(sameOrder(["a"], ["a", "b"])).toBe(false);
	});

	it("keeps a pending order while dropping left Spaces and appending new ones", () => {
		expect(reconcileOrder(["c", "a", "b"], ["a", "b", "c"])).toEqual([
			"c",
			"a",
			"b",
		]);
		expect(reconcileOrder(["c", "gone", "a"], ["a", "c", "new"])).toEqual([
			"c",
			"a",
			"new",
		]);
	});

	it("places an id at a clamped index", () => {
		expect(placeAt(["a", "b", "c", "d"], "a", 2)).toEqual(["b", "c", "a", "d"]);
		expect(placeAt(["a", "b", "c"], "c", 0)).toEqual(["c", "a", "b"]);
		expect(placeAt(["a", "b", "c"], "b", 9)).toEqual(["a", "c", "b"]);
		expect(placeAt(["a", "b", "c"], "b", -3)).toEqual(["b", "a", "c"]);
	});

	it("picks the slot nearest to the dragged icon", () => {
		expect(slotAt(0, 0, 56, 4)).toBe(0);
		expect(slotAt(27, 0, 56, 4)).toBe(0);
		expect(slotAt(29, 0, 56, 4)).toBe(1);
		expect(slotAt(56 * 2 + 10, 0, 56, 4)).toBe(2);
		expect(slotAt(10_000, 0, 56, 4)).toBe(3);
		expect(slotAt(-500, 0, 56, 4)).toBe(0);
		expect(slotAt(120, 64, 56, 4)).toBe(1);
		expect(slotAt(50, 0, 56, 0)).toBe(0);
	});

	it("shifts each icon by the slots it moves", () => {
		const actual = ["a", "b", "c", "d"];
		const target = ["b", "c", "a", "d"];
		expect(shiftOf(target, actual, "a", 56)).toBe(112);
		expect(shiftOf(target, actual, "b", 56)).toBe(-56);
		expect(shiftOf(target, actual, "c", 56)).toBe(-56);
		expect(shiftOf(target, actual, "d", 56)).toBe(0);
		expect(shiftOf(undefined, actual, "a", 56)).toBe(0);
		expect(shiftOf(target, actual, "missing", 56)).toBe(0);
	});

	it("maps reorder keys to a slot", () => {
		expect(keyboardSlot("ArrowUp", 2, 4)).toBe(1);
		expect(keyboardSlot("ArrowUp", 0, 4)).toBe(0);
		expect(keyboardSlot("ArrowDown", 2, 4)).toBe(3);
		expect(keyboardSlot("ArrowDown", 3, 4)).toBe(3);
		expect(keyboardSlot("Home", 2, 4)).toBe(0);
		expect(keyboardSlot("End", 0, 4)).toBe(3);
		expect(keyboardSlot("Enter", 1, 4)).toBeUndefined();
		expect(keyboardSlot("ArrowUp", 0, 0)).toBeUndefined();
	});

	it("describes a position for screen readers", () => {
		expect(positionText(0, 3)).toBe("position 1 of 3");
	});
});
