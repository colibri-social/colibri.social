import { describe, expect, it } from "vitest";
import type { ColibriRichTextFacet } from "./facets.js";
import { facetsToSource, parseMarkdown } from "./markdown.js";

type Feature = ColibriRichTextFacet["features"][number];

const kindOf = (feature: Feature): string =>
	(feature.$type ?? "").split("#")[1] ?? "";

/** Facets as `start-end:kind` strings, for readable assertions */
const summarize = (facets: Array<ColibriRichTextFacet>): Array<string> =>
	facets.map(
		(facet) =>
			`${facet.index.byteStart}-${facet.index.byteEnd}:${facet.features
				.map(kindOf)
				.join("+")}`,
	);

const buildFacet = (
	byteStart: number,
	byteEnd: number,
	...features: Array<Feature>
): ColibriRichTextFacet => ({
	$type: "social.colibri.richtext.facet",
	index: {
		$type: "app.bsky.richtext.facet#byteSlice",
		byteStart,
		byteEnd,
	},
	features,
});

const BOLD: Feature = { $type: "social.colibri.richtext.facet#bold" };
const QUOTE: Feature = { $type: "social.colibri.richtext.facet#quote" };
const CODEBLOCK: Feature = { $type: "social.colibri.richtext.facet#codeblock" };
const heading = (level: number): Feature => ({
	$type: "social.colibri.richtext.facet#heading",
	level,
});
const list = (ordered: boolean): Feature => ({
	$type: "social.colibri.richtext.facet#list",
	ordered,
});

const sliceFacet = (text: string, facet: ColibriRichTextFacet): string =>
	new TextDecoder().decode(
		new TextEncoder()
			.encode(text)
			.subarray(facet.index.byteStart, facet.index.byteEnd),
	);

describe("quote lines", () => {
	it("marks a single quoted line", () => {
		const { text, facets } = parseMarkdown("> hello", []);
		expect(text).toBe("hello");
		expect(summarize(facets)).toEqual(["0-5:quote"]);
	});

	it("merges consecutive quoted lines into one quote", () => {
		const { text, facets } = parseMarkdown("> one\n> two", []);
		expect(text).toBe("one\ntwo");
		expect(summarize(facets)).toEqual(["0-7:quote"]);
	});

	it("ends a quote at the first unquoted line instead of absorbing it", () => {
		const { text, facets } = parseMarkdown("> one\nplain\n> two", []);
		expect(text).toBe("one\nplain\ntwo");
		expect(summarize(facets)).toEqual(["0-3:quote", "10-13:quote"]);
		expect(facets.map((f) => sliceFacet(text, f))).toEqual(["one", "two"]);
	});

	it("keeps quotes separated by a blank line separate", () => {
		const { text, facets } = parseMarkdown("> one\n\n> two", []);
		expect(text).toBe("one\n\ntwo");
		expect(summarize(facets)).toEqual(["0-3:quote", "5-8:quote"]);
	});

	it("requires whitespace or end of line after the marker", () => {
		const { text, facets } = parseMarkdown(">hello", []);
		expect(text).toBe(">hello");
		expect(facets).toEqual([]);
	});

	it("treats a marker alone on a line as an empty quoted line", () => {
		const { text, facets } = parseMarkdown("> one\n>\n> two", []);
		expect(text).toBe("one\n\ntwo");
		expect(summarize(facets)).toEqual(["0-8:quote"]);
	});

	it("starts a quote after unquoted text", () => {
		const { text, facets } = parseMarkdown("intro\n> quoted", []);
		expect(text).toBe("intro\nquoted");
		expect(summarize(facets)).toEqual(["6-12:quote"]);
	});

	it("allows up to three spaces before the marker", () => {
		const { text, facets } = parseMarkdown("   > indented", []);
		expect(text).toBe("indented");
		expect(summarize(facets)).toEqual(["0-8:quote"]);
	});

	it("keeps a carriage return from splitting one quote in two", () => {
		const { text, facets } = parseMarkdown("> one\r\n> two", []);
		expect(text).toBe("one\r\ntwo");
		expect(summarize(facets)).toEqual(["0-8:quote"]);
	});

	it("does not treat a marker inside a code block as a quote", () => {
		const { text, facets } = parseMarkdown("```\n> not a quote\n```", []);
		expect(text).toBe("> not a quote");
		expect(summarize(facets)).toEqual(["0-13:codeblock"]);
	});
});

