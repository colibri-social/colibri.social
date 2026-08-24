import {
	type ColibriRichTextChannel,
	type ColibriRichTextFacet,
	type ColibriRichTextMention,
	type ColibriRichTextRole,
	type ColibriRichTextTime,
	facetsToSource,
	isTimestampStyle,
} from "@colibri-social/lib";
import type { Editor, TextType } from "@tiptap/core";
import twemoji from "@twemoji/api";
import {
	peekChannel,
	resolveChannelChip,
	UNRESOLVED_CHANNEL_LABEL,
} from "../../../../atproto/channel-reference";
import { parseColibriChannelUrl } from "../../../../atproto/colibri-channel-url";
import {
	channelSpaceCandidates,
	spaceSkey,
} from "../../../../atproto/space-ref";
import type { CommunityView } from "../../../../atproto/views";
import type {
	Category,
	Channel,
	Member,
	Role,
} from "../../../../contexts/community-payload";
import { formatTimestamp } from "../../../../utils/format-timestamp";
import { normalizeFacets } from "../../../../utils/normalize-facets";
import { channelChipAttrs } from "./insert-channel-chip";
import type { MentionType } from "./prosemirror-to-facets";

type Feature = ColibriRichTextFacet["features"][number];
type DocNode = ReturnType<Editor["getJSON"]>["content"][number];

const EMOJI_IMAGE_REGEX = /<img [\s\S\w\W\d\D]+\/>/gm;
const EMOJI_IMAGE_ALT_REGEX =
	/<img [\s\S\w\W\d\D]+ alt="([\W]+)" [\s\S\w\W\d\D]+\/>/gm;

/**
 * Formats stored text + facets back into a ProseMirror document for editing.
 */
export type ChipScope = {
	communities: Array<CommunityView>;
	categories?: Array<Category>;
	currentCommunityDid?: string;
};

const resolveChannelSpace = (
	channelSkey: string,
	channels: Array<Channel>,
	currentCommunityDid?: string,
): string | undefined => {
	const local = channels.find(
		(channel) => spaceSkey(channel.space) === channelSkey,
	);
	if (local) return local.space;
	if (!currentCommunityDid) return undefined;

	return channelSpaceCandidates(currentCommunityDid, channelSkey).find(
		(candidate) => peekChannel(candidate),
	);
};

export const facetsToProseMirror = (
	text: string,
	facets: Array<ColibriRichTextFacet>,
	members: Array<Member>,
	channels: Array<Channel>,
	roles: Array<Role>,
	scope?: ChipScope,
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

	doc.content.push(
		buildParagraph(
			text,
			normalizeFacets(facets),
			members,
			channels,
			roles,
			scope,
		),
	);

	return doc;
};

/** Builds a paragraph node */
function buildParagraph(
	text: string,
	facets: Array<ColibriRichTextFacet>,
	members: Array<Member>,
	channels: Array<Channel>,
	roles: Array<Role>,
	scope?: ChipScope,
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
		const sourceText = source.slice(atom.start, atom.end);
		const node = atomNode(
			atom.feature,
			sourceText,
			members,
			channels,
			roles,
			scope,
		);
		if (node) {
			paragraph.content!.push(node);
		} else {
			addTextWithNewlines(paragraph, sourceText);
		}
		cursor = atom.end;
	}
	if (cursor < source.length) {
		addTextWithNewlines(paragraph, source.slice(cursor));
	}

	return paragraph;
}

function atomNode(
	feature: Feature,
	sourceText: string,
	members: Array<Member>,
	channels: Array<Channel>,
	roles: Array<Role>,
	scope?: ChipScope,
): MentionType | undefined {
	if (feature.$type === "social.colibri.beta.richtext.facet#channel") {
		const channelFeature = feature as ColibriRichTextChannel;
		const space = resolveChannelSpace(
			channelFeature.channel,
			channels,
			scope?.currentCommunityDid,
		);
		const chip = space
			? resolveChannelChip(
					space,
					channels,
					scope?.communities ?? [],
					scope?.currentCommunityDid,
					scope?.categories ?? [],
				)
			: { label: UNRESOLVED_CHANNEL_LABEL };

		if (
			chip.label === UNRESOLVED_CHANNEL_LABEL &&
			parseColibriChannelUrl(sourceText)
		) {
			return undefined;
		}

		return {
			type: "mention",
			attrs: channelChipAttrs(channelFeature.channel, chip),
		};
	}

	if (feature.$type === "social.colibri.beta.richtext.facet#role") {
		const roleFeature = feature as ColibriRichTextRole;
		const role = roles.find((x) => x.rkey === roleFeature.role);
		return {
			type: "mention",
			attrs: {
				id: roleFeature.role,
				label: role?.name || "Unknown Role",
				handle: null,
				avatar: null,
				color: role?.color,
				type: "role",
			},
		};
	}

	if (feature.$type === "social.colibri.beta.richtext.facet#time") {
		const timeFeature = feature as ColibriRichTextTime;
		const style = isTimestampStyle(timeFeature.style)
			? timeFeature.style
			: undefined;
		return {
			type: "mention",
			attrs: {
				id: null,
				label: formatTimestamp(timeFeature.datetime, style),
				avatar: null,
				handle: null,
				type: "time",
				datetime: timeFeature.datetime,
				style,
			},
		};
	}

	const did =
		feature.$type === "social.colibri.beta.richtext.facet#mention"
			? (feature as ColibriRichTextMention).did
			: "";
	const member = members.find((x) => x.did === did);
	return {
		type: "mention",
		attrs: {
			id: did,
			label: member?.data.displayName || "Unknown User",
			handle: member?.handle || "handle.invalid",
			avatar: member?.data.avatar ?? "/user-placeholder.png",
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
