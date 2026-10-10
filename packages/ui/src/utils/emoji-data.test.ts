import { describe, expect, it } from "vitest";
import { EMOJI_ALIASES, EMOJI_DATA_RECORD, searchEmojis } from "./emoji-data";

describe("searchEmojis", () => {
	it("finds the saluting face for salute", () => {
		const results = searchEmojis("salute", 10);
		expect(results[0]?.emoji).toBe("🫡");
	});

	it("returns thumbs up exactly once for thumb", () => {
		const results = searchEmojis("thumb", 10);
		const thumbs = results.filter((r) => r.emoji === "👍");
		expect(thumbs.length).toBe(1);
	});

	it("ranks exact shortcode matches first", () => {
		const results = searchEmojis("joy", 10);
		expect(results[0]?.name).toBe("joy");
		expect(results[0]?.emoji).toBe("😂");
	});

	it("matches by keyword concept", () => {
		const results = searchEmojis("angry", 10);
		expect(results.some((r) => r.emoji === "😠")).toBe(true);
	});

	it("caps results at the limit", () => {
		expect(searchEmojis("face", 10).length).toBeLessThanOrEqual(10);
	});

	it("ranks the bird above emoji that only list bird as a keyword", () => {
		const results = searchEmojis("bird", 10);
		expect(results[0]?.emoji).toBe("🐦");
		expect(results.slice(0, 3).map((r) => r.emoji)).not.toContain("🖕");
	});

	it("folds case in the query", () => {
		expect(searchEmojis("Bird", 10)[0]?.emoji).toBe("🐦");
		expect(searchEmojis("  BIRD  ", 10)[0]?.emoji).toBe("🐦");
	});

	it("matches multi-word queries", () => {
		expect(searchEmojis("middle finger", 10)[0]?.emoji).toBe("🖕");
		expect(searchEmojis("grinning face", 10)[0]?.emoji).toBe("😀");
		expect(searchEmojis("thumbs up", 10)[0]?.emoji).toBe("👍");
	});

	it("resolves country flags by their two letter code", () => {
		expect(searchEmojis("flag_de", 10)[0]?.emoji).toBe("🇩🇪");
		expect(searchEmojis("flag_us", 10)[0]?.emoji).toBe("🇺🇸");
		expect(searchEmojis("flag_gb", 10)[0]?.emoji).toBe("🇬🇧");
	});

	it("prefers the canonical slug as the label", () => {
		const results = searchEmojis("thumbs", 10);
		expect(results[0]?.name).toBe("thumbs_up");
	});

	it("returns the alias as the label when it matches exactly", () => {
		expect(searchEmojis("tada", 10)[0]?.name).toBe("tada");
		expect(searchEmojis("+1", 10)[0]?.name).toBe("+1");
	});

	it("falls back to fuzzy matching for typos", () => {
		expect(searchEmojis("thmubs", 10).some((r) => r.emoji === "👍")).toBe(true);
		expect(searchEmojis("rocekt", 10).some((r) => r.emoji === "🚀")).toBe(true);
	});

	it("does not fuzzy match queries shorter than four characters", () => {
		expect(searchEmojis("xqz", 10)).toEqual([]);
	});

	it("breaks ties within a tier by usage count", () => {
		const usage = {
			"💌": { count: 0, lastUsed: 0 },
			"🤟": { count: 25, lastUsed: 1 },
		};
		const withoutUsage = searchEmojis("love", 10);
		const withUsage = searchEmojis("love", 10, usage);

		expect(withoutUsage.findIndex((r) => r.emoji === "🤟")).toBeGreaterThan(
			withUsage.findIndex((r) => r.emoji === "🤟"),
		);
	});

	it("returns nothing for an empty query", () => {
		expect(searchEmojis("", 10)).toEqual([]);
		expect(searchEmojis("   ", 10)).toEqual([]);
	});

	it("respects a zero limit", () => {
		expect(searchEmojis("bird", 0)).toEqual([]);
	});
});

describe("EMOJI_ALIASES", () => {
	const slugs = new Set(
		Object.values(EMOJI_DATA_RECORD).map((emoji) => emoji.slug),
	);

	it("points every alias at a slug that exists", () => {
		const broken = Object.entries(EMOJI_ALIASES).filter(
			([, slug]) => !slugs.has(slug),
		);
		expect(broken).toEqual([]);
	});

	it("never shadows an existing slug", () => {
		const shadowing = Object.keys(EMOJI_ALIASES).filter((alias) =>
			slugs.has(alias),
		);
		expect(shadowing).toEqual([]);
	});

	it("covers every regional indicator flag", () => {
		const flagCodes = Object.keys(EMOJI_ALIASES).filter((alias) =>
			/^flag_[a-z]{2}$/.test(alias),
		);
		expect(flagCodes.length).toBe(259);
	});
});
