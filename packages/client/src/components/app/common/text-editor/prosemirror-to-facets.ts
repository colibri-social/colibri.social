import type { ColibriRichTextFacet, TimestampStyle } from "@colibri-social/lib";
import type { Editor, MarkType, NodeType, TextType } from "@tiptap/core";
import type { TextWithFacets } from "../rich-text-renderer/util";
import TLDs from "tlds";
import { URL_REGEX } from "@atproto/api";
import { createFenceRegex } from "../../../../utils/fenced-code-regex";

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
				avatar: null;
				handle: null;
				type: "channel";
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

type UsedMarkType =
	| MarkType<"bold", undefined>
	| MarkType<"italic", undefined>
	| MarkType<"strike", undefined>
	| MarkType<"underline", undefined>
	| MarkType<"code", undefined>
	| MarkType<"link", { href: string }>;

const textEncoder = new TextEncoder();

/**
 * Strips leading and trailing whitespace from the text and adjusts facet
 * byte offsets accordingly. Facets that fall entirely within the trimmed
 * regions are removed; facets that partially overlap are clamped.
 */
const trimTextWithFacets = (input: TextWithFacets): TextWithFacets => {
	const { text, facets } = input;

	const leadingMatch = text.match(/^\s+/);
	const trailingMatch = text.match(/\s+$/);
	const leadingWs = leadingMatch ? leadingMatch[0] : "";
	const trailingWs = trailingMatch ? trailingMatch[0] : "";

	if (!leadingWs && !trailingWs) return input;

	const trimmedText = text.slice(
		leadingWs.length,
		text.length - (trailingWs.length || 0),
	);

	const leadingBytes = textEncoder.encode(leadingWs).length;
	const totalBytes = textEncoder.encode(text).length;
	const trailingBytes = textEncoder.encode(trailingWs).length;
	const trimmedEndByte = totalBytes - trailingBytes;

	const newFacets: ColibriRichTextFacet[] = [];
	for (const facet of facets) {
		const newStart =
			Math.max(facet.index.byteStart, leadingBytes) - leadingBytes;
		const newEnd = Math.min(facet.index.byteEnd, trimmedEndByte) - leadingBytes;

		if (newStart >= newEnd) continue;

		newFacets.push({
			...facet,
			index: {
				byteStart: newStart,
				byteEnd: newEnd,
			},
		});
	}

	return {
		text: trimmedText,
		facets: newFacets,
	};
};

