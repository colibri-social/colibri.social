import type { ColibriRichTextFacet } from "@colibri-social/lib";
import { describe, expect, it } from "vitest";
import { buildClipboardHtml, readClipboardFacets } from "./clipboard-facets";
import {
	facetsToProseMirror,
	flattenLegacyEmoji,
} from "./facets-to-prosemirror";
import { proseMirrorToFacets } from "./prosemirror-to-facets";

type Inline = { type: string; text?: string; attrs?: Record<string, unknown> };

const inline = (doc: ReturnType<typeof facetsToProseMirror>) =>
	(doc.content[0].content ?? []) as Inline[];

const nodes = (text: string) =>
	inline(facetsToProseMirror(text, [])).map((node) =>
		node.type === "hardBreak" ? "\n" : node.text,
	);

const roundTrip = (text: string, facets: ColibriRichTextFacet[]) =>
	proseMirrorToFacets(facetsToProseMirror(text, facets) as never);

describe("emoji", () => {
	it("keeps emoji inside plain text", () => {
		expect(nodes("hello 😀 world")).toEqual(["hello 😀 world"]);
	});

	it("keeps a keycap emoji", () => {
		expect(nodes("1️⃣ first")).toEqual(["1️⃣ first"]);
	});

	it("splits lines on hard breaks", () => {
		expect(nodes("😀\n😀")).toEqual(["😀", "\n", "😀"]);
	});

	it("flattens emoji nodes from older drafts into text", () => {
		const legacy = {
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [
						{ type: "text", text: "hi " },
						{ type: "mention", attrs: { type: "emoji", label: "🎉" } },
						{ type: "emoji", attrs: { name: "wave" } },
						{ type: "emoji", attrs: { name: "not_a_real_emoji" } },
					],
				},
			],
		};
		const flat = flattenLegacyEmoji(legacy as never, (name) =>
			name === "wave" ? "👋" : undefined,
		);
		expect(flat.content[0].content).toEqual([
			expect.objectContaining({
				type: "text",
				text: "hi 🎉👋:not_a_real_emoji:",
			}),
		]);
	});
});

describe("bridged mentions", () => {
	const feature = {
		$type: "social.colibri.beta.richtext.facet#bridgedMention" as const,
		registration: "3lkbridgeaaaa",
		platform: "chat",
		remoteId: "123",
	};

	it("survives a trip through the editor", () => {
		const doc = facetsToProseMirror("hi @Nelly", [
			{ index: { byteStart: 3, byteEnd: 9 }, features: [feature] },
		]);
		const mention = inline(doc).find((node) => node.type === "mention");
		expect(mention?.attrs).toMatchObject({
			type: "bridged",
			label: "Nelly",
			id: "123",
		});

		const { text, facets } = proseMirrorToFacets(doc as never);
		expect(text).toBe("hi @Nelly");
		expect(facets).toEqual([
			expect.objectContaining({
				index: expect.objectContaining({ byteStart: 3, byteEnd: 9 }),
				features: [feature],
			}),
		]);
	});
});

describe("unresolved mentions", () => {
	it("keeps the original text of a member who can't be resolved", () => {
		const facets: ColibriRichTextFacet[] = [
			{
				index: { byteStart: 4, byteEnd: 9 },
				features: [
					{
						$type: "social.colibri.beta.richtext.facet#mention",
						did: "did:plc:gone",
					},
				],
			},
		];
		const { text } = roundTrip("hey @Lena!", facets);
		expect(text).toBe("hey @Lena!");
	});

	it("keeps the original text of a role that can't be resolved", () => {
		const facets: ColibriRichTextFacet[] = [
			{
				index: { byteStart: 0, byteEnd: 5 },
				features: [
					{
						$type: "social.colibri.beta.richtext.facet#role",
						role: "3lkrole",
					},
				],
			},
		];
		const { text } = roundTrip("@mods help", facets);
		expect(text).toBe("@mods help");
	});

	it("uses the resolved member name", () => {
		const doc = facetsToProseMirror(
			"hey @old",
			[
				{
					index: { byteStart: 4, byteEnd: 8 },
					features: [
						{
							$type: "social.colibri.beta.richtext.facet#mention",
							did: "did:plc:lou",
						},
					],
				},
			],
			{ resolveMember: () => ({ did: "did:plc:lou", name: "Lou" }) },
		);
		const mention = inline(doc).find((node) => node.type === "mention");
		expect(mention?.attrs).toMatchObject({ label: "Lou", type: "member" });
	});
});

describe("custom emoji", () => {
	const uri = "at://did:plc:hq/blue.moji.collection.item/shipit";
	const facets = [
		{
			index: { byteStart: 3, byteEnd: 7 },
			features: [
				{
					$type: "social.colibri.beta.richtext.facet#customEmoji",
					uri,
					cid: "bafyshipit",
				},
			],
		},
	] as unknown as ColibriRichTextFacet[];
	const resolveCustomEmoji = ({ uri: target }: { uri: string }) =>
		target === uri
			? { id: uri, name: "shipit", src: "https://blobs.test/shipit" }
			: undefined;

	it("loads an emoji facet back as an inline emoji node", () => {
		const doc = facetsToProseMirror("Go 🚀", facets, { resolveCustomEmoji });
		expect(inline(doc)[1]).toMatchObject({
			type: "mention",
			attrs: {
				type: "customEmoji",
				id: uri,
				cid: "bafyshipit",
				label: "🚀",
				name: "shipit",
				avatar: "https://blobs.test/shipit",
			},
		});
		expect(proseMirrorToFacets(doc as never)).toMatchObject({
			text: "Go 🚀",
			facets: [
				{
					index: { byteStart: 3, byteEnd: 7 },
					features: [
						{
							$type: "social.colibri.beta.richtext.facet#customEmoji",
							uri,
							cid: "bafyshipit",
						},
					],
				},
			],
		});
	});

	it("keeps an unresolvable emoji facet as plain text", () => {
		const doc = facetsToProseMirror("Go 🚀", facets);
		expect(inline(doc).every((node) => node.type === "text")).toBe(true);
		expect(proseMirrorToFacets(doc as never)).toEqual({
			text: "Go 🚀",
			facets: [],
		});
	});
});

