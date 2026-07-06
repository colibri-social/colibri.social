import type { Facet, FacetFeature } from "./types.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export class UnicodeString {
	utf16: string;
	utf8: Uint8Array;

	constructor(utf16: string) {
		this.utf16 = utf16;
		this.utf8 = encoder.encode(utf16);
	}

	get length() {
		return this.utf8.byteLength;
	}

	slice(start?: number, end?: number): string {
		return decoder.decode(this.utf8.slice(start, end));
	}

	toString() {
		return this.utf16;
	}
}

export interface RichTextSegment {
	text: string;
	features: FacetFeature[];
}

const facetSort = (a: Facet, b: Facet) => a.index.byteStart - b.index.byteStart;

const facetFilter = (facet: Facet) =>
	facet.index.byteStart <= facet.index.byteEnd;

export const segmentRichText = (
	text: string,
	facets?: Facet[],
): RichTextSegment[] => {
	const unicode = new UnicodeString(text);
	const sorted = (facets ?? []).filter(facetFilter).sort(facetSort);
	const segments: RichTextSegment[] = [];

	if (!sorted.length) {
		if (unicode.utf16.length) segments.push({ text: unicode.utf16, features: [] });
		return segments;
	}

	let textCursor = 0;
	let facetCursor = 0;
	do {
		const currFacet = sorted[facetCursor];
		if (textCursor < currFacet.index.byteStart) {
			segments.push({
				text: unicode.slice(textCursor, currFacet.index.byteStart),
				features: [],
			});
		} else if (textCursor > currFacet.index.byteStart) {
			facetCursor++;
			continue;
		}
		if (currFacet.index.byteStart < currFacet.index.byteEnd) {
			const subtext = unicode.slice(
				currFacet.index.byteStart,
				currFacet.index.byteEnd,
			);
			if (!subtext.trim()) {
				segments.push({ text: subtext, features: [] });
			} else {
				segments.push({ text: subtext, features: currFacet.features });
			}
		}
		textCursor = currFacet.index.byteEnd;
		facetCursor++;
	} while (facetCursor < sorted.length);

	if (textCursor < unicode.length) {
		segments.push({
			text: unicode.slice(textCursor, unicode.length),
			features: [],
		});
	}

	return segments;
};

export type SegmentMark =
	| { kind: "bold" }
	| { kind: "italic" }
	| { kind: "code" }
	| { kind: "underline" }
	| { kind: "strikethrough" }
	| { kind: "highlight"; color?: string };

export interface SegmentStyle {
	marks: SegmentMark[];
	href?: string;
}

export const resolveSegmentStyle = (features: FacetFeature[]): SegmentStyle => {
	const marks: SegmentMark[] = [];
	let href: string | undefined;

	for (const feature of features) {
		switch (feature.$type) {
			case "pub.leaflet.richtext.facet#bold":
				marks.push({ kind: "bold" });
				break;
			case "pub.leaflet.richtext.facet#italic":
				marks.push({ kind: "italic" });
				break;
			case "pub.leaflet.richtext.facet#code":
				marks.push({ kind: "code" });
				break;
			case "pub.leaflet.richtext.facet#underline":
				marks.push({ kind: "underline" });
				break;
			case "pub.leaflet.richtext.facet#strikethrough":
				marks.push({ kind: "strikethrough" });
				break;
			case "pub.leaflet.richtext.facet#highlight":
				marks.push({
					kind: "highlight",
					color: feature.color as string | undefined,
				});
				break;
			case "pub.leaflet.richtext.facet#link":
				href = feature.uri as string;
				break;
			case "pub.leaflet.richtext.facet#atMention":
				href =
					(feature.href as string | undefined) ??
					`https://bsky.app/profile/${encodeURIComponent(feature.atURI as string)}`;
				break;
			case "pub.leaflet.richtext.facet#didMention":
				href = `https://bsky.app/profile/${encodeURIComponent(feature.did as string)}`;
				break;
		}
	}

	return { marks, href };
};
