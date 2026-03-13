import type { Facet } from "@/utils/atproto/rich-text";

export type TextWithFacets = {
	text: string;
	facets: Array<Facet>;
};

export const textEncoder = new TextEncoder();
export const textDecoder = new TextDecoder();

export type AnyFeature = Facet["features"][number];

/**
 * Convert newline characters to `<br>` tags for HTML output.
 */
const nlToBr = (s: string): string => s.replace(/\n/g, "<br>");

/**
 * Escape a string for safe use inside an HTML attribute value.
 */
const escapeAttr = (s: string): string =>
	s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/**
 * Wraps the facet's text content in the appropriate HTML element, embedding
 * `data-facet-type` (and any metadata like `data-did`, `data-uri`,
 * `data-channel`) so the reverse parser can reconstruct the facet losslessly.
 */
const applyStyleForFacet = (
	text: string,
	feature: AnyFeature,
	community?: string,
): string => {
	switch (feature.$type) {
		case "social.colibri.richtext.facet#mention": {
			const did = "did" in feature ? escapeAttr(String(feature.did)) : "";
			return `<div data-facet-type="mention" data-did="${did}" class="bg-primary/15 hover:bg-primary/25 px-1 rounded-xs cursor-pointer inline">${text}</div>`;
		}
		case "social.colibri.richtext.facet#link": {
			const uri =
				"uri" in feature ? escapeAttr(String(feature.uri)) : escapeAttr(text);
			return `<a data-facet-type="link" title="${uri}" data-uri="${uri}" href="${uri}" class="text-(--primary-hover) decoration-(--primary-hover) font-medium hover:underline inline w-fit" target="_blank">${text}</a>`;
		}
		case "social.colibri.richtext.facet#channel": {
			const channel =
				"channel" in feature ? escapeAttr(String(feature.channel)) : "";
			if (community) {
				const href = escapeAttr(`/c/${community}/${channel}`);
				return `<a data-facet-type="channel" data-channel="${channel}" href="${href}" class="bg-blue-500/15 hover:bg-blue-500/25 px-1 rounded-xs cursor-pointer inline no-underline text-foreground">${text}</a>`;
			}
			return `<div data-facet-type="channel" data-channel="${channel}" class="bg-blue-500/15 hover:bg-blue-500/25 px-1 rounded-xs cursor-pointer inline">${text}</div>`;
		}
		case "social.colibri.richtext.facet#bold":
			return `<b data-facet-type="bold" class="font-bold">${text}</b>`;
		case "social.colibri.richtext.facet#italic":
			return `<i data-facet-type="italic" class="italic">${text}</i>`;
		case "social.colibri.richtext.facet#underline":
			return `<u data-facet-type="underline" class="underline">${text}</u>`;
		case "social.colibri.richtext.facet#strikethrough":
			return `<span data-facet-type="strikethrough" class="line-through">${text}</span>`;
		case "social.colibri.richtext.facet#code":
			return `<code data-facet-type="code">${text}</code>`;
	}

	// @ts-expect-error - Fallback just to be sure
	return `[UNKNOWN FACET: ${feature.$type}]`;
};

/**
 * Renders text with facets. Facets use byte offsets into the
 * UTF-8 encoded text, so we work with the encoded bytes directly and build
 * the result string by walking through sorted, non-overlapping segments.
 *
 * When multiple facets share the same byte range, all of their features are
 * applied as nested wrappers.
 */
export const renderWithFacets = (
	input: TextWithFacets,
	community?: string,
): string => {
	const bytes = textEncoder.encode(input.text);

	const sortedFacets = [...input.facets].sort((a, b) => {
		if (a.index.byteStart !== b.index.byteStart) {
			return a.index.byteStart - b.index.byteStart;
		}
		return a.index.byteEnd - b.index.byteEnd;
	});

	type FacetGroup = {
		byteStart: number;
		byteEnd: number;
		features: AnyFeature[];
	};
	const groups: FacetGroup[] = [];

	for (const facet of sortedFacets) {
		const last = groups[groups.length - 1];
		if (
			last &&
			last.byteStart === facet.index.byteStart &&
			last.byteEnd === facet.index.byteEnd
		) {
			last.features.push(...facet.features);
		} else {
			groups.push({
				byteStart: facet.index.byteStart,
				byteEnd: facet.index.byteEnd,
				features: [...facet.features],
			});
		}
	}

	let result = "";
	let cursor = 0;

	for (const group of groups) {
		if (group.byteStart < cursor) continue;

		if (group.byteStart > cursor) {
			result += nlToBr(
				textDecoder.decode(bytes.slice(cursor, group.byteStart)),
			);
		}

		let facetText = nlToBr(
			textDecoder.decode(bytes.slice(group.byteStart, group.byteEnd)),
		);

		// If a channel mention is present, render ONLY the channel mention
		// style - other formatting features are stripped to prevent forgery.
		const channelFeature = group.features.find(
			(f) => f.$type === "social.colibri.richtext.facet#channel",
		);
		const mentionFeature = group.features.find(
			(f) => f.$type === "social.colibri.richtext.facet#mention",
		);

		if (channelFeature) {
			facetText = applyStyleForFacet(facetText, channelFeature, community);
		} else if (mentionFeature) {
			facetText = applyStyleForFacet(facetText, mentionFeature, community);
		} else {
			for (const feature of group.features) {
				facetText = applyStyleForFacet(facetText, feature, community);
			}
		}

		result += facetText;
		cursor = group.byteEnd;
	}

	if (cursor < bytes.length) {
		result += nlToBr(textDecoder.decode(bytes.slice(cursor)));
	}

	return result;
};

/**
 * Validate that a string is a well-formed http(s) URL.
 * @param value The value to check
 */
export const isValidUrl = (value: string): boolean => {
	try {
		const url = new URL(value);
		return url.protocol === "http:" || url.protocol === "https:";
	} catch {
		return false;
	}
};