describe("blocks nested in a quote", () => {
	it("keeps a heading sharing the quote's range as its own facet", () => {
		const { text, facets } = parseMarkdown("> # title", []);
		expect(text).toBe("title");
		expect(summarize(facets)).toEqual(["0-5:quote", "0-5:heading"]);
	});

	it("keeps a heading on a later quoted line", () => {
		const { text, facets } = parseMarkdown("> intro\n> # title", []);
		expect(text).toBe("intro\ntitle");
		expect(summarize(facets)).toEqual(["0-11:quote", "6-11:heading"]);
	});

	it("keeps list items inside the quote's range", () => {
		const { text, facets } = parseMarkdown("> - one\n> - two", []);
		expect(text).toBe("one\ntwo");
		expect(summarize(facets)).toEqual(["0-3:list", "0-7:quote", "4-7:list"]);
	});

	it("detects subtext on a quoted line", () => {
		const { text, facets } = parseMarkdown("> -# small", []);
		expect(text).toBe("small");
		expect(summarize(facets)).toEqual(["0-5:quote", "0-5:subtext"]);
	});

	it("covers a fenced block inside a quote with both facets", () => {
		const { text, facets } = parseMarkdown("> ```\n> code\n> ```", []);
		expect(text).toBe("code");
		expect(summarize(facets)).toEqual(["0-4:quote", "0-4:codeblock"]);
	});

	it("drops a fence that opens inside a quote and closes outside it", () => {
		const { facets } = parseMarkdown("> ```js\n> a\nb\n> ```", []);
		for (const facet of facets) {
			expect(facet.index.byteEnd).toBeGreaterThan(facet.index.byteStart);
		}
		expect(summarize(facets).some((f) => f.endsWith("codeblock"))).toBe(false);
	});

	it("does not merge a list across a quote boundary", () => {
		const { text, facets } = parseMarkdown("- one\n> - two", []);
		expect(text).toBe("one\ntwo");
		expect(summarize(facets)).toEqual(["0-3:list", "4-7:quote", "4-7:list"]);
	});
});

describe("inline marks and quotes", () => {
	it("keeps an inline mark that spans a quote boundary", () => {
		const { text, facets } = parseMarkdown("**one\n> two**", []);
		expect(text).toBe("one\ntwo");
		expect(summarize(facets)).toEqual(["0-7:bold", "4-7:quote"]);
	});

	it("keeps an inline mark inside a quote", () => {
		const { text, facets } = parseMarkdown("> **bold**", []);
		expect(text).toBe("bold");
		expect(summarize(facets)).toEqual(["0-4:quote", "0-4:bold"]);
	});
});

describe("facetsToSource", () => {
	it("re-emits a marker on every line of a quote", () => {
		const { text, facets } = parseMarkdown("> one\n> two", []);
		expect(facetsToSource(text, facets).source).toBe("> one\n> two");
	});

	it("does not add markers to lines that were never quoted", () => {
		const { text, facets } = parseMarkdown("> one\nplain\n> two", []);
		expect(facetsToSource(text, facets).source).toBe("> one\nplain\n> two");
	});

	it("keeps a trailing empty quoted line", () => {
		const { text, facets } = parseMarkdown("> one\n>", []);
		expect(facetsToSource(text, facets).source).toBe("> one\n> ");
	});

	it("prefixes every line of a fence nested in a quote", () => {
		const { text, facets } = parseMarkdown("> ```\n> code\n> ```", []);
		expect(facetsToSource(text, facets).source).toBe("> ```\n> code\n> ```");
	});

	it("leaves an unquoted fence unprefixed", () => {
		const { text, facets } = parseMarkdown("```\ncode\n```", []);
		expect(facetsToSource(text, facets).source).toBe("```\ncode\n```");
	});

	it("returns instead of hanging on a zero-length codeblock facet", () => {
		const facet: ColibriRichTextFacet = {
			$type: "social.colibri.richtext.facet",
			index: {
				$type: "app.bsky.richtext.facet#byteSlice",
				byteStart: 0,
				byteEnd: 0,
			},
			features: [{ $type: "social.colibri.richtext.facet#codeblock" }],
		};
		expect(facetsToSource("abc", [facet]).source).toBe("abc");
	});
});

