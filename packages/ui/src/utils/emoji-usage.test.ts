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

describe("topEmoji with custom emoji", () => {
	const uri = "at://did:plc:a/blue.moji.collection.item/blob";

	it("maps custom keys through the resolver", () => {
		expect(
			topEmoji({ [uri]: usage(9, 10), "🔥": usage(2, 10) }, 2, (key) =>
				key === uri ? ":blob:" : undefined,
			),
		).toEqual([":blob:", "🔥"]);
	});

	it("skips custom keys that do not resolve and takes the next ranked", () => {
		expect(
			topEmoji({ [uri]: usage(9, 10), "🔥": usage(2, 10) }, 2, () => undefined),
		).toEqual(["🔥", DEFAULT_QUICK_REACTIONS[0]]);
		expect(topEmoji({ [uri]: usage(9, 10) }, 1)).toEqual([
			DEFAULT_QUICK_REACTIONS[0],
		]);
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

describe("frecency ranking", () => {
	const DAY = 24 * 60 * 60 * 1000;
	const now = 100 * DAY;

	it("ranks a recent emoji above an older one with a higher count", () => {
		expect(
			topEmoji(
				{ "🎉": usage(8, now - 30 * DAY), "🔥": usage(2, now - DAY) },
				2,
				undefined,
				now,
			),
		).toEqual(["🔥", "🎉"]);
	});

	it("halves the weight of a count every week", () => {
		const store = {
			"🎉": usage(4, now - 7 * DAY),
			"🔥": usage(2, now),
			"🙏": usage(3, now - 7 * DAY),
		};
		expect(topEmoji(store, 3, undefined, now)).toEqual(["🔥", "🎉", "🙏"]);
	});

	it("keeps the count order for very old entries", () => {
		expect(
			topEmoji(
				{ "🎉": usage(2, 0), "🔥": usage(9, 0), "🙏": usage(5, 0) },
				3,
				undefined,
				10_000 * DAY,
			),
		).toEqual(["🔥", "🙏", "🎉"]);
	});

	it("prunes the stalest entries first", () => {
		expect(
			pruneEmojiUsage(
				{ "🎉": usage(20, now - 60 * DAY), "🔥": usage(1, now) },
				1,
				now,
			),
		).toEqual({ "🔥": usage(1, now) });
	});
});
