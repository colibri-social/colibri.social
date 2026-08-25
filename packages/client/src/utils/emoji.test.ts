import { describe, expect, it } from "vitest";
import { findEmoji } from "./emoji";

describe("findEmoji", () => {
	it("reports every emoji with its UTF-16 offset", () => {
		expect(findEmoji("a 😂 b 🎉")).toEqual([
			{ emoji: "😂", index: 2 },
			{ emoji: "🎉", index: 7 },
		]);
	});

	it("keeps a zero-width-joiner sequence in one match", () => {
		expect(findEmoji("x 👨‍👩‍👦 y")).toEqual([{ emoji: "👨‍👩‍👦", index: 2 }]);
	});

	it("keeps a regional-indicator pair in one match", () => {
		expect(findEmoji("🇩🇪 flag")).toEqual([{ emoji: "🇩🇪", index: 0 }]);
	});

	it("includes the variation selector in the match", () => {
		expect(findEmoji("❤️")).toEqual([{ emoji: "❤️", index: 0 }]);
	});

	it("returns nothing for plain text", () => {
		expect(findEmoji("no emoji here")).toEqual([]);
	});

	it("reports only the selector for a base character twemoji does not render", () => {
		expect(findEmoji("\u{1F590}\uFE0F")).toEqual([
			{ emoji: "\uFE0F", index: 2 },
		]);
	});
});
