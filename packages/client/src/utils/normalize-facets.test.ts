import type { ColibriRichTextFacet } from "@colibri-social/lib";
import { describe, expect, it } from "vitest";
import {
	buildFeatureKey,
	normalizeFacets,
	stableStringify,
} from "./normalize-facets";

type Feature = ColibriRichTextFacet["features"][number];

const facet = (
	byteStart: number,
	byteEnd: number,
	...features: Array<Feature>
): ColibriRichTextFacet =>
	({
		$type: "social.colibri.richtext.facet",
		index: { byteStart, byteEnd },
		features,
	}) as ColibriRichTextFacet;

const bold = { $type: "social.colibri.richtext.facet#bold" } as Feature;
const italic = { $type: "social.colibri.richtext.facet#italic" } as Feature;
const quote = { $type: "social.colibri.richtext.facet#quote" } as Feature;
const heading = (level: number) =>
	({ $type: "social.colibri.richtext.facet#heading", level }) as Feature;
const link = (uri: string) =>
	({ $type: "social.colibri.richtext.facet#link", uri }) as Feature;

const ranges = (facets: Array<ColibriRichTextFacet>) =>
	facets.map((f) => `${f.index.byteStart}-${f.index.byteEnd}`);

const kinds = (f: ColibriRichTextFacet) =>
	f.features.map((feature) => (feature.$type ?? "").split("#")[1]);

describe("stableStringify", () => {
	it("orders object keys so equal objects stringify identically", () => {
		expect(stableStringify({ b: 1, a: 2 })).toBe(
			stableStringify({ a: 2, b: 1 }),
		);
	});

	it("preserves array order", () => {
		expect(stableStringify([1, 2])).not.toBe(stableStringify([2, 1]));
	});

	it("sorts keys of objects nested inside arrays", () => {
		expect(stableStringify([{ b: 1, a: 2 }])).toBe('[{"a":2,"b":1}]');
	});

	it("handles null without treating it as an object", () => {
		expect(stableStringify(null)).toBe("null");
	});

	it("stringifies primitives the way JSON does", () => {
		expect(stableStringify("x")).toBe('"x"');
		expect(stableStringify(3)).toBe("3");
		expect(stableStringify(true)).toBe("true");
	});
});

describe("buildFeatureKey", () => {
	it("distinguishes links by uri", () => {
		expect(buildFeatureKey(link("https://a.example"))).not.toBe(
			buildFeatureKey(link("https://b.example")),
		);
	});

	it("treats identical links as the same feature", () => {
		expect(buildFeatureKey(link("https://a.example"))).toBe(
			buildFeatureKey(link("https://a.example")),
		);
	});

	it("distinguishes headings by level", () => {
		expect(buildFeatureKey(heading(1))).not.toBe(buildFeatureKey(heading(2)));
	});

	it("keys markers by type alone", () => {
		expect(buildFeatureKey(bold)).toBe("social.colibri.richtext.facet#bold");
	});
});

describe("normalizeFacets", () => {
	it("returns an empty array unchanged", () => {
		expect(normalizeFacets([])).toEqual([]);
	});

	it("merges features of facets sharing a byte range", () => {
		const result = normalizeFacets([facet(0, 5, bold), facet(0, 5, italic)]);

		expect(result).toHaveLength(1);
		expect(kinds(result[0])).toEqual(["bold", "italic"]);
	});

	it("deduplicates an identical feature repeated across facets", () => {
		const result = normalizeFacets([facet(0, 5, bold), facet(0, 5, bold)]);

		expect(result).toHaveLength(1);
		expect(kinds(result[0])).toEqual(["bold"]);
	});

	it("deduplicates by value, not just by type", () => {
		const result = normalizeFacets([
			facet(0, 5, link("https://a.example")),
			facet(0, 5, link("https://a.example")),
			facet(0, 5, link("https://b.example")),
		]);

		expect(result).toHaveLength(1);
		expect(result[0].features).toHaveLength(2);
	});

	it("keeps a quote in its own group so same-range blocks can nest inside it", () => {
		const result = normalizeFacets([
			facet(0, 5, quote),
			facet(0, 5, heading(1)),
		]);

		expect(result).toHaveLength(2);
		expect(result.flatMap(kinds).sort()).toEqual(["heading", "quote"]);
	});

	it("still merges two quotes covering the same range", () => {
		const result = normalizeFacets([facet(0, 5, quote), facet(0, 5, quote)]);
		expect(result).toHaveLength(1);
	});

	it("drops zero-length and inverted ranges", () => {
		expect(normalizeFacets([facet(3, 3, bold), facet(5, 2, bold)])).toEqual([]);
	});

	it("sorts by start offset", () => {
		const result = normalizeFacets([
			facet(10, 12, bold),
			facet(0, 5, bold),
			facet(6, 9, bold),
		]);

		expect(ranges(result)).toEqual(["0-5", "6-9", "10-12"]);
	});

	it("breaks ties on start offset using the end offset", () => {
		const result = normalizeFacets([facet(0, 9, bold), facet(0, 4, italic)]);
		expect(ranges(result)).toEqual(["0-4", "0-9"]);
	});

	it("keeps distinct ranges separate", () => {
		const result = normalizeFacets([facet(0, 5, bold), facet(6, 9, bold)]);
		expect(result).toHaveLength(2);
	});

	it("defaults the facet type when the source facet omits it", () => {
		const untyped = {
			index: { byteStart: 0, byteEnd: 3 },
			features: [bold],
		} as ColibriRichTextFacet;

		expect(normalizeFacets([untyped])[0].$type).toBe(
			"social.colibri.richtext.facet",
		);
	});
});
