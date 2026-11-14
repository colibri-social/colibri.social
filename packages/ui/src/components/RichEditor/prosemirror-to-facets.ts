import {
	type ColibriRichTextFacet,
	type ColibriRichTextFeature,
	normalizeWhitespace,
	parseMarkdown,
	type SourceFacet,
	type TimestampStyle,
} from "@colibri-social/lib";
import type { Editor, MarkType, NodeType, TextType } from "@tiptap/core";
import { shortcodeToEmoji } from "@tiptap/extension-emoji";
import { TIPTAP_EMOJIS } from "../../utils/emoji-data";
import { MARKDOWN_LINK_POLICY } from "../../utils/rich-text/link-safety";

export type ParsedText = { text: string; facets: Array<ColibriRichTextFacet> };
type DocContent =
	| ReturnType<Editor["getJSON"]>["content"]
	| (NodeType<any, any, any, any> | TextType<MarkType<any, any>>)[];

export type MentionType = {
	type: "mention";
	attrs:
		| {
				id: string;
				label: string;
				avatar: string | null;
				handle: string | null;
				type: "member";
		  }
		| {
				id: string;
				label: string;
				avatar: string | null;
				handle: null;
				community?: string | null;
				category?: string | null;
				uri?: string | null;
				type: "channel";
		  }
		| {
				id: string;
				label: string;
				avatar: string | null;
				handle: null;
				registration: string;
				platform: string;
				type: "bridged";
		  }
		| {
				id: string;
				label: string;
				avatar: null;
				handle: null;
				color?: string;
				type: "role";
		  }
		| {
				id: null;
				label: string;
				avatar: null;
				handle: null;
				type: "emoji";
		  }
		| {
				id: string;
				label: string;
				avatar: string | null;
				handle: null;
				name: string;
				alt?: string | null;
				cid?: string | null;
				type: "customEmoji";
		  }
		| {
				id: null;
				label: string;
				avatar: null;
				handle: null;
				type: "time";
				datetime: string;
				style?: TimestampStyle;
		  };
};

const docToSource = (
	content: DocContent,
): { source: string; atoms: SourceFacet[] } => {
	let source = "";
	const atoms: SourceFacet[] = [];

	const walk = (items: DocContent): void => {
		let previousBlock = false;
		for (const item of items) {
			const isBlockLevelItem =
				item.type !== "text" &&
				item.type !== "hardBreak" &&
				item.type !== "mention" &&
				item.type !== "emoji";
			if (isBlockLevelItem) {
				if (previousBlock) source += "\n";
				previousBlock = true;
			}

			if (item.type === "hardBreak") {
				source += "\n";
				continue;
			}

			if (item.type === "mention") {
				const mention = item as unknown as MentionType;
				const start = source.length;

				if (mention.attrs.type === "member") {
					source += `@${mention.attrs.label}`;
					atoms.push({
						start,
						end: source.length,
						features: [
							{
								$type: "social.colibri.beta.richtext.facet#mention",
								did: mention.attrs.id,
							} as ColibriRichTextFeature,
						],
					});
				} else if (mention.attrs.type === "channel") {
					source += `#${mention.attrs.label}`;
					atoms.push({
						start,
						end: source.length,
						features: [
							mention.attrs.uri
								? ({
										$type: "social.colibri.beta.richtext.facet#link",
										uri: mention.attrs.uri,
									} as ColibriRichTextFeature)
								: {
										$type: "social.colibri.beta.richtext.facet#channel",
										channel: mention.attrs.id,
									},
						],
					});
				} else if (mention.attrs.type === "bridged") {
					source += `@${mention.attrs.label}`;
					atoms.push({
						start,
						end: source.length,
						features: [
							{
								$type: "social.colibri.beta.richtext.facet#bridgedMention",
								registration: mention.attrs.registration,
								platform: mention.attrs.platform,
								remoteId: mention.attrs.id,
							} as ColibriRichTextFeature,
						],
					});
				} else if (mention.attrs.type === "role") {
					source += `@${mention.attrs.label}`;
					atoms.push({
						start,
						end: source.length,
						features: [
							{
								$type: "social.colibri.beta.richtext.facet#role",
								role: mention.attrs.id,
							},
						],
					});
				} else if (mention.attrs.type === "customEmoji") {
					source += mention.attrs.label;
					atoms.push({
						start,
						end: source.length,
						features: [
							{
								$type: "social.colibri.beta.richtext.facet#customEmoji",
								uri: mention.attrs.id,
								...(mention.attrs.cid ? { cid: mention.attrs.cid } : {}),
							} as unknown as ColibriRichTextFeature,
						],
					});
				} else if (mention.attrs.type === "time") {
					source += mention.attrs.label;
					atoms.push({
						start,
						end: source.length,
						features: [
							{
								$type: "social.colibri.beta.richtext.facet#time",
								datetime: mention.attrs.datetime,
								...(mention.attrs.style ? { style: mention.attrs.style } : {}),
							} as ColibriRichTextFeature,
						],
					});
				} else {
					source += mention.attrs.label;
				}

				continue;
			}

			if (item.type === "emoji") {
				const name = (item as unknown as { attrs: { name: string } }).attrs
					.name;
				const emojiItem = shortcodeToEmoji(name, TIPTAP_EMOJIS);
				source += emojiItem?.emoji ?? `:${name}:`;
				continue;
			}

			if (item.type === "text") {
				source += (item as unknown as TextType).text;
				continue;
			}

			if ("content" in item && item.content) {
				walk(item.content);
			}
		}
	};

	walk(content);
	return { source, atoms };
};

export const proseMirrorToFacets = (
	json: ReturnType<Editor["getJSON"]>,
): ParsedText => {
	const { source, atoms } = docToSource(json.content);
	const parsed = parseMarkdown(source, atoms, {
		...MARKDOWN_LINK_POLICY,
		autolink: true,
	});

	return normalizeWhitespace(parsed);
};
