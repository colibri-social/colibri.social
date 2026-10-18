import { describe, expect, it } from "vitest";
import type { Datetime, Did, Facet } from "../types";
import {
	attachEmojiFacets,
	type BlobLocator,
	CUSTOM_EMOJI_FEATURE,
	createEmojiRegistry,
	type EmojiProvider,
	type EmojiView,
	emojiFeature,
	readEmojiFeature,
} from "./index";
import { BLUEMOJI, bluemojiProvider } from "./providers/bluemoji";

const OWNER = "did:plc:space" as Did;
const CREATED = "2026-10-12T10:00:00.000Z" as Datetime;
const locate: BlobLocator = ({ did, cid }) =>
	`https://blobs.test/${did}/${cid}`;

const written = bluemojiProvider.writeItem({
	owner: OWNER,
	name: "shipit",
	alt: "A rocket",
	image: { cid: "bafkreipng", mimeType: "image/png", size: 900 },
	createdAt: CREATED,
});

const shipit = bluemojiProvider.readItem(
	{
		uri: `at://${OWNER}/${written.collection}/${written.rkey}`,
		cid: "bafyrecord",
		value: written.value,
	},
	locate,
) as EmojiView;

describe("Bluemoji adapter", () => {
	it("writes items in the blue.moji.collection.item shape", () => {
		expect(written.collection).toBe(BLUEMOJI.item);
		expect(written.rkey).toBe("shipit");
		expect(written.value).toMatchObject({
			$type: BLUEMOJI.item,
			name: ":shipit:",
			alt: "A rocket",
			formats: {
				$type: BLUEMOJI.itemFormatsV1,
				png_128: { $type: "blob", ref: { $link: "bafkreipng" } },
				original: { ref: { $link: "bafkreipng" } },
			},
		});
	});

	it("reads its own items back into the neutral model", () => {
		expect(shipit).toMatchObject({
			id: `at://${OWNER}/${BLUEMOJI.item}/shipit`,
			name: "shipit",
			alt: "A rocket",
			image: `https://blobs.test/${OWNER}/bafkreipng`,
			ref: { provider: "blue.moji", owner: OWNER, cid: "bafyrecord" },
		});
		expect(shipit.images).toEqual([
			expect.objectContaining({
				format: "png",
				cid: "bafkreipng",
				pixels: 128,
			}),
		]);
	});

	it("reads legacy formats_v0 records from the network", () => {
		const legacy = bluemojiProvider.readItem(
			{
				uri: "at://did:plc:tgz54h2xke4so6zlkqfvmt2e/blue.moji.collection.item/sonnamonndesu",
				value: {
					alt: "white text emoji",
					name: ":sonnamonndesu:",
					formats: {
						png_128: {
							ref: {
								$link:
									"bafkreigkr4ff4baj4yekqudgnb6i3vs5v37th5dlfijo6jgdunrh5dvc3u",
							},
							size: 8544,
							mimeType: "image/png",
						},
						apng_128: new Uint8Array([1, 2, 3]),
					},
					createdAt: "2025-03-18T09:17:59.387Z",
				},
			},
			locate,
		);
		expect(legacy?.name).toBe("sonnamonndesu");
		expect(legacy?.images.map((image) => image.format)).toEqual(["png"]);
	});

	it("uses the Unicode fallback under the facet when the item has one", () => {
		const withFallback = bluemojiProvider.writeItem({
			owner: OWNER,
			name: "rocket",
			fallback: "🚀",
			image: { cid: "bafkreirocket", mimeType: "image/png", size: 10 },
			createdAt: CREATED,
		});
		expect(withFallback.value).toMatchObject({ fallbackText: "🚀" });
		const rocket = bluemojiProvider.readItem(
			{
				uri: `at://${OWNER}/${BLUEMOJI.item}/rocket`,
				value: withFallback.value,
			},
			locate,
		) as EmojiView;
		expect(bluemojiProvider.fallbackText(rocket)).toBe("🚀");
		expect(bluemojiProvider.altText(rocket)).toBe("🚀");
	});

	it("falls back to the shortcode when the item has no Unicode fallback", () => {
		expect(bluemojiProvider.fallbackText(shipit)).toBe(":shipit:");
		expect(bluemojiProvider.altText(shipit)).toBe("A rocket");
	});

	it("builds packs from pack and packitem records in membership order", () => {
		const pack = `at://${OWNER}/${BLUEMOJI.pack}/3pack`;
		const packs = bluemojiProvider.readPacks?.({
			packs: [
				{
					uri: pack,
					value: { name: "Release day", createdAt: CREATED },
				},
			],
			memberships: [
				{
					uri: `at://${OWNER}/${BLUEMOJI.packItem}/b`,
					value: {
						subject: `at://${OWNER}/${BLUEMOJI.item}/gone`,
						pack,
						createdAt: "2026-10-12T10:00:02.000Z",
					},
				},
				{
					uri: `at://${OWNER}/${BLUEMOJI.packItem}/a`,
					value: {
						subject: shipit.id,
						pack,
						createdAt: "2026-10-12T10:00:01.000Z",
					},
				},
			],
			emojis: [shipit],
		});
		expect(packs).toEqual([
			expect.objectContaining({
				id: pack,
				name: "Release day",
				provider: "blue.moji",
				emojis: [shipit.id],
			}),
		]);
	});
});

