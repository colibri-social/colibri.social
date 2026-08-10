import { describe, expect, it } from "vitest";
import { searchEmojis } from "./emoji-data";

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
});
