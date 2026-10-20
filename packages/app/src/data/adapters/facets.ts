import type { Did, Facet } from "../types";

const encoder = new TextEncoder();

export type TextValue = { text: string; facets: Facet[] };

export const utf8Length = (text: string) => encoder.encode(text).length;

export const linkMessage = (url: `${string}:${string}`): TextValue => ({
	text: url,
	facets: [
		{
			index: { byteStart: 0, byteEnd: utf8Length(url) },
			features: [
				{ $type: "social.colibri.beta.richtext.facet#link", uri: url },
			],
		},
	],
});

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

export const sameTextValue = (a: TextValue, b: TextValue) =>
	a.text === b.text && JSON.stringify(a.facets) === JSON.stringify(b.facets);

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

export const collapseWhitespace = (
	text: string,
	facets: readonly Facet[] = [],
): TextValue => {
	const offsets = new Map<number, number>();
	let source = 0;
	let target = 0;
	let collapsed = "";
	let pendingSpace = false;
	for (const char of text) {
		offsets.set(source, target);
		const size = utf8Length(char);
		if (/\s/.test(char)) {
			pendingSpace = collapsed.length > 0;
		} else {
			if (pendingSpace) {
				collapsed += " ";
				target += 1;
				offsets.set(source, target);
				pendingSpace = false;
			}
			collapsed += char;
			target += size;
		}
		source += size;
	}
	offsets.set(source, target);
	const mapped = facets.flatMap((facet) => {
		const byteStart = offsets.get(facet.index.byteStart);
		const byteEnd = offsets.get(facet.index.byteEnd);
		if (byteStart === undefined || byteEnd === undefined) return [];
		return [{ ...facet, index: { ...facet.index, byteStart, byteEnd } }];
	});
	return { text: collapsed, facets: validFacets(collapsed, mapped) };
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

export const mentionedDids = (facets: readonly Facet[] | undefined) =>
	(facets ?? []).flatMap((facet) =>
		facet.features.flatMap((feature) =>
			feature.$type === "social.colibri.beta.richtext.facet#mention" &&
			"did" in feature
				? [feature.did as Did]
				: [],
		),
	);

export const mentionsRole = (
	facets: readonly Facet[] | undefined,
	roles: readonly string[],
) => {
	if (roles.length === 0) return false;
	const owned = new Set(roles);
	return (facets ?? []).some((facet) =>
		facet.features.some(
			(feature) =>
				feature.$type === "social.colibri.beta.richtext.facet#role" &&
				"role" in feature &&
				owned.has(feature.role as string),
		),
	);
};

const LINK_FEATURE = "social.colibri.beta.richtext.facet#link";
const SPOILER_FEATURE = "social.colibri.beta.richtext.facet#spoiler";

const linkUriOf = (feature: Facet["features"][number]) =>
	feature.$type === LINK_FEATURE &&
	"uri" in feature &&
	typeof feature.uri === "string"
		? feature.uri
		: undefined;

const linkFacets = (facets: readonly Facet[] | undefined) => {
	const list = facets ?? [];
	const spoilers = list
		.filter((facet) =>
			facet.features.some((feature) => feature.$type === SPOILER_FEATURE),
		)
		.map((facet) => facet.index);
	const insideSpoiler = (index: Facet["index"]) =>
		spoilers.some(
			(spoiler) =>
				index.byteStart < spoiler.byteEnd && spoiler.byteStart < index.byteEnd,
		);
	const links: { uri: string; spoiler: boolean }[] = [];
	for (const facet of list) {
		for (const feature of facet.features) {
			const uri = linkUriOf(feature);
			if (uri) links.push({ uri, spoiler: insideSpoiler(facet.index) });
		}
	}
	return links;
};

export const linkUris = (facets: readonly Facet[] | undefined) => {
	const uris: string[] = [];
	for (const link of linkFacets(facets)) {
		if (!link.spoiler && !uris.includes(link.uri)) uris.push(link.uri);
	}
	return uris;
};

export const spoileredLinkUris = (facets: readonly Facet[] | undefined) => {
	const links = linkFacets(facets);
	const visible = new Set(
		links.filter((link) => !link.spoiler).map((link) => link.uri),
	);
	return new Set(
		links
			.filter((link) => link.spoiler && !visible.has(link.uri))
			.map((link) => link.uri),
	);
};
