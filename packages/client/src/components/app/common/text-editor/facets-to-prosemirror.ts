import type { ColibriRichTextFacet } from "@colibri-social/lib";
import type { Editor, TextType } from "@tiptap/core";
import twemoji from "@twemoji/api";
import { resolveBlob } from "../../../../atproto/resolve-blob";
import type { Channel } from "../../../../atproto/xrpc/social/colibri/community/listChannels";
import type { Member } from "../../../../atproto/xrpc/social/colibri/community/listMembers";
import { formatTimestamp } from "../../../../utils/format-timestamp";
import {
	buildFeatureKey,
	normalizeFacets,
} from "../../../../utils/normalize-facets";
import type { MentionType } from "./prosemirror-to-facets";

type Feature = ColibriRichTextFacet["features"][number];
type DocNode = ReturnType<Editor["getJSON"]>["content"][number];

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const EMOJI_IMAGE_REGEX = /<img [\s\S\w\W\d\D]+\/>/gm;
const EMOJI_IMAGE_ALT_REGEX =
	/<img [\s\S\w\W\d\D]+ alt="([\W]+)" [\s\S\w\W\d\D]+\/>/gm;

/**
 * Formats a given text with facets to a ProseMirror document.
 * @param text The text to convert.
 * @param facets The facets to apply.
 * @param members A list of all members, used for lookups of member facets.
 * @param channels A list of all channels, used for lookups of channel facets.
 * @returns A ProseMirror document.
 */
export const facetsToProseMirror = (
	text: string,
	facets: Array<ColibriRichTextFacet>,
	members: Array<Member>,
	channels: Array<Channel>,
): ReturnType<Editor["getJSON"]> => {
	const doc: ReturnType<Editor["getJSON"]> = {
		type: "doc",
		attrs: undefined,
		content: [],
	};

	if (!text) {
		doc.content.push({ type: "paragraph", content: [], attrs: undefined });
		return doc;
	}

	const baseEncoded = encoder.encode(text);
	const normalizedFacets = normalizeFacets(facets);

	// If no facets, just handle text and newlines in a single paragraph
	if (normalizedFacets.length === 0) {
		const paragraph: DocNode = { type: "paragraph", content: [], attrs: undefined };
		addTextWithNewlines(paragraph, text);
		doc.content.push(paragraph);
		return doc;
	}

	// Quote facets become their own top-level blockquote node; codeblock
	// facets are reconstructed as literal ```lang fenced text (handled inline
	// in buildInlineParagraphContent) since the editor keeps fences visible.
	const blockFacets = normalizedFacets
		.filter((f) =>
			f.features.some((feat) => feat.$type === "social.colibri.richtext.facet#quote"),
		)
		.sort((a, b) => a.index.byteStart - b.index.byteStart);

	type Chunk =
		| { kind: "inline"; byteStart: number; byteEnd: number }
		| { kind: "block"; facet: ColibriRichTextFacet };

	const chunks: Chunk[] = [];
	let cursor = 0;
	for (const blockFacet of blockFacets) {
		if (blockFacet.index.byteStart > cursor) {
			chunks.push({
				kind: "inline",
				byteStart: cursor,
				byteEnd: blockFacet.index.byteStart,
			});
		}
		chunks.push({ kind: "block", facet: blockFacet });
		cursor = blockFacet.index.byteEnd;
	}
	if (cursor < baseEncoded.length) {
		chunks.push({ kind: "inline", byteStart: cursor, byteEnd: baseEncoded.length });
	}

	for (const chunk of chunks) {
		if (chunk.kind === "inline") {
			if (chunk.byteStart === chunk.byteEnd) continue;
			const paragraph: DocNode = { type: "paragraph", content: [], attrs: undefined };
			buildInlineParagraphContent(
				paragraph,
				baseEncoded,
				chunk.byteStart,
				chunk.byteEnd,
				normalizedFacets,
				members,
				channels,
			);
			doc.content.push(paragraph);
			continue;
		}

		const quoteFeature = chunk.facet.features.find(
			(f) => f.$type === "social.colibri.richtext.facet#quote",
		);

		const blockText = decoder.decode(
			baseEncoded.slice(chunk.facet.index.byteStart, chunk.facet.index.byteEnd),
		);

		if (quoteFeature) {
			// Re-base facets nested inside this quote's byte range to local
			// (0-based) offsets so the same conversion logic can be reused
			// recursively for the quote's inner content.
			const innerFacets = normalizedFacets
				.filter(
					(f) =>
						f !== chunk.facet &&
						f.index.byteStart >= chunk.facet.index.byteStart &&
						f.index.byteEnd <= chunk.facet.index.byteEnd,
				)
				.map((f) => ({
					...f,
					index: {
						byteStart: f.index.byteStart - chunk.facet.index.byteStart,
						byteEnd: f.index.byteEnd - chunk.facet.index.byteStart,
					},
				}));

			const innerDoc = facetsToProseMirror(blockText, innerFacets, members, channels);

			doc.content.push({
				type: "blockquote",
				content: innerDoc.content,
				attrs: undefined,
			});
		}
	}

	return doc;
};