describe("pasted links", () => {
	const bytes = (value: string) => new TextEncoder().encode(value).length;
	const linkFacet = (
		text: string,
		label: string,
		uri: string,
	): ColibriRichTextFacet => {
		const start = bytes(text.slice(0, text.indexOf(label)));
		return {
			index: { byteStart: start, byteEnd: start + bytes(label) },
			features: [
				{
					$type: "social.colibri.beta.richtext.facet#link",
					uri: uri as `${string}:${string}`,
				},
			],
		};
	};
	const textOf = (doc: ReturnType<typeof facetsToProseMirror>) =>
		inline(doc)
			.map((node) => node.text ?? "")
			.join("");

	it("inserts a bare url as plain text", () => {
		const uri = "https://colibri.social/docs";
		const text = `read ${uri} first`;
		const doc = facetsToProseMirror(text, [linkFacet(text, uri, uri)]);
		expect(textOf(doc)).toBe(text);
	});

	it("inserts a bare url as plain text when its label has stray spaces", () => {
		const uri = "https://colibri.social/docs";
		const text = `read  ${uri} first`;
		const doc = facetsToProseMirror(text, [linkFacet(text, ` ${uri}`, uri)]);
		expect(textOf(doc)).toBe(text);
	});

	it("autolinks the pasted url again on send", () => {
		const uri = "https://colibri.social/docs";
		const text = `read ${uri} first`;
		const { facets } = roundTrip(text, [linkFacet(text, uri, uri)]);
		expect(facets).toEqual([
			expect.objectContaining({
				index: expect.objectContaining({
					byteStart: 5,
					byteEnd: 5 + bytes(uri),
				}),
				features: [
					expect.objectContaining({
						$type: "social.colibri.beta.richtext.facet#link",
						uri,
					}),
				],
			}),
		]);
	});

	it("keeps markdown source for a labelled link", () => {
		const uri = "https://colibri.social/docs";
		const text = "read the docs first";
		const doc = facetsToProseMirror(text, [linkFacet(text, "the docs", uri)]);
		expect(textOf(doc)).toBe(`read [the docs](${uri}) first`);
	});

	it("keeps markdown source when the url runs into other text", () => {
		const uri = "https://colibri.social/docs";
		const text = `read${uri}`;
		const doc = facetsToProseMirror(text, [linkFacet(text, uri, uri)]);
		expect(textOf(doc)).toBe(`read[${uri}](${uri})`);
	});

	it("pastes a copied message link as plain text", () => {
		const uri = "at://did:plc:abc123/app.bsky.feed.post/3kabc";
		const text = `see ${uri}`;
		const payload = readClipboardFacets(
			buildClipboardHtml(text, [linkFacet(text, uri, uri)]),
		);
		if (!payload) throw new Error("clipboard payload missing");
		const doc = facetsToProseMirror(payload.text, payload.facets);
		expect(textOf(doc)).toBe(text);
	});
});

describe("thread mentions", () => {
	const thread =
		"at://did:plc:space/space/social.colibri.beta.channel.thread/3kthread";
	const text = "see #release-notes today";
	const start = new TextEncoder().encode("see ").length;
	const facets: ColibriRichTextFacet[] = [
		{
			index: {
				byteStart: start,
				byteEnd: start + new TextEncoder().encode("#release-notes").length,
			},
			features: [
				{
					$type: "social.colibri.beta.richtext.facet#link",
					uri: thread as `${string}:${string}`,
				},
			],
		},
	];
	const resolvers = {
		resolveThreadLink: (uri: string) =>
			uri === thread
				? { label: "release-notes", category: "general" }
				: undefined,
	};

	it("maps a thread link back to a thread chip", () => {
		const doc = facetsToProseMirror(text, facets, resolvers);
		expect(inline(doc)).toContainEqual(
			expect.objectContaining({
				type: "mention",
				attrs: expect.objectContaining({
					type: "channel",
					label: "release-notes",
					category: "general",
					uri: thread,
				}),
			}),
		);
	});

	it("round-trips a thread chip as a link facet with the thread uri", () => {
		const doc = facetsToProseMirror(text, facets, resolvers);
		expect(proseMirrorToFacets(doc as never)).toEqual({
			text,
			facets: [
				expect.objectContaining({
					index: expect.objectContaining({
						byteStart: facets[0].index.byteStart,
						byteEnd: facets[0].index.byteEnd,
					}),
					features: [
						{ $type: "social.colibri.beta.richtext.facet#link", uri: thread },
					],
				}),
			],
		});
	});

	it("keeps an unknown thread link as a markdown link", () => {
		const doc = facetsToProseMirror(text, facets);
		expect(inline(doc).some((node) => node.type === "mention")).toBe(false);
		expect(roundTrip(text, facets).facets[0].features).toEqual([
			{ $type: "social.colibri.beta.richtext.facet#link", uri: thread },
		]);
	});
});
