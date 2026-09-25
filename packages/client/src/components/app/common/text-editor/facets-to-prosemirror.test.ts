import { describe, expect, it } from "vitest";
import { facetsToProseMirror } from "./facets-to-prosemirror";
import { proseMirrorToFacets } from "./prosemirror-to-facets";

const nodes = (text: string) =>
	(
		facetsToProseMirror(text, [], [], [], []).content[0].content as Array<{
			type: string;
			text?: string;
			attrs?: { label?: string };
		}>
	).map((node) => {
		if (node.type === "text") return node.text;
		if (node.type === "hardBreak") return "\n";
		return `:${node.attrs?.label}:`;
	});

describe("emoji placement", () => {
	it("keeps an emoji between the text around it", () => {
		expect(nodes("hello 😀 world")).toEqual(["hello ", ":😀:", " world"]);
	});

	it("keeps a line-leading emoji at the start of the line", () => {
		expect(nodes("😀 leading")).toEqual([":😀:", " leading"]);
	});

	it("keeps a line-trailing emoji at the end of the line", () => {
		expect(nodes("trailing 😀")).toEqual(["trailing ", ":😀:"]);
	});

	it("keeps every emoji on a line with several", () => {
		expect(nodes("a 😀 b 🎉 c")).toEqual(["a ", ":😀:", " b ", ":🎉:", " c"]);
	});

	it("keeps adjacent emoji", () => {
		expect(nodes("😀😀")).toEqual([":😀:", ":😀:"]);
	});

	it("keeps a keycap emoji", () => {
		expect(nodes("1️⃣ first")).toEqual([":1️⃣:", " first"]);
	});

	it("splits lines on hard breaks", () => {
		expect(nodes("😀\n😀")).toEqual([":😀:", "\n", ":😀:"]);
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
		const doc = facetsToProseMirror(
			"hi @Nelly",
			[{ index: { byteStart: 3, byteEnd: 9 }, features: [feature] }],
			[],
			[],
			[],
		);
		const mention = (
			doc.content[0].content as Array<{ type: string; attrs?: object }>
		).find((node) => node.type === "mention");

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