/**
 * Builds the inline content (text/marks/mentions) for a paragraph, scoped to
 * a byte range of the source text.
 */
function buildInlineParagraphContent(
	paragraph: DocNode,
	baseEncoded: Uint8Array,
	rangeStart: number,
	rangeEnd: number,
	normalizedFacets: Array<ColibriRichTextFacet>,
	members: Array<Member>,
	channels: Array<Channel>,
): void {
	const boundaries = new Set<number>([rangeStart, rangeEnd]);
	for (const facet of normalizedFacets) {
		if (facet.index.byteStart > rangeStart && facet.index.byteStart < rangeEnd) {
			boundaries.add(facet.index.byteStart);
		}
		if (facet.index.byteEnd > rangeStart && facet.index.byteEnd < rangeEnd) {
			boundaries.add(facet.index.byteEnd);
		}
	}
	const sortedBoundaries = [...boundaries].sort((a, b) => a - b);

	for (let i = 0; i < sortedBoundaries.length - 1; i++) {
		const start = sortedBoundaries[i];
		const end = sortedBoundaries[i + 1];
		if (start === end) continue;

		const segmentText = decoder.decode(baseEncoded.slice(start, end));

		const covering = normalizedFacets.filter(
			(facet) => facet.index.byteStart <= start && facet.index.byteEnd >= end,
		);

		if (covering.length === 0) {
			addTextWithNewlines(paragraph, segmentText);
			continue;
		}

		const features: Feature[] = [];
		const featureKeys = new Set<string>();
		for (const facet of covering) {
			for (const feature of facet.features) {
				const key = buildFeatureKey(feature);
				if (featureKeys.has(key)) continue;
				featureKeys.add(key);
				features.push(feature);
			}
		}

		const channelFeature = features.find(
			(f) => f.$type === "social.colibri.richtext.facet#channel",
		);
		const mentionFeature = features.find(
			(f) => f.$type === "social.colibri.richtext.facet#mention",
		);
		const timeFeature = features.find(
			(f) => f.$type === "social.colibri.richtext.facet#time",
		);
		const codeblockFeature = features.find(
			(f) => f.$type === "social.colibri.richtext.facet#codeblock",
		);

		if (channelFeature) {
			const channel = channels.find((x) => x.uri === channelFeature.channel);
			paragraph.content!.push({
				type: "mention",
				attrs: {
					id: channelFeature.channel,
					label: channel?.name || "Unknown Channel",
					handle: null,
					avatar: null,
					type: "channel",
				},
			});
		} else if (mentionFeature) {
			const member = members.find((x) => x.did === mentionFeature.did);
			paragraph.content!.push({
				type: "mention",
				attrs: {
					id: mentionFeature.did,
					label: member?.data.displayName || "Unknown User",
					handle: member?.handle || "handle.invalid",
					avatar: member?.data.avatar
						? resolveBlob(member.did, member.data.avatar)
						: "/user-placeholder.png",
					type: "member",
				},
			});
		} else if (timeFeature) {
			paragraph.content!.push({
				type: "mention",
				attrs: {
					id: null,
					label: formatTimestamp(timeFeature.datetime, timeFeature.style),
					avatar: null,
					handle: null,
					type: "time",
					datetime: timeFeature.datetime,
					style: timeFeature.style,
				},
			});
		} else if (codeblockFeature) {
			// Reconstruct the literal ```lang fence markers around the code so
			// the editor shows (and lets the user edit) raw markdown syntax.
			const lang = "lang" in codeblockFeature ? codeblockFeature.lang ?? "" : "";
			paragraph.content!.push(
				{ type: "text", text: `\`\`\`${lang}`, marks: [] },
				{ type: "hardBreak", attrs: undefined },
			);
			addTextWithNewlines(paragraph, segmentText);
			paragraph.content!.push(
				{ type: "hardBreak", attrs: undefined },
				{ type: "text", text: "```", marks: [] },
			);
		} else {
			const marks = features.reduce<Array<{ type: string; attrs: any }>>(
				(acc, feature) => {
					const markType = getMarkType(feature.$type);
					if (!markType) return acc;
					acc.push({
						type: markType,
						attrs: getMarkAttrs(feature) ?? null,
					});
					return acc;
				},
				[],
			);

			addMarkedTextWithNewlines(paragraph, segmentText, marks);
		}
	}
}

