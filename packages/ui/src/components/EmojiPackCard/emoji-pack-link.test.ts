import { describe, expect, it } from "vitest";
import { emojiPackShareUrl, parseEmojiPackShareUrl } from "./emoji-pack-link";

const did = "did:plc:abc123xyz";

describe("emoji pack share links", () => {
	it("round-trips a did and rkey", () => {
		const url = emojiPackShareUrl({ did, rkey: "3kabc" });
		expect(url).toBe(
			"https://spaces.colibri.social/emoji/did:plc:abc123xyz/3kabc",
		);
		expect(parseEmojiPackShareUrl(url)).toEqual({ did, rkey: "3kabc" });
	});

	it("accepts a percent-encoded did", () => {
		expect(
			parseEmojiPackShareUrl(
				"https://colibri.social/emoji/did%3Aplc%3Aabc123xyz/3kabc",
			),
		).toEqual({ did, rkey: "3kabc" });
	});

	it("rejects other origins, paths and malformed parts", () => {
		expect(
			parseEmojiPackShareUrl(`https://example.com/emoji/${did}/3kabc`),
		).toBeUndefined();
		expect(
			parseEmojiPackShareUrl(`https://colibri.social/invite/${did}`),
		).toBeUndefined();
		expect(
			parseEmojiPackShareUrl("https://colibri.social/emoji/lou.gg/3kabc"),
		).toBeUndefined();
		expect(
			parseEmojiPackShareUrl(`https://colibri.social/emoji/${did}/..`),
		).toBeUndefined();
		expect(
			parseEmojiPackShareUrl(`https://colibri.social/emoji/${did}/a/b`),
		).toBeUndefined();
		expect(parseEmojiPackShareUrl("not a url")).toBeUndefined();
	});

	it("accepts every Colibri host by default", () => {
		for (const host of ["next.colibri.social", "spaces.colibri.social"]) {
			expect(parseEmojiPackShareUrl(`https://${host}/emoji/${did}/x`)).toEqual({
				did,
				rkey: "x",
			});
		}
	});

	it("accepts extra origins", () => {
		expect(
			parseEmojiPackShareUrl(`https://next.colibri.social/emoji/${did}/x`, [
				"https://next.colibri.social",
			]),
		).toEqual({ did, rkey: "x" });
	});
});
