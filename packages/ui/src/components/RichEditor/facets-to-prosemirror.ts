import {
	type ColibriRichTextBridgedMention,
	type ColibriRichTextChannel,
	type ColibriRichTextFacet,
	type ColibriRichTextMention,
	type ColibriRichTextRole,
	type ColibriRichTextTime,
	facetsToSource,
	isTimestampStyle,
} from "@colibri-social/lib";
import type { Editor } from "@tiptap/core";
import { formatTimestamp } from "../../utils/rich-text/format-timestamp";
import { normalizeFacets } from "../../utils/rich-text/normalize-facets";
import { customEmojiAttrs } from "./custom-emoji";
import type { MentionType } from "./prosemirror-to-facets";
import type { ChannelChip, RichEditorSources } from "./types";

type Feature = ColibriRichTextFacet["features"][number];
type DocJSON = ReturnType<Editor["getJSON"]>;
type DocNode = DocJSON["content"][number];

export const UNKNOWN_USER_LABEL = "Unknown user";
export const UNKNOWN_ROLE_LABEL = "Unknown role";
export const UNRESOLVED_CHANNEL_LABEL = "unknown-channel";

export type FacetResolvers = Pick<
	RichEditorSources,
	| "resolveMember"
	| "resolveRole"
	| "resolveChannel"
	| "resolveThreadLink"
	| "matchChannelUrl"
	| "resolveCustomEmoji"
>;

export const channelChipAttrs = (channelId: string, chip: ChannelChip) => ({
	id: channelId,
	label: chip.label,
	handle: null,
	avatar: chip.spaceAvatarSrc ?? null,
	community: chip.spaceName ?? null,
	category: chip.category ?? null,
	type: "channel" as const,
});

const LINK_FEATURE = "social.colibri.beta.richtext.facet#link";
type ThreadLink = { uri: string; chip: ChannelChip };

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const withThreadLinks = (
	text: string,
	facets: Array<ColibriRichTextFacet>,
	resolvers: FacetResolvers,
): Array<ColibriRichTextFacet> => {
	const resolve = resolvers.resolveThreadLink;
	if (!resolve) return facets;
	const bytes = textEncoder.encode(text);
	return facets.map((facet) => {
		if (facet.features.length !== 1) return facet;
		const [feature] = facet.features;
		if (feature.$type !== LINK_FEATURE) return facet;
		const label = textDecoder.decode(
			bytes.slice(facet.index.byteStart, facet.index.byteEnd),
		);
		if (!label.startsWith("#")) return facet;
		const { uri } = feature as { uri: string };
		const chip = resolve(uri);
		if (!chip) return facet;
		const threadLink: ThreadLink = { uri, chip };
		return {
			...facet,
			features: [
				{
					$type: "social.colibri.beta.richtext.facet#channel",
					channel: uri,
					threadLink,
				} as Feature,
			],
		};
	});
};

export const facetsToProseMirror = (
	text: string,
	facets: Array<ColibriRichTextFacet>,
	resolvers: FacetResolvers = {},
): DocJSON => {
	const doc: DocJSON = { type: "doc", attrs: undefined, content: [] };

	if (!text) {
		doc.content.push({ type: "paragraph", content: [], attrs: undefined });
		return doc;
	}

	doc.content.push(buildParagraph(text, normalizeFacets(facets), resolvers));
	return doc;
};

const buildParagraph = (
	text: string,
	facets: Array<ColibriRichTextFacet>,
	resolvers: FacetResolvers,
): DocNode => {
	const paragraph: DocNode = {
		type: "paragraph",
		content: [],
		attrs: undefined,
	};
	const { source, atoms } = facetsToSource(
		text,
		withThreadLinks(text, facets, resolvers),
	);
	const sorted = [...atoms].sort((a, b) => a.start - b.start);

	let cursor = 0;
	for (const atom of sorted) {
		if (atom.start < cursor) continue;
		if (atom.start > cursor) {
			addTextWithNewlines(paragraph, source.slice(cursor, atom.start));
		}
		const sourceText = source.slice(atom.start, atom.end);
		const node = atomNode(atom.feature, sourceText, resolvers);
		if (node) paragraph.content?.push(node);
		else addTextWithNewlines(paragraph, sourceText);
		cursor = atom.end;
	}
	if (cursor < source.length) {
		addTextWithNewlines(paragraph, source.slice(cursor));
	}

	return paragraph;
};