const walkDoc = (
	content: DocContent,
	_text: string,
	_facets: Array<ColibriRichTextFacet>,
) => {
	let text = _text;
	let facets: Array<ColibriRichTextFacet> = [];

	for (const item of content) {
		// Block-level siblings (paragraph, blockquote, ...) need a separator
		// between them; inline items (text/hardBreak/mention) don't.
		const isBlockLevelItem =
			item.type !== "text" && item.type !== "hardBreak" && item.type !== "mention";
		if (isBlockLevelItem && text.length > 0 && !text.endsWith("\n")) {
			text += "\n";
		}

		if (item.type === "hardBreak") {
			text += "\n";
			continue;
		}

		if (item.type === "mention") {
			const mentionNode = item as unknown as MentionType;

			const byteStart = textEncoder.encode(text).byteLength;

			const features: ColibriRichTextFacet["features"] = [];

			if (mentionNode.attrs.type === "member") {
				text += `@${mentionNode.attrs.label}`;

				features.push({
					$type: "social.colibri.richtext.facet#mention",
					did: mentionNode.attrs.id,
				});
			} else if (mentionNode.attrs.type === "channel") {
				text += `#${mentionNode.attrs.label}`;

				features.push({
					$type: "social.colibri.richtext.facet#channel",
					channel: mentionNode.attrs.id,
				});
			} else if (mentionNode.attrs.type === "time") {
				text += mentionNode.attrs.label;

				features.push({
					$type: "social.colibri.richtext.facet#time",
					datetime: mentionNode.attrs.datetime,
					...(mentionNode.attrs.style ? { style: mentionNode.attrs.style } : {}),
				});
			} else {
				text += mentionNode.attrs.label;
			}

			const byteEnd = textEncoder.encode(text).byteLength;

			facets.push({
				$type: "social.colibri.richtext.facet",
				index: {
					$type: "app.bsky.richtext.facet#byteSlice",
					byteEnd,
					byteStart,
				},
				features,
			});

			continue;
		}

		if (item.type === "blockquote") {
			const quoteNode = item as unknown as {
				type: "blockquote";
				content?: DocContent;
			};

			const byteStart = textEncoder.encode(text).byteLength;

			// Recurse independently so inline marks (bold/italic/etc) inside
			// the quote are preserved as their own facets, then re-base them
			// onto the outer text's byte offsets and keep them alongside the
			// single facet that spans the whole quote.
			const { text: innerText, facets: innerFacets } = walkDoc(
				quoteNode.content ?? [],
				"",
				[],
			);

			text += innerText;
			const byteEnd = textEncoder.encode(text).byteLength;

			for (const innerFacet of innerFacets) {
				facets.push({
					...innerFacet,
					index: {
						byteStart: innerFacet.index.byteStart + byteStart,
						byteEnd: innerFacet.index.byteEnd + byteStart,
					},
				});
			}

			facets.push({
				$type: "social.colibri.richtext.facet",
				index: { byteStart, byteEnd },
				features: [{ $type: "social.colibri.richtext.facet#quote" }],
			});

			continue;
		}

		if (item.type === "text") {
			const textNode = item as unknown as TextType;

			const byteStart = textEncoder.encode(text).byteLength;
			text += textNode.text;
			const byteEnd = textEncoder.encode(text).byteLength;

			const features: ColibriRichTextFacet["features"] = [];

			for (const mark of (textNode.marks as Array<UsedMarkType>) || []) {
				switch (mark.type) {
					case "bold":
						features.push({
							$type: "social.colibri.richtext.facet#bold",
						});
						break;
					case "code":
						features.push({
							$type: "social.colibri.richtext.facet#code",
						});
						break;
					case "italic":
						features.push({
							$type: "social.colibri.richtext.facet#italic",
						});
						break;
					case "strike":
						features.push({
							$type: "social.colibri.richtext.facet#strikethrough",
						});
						break;
					case "underline":
						features.push({
							$type: "social.colibri.richtext.facet#underline",
						});
						break;
					case "link":
						features.push({
							$type: "social.colibri.richtext.facet#link",
							uri: mark.attrs.href,
						});
						break;
					default:
						console.warn("Mark ignored:", mark);
						break;
				}
			}

			facets.push({
				$type: "social.colibri.richtext.facet",
				index: {
					$type: "app.bsky.richtext.facet#byteSlice",
					byteEnd,
					byteStart,
				},
				features,
			});

			continue;
		}

		if ("content" in item) {
			const { text: newText, facets: newFacets } = walkDoc(
				item.content,
				text,
				[],
			);

			text = newText;
			facets.push(...newFacets);
		}
	}

	return {
		text,
		facets,
	};
};

const mergeFacets = (
	facets: Array<ColibriRichTextFacet>,
): Array<ColibriRichTextFacet> => {
	const sorted = [...facets].sort(
		(a, b) => a.index.byteStart - b.index.byteStart,
	);

	// Collect all unique feature types across all facets
	const featureTypes = [
		...new Set(sorted.flatMap((f) => f.features.map((feat) => feat.$type))),
	];

	// For each feature type, find contiguous chains and merge them
	const resultEntries: Array<{
		byteStart: number;
		byteEnd: number;
		feature: ColibriRichTextFacet["features"][0];
	}> = [];

	for (const featureType of featureTypes) {
		const withFeature = sorted.filter((f) =>
			f.features.some((feat) => feat.$type === featureType),
		);

		let i = 0;
		while (i < withFeature.length) {
			// Walk forward as long as facets are contiguous
			let j = i + 1;
			while (
				j < withFeature.length &&
				withFeature[j - 1].index.byteEnd === withFeature[j].index.byteStart
			) {
				j++;
			}

			// Merge the chain [i, j) into a single span
			resultEntries.push({
				byteStart: withFeature[i].index.byteStart,
				byteEnd: withFeature[j - 1].index.byteEnd,
				feature: withFeature[i].features.find((f) => f.$type === featureType)!,
			});

			i = j;
		}
	}

	// Re-group entries by their (byteStart, byteEnd) span into facets
	const facetMap = new Map<string, ColibriRichTextFacet>();
	for (const { byteStart, byteEnd, feature } of resultEntries) {
		const key = `${byteStart}:${byteEnd}`;
		if (!facetMap.has(key)) {
			facetMap.set(key, {
				$type: "social.colibri.richtext.facet",
				index: { byteStart, byteEnd },
				features: [],
			});
		}
		facetMap.get(key)!.features.push(feature);
	}

	return [...facetMap.values()].sort(
		(a, b) => a.index.byteStart - b.index.byteStart,
	);
};

