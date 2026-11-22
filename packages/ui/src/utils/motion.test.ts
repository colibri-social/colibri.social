import { afterEach, describe, expect, it, vi } from "vitest";
import { motionScale, prefersReducedMotion } from "./motion";

const stubRoot = (dataset: Record<string, string>) => {
	vi.stubGlobal("document", { documentElement: { dataset } });
};

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("motionScale", () => {
	it("defaults to 1 without a document", () => {
		expect(motionScale()).toBe(1);
	});

	it("defaults to 1 without a motion scale attribute", () => {
		stubRoot({});

		expect(motionScale()).toBe(1);
	});

	it("reads the device scale from the root dataset", () => {
		stubRoot({ motionScale: "0.5" });

		expect(motionScale()).toBe(0.5);
	});

	it("reads a scale of 0", () => {
		stubRoot({ motionScale: "0" });

		expect(motionScale()).toBe(0);
	});

	it("falls back to 1 for invalid values", () => {
		for (const value of ["", "abc", "-1", "Infinity"]) {
			stubRoot({ motionScale: value });

			expect(motionScale()).toBe(1);
		}
	});

	it("lets the slow motion flag override the device scale", () => {
		stubRoot({ motionScale: "0.5", slowMotion: "true" });

		expect(motionScale()).toBe(5);
	});
});

describe("prefersReducedMotion", () => {
	it("treats a scale of 0 as reduced motion", () => {
		stubRoot({ motionScale: "0" });

		expect(prefersReducedMotion()).toBe(true);
	});

	it("keeps motion on for a positive scale", () => {
		stubRoot({ motionScale: "2" });

		expect(prefersReducedMotion()).toBe(false);
	});

	it("honors the reduced motion attribute", () => {
		stubRoot({ motionScale: "1", reducedMotion: "true" });

		expect(prefersReducedMotion()).toBe(true);
	});
});
