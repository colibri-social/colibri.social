import type { Editor, MarkType, NodeType, TextType } from "@tiptap/core";
import type { Facet } from "@/utils/atproto/rich-text";
import type { TextWithFacets } from "../RichTextRenderer";

export type ParsedText = { text: string; facets: Array<Facet> };
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

	const newFacets: Facet[] = [];
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

const walkDoc = (content: DocContent, _text: string, _facets: Array<Facet>) => {
	let text = _text;
	let facets: Array<Facet> = [];

	for (const item of content) {
		if (item.type === "hardBreak") {
			text += "\n";
			continue;
		}

		if (item.type === "mention") {
			const mentionNode = item as unknown as MentionType;

			const byteStart = textEncoder.encode(text).byteLength;

			const features: Facet["features"] = [];

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

		if (item.type === "text") {
			const textNode = item as unknown as TextType;

			const byteStart = textEncoder.encode(text).byteLength;
			text += textNode.text;
			const byteEnd = textEncoder.encode(text).byteLength;

			const features: Facet["features"] = [];

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
				facets,
			);

			text += newText;
			facets = newFacets;
		}
	}

	return {
		text,
		facets,
	};
};

const mergeFacets = (facets: Array<Facet>): Array<Facet> => {
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
		feature: Facet["features"][0];
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
	const facetMap = new Map<string, Facet>();
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

export const proseMirrorToFacets = (
	json: ReturnType<Editor["getJSON"]>,
): ParsedText => {
	const { text, facets } = walkDoc(json.content, "", []);

	const mergedFacets = mergeFacets(facets);

	return trimTextWithFacets({
		text,
		facets: mergedFacets,
	});
};
