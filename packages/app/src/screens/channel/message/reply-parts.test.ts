import { describe, expect, it } from "vitest";
import type { Facet } from "../../../data/types";
import { type ReplyPartEmoji, replyParts } from "./reply-parts";

const EMOJI_FEATURE = "social.colibri.beta.richtext.facet#customEmoji";

const wave: ReplyPartEmoji = {
	name: "wave",
	src: "https://cdn.test/wave.webp",
};
const party: ReplyPartEmoji = {
	name: "party",
	src: "https://cdn.test/party.webp",
};

const emojiFacet = (text: string, token: string, uri: string): Facet => {
	const encoder = new TextEncoder();
	const start = text.indexOf(token);
	const byteStart = encoder.encode(text.slice(0, start)).length;
	return {
		index: { byteStart, byteEnd: byteStart + encoder.encode(token).length },
		features: [{ $type: EMOJI_FEATURE, uri } as Facet["features"][number]],
	} as Facet;
};

const byFeature = (feature: Facet["features"][number]) =>
	"uri" in feature && feature.uri === "at://emoji/wave" ? wave : undefined;

const byName = (name: string) => (name === "party" ? party : undefined);

describe("replyParts", () => {
	it("maps custom emoji facets to images", () => {
		const text = "hello :wave: there";
		expect(
			replyParts(text, [emojiFacet(text, ":wave:", "at://emoji/wave")], {
				byFeature,
			}),
		).toEqual(["hello ", wave, " there"]);
	});

	it("resolves bare shortcodes by name and keeps unknown ones as text", () => {
		expect(
			replyParts("go :party: and :unknown:", undefined, { byName }),
		).toEqual(["go ", party, " and :unknown:"]);
	});

	it("keeps facet offsets after collapsing whitespace", () => {
		const text = "  line one\n\n   :wave:  ";
		expect(
			replyParts(text, [emojiFacet(text, ":wave:", "at://emoji/wave")], {
				byFeature,
			}),
		).toEqual(["line one ", wave]);
	});

	it("truncates to the character budget with emoji counted once", () => {
		expect(replyParts(`:party:${"a".repeat(20)}`, [], { byName }, 10)).toEqual([
			party,
			"aaaaaaaaa",
			"...",
		]);
	});

	it("trims trailing space before the ellipsis", () => {
		expect(replyParts("abcd efgh", [], {}, 5)).toEqual(["abcd", "..."]);
	});

	it("returns no parts for empty text", () => {
		expect(replyParts("  \n ", [], { byName })).toEqual([]);
	});
});
