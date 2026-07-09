import { type ColibriRichTextFacet, facetsToSource } from "@colibri-social/lib";
import type { Editor, TextType } from "@tiptap/core";
import twemoji from "@twemoji/api";
import { resolveBlob } from "../../../../atproto/resolve-blob";
import type { Channel } from "../../../../atproto/xrpc/social/colibri/community/listChannels";
import type { Member } from "../../../../atproto/xrpc/social/colibri/community/listMembers";
import type { Role } from "../../../../atproto/xrpc/social/colibri/community/listRoles";
import { formatTimestamp } from "../../../../utils/format-timestamp";
import { normalizeFacets } from "../../../../utils/normalize-facets";
import type { MentionType } from "./prosemirror-to-facets";

type Feature = ColibriRichTextFacet["features"][number];
type DocNode = ReturnType<Editor["getJSON"]>["content"][number];

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const EMOJI_IMAGE_REGEX = /<img [\s\S\w\W\d\D]+\/>/gm;
const EMOJI_IMAGE_ALT_REGEX =
	/<img [\s\S\w\W\d\D]+ alt="([\W]+)" [\s\S\w\W\d\D]+\/>/gm;

const isQuote = (facet: ColibriRichTextFacet): boolean =>
	facet.features.some((f) => f.$type === "social.colibri.richtext.facet#quote");

/**
 * Formats stored text + facets back into a ProseMirror document for editing.
 */
export const facetsToProseMirror = (
	text: string,
	facets: Array<ColibriRichTextFacet>,
	members: Array<Member>,
	channels: Array<Channel>,
	roles: Array<Role>,
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

	const normalized = normalizeFacets(facets);
	const bytes = encoder.encode(text);
	const quoteFacets = normalized
		.filter(isQuote)
		.sort((a, b) => a.index.byteStart - b.index.byteStart);

	if (quoteFacets.length === 0) {
		doc.content.push(
			buildParagraph(text, normalized, members, channels, roles),
		);
		return doc;
	}

	const NEWLINE = 0x0a;

	const pushInline = (
		start: number,
		end: number,
		afterQuote: boolean,
		beforeQuote: boolean,
	): void => {
		let s = start;
		let e = end;
		if (afterQuote && s < e && bytes[s] === NEWLINE) s++;
		if (beforeQuote && e > s && bytes[e - 1] === NEWLINE) e--;
		if (e <= s) return;
		const sub = decoder.decode(bytes.slice(s, e));
		doc.content.push(
			buildParagraph(sub, rebase(normalized, s, e), members, channels, roles),
		);
	};

	let cursor = 0;
	let afterQuote = false;
	for (const quote of quoteFacets) {
		pushInline(cursor, quote.index.byteStart, afterQuote, true);

		const innerText = decoder.decode(
			bytes.slice(quote.index.byteStart, quote.index.byteEnd),
		);
		doc.content.push({
			type: "blockquote",
			content: [
				buildParagraph(
					innerText,
					rebase(normalized, quote.index.byteStart, quote.index.byteEnd),
					members,
					channels,
					roles,
				),
			],
			attrs: undefined,
		});

		cursor = quote.index.byteEnd;
		afterQuote = true;
	}
	pushInline(cursor, bytes.length, afterQuote, false);

	return doc;
};

/** Facets fully inside [start,end) (excluding quotes), re-based to that range */
function rebase(
	facets: Array<ColibriRichTextFacet>,
	start: number,
	end: number,
): Array<ColibriRichTextFacet> {
	return facets
		.filter(
			(f) =>
				!isQuote(f) && f.index.byteStart >= start && f.index.byteEnd <= end,
		)
		.map((f) => ({
			...f,
			index: {
				...f.index,
				byteStart: f.index.byteStart - start,
				byteEnd: f.index.byteEnd - start,
			},
		}));
}

/** Builds a paragraph node */
function buildParagraph(
	text: string,
	facets: Array<ColibriRichTextFacet>,
	members: Array<Member>,
	channels: Array<Channel>,
	roles: Array<Role>,
): DocNode {
	const paragraph: DocNode = {
		type: "paragraph",
		content: [],
		attrs: undefined,
	};
	if (!text) return paragraph;

	const { source, atoms } = facetsToSource(text, facets);
	const sorted = [...atoms].sort((a, b) => a.start - b.start);

	let cursor = 0;
	for (const atom of sorted) {
		if (atom.start < cursor) continue;
		if (atom.start > cursor) {
			addTextWithNewlines(paragraph, source.slice(cursor, atom.start));
		}
		paragraph.content!.push(atomNode(atom.feature, members, channels, roles));
		cursor = atom.end;
	}
	if (cursor < source.length) {
		addTextWithNewlines(paragraph, source.slice(cursor));
	}

	return paragraph;
}

function atomNode(
	feature: Feature,
	members: Array<Member>,
	channels: Array<Channel>,
	roles: Array<Role>,
): MentionType {
	if (feature.$type === "social.colibri.richtext.facet#channel") {
		const channel = channels.find((x) => x.uri === feature.channel);
		return {
			type: "mention",
			attrs: {
				id: feature.channel,
				label: channel?.name || "Unknown Channel",
				handle: null,
				avatar: null,
				type: "channel",
			},
		};
	}

	if (feature.$type === "social.colibri.richtext.facet#role") {
		const role = roles.find((x) => x.uri === feature.role);
		return {
			type: "mention",
			attrs: {
				id: feature.role,
				label: role?.name || "Unknown Role",
				handle: null,
				avatar: null,
				color: role?.color,
				type: "role",
			},
		};
	}

	if (feature.$type === "social.colibri.richtext.facet#time") {
		return {
			type: "mention",
			attrs: {
				id: null,
				label: formatTimestamp(feature.datetime, feature.style),
				avatar: null,
				handle: null,
				type: "time",
				datetime: feature.datetime,
				style: feature.style,
			},
		};
	}

	const did =
		feature.$type === "social.colibri.richtext.facet#mention"
			? feature.did
			: "";
	const member = members.find((x) => x.did === did);
	return {
		type: "mention",
		attrs: {
			id: did,
			label: member?.data.displayName || "Unknown User",
			handle: member?.handle || "handle.invalid",
			avatar:
				(member?.data.avatar
					? resolveBlob(member.did, member.data.avatar)
					: "/user-placeholder.png") ?? "/user-placeholder.png",
			type: "member",
		},
	};
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