describe("block prefixes", () => {
	it("puts a heading marker outside an inline mark starting at the same offset", () => {
		expect(
			facetsToSource("x", [
				buildFacet(0, 1, BOLD),
				buildFacet(0, 1, heading(1)),
			]).source,
		).toBe("# **x**");
	});

	it("ignores feature order within a merged facet", () => {
		expect(
			facetsToSource("x", [buildFacet(0, 1, BOLD, heading(1))]).source,
		).toBe("# **x**");
		expect(
			facetsToSource("x", [buildFacet(0, 1, BOLD, list(false))]).source,
		).toBe("- **x**");
	});

	it("emits one marker per kind when a range carries two of the same", () => {
		expect(
			facetsToSource("x", [
				buildFacet(0, 1, list(false)),
				buildFacet(0, 1, list(true)),
			]).source,
		).toBe("- x");
		expect(
			facetsToSource("x", [
				buildFacet(0, 1, heading(1)),
				buildFacet(0, 1, heading(2)),
			]).source,
		).toBe("# x");
	});

	it("does not spend an ordered number on a discarded marker", () => {
		expect(
			facetsToSource("x\ny", [
				buildFacet(0, 1, list(false)),
				buildFacet(0, 1, list(true)),
				buildFacet(2, 3, list(true)),
			]).source,
		).toBe("- x\n1. y");
	});

	it("drops a prefix colliding with a fence rather than fencing the text twice", () => {
		expect(
			facetsToSource("code", [
				buildFacet(0, 4, list(false)),
				buildFacet(0, 4, CODEBLOCK),
			]).source,
		).toBe("```\ncode\n```");
	});

	it("nests a quote, list, heading and inline mark on one range", () => {
		expect(
			facetsToSource("x", [
				buildFacet(0, 1, QUOTE),
				buildFacet(0, 1, list(false)),
				buildFacet(0, 1, heading(1)),
				buildFacet(0, 1, BOLD),
			]).source,
		).toBe("> - # **x**");
	});
});

describe("round trip", () => {
	const cases = [
		"> one",
		"> one\n> two",
		"> one\nplain\n> two",
		"> one\n\n> two",
		">not a quote",
		"> # title",
		"> intro\n> # title",
		"> - one\n> - two",
		"> -# small",
		"> ```\n> code\n> ```",
		"> one\n>",
		"intro\n> quoted",
		"```\n> not a quote\n```",
		"**one\n> two**",
		"- one\n> - two",
		"> - one\n- two",
		"> one\r\n> two",
		"> one\n>\n> two",
		"> **bold**",
		">>> one\ntwo",
		"one\n> two\nthree\n> four",
		"```js\ncode\n```",
		"# title\n- one\n- two",
		"plain text",
		"> one\n> two\nplain\n> three",
		"> ```js\n> a\n> b\n> ```\nafter",
		"- **Test**",
		"- *i*",
		"- `c`",
		"- [x](https://e.com)",
		"- ||sp||",
		"- ~~gone~~",
		"- a **b**",
		"- # head",
		"- ### deep",
		"- # **x** y",
		"- **a**\nplain\n- **b**",
		"1. **a**\n2. **b**",
		"1. # h",
		"> - `c`",
		"> - # **x**",
		"> 1. **a**\n> 2. **b**",
		"# **x** y",
		"-# **x** y",
		"## `c` tail",
		"# [a](https://x.y) z",
		"- -# small",
		"-# - x",
		"- x\n  -# y",
		"- ```\ncode\n```",
	];

	it.each(cases)("is stable for %j", (source) => {
		const first = parseMarkdown(source, []);
		const second = parseMarkdown(
			facetsToSource(first.text, first.facets).source,
			[],
		);
		expect(second).toEqual(first);
	});

	it.each(cases)("emits no empty facet for %j", (source) => {
		for (const facet of parseMarkdown(source, []).facets) {
			expect(facet.index.byteEnd).toBeGreaterThan(facet.index.byteStart);
		}
	});
});
