import { describe, expect, it } from "vitest";
import { applySkinTone, stripSkinTone } from "./skin-tone";

const points = (value: string) =>
	Array.from(value, (character) => character.codePointAt(0)?.toString(16));

describe("applySkinTone", () => {
	it("leaves the default tone untouched", () => {
		expect(applySkinTone("👍", 0)).toBe("👍");
	});

	it("appends the modifier to a single base", () => {
		expect(points(applySkinTone("👍", 3))).toEqual(["1f44d", "1f3fd"]);
	});

	it("drops the variation selector that follows a base", () => {
		expect(points(applySkinTone("✌️", 1))).toEqual(["270c", "1f3fb"]);
	});

	it("tones every person in a ZWJ sequence", () => {
		expect(points(applySkinTone("🧑‍🤝‍🧑", 5))).toEqual([
			"1f9d1",
			"1f3ff",
			"200d",
			"1f91d",
			"200d",
			"1f9d1",
			"1f3ff",
		]);
	});

	it("keeps the gender sign selector in a profession sequence", () => {
		expect(points(applySkinTone("🧔‍♂️", 2))).toEqual([
			"1f9d4",
			"1f3fc",
			"200d",
			"2642",
			"fe0f",
		]);
	});

	it("replaces an existing tone", () => {
		expect(applySkinTone(applySkinTone("👋", 1), 4)).toBe(
			applySkinTone("👋", 4),
		);
	});
});

describe("stripSkinTone", () => {
	it("removes every modifier", () => {
		expect(stripSkinTone(applySkinTone("🧑‍🤝‍🧑", 2))).toBe("🧑‍🤝‍🧑");
	});
});
