import { describe, expect, it } from "vitest";
import type { Did, Facet } from "../types";
import { allowsEmojiUri, emojiPolicy, filterEmojiFacets } from "./policy";
import { CUSTOM_EMOJI_FEATURE } from "./references";

const HQ = "did:plc:hq" as Did;
const local = `at://${HQ}/blue.moji.collection.item/shipit`;
const foreign = "at://did:plc:owls/blue.moji.collection.item/owl";

const facet = (byteStart: number, ...features: object[]) =>
	({
		index: { byteStart, byteEnd: byteStart + 4 },
		features,
	}) as unknown as Facet;

describe("custom emoji policy", () => {
	it("reads unknown or missing values as all", () => {
		expect(emojiPolicy(undefined)).toBe("all");
		expect(emojiPolicy("everything")).toBe("all");
		expect(emojiPolicy("local")).toBe("local");
		expect(emojiPolicy("none")).toBe("none");
	});

	it("allows emoji by the repo that owns them", () => {
		expect(allowsEmojiUri("all", HQ, foreign)).toBe(true);
		expect(allowsEmojiUri("local", HQ, local)).toBe(true);
		expect(allowsEmojiUri("local", HQ, foreign)).toBe(false);
		expect(allowsEmojiUri("none", HQ, local)).toBe(false);
	});

	it("drops disallowed emoji features and keeps the rest of the facet", () => {
		const mention = { $type: "social.colibri.beta.richtext.facet#mention" };
		const facets = [
			facet(0, { $type: CUSTOM_EMOJI_FEATURE, uri: local }),
			facet(5, { $type: CUSTOM_EMOJI_FEATURE, uri: foreign }),
			facet(10, mention, { $type: CUSTOM_EMOJI_FEATURE, uri: foreign }),
		];
		const kept = filterEmojiFacets(facets, (uri) =>
			allowsEmojiUri("local", HQ, uri),
		);
		expect(kept).toHaveLength(2);
		expect(kept[0]).toBe(facets[0]);
		expect(kept[1]?.features).toEqual([mention]);
	});
});