type FenceMatchIndices = RegExpMatchArray & { indices: Array<[number, number]> };

/**
 * Detects ```lang fenced code blocks in the raw message text (kept as plain
 * markdown while editing — see MarkdownCodeHighlight) and converts them to a
 * `codeblock` facet, stripping the fence delimiter lines from the stored
 * text/byte offsets so the rendered message shows a clean highlighted block
 * instead of literal backticks.
 */
const detectFencedCodeBlocks = (
	text: string,
	facets: Array<ColibriRichTextFacet>,
): { text: string; facets: Array<ColibriRichTextFacet> } => {
	const matches = [...text.matchAll(createFenceRegex())] as FenceMatchIndices[];
	if (matches.length === 0) return { text, facets };

	const byteOffsetOf = (utf16Index: number): number =>
		textEncoder.encode(text.slice(0, utf16Index)).byteLength;

	const removedByteRanges: Array<{ byteStart: number; byteEnd: number }> = [];
	const codeByteRanges: Array<{
		byteStart: number;
		byteEnd: number;
		lang?: string;
	}> = [];

	let newText = "";
	let cursor = 0;
	for (const match of matches) {
		const [matchStart, matchEnd] = match.indices[0];
		const [codeStart, codeEnd] = match.indices[2];
		const lang = match[1];

		newText += text.slice(cursor, matchStart);
		newText += text.slice(codeStart, codeEnd);
		cursor = matchEnd;

		removedByteRanges.push({
			byteStart: byteOffsetOf(matchStart),
			byteEnd: byteOffsetOf(codeStart),
		});
		removedByteRanges.push({
			byteStart: byteOffsetOf(codeEnd),
			byteEnd: byteOffsetOf(matchEnd),
		});
		codeByteRanges.push({
			byteStart: byteOffsetOf(codeStart),
			byteEnd: byteOffsetOf(codeEnd),
			lang: lang || undefined,
		});
	}
	newText += text.slice(cursor);

	const sortedRemoved = [...removedByteRanges].sort(
		(a, b) => a.byteStart - b.byteStart,
	);

	const mapOffset = (oldOffset: number): number => {
		let delta = 0;
		for (const r of sortedRemoved) {
			if (r.byteEnd <= oldOffset) delta += r.byteEnd - r.byteStart;
		}
		return oldOffset - delta;
	};

	const remappedFacets = facets
		.filter(
			(f) =>
				!sortedRemoved.some(
					(r) => r.byteStart <= f.index.byteStart && r.byteEnd >= f.index.byteEnd,
				),
		)
		.map((f) => ({
			...f,
			index: {
				byteStart: mapOffset(f.index.byteStart),
				byteEnd: mapOffset(f.index.byteEnd),
			},
		}));

	for (const range of codeByteRanges) {
		remappedFacets.push({
			$type: "social.colibri.richtext.facet",
			index: {
				byteStart: mapOffset(range.byteStart),
				byteEnd: mapOffset(range.byteEnd),
			},
			features: [
				{
					$type: "social.colibri.richtext.facet#codeblock",
					...(range.lang ? { lang: range.lang } : {}),
				},
			],
		});
	}

	return {
		text: newText,
		facets: remappedFacets.sort((a, b) => a.index.byteStart - b.index.byteStart),
	};
};

const isValidDomain = (str: string): boolean =>
	!!TLDs.find((tld) => {
		const i = str.lastIndexOf(tld);
		if (i === -1) return false;
		return str.charAt(i - 1) === "." && i === str.length - tld.length;
	});

/**
 * Detects URLs in plain text that aren't already covered by a link facet
 * and adds link facets for them. This handles cases where Tiptap's autolink
 * hasn't applied the link mark yet (e.g. URL at the end of the message
 * submitted without a trailing space).
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
					f.$type === "social.colibri.richtext.facet#codeblock",
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
	const { text, facets } = walkDoc(json.content, "", []);

	const mergedFacets = mergeFacets(facets);
	const { text: textWithCodeBlocks, facets: facetsWithCodeBlocks } =
		detectFencedCodeBlocks(text, mergedFacets);
	const withDetectedLinks = detectMissingLinkFacets(
		textWithCodeBlocks,
		facetsWithCodeBlocks,
	);

	return trimTextWithFacets({
		text: textWithCodeBlocks,
		facets: withDetectedLinks,
	});
};
