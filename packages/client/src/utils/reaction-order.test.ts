import { describe, expect, it } from "vitest";
import { compareReactionGroups, sortReactionGroups } from "./reaction-order";

const group = (emoji: string) => ({ emoji, count: 1, reactorDIDs: [] });

const emojis = (groups: Array<{ emoji: string }>) => groups.map((g) => g.emoji);

describe("sortReactionGroups", () => {
	it("orders by emoji name rather than by codepoint", () => {
		const input = ["🔥", "👍", "🎉"].map(group);
		expect(emojis(sortReactionGroups(input))).toEqual(["🔥", "🎉", "👍"]);
	});

	it("orders a wider set alphabetically by name", () => {
		const input = ["👍", "🔥", "🐛", "❤️"].map(group);
		expect(emojis(sortReactionGroups(input))).toEqual(["🐛", "🔥", "❤️", "👍"]);
	});

	it("returns a new array without mutating the input", () => {
		const input = ["🔥", "👍", "🎉"].map(group);
		const result = sortReactionGroups(input);
		expect(result).not.toBe(input);
		expect(emojis(input)).toEqual(["🔥", "👍", "🎉"]);
	});

	it("preserves element identity", () => {
		const input = ["🔥", "👍", "🎉"].map(group);
		for (const entry of sortReactionGroups(input)) {
			expect(input).toContain(entry);
		}
	});

	it("is idempotent", () => {
		const once = sortReactionGroups(["👍", "🔥", "🐛"].map(group));
		expect(sortReactionGroups(once)).toEqual(once);
	});

	it("does not depend on input order", () => {
		const permutations = [
			["🔥", "👍", "🎉"],
			["👍", "🎉", "🔥"],
			["🎉", "🔥", "👍"],
			["🎉", "👍", "🔥"],
			["👍", "🔥", "🎉"],
			["🔥", "🎉", "👍"],
		];
		for (const permutation of permutations) {
			expect(emojis(sortReactionGroups(permutation.map(group)))).toEqual([
				"🔥",
				"🎉",
				"👍",
			]);
		}
	});

	it("falls back to the raw string for emoji outside the dataset", () => {
		const input = ["👍", ":shipit:", "🐛", "👍🏽"].map(group);
		expect(emojis(sortReactionGroups(input))).toEqual([
			":shipit:",
			"🐛",
			"👍",
			"👍🏽",
		]);
	});

	it("breaks name ties by the raw emoji string", () => {
		expect(emojis(sortReactionGroups(["❤", "❤️"].map(group)))).toEqual([
			"❤",
			"❤️",
		]);
		expect(emojis(sortReactionGroups(["❤️", "❤"].map(group)))).toEqual([
			"❤",
			"❤️",
		]);
	});

	it("returns an empty array for no reactions", () => {
		expect(sortReactionGroups([])).toEqual([]);
	});
});

describe("compareReactionGroups", () => {
	it("is zero only for identical emoji strings", () => {
		expect(compareReactionGroups(group("👍"), group("👍"))).toBe(0);
		expect(compareReactionGroups(group("❤"), group("❤️"))).not.toBe(0);
	});

	it("is antisymmetric", () => {
		const all = ["👍", "🔥", "🐛", "❤️", "❤", ":shipit:"].map(group);
		for (const a of all) {
			for (const b of all) {
				const forward = Math.sign(compareReactionGroups(a, b));
				const backward = Math.sign(compareReactionGroups(b, a));
				expect(forward + backward).toBe(0);
			}
		}
	});
});
