import { afterEach, describe, expect, it, vi } from "vitest";
import { isTouchNow, TOUCH_QUERY, wantsHoldToDrag } from "./touch";

const PHONE_QUERY = "(max-width: 767px)";

const stubMatchMedia = (matches: (query: string) => boolean) => {
	vi.stubGlobal("matchMedia", (query: string) => ({ matches: matches(query) }));
};

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("TOUCH_QUERY", () => {
	it("asks about the primary pointer, not any available pointer", () => {
		expect(TOUCH_QUERY).toBe("(pointer: coarse)");
	});

	it("is independent of the layout breakpoint", () => {
		expect(TOUCH_QUERY).not.toBe(PHONE_QUERY);
	});
});

describe("isTouchNow", () => {
	it("is false when matchMedia is unavailable", () => {
		expect(isTouchNow()).toBe(false);
	});

	it("is true for a coarse pointer at a desktop viewport width", () => {
		stubMatchMedia((query) => query === TOUCH_QUERY);
		expect(isTouchNow()).toBe(true);
	});

	it("is false for a fine pointer at a phone viewport width", () => {
		stubMatchMedia((query) => query === PHONE_QUERY);
		expect(isTouchNow()).toBe(false);
	});
});

describe("wantsHoldToDrag", () => {
	it("requires a hold for touch and pen", () => {
		expect(wantsHoldToDrag("touch")).toBe(true);
		expect(wantsHoldToDrag("pen")).toBe(true);
	});

	it("lets a mouse start dragging immediately", () => {
		expect(wantsHoldToDrag("mouse")).toBe(false);
	});

	it("holds for a touch even when the primary pointer reports fine", () => {
		stubMatchMedia(() => false);
		expect(wantsHoldToDrag("touch")).toBe(true);
	});
});
