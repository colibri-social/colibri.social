import { describe, expect, it } from "vitest";
import {
	DEFAULT_QUICK_REACTIONS,
	normalizeEmojiUsage,
	pruneEmojiUsage,
	topEmoji,
} from "./emoji-usage";

const usage = (count: number, lastUsed: number) => ({ count, lastUsed });

describe("topEmoji", () => {
	it("returns the defaults when there is no history", () => {
		expect(topEmoji({}, 4)).toEqual(DEFAULT_QUICK_REACTIONS);
		expect(topEmoji({}, 3)).toEqual(DEFAULT_QUICK_REACTIONS.slice(0, 3));
	});

	it("orders by count descending", () => {
		expect(
			topEmoji(
				{ "🎉": usage(2, 10), "🔥": usage(9, 10), "🙏": usage(5, 10) },
				3,
			),
		).toEqual(["🔥", "🙏", "🎉"]);
	});

	it("breaks count ties by most recent use", () => {
		expect(topEmoji({ "🎉": usage(4, 100), "🔥": usage(4, 200) }, 2)).toEqual([
			"🔥",
			"🎉",
		]);
	});

	it("pads a short history with defaults", () => {
		expect(topEmoji({ "🔥": usage(3, 10) }, 4)).toEqual([
			"🔥",
			...DEFAULT_QUICK_REACTIONS.slice(0, 3),
		]);
	});

	it("does not repeat a default that is already in the history", () => {
		const result = topEmoji({ "😂": usage(7, 10) }, 4);
		expect(result).toEqual(["😂", "👍", "❤️", "😮"]);
		expect(new Set(result).size).toBe(result.length);
	});

	it("never returns more than the limit", () => {
		const result = topEmoji(
			{ "🎉": usage(1, 1), "🔥": usage(2, 2), "🙏": usage(3, 3) },
			2,
		);
		expect(result).toEqual(["🙏", "🔥"]);
	});

	it("keeps the desktop three a prefix of the mobile four", () => {
		const store = { "🔥": usage(5, 20), "🙏": usage(2, 10) };
		expect(topEmoji(store, 4).slice(0, 3)).toEqual(topEmoji(store, 3));
	});
});

describe("pruneEmojiUsage", () => {
	it("returns the map untouched when it fits", () => {
		const store = { "🔥": usage(1, 1) };
		expect(pruneEmojiUsage(store, 2)).toBe(store);
	});

	it("keeps only the highest ranked entries", () => {
		expect(
			pruneEmojiUsage(
				{ "🎉": usage(1, 10), "🔥": usage(8, 10), "🙏": usage(4, 10) },
				2,
			),
		).toEqual({ "🔥": usage(8, 10), "🙏": usage(4, 10) });
	});
});

describe("normalizeEmojiUsage", () => {
	it("drops entries that are not usage records", () => {
		expect(
			normalizeEmojiUsage({
				"🔥": usage(3, 10),
				"🎉": 4,
				"🙏": { count: "many", lastUsed: 10 },
				"😮": { count: Number.NaN, lastUsed: 10 },
			}),
		).toEqual({ "🔥": usage(3, 10) });
	});

	it("returns an empty map for anything that is not an object", () => {
		expect(normalizeEmojiUsage(undefined)).toEqual({});
		expect(normalizeEmojiUsage(null)).toEqual({});
		expect(normalizeEmojiUsage("👍")).toEqual({});
	});
});
