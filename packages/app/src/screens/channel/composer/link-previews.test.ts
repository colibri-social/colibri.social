import { describe, expect, it } from "vitest";
import type { Facet } from "../../../data/types";
import { isDirectMediaUrl, suppressedLinksFor } from "./link-previews";

const link = (uri: string, start: number): Facet =>
	({
		index: { byteStart: start, byteEnd: start + 4 },
		features: [{ $type: "social.colibri.beta.richtext.facet#link", uri }],
	}) as unknown as Facet;

const facets = [
	link("https://example.com/post", 0),
	link("https://media.example.com/cat.gif", 10),
	link("https://example.com/photo.JPG?size=large", 20),
	link("https://example.com/post", 30),
];

describe("composer link previews", () => {
	it("keeps previews when the viewer shows them by default", () => {
		expect(suppressedLinksFor(facets, true)).toEqual([]);
	});

	it("hides previews for every link except direct images and GIFs", () => {
		expect(suppressedLinksFor(facets, false)).toEqual([
			"https://example.com/post",
		]);
	});

	it("has nothing to hide in a message without links", () => {
		expect(suppressedLinksFor(undefined, false)).toEqual([]);
	});

	it("recognizes direct media links by their file type", () => {
		expect(isDirectMediaUrl("https://example.com/a.webp#x")).toBe(true);
		expect(isDirectMediaUrl("https://example.com/a.png")).toBe(true);
		expect(isDirectMediaUrl("https://example.com/png")).toBe(false);
		expect(isDirectMediaUrl("not a url")).toBe(false);
	});
});