const atomNode = (
	feature: Feature,
	sourceText: string,
	resolvers: FacetResolvers,
): MentionType | undefined => {
	switch (feature.$type) {
		case "social.colibri.beta.richtext.facet#channel": {
			const { threadLink } = feature as { threadLink?: ThreadLink };
			if (threadLink) {
				return {
					type: "mention",
					attrs: {
						...channelChipAttrs(threadLink.uri, threadLink.chip),
						uri: threadLink.uri,
					},
				};
			}
			const { channel } = feature as ColibriRichTextChannel;
			const chip = resolvers.resolveChannel?.(channel);
			if (!chip && resolvers.matchChannelUrl?.(sourceText)) return undefined;
			return {
				type: "mention",
				attrs: channelChipAttrs(
					channel,
					chip ?? { label: UNRESOLVED_CHANNEL_LABEL },
				),
			};
		}
		case "social.colibri.beta.richtext.facet#bridgedMention": {
			const bridged = feature as ColibriRichTextBridgedMention;
			return {
				type: "mention",
				attrs: {
					id: bridged.remoteId,
					label: sourceText.replace(/^@/, ""),
					avatar: null,
					handle: null,
					registration: bridged.registration,
					platform: bridged.platform,
					type: "bridged",
				},
			};
		}
		case "social.colibri.beta.richtext.facet#role": {
			const { role: id } = feature as ColibriRichTextRole;
			const role = resolvers.resolveRole?.(id);
			return {
				type: "mention",
				attrs: {
					id,
					label:
						role?.name || sourceText.replace(/^@/, "") || UNKNOWN_ROLE_LABEL,
					handle: null,
					avatar: null,
					color: role?.color,
					type: "role",
				},
			};
		}
		case "social.colibri.beta.richtext.facet#time": {
			const time = feature as ColibriRichTextTime;
			const style = isTimestampStyle(time.style) ? time.style : undefined;
			return {
				type: "mention",
				attrs: {
					id: null,
					label: formatTimestamp(time.datetime, style),
					avatar: null,
					handle: null,
					type: "time",
					datetime: time.datetime,
					style,
				},
			};
		}
		case "social.colibri.beta.richtext.facet#customEmoji" as Feature["$type"]: {
			const { uri, cid } = feature as unknown as { uri?: string; cid?: string };
			if (typeof uri !== "string") return undefined;
			const emoji = resolvers.resolveCustomEmoji?.({ uri, cid });
			if (!emoji) return undefined;
			return {
				type: "mention",
				attrs: {
					...customEmojiAttrs({ ...emoji, fallback: sourceText }),
					id: uri,
					cid: cid ?? emoji.cid ?? null,
					type: "customEmoji",
				},
			};
		}
		case "social.colibri.beta.richtext.facet#mention": {
			const { did } = feature as ColibriRichTextMention;
			const member = resolvers.resolveMember?.(did);
			return {
				type: "mention",
				attrs: {
					id: did,
					label:
						member?.name || sourceText.replace(/^@/, "") || UNKNOWN_USER_LABEL,
					handle: member?.handle ?? null,
					avatar: member?.avatarSrc ?? null,
					type: "member",
				},
			};
		}
		default:
			return undefined;
	}
};

const addTextWithNewlines = (paragraph: DocNode, text: string) => {
	const lines = text.split("\n");
	for (let index = 0; index < lines.length; index++) {
		const line = lines[index];
		if (line.length > 0) {
			paragraph.content?.push({ type: "text", text: line, marks: [] });
		}
		if (index < lines.length - 1) {
			paragraph.content?.push({ type: "hardBreak", attrs: undefined });
		}
	}
};

type LegacyNode = {
	type?: string;
	text?: string;
	attrs?: Record<string, unknown>;
	content?: LegacyNode[];
	marks?: unknown[];
};

const legacyEmojiText = (
	node: LegacyNode,
	shortcodeToChar: (name: string) => string | undefined,
): string | undefined => {
	if (node.type === "emoji") {
		const name = String(node.attrs?.name ?? "");
		return shortcodeToChar(name) ?? `:${name}:`;
	}
	if (node.type === "mention" && node.attrs?.type === "emoji") {
		return String(node.attrs.label ?? "");
	}
	return undefined;
};

export const flattenLegacyEmoji = (
	doc: DocJSON,
	shortcodeToChar: (name: string) => string | undefined,
): DocJSON => {
	const walk = (nodes: LegacyNode[] | undefined): LegacyNode[] | undefined => {
		if (!nodes) return nodes;
		const out: LegacyNode[] = [];
		for (const node of nodes) {
			const emoji = legacyEmojiText(node, shortcodeToChar);
			const value =
				emoji === undefined
					? node.content
						? { ...node, content: walk(node.content) }
						: node
					: { type: "text", text: emoji, marks: [] };
			const previous = out.at(-1);
			if (
				value.type === "text" &&
				previous?.type === "text" &&
				!previous.marks?.length &&
				!value.marks?.length
			) {
				out[out.length - 1] = {
					...previous,
					text: `${previous.text ?? ""}${value.text ?? ""}`,
				};
			} else {
				out.push(value);
			}
		}
		return out;
	};
	return {
		...doc,
		content: walk(doc.content as LegacyNode[]) as DocJSON["content"],
	};
};
