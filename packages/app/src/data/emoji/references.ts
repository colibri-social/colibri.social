import type { Facet } from "../types";
import type { EmojiView } from "./model";
import type { EmojiRegistry } from "./provider";

export const CUSTOM_EMOJI_FEATURE =
	"social.colibri.beta.richtext.facet#customEmoji";

export type CustomEmojiFeature = {
	$type: typeof CUSTOM_EMOJI_FEATURE;
	uri: string;
	cid?: string;
};

export type EmojiTarget = { uri: string; cid?: string };

const SHORTCODE = /:([a-z0-9_]{2,32}):/g;
const COLIBRI_FACET = "social.colibri.beta.richtext.facet#";
const LITERAL_KINDS = new Set(["code", "codeblock", "link"]);

const encoder = new TextEncoder();
const byteLength = (text: string) => encoder.encode(text).length;

const kindOf = (feature: { $type?: string }) => {
	const type = feature.$type ?? "";
	return type.startsWith(COLIBRI_FACET) ? type.slice(COLIBRI_FACET.length) : "";
};

export const isEmojiFeature = (feature: {
	$type?: string;
}): feature is CustomEmojiFeature => feature.$type === CUSTOM_EMOJI_FEATURE;

export const emojiFeature = (emoji: EmojiView): CustomEmojiFeature => {
	const feature: CustomEmojiFeature = {
		$type: CUSTOM_EMOJI_FEATURE,
		uri: emoji.ref.uri,
	};
	if (emoji.ref.cid) feature.cid = emoji.ref.cid;
	return feature;
};

export const readEmojiFeature = (
	feature: { $type?: string } & Record<string, unknown>,
): EmojiTarget | undefined => {
	if (!isEmojiFeature(feature) || typeof feature.uri !== "string") {
		return undefined;
	}
	if (!feature.uri.startsWith("at://")) return undefined;
	return typeof feature.cid === "string"
		? { uri: feature.uri, cid: feature.cid }
		: { uri: feature.uri };
};

const overlaps = (
	facet: Facet,
	range: { byteStart: number; byteEnd: number },
) =>
	facet.index.byteStart < range.byteEnd &&
	facet.index.byteEnd > range.byteStart;

const shift = (facet: Facet, at: number, delta: number): Facet => {
	if (delta === 0 || facet.index.byteEnd < at) return facet;
	const byteStart =
		facet.index.byteStart >= at
			? facet.index.byteStart + delta
			: facet.index.byteStart;
	return {
		...facet,
		index: { byteStart, byteEnd: facet.index.byteEnd + delta },
	};
};

export const attachEmojiFacets = (options: {
	text: string;
	facets: readonly Facet[];
	lookup: (name: string) => EmojiView | undefined;
	registry: EmojiRegistry;
}): { text: string; facets: Facet[] } => {
	const { lookup, registry } = options;
	let text = options.text;
	let facets = [...options.facets];
	if (!text.includes(":")) return { text, facets };
	const matches = [...text.matchAll(SHORTCODE)].reverse();
	for (const match of matches) {
		const emoji = lookup(match[1] ?? "");
		if (!emoji || !registry.forUri(emoji.ref.uri)) continue;
		const offset = match.index ?? 0;
		const byteStart = byteLength(text.slice(0, offset));
		const range = { byteStart, byteEnd: byteStart + byteLength(match[0]) };
		const blocked = facets.some(
			(facet) =>
				overlaps(facet, range) &&
				facet.features.some(
					(feature) =>
						LITERAL_KINDS.has(kindOf(feature)) || isEmojiFeature(feature),
				),
		);
		if (blocked) continue;
		const replacement = registry.fallbackText(emoji);
		const delta = byteLength(replacement) - byteLength(match[0]);
		text =
			text.slice(0, offset) +
			replacement +
			text.slice(offset + match[0].length);
		facets = facets.map((facet) => shift(facet, range.byteEnd, delta));
		facets.push({
			index: {
				byteStart: range.byteStart,
				byteEnd: range.byteStart + byteLength(replacement),
			},
			features: [emojiFeature(emoji) as unknown as Facet["features"][number]],
		});
	}
	return {
		text,
		facets: facets.sort((a, b) => a.index.byteStart - b.index.byteStart),
	};
};
