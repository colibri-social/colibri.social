import { describe, expect, it } from "vitest";
import { proseMirrorToFacets } from "./prosemirror-to-facets";

type Doc = Parameters<typeof proseMirrorToFacets>[0];

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const paragraph = (text: string): Doc =>
	({
		type: "doc",
		content: [{ type: "paragraph", content: [{ type: "text", text }] }],
	}) as unknown as Doc;

const linksIn = (input: string): Array<{ uri: string; covers: string }> => {
	const { text, facets } = proseMirrorToFacets(paragraph(input));
	const bytes = encoder.encode(text);

	return facets.flatMap((facet) =>
		facet.features
			.filter((f) => f.$type === "social.colibri.beta.richtext.facet#link")
			.map((f) => ({
				uri: (f as { uri: string }).uri,
				covers: decoder.decode(
					bytes.slice(facet.index.byteStart, facet.index.byteEnd),
				),
			})),
	);
};

describe("autolinked bare domains", () => {
	it("leaves a possessive out of the link", () => {
		expect(linksIn("read plc.directory's docs")).toEqual([
			{ uri: "https://plc.directory", covers: "plc.directory" },
		]);
	});

	it("leaves a curly possessive out of the link", () => {
		expect(linksIn("read plc.directory’s docs")).toEqual([
			{ uri: "https://plc.directory", covers: "plc.directory" },
		]);
	});

	it("drops a trailing full stop", () => {
		expect(linksIn("we build on astro.build.")).toEqual([
			{ uri: "https://astro.build", covers: "astro.build" },
		]);
	});

	it("drops a possessive followed by a full stop", () => {
		expect(linksIn("that is plc.directory's.")).toEqual([
			{ uri: "https://plc.directory", covers: "plc.directory" },
		]);
	});

	it("drops a trailing straight quote", () => {
		expect(linksIn('she said "go to example.com"')).toEqual([
			{ uri: "https://example.com", covers: "example.com" },
		]);
	});

	it("drops a trailing curly quote", () => {
		expect(linksIn("she said “go to example.com”")).toEqual([
			{ uri: "https://example.com", covers: "example.com" },
		]);
	});

	it("drops an unbalanced closing paren and the full stop after it", () => {
		expect(linksIn("(see astro.build).")).toEqual([
			{ uri: "https://astro.build", covers: "astro.build" },
		]);
	});

	it("skips a domain whose tail cannot be a hostname", () => {
		expect(linksIn("ask plc.directory'sup about it")).toEqual([]);
	});
});

describe("autolinked absolute urls", () => {
	it("keeps a balanced closing paren", () => {
		const uri = "https://en.wikipedia.org/wiki/Bracket_(disambiguation)";
		expect(linksIn(`read ${uri} first`)).toEqual([{ uri, covers: uri }]);
	});

	it("keeps a path and query intact", () => {
		const uri = "https://example.com/a/b?c=d&e=f";
		expect(linksIn(`open ${uri} now`)).toEqual([{ uri, covers: uri }]);
	});

	it("keeps a trailing slash", () => {
		const uri = "https://example.com/docs/";
		expect(linksIn(`open ${uri} now`)).toEqual([{ uri, covers: uri }]);
	});

	it("drops a trailing full stop after a path", () => {
		expect(linksIn("open https://example.com/docs.")).toEqual([
			{ uri: "https://example.com/docs", covers: "https://example.com/docs" },
		]);
	});
});
