import { URL_REGEX } from "@atproto/api";
import {
	type ColibriRichTextFacet,
	normalizeWhitespace,
	parseMarkdown,
	type SourceFacet,
	type TimestampStyle,
} from "@colibri-social/lib";
import type { Editor, MarkType, NodeType, TextType } from "@tiptap/core";
import { shortcodeToEmoji } from "@tiptap/extension-emoji";
import { TIPTAP_EMOJIS } from "../../../../utils/emoji-data";
import {
	isValidDomain,
	MARKDOWN_LINK_POLICY,
} from "../../../../utils/link-safety";

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
				avatar: string;
				handle: string;
				type: "member";
		  }
		| {
				id: string;
				label: string;
				avatar: string | null;
				handle: null;
				community?: string | null;
				type: "channel";
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
				id: null;
				label: string;
				avatar: null;
				handle: null;
				type: "time";
				datetime: string;
				style?: TimestampStyle;
		  };
};

const textEncoder = new TextEncoder();

/**
 * Flattens the ProseMirror document into raw markdown source
 */
const docToSource = (
	content: DocContent,
): { source: string; atoms: SourceFacet[] } => {
	let source = "";
	const atoms: SourceFacet[] = [];

	const walk = (items: DocContent): void => {
		for (const item of items) {
			const isBlockLevelItem =
				item.type !== "text" &&
				item.type !== "hardBreak" &&
				item.type !== "mention" &&
				item.type !== "emoji";
			if (isBlockLevelItem && source.length > 0 && !source.endsWith("\n")) {
				source += "\n";
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
								$type: "social.colibri.richtext.facet#mention",
								did: mention.attrs.id,
							},
						],
					});
				} else if (mention.attrs.type === "channel") {
					source += `#${mention.attrs.label}`;
					atoms.push({
						start,
						end: source.length,
						features: [
							{
								$type: "social.colibri.richtext.facet#channel",
								channel: mention.attrs.id,
							},
						],
					});
				} else if (mention.attrs.type === "role") {
					source += `@${mention.attrs.label}`;
					atoms.push({
						start,
						end: source.length,
						features: [
							{
								$type: "social.colibri.richtext.facet#role",
								role: mention.attrs.id,
							},
						],
					});
				} else if (mention.attrs.type === "time") {
					source += mention.attrs.label;
					atoms.push({
						start,
						end: source.length,
						features: [
							{
								$type: "social.colibri.richtext.facet#time",
								datetime: mention.attrs.datetime,
								...(mention.attrs.style ? { style: mention.attrs.style } : {}),
							},
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

/**
 * Detects URLs in plain text that aren't already covered by a link facet
 * and adds link facets for them
 */
const detectMissingLinkFacets = (
	text: string,
	facets: Array<ColibriRichTextFacet>,
): Array<ColibriRichTextFacet> => {
	const linkedRanges: Array<[number, number]> = [];
	for (const facet of facets) {
		if (
			facet.features.some(
				(f) =>
					f.$type === "social.colibri.richtext.facet#link" ||
					f.$type === "social.colibri.richtext.facet#codeblock" ||
					f.$type === "social.colibri.richtext.facet#code",
			)
		) {
			linkedRanges.push([facet.index.byteStart, facet.index.byteEnd]);
		}
	}

	const newFacets: Array<ColibriRichTextFacet> = [];
	const re = new RegExp(URL_REGEX.source, URL_REGEX.flags);
	let match: RegExpExecArray | null;

	while ((match = re.exec(text))) {
		let uri = match[2];
		if (!uri.startsWith("http")) {
			const domain = match.groups?.domain;
			if (!domain || !isValidDomain(domain)) continue;
			uri = `https://${uri}`;
		}

		const startUtf16 = text.indexOf(match[2], match.index);
		let endUtf16 = startUtf16 + match[2].length;

		if (/[.,;:!?]$/.test(uri)) {
			uri = uri.slice(0, -1);
			endUtf16--;
		}
		if (/[)]$/.test(uri) && !uri.includes("(")) {
			uri = uri.slice(0, -1);
			endUtf16--;
		}

		const byteStart = textEncoder.encode(text.slice(0, startUtf16)).length;
		const byteEnd = textEncoder.encode(text.slice(0, endUtf16)).length;

		const alreadyLinked = linkedRanges.some(
			([s, e]) => s <= byteStart && e >= byteEnd,
		);
		if (alreadyLinked) continue;

		newFacets.push({
			$type: "social.colibri.richtext.facet",
			index: {
				$type: "app.bsky.richtext.facet#byteSlice",
				byteStart,
				byteEnd,
			},
			features: [
				{
					$type: "social.colibri.richtext.facet#link",
					uri,
				},
			],
		});
	}

	if (newFacets.length === 0) return facets;

	return [...facets, ...newFacets].sort(
		(a, b) => a.index.byteStart - b.index.byteStart,
	);
};

export const proseMirrorToFacets = (
	json: ReturnType<Editor["getJSON"]>,
): ParsedText => {
	const { source, atoms } = docToSource(json.content);
	const { text, facets } = parseMarkdown(source, atoms, MARKDOWN_LINK_POLICY);
	const withDetectedLinks = detectMissingLinkFacets(text, facets);

	return normalizeWhitespace({ text, facets: withDetectedLinks });
};