/**
 * Add text to a paragraph, handling newlines as hardBreak nodes and parsing emojis.
 */
function addTextWithNewlines(paragraph: any, text: string): void {
	const lines = text.split("\n");
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line.length > 0) {
			addTextNodesWithEmoji(paragraph, line);
		}
		if (i < lines.length - 1) {
			paragraph.content!.push({
				type: "hardBreak",
				attrs: undefined,
			});
		}
	}
}

/**
 * Add text nodes with marks, splitting on newlines.
 */
function addMarkedTextWithNewlines(
	paragraph: any,
	text: string,
	marks: Array<{ type: string; attrs: any }>,
): void {
	const lines = text.split("\n");
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line.length > 0) {
			paragraph.content!.push({
				type: "text",
				text: line,
				marks,
			} as TextType);
		}
		if (i < lines.length - 1) {
			paragraph.content!.push({
				type: "hardBreak",
				attrs: undefined,
			});
		}
	}
}

/**
 * Add text nodes with emoji support to a paragraph.
 */
function addTextNodesWithEmoji(paragraph: any, text: string): void {
	const textWithEmojis = twemoji.parse(text);

	const expandedNodes: Array<TextType | MentionType> = textWithEmojis
		.split(EMOJI_IMAGE_REGEX)
		.filter((x) => x.length > 0)
		.map((x) => ({
			type: "text",
			text: x,
			marks: [],
		}));

	let match: RegExpExecArray | null;
	let j = 1;

	while ((match = EMOJI_IMAGE_ALT_REGEX.exec(textWithEmojis))) {
		expandedNodes.splice(j, 0, {
			type: "mention",
			attrs: {
				type: "emoji",
				label: match[1],
				avatar: null,
				handle: null,
				id: null,
			},
		});
		j++;
	}

	paragraph.content!.push(...expandedNodes);
}

function getMarkType(featureType: string): string {
	switch (featureType) {
		case "social.colibri.richtext.facet#bold":
			return "bold";
		case "social.colibri.richtext.facet#italic":
			return "italic";
		case "social.colibri.richtext.facet#underline":
			return "underline";
		case "social.colibri.richtext.facet#strikethrough":
			return "strike";
		case "social.colibri.richtext.facet#code":
			return "code";
		case "social.colibri.richtext.facet#link":
			return "link";
		default:
			return "";
	}
}

function getMarkAttrs(feature: any): any {
	if (feature.$type === "social.colibri.richtext.facet#link") {
		return {
			href: feature.uri,
			target: "_blank",
			rel: "noopener noreferrer nofollow",
		};
	}
	return undefined;
}
