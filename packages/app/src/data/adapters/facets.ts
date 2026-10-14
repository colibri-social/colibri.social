import type { Facet } from "../types";

const encoder = new TextEncoder();

export type TextValue = { text: string; facets: Facet[] };

export const utf8Length = (text: string) => encoder.encode(text).length;

const isContinuationByte = (byte: number | undefined) =>
	byte !== undefined && (byte & 0b1100_0000) === 0b1000_0000;

const onBoundary = (bytes: Uint8Array, offset: number) =>
	offset === bytes.length || !isContinuationByte(bytes[offset]);

export const validFacets = (text: string, facets: readonly Facet[] = []) => {
	if (facets.length === 0) return [];
	const bytes = encoder.encode(text);
	return facets.filter((facet) => {
		const { byteStart, byteEnd } = facet.index;
		return (
			Number.isInteger(byteStart) &&
			Number.isInteger(byteEnd) &&
			byteStart >= 0 &&
			byteEnd > byteStart &&
			byteEnd <= bytes.length &&
			onBoundary(bytes, byteStart) &&
			onBoundary(bytes, byteEnd) &&
			facet.features.length > 0
		);
	});
};

export const toTextValue = (
	text: string,
	facets: readonly Facet[] | undefined,
): TextValue => ({ text, facets: validFacets(text, facets) });

export const fromComposerValue = (value: {
	text: string;
	facets: readonly Facet[];
}): TextValue => {
	const leading = value.text.length - value.text.trimStart().length;
	const text = value.text.trim();
	const shift = utf8Length(value.text.slice(0, leading));
	const limit = utf8Length(text);
	const facets = value.facets
		.map((facet) => ({
			...facet,
			index: {
				...facet.index,
				byteStart: Math.max(0, facet.index.byteStart - shift),
				byteEnd: Math.min(limit, facet.index.byteEnd - shift),
			},
		}))
		.filter((facet) => facet.index.byteEnd > facet.index.byteStart)
		.sort((a, b) => a.index.byteStart - b.index.byteStart);
	return { text, facets: validFacets(text, facets) };
};

export const previewText = (text: string, max = 140) => {
	const collapsed = text.replace(/\s+/g, " ").trim();
	if (collapsed.length <= max) return collapsed;
	const cut = Array.from(collapsed).slice(0, max).join("");
	return `${cut.trimEnd()}...`;
};

export const mentionsDid = (
	facets: readonly Facet[] | undefined,
	did: string,
) =>
	(facets ?? []).some((facet) =>
		facet.features.some(
			(feature) =>
				feature.$type === "social.colibri.beta.richtext.facet#mention" &&
				"did" in feature &&
				feature.did === did,
		),
	);