const fakeProvider: EmojiProvider = {
	id: "test.sticker",
	label: "Test stickers",
	maxImageBytes: 1000,
	collections: { item: "test.sticker.item" },
	readItem: (record, find) => {
		const value = record.value as { code: string; blob: string };
		return {
			id: record.uri,
			ref: { provider: "test.sticker", uri: record.uri, owner: OWNER },
			name: value.code,
			images: [
				{
					src: find({ did: OWNER, cid: value.blob }),
					cid: value.blob,
					format: "webp",
					animated: false,
				},
			],
			image: find({ did: OWNER, cid: value.blob }),
			createdAt: CREATED,
		};
	},
	writeItem: (draft) => ({
		collection: "test.sticker.item",
		rkey: draft.name,
		value: { code: draft.name, blob: draft.image.cid },
	}),
	writeCopy: (draft) => ({
		collection: "test.sticker.item",
		rkey: draft.name,
		value: { code: draft.name, blob: draft.image.cid, from: draft.source.id },
	}),
	fallbackText: () => "👋",
	altText: (emoji) => `Sticker ${emoji.name}`,
};

describe("emoji registry", () => {
	const registry = createEmojiRegistry([bluemojiProvider, fakeProvider]);
	const sticker = registry.readItem(
		{
			uri: `at://${OWNER}/test.sticker.item/wave`,
			value: { code: "wave", blob: "bafkreiwave" },
		},
		locate,
	) as EmojiView;

	it("dispatches records to the provider that owns their collection", () => {
		expect(registry.forUri(shipit.id)?.id).toBe("blue.moji");
		expect(sticker.ref.provider).toBe("test.sticker");
		expect(registry.forUri("at://did:plc:x/app.bsky.feed.post/1")).toBe(
			undefined,
		);
		expect(registry.fallbackText(sticker)).toBe("👋");
		expect(registry.altText(sticker)).toBe("Sticker wave");
	});

	it("encodes every provider's emoji as the same neutral facet feature", () => {
		expect(emojiFeature(shipit)).toEqual({
			$type: CUSTOM_EMOJI_FEATURE,
			uri: shipit.id,
			cid: "bafyrecord",
		});
		expect(emojiFeature(sticker)).toEqual({
			$type: CUSTOM_EMOJI_FEATURE,
			uri: sticker.id,
		});
		expect(readEmojiFeature(emojiFeature(shipit))).toEqual({
			uri: shipit.id,
			cid: "bafyrecord",
		});
		expect(
			readEmojiFeature({ $type: "social.colibri.beta.richtext.facet#bold" }),
		).toBe(undefined);
		expect(readEmojiFeature({ $type: CUSTOM_EMOJI_FEATURE, uri: "x" })).toBe(
			undefined,
		);
	});

	it("converts typed shortcodes to fallback text with the facet at the right byte range", () => {
		const text = "héllo :shipit: and `:wave:` :wave: :nope: **x**";
		const encoder = new TextEncoder();
		const codeStart = encoder.encode("héllo :shipit: and ").length;
		const boldStart = encoder.encode(
			"héllo :shipit: and `:wave:` :wave: :nope: ",
		).length;
		const facets: Facet[] = [
			{
				index: { byteStart: codeStart, byteEnd: codeStart + 8 },
				features: [{ $type: "social.colibri.beta.richtext.facet#code" }],
			},
			{
				index: { byteStart: boldStart, byteEnd: boldStart + 5 },
				features: [{ $type: "social.colibri.beta.richtext.facet#bold" }],
			},
		];
		const lookup = (name: string) =>
			name === "shipit" ? shipit : name === "wave" ? sticker : undefined;
		const result = attachEmojiFacets({ text, facets, lookup, registry });
		expect(result.text).toBe("héllo :shipit: and `:wave:` 👋 :nope: **x**");
		const bytes = encoder.encode(result.text);
		const slice = (facet: Facet) =>
			new TextDecoder().decode(
				bytes.subarray(facet.index.byteStart, facet.index.byteEnd),
			);
		const emojiFacets = result.facets.filter((facet) =>
			facet.features.some((feature) => feature.$type === CUSTOM_EMOJI_FEATURE),
		);
		expect(emojiFacets.map(slice)).toEqual([":shipit:", "👋"]);
		expect(
			emojiFacets.map(
				(facet) => (facet.features[0] as { uri?: string } | undefined)?.uri,
			),
		).toEqual([shipit.id, sticker.id]);
		const code = result.facets.find(
			(facet) =>
				facet.features[0]?.$type === "social.colibri.beta.richtext.facet#code",
		) as Facet;
		const bold = result.facets.find(
			(facet) =>
				facet.features[0]?.$type === "social.colibri.beta.richtext.facet#bold",
		) as Facet;
		expect(slice(code)).toBe("`:wave:`");
		expect(slice(bold)).toBe("**x**");
		expect(result.facets).toHaveLength(4);
	});

	it("leaves shortcodes alone that already carry an emoji facet", () => {
		const text = ":shipit:";
		const facets: Facet[] = [
			{
				index: { byteStart: 0, byteEnd: 8 },
				features: [
					emojiFeature(shipit) as unknown as Facet["features"][number],
				],
			},
		];
		const result = attachEmojiFacets({
			text,
			facets,
			lookup: () => shipit,
			registry,
		});
		expect(result.facets).toHaveLength(1);
		expect(result.text).toBe(":shipit:");
	});
});
