import type { ColibriRichTextFacet } from "@colibri-social/lib";
import { describe, expect, it } from "vitest";
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
