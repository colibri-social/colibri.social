import type { Editor, TextType } from "@tiptap/core";
import twemoji from "@twemoji/api";
import type { Facet } from "@/utils/atproto/rich-text";
import type { ChannelData } from "@/utils/sdk";
import type { MemberData } from "../../layouts/CommunityLayout";
import { buildFeatureKey, normalizeFacets } from "../../utils/normalize-facets";
import type { MentionType } from "./prosemirror-to-facets";

type Feature = Facet["features"][number];

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
	facets: Array<Facet>,
	members: Array<MemberData>,
	channels: Array<ChannelData>,
): ReturnType<Editor["getJSON"]> => {
	const doc: ReturnType<Editor["getJSON"]> = {
		type: "doc",
		attrs: undefined,
		content: [{ type: "paragraph", content: [], attrs: undefined }],
	};

	if (!text) {
		return doc;
	}

	const baseEncoded = encoder.encode(text);
	const paragraph = doc.content[0];
	const normalizedFacets = normalizeFacets(facets);

	// If no facets, just handle text and newlines
	if (normalizedFacets.length === 0) {
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
		return doc;
	}

	const boundaries = new Set<number>([0, baseEncoded.length]);
	for (const facet of normalizedFacets) {
		boundaries.add(facet.index.byteStart);
		boundaries.add(facet.index.byteEnd);
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

		if (channelFeature) {
			const channel = channels.find((x) => x.rkey === channelFeature.channel);
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
			const member = members.find((x) => x.member_did === mentionFeature.did);
			paragraph.content!.push({
				type: "mention",
				attrs: {
					id: mentionFeature.did,
					label: member?.display_name || "Unknown User",
					handle: member?.handle || "handle.invalid",
					avatar: member?.avatar_url || "/user-placeholder.png",
					type: "member",
				},
			});
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

	return doc;
};

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
