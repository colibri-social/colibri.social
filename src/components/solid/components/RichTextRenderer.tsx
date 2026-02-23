import type { Facet } from "@/utils/atproto/rich-text";
import { detectFacets } from "@/utils/atproto/rich-text/detection";
import { UnicodeString } from "@/utils/atproto/rich-text/unicode";
import twemoji from "@twemoji/api";
import type { Accessor, Component, Setter } from "solid-js";

export type TextWithFacets = {
	text: string;
	facets: Array<Facet>;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

type AnyFeature = Facet["features"][number];

/** Convert newline characters to `<br>` tags for HTML output. */
const nlToBr = (s: string): string => s.replace(/\n/g, "<br>");

/** Escape a string for safe use inside an HTML attribute value. */
const escapeAttr = (s: string): string =>
	s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/**
 * Wraps the facet's text content in the appropriate HTML element, embedding
 * `data-facet-type` (and any metadata like `data-did`, `data-uri`,
 * `data-channel`) so the reverse parser can reconstruct the facet losslessly.
 */
const applyStyleForFacet = (text: string, feature: AnyFeature): string => {
	switch (feature.$type) {
		case "app.bsky.richtext.facet#mention": {
			const did = "did" in feature ? escapeAttr(String(feature.did)) : "";
			return `<div data-facet-type="mention" data-did="${did}" class="bg-primary/15 hover:bg-primary/25 px-1 rounded-xs cursor-pointer inline">${text}</div>`;
		}
		case "app.bsky.richtext.facet#link": {
			const uri =
				"uri" in feature ? escapeAttr(String(feature.uri)) : escapeAttr(text);
			return `<a data-facet-type="link" data-uri="${uri}" href="${uri}" class="text-primary-foreground font-medium hover:underline inline w-fit" target="_blank">${text}</a>`;
		}
		case "app.bsky.richtext.facet#tag": {
			const tag = "tag" in feature ? escapeAttr(String(feature.tag)) : "";
			return `<div data-facet-type="tag" data-tag="${tag}" class="bg-primary/15 hover:bg-primary/25 px-1 rounded-xs cursor-pointer inline">${text}</div>`;
		}
		case "social.colibri.richtext.facet#channel": {
			const channel =
				"channel" in feature ? escapeAttr(String(feature.channel)) : "";
			return `<div data-facet-type="channel" data-channel="${channel}" class="bg-blue-500/15 hover:bg-blue-500/25 px-1 rounded-xs cursor-pointer inline">${text}</div>`;
		}
		case "social.colibri.richtext.facet#bold":
			return `<b data-facet-type="bold" class="font-bold">${text}</b>`;
		case "social.colibri.richtext.facet#italic":
			return `<i data-facet-type="italic" class="italic">${text}</i>`;
		case "social.colibri.richtext.facet#underline":
			return `<u data-facet-type="underline" class="underline">${text}</u>`;
		case "social.colibri.richtext.facet#strikethrough":
			return `<span data-facet-type="strikethrough" class="line-through">${text}</span>`;
		case "social.colibri.richtext.facet#code":
			return `<code data-facet-type="code">${text}</code>`;
	}

	return "UNKNOWN";
};

/**
 * Renders text with facets in a single pass. Facets use byte offsets into the
 * UTF-8 encoded text, so we work with the encoded bytes directly and build
 * the result string by walking through sorted, non-overlapping segments.
 *
 * When multiple facets share the same byte range, all of their features are
 * applied as nested wrappers.
 */
const renderWithFacets = (input: TextWithFacets): string => {
	const bytes = textEncoder.encode(input.text);

	// Sort facets by byteStart, then by byteEnd (ascending) so that for
	// overlapping ranges the narrower one comes first.
	const sortedFacets = [...input.facets].sort((a, b) => {
		if (a.index.byteStart !== b.index.byteStart) {
			return a.index.byteStart - b.index.byteStart;
		}
		return a.index.byteEnd - b.index.byteEnd;
	});

	// Group facets that cover the exact same byte range so we can apply all
	// their features together.
	type FacetGroup = {
		byteStart: number;
		byteEnd: number;
		features: AnyFeature[];
	};
	const groups: FacetGroup[] = [];

	for (const facet of sortedFacets) {
		const last = groups[groups.length - 1];
		if (
			last &&
			last.byteStart === facet.index.byteStart &&
			last.byteEnd === facet.index.byteEnd
		) {
			// Same range – merge features into the existing group
			last.features.push(...facet.features);
		} else {
			groups.push({
				byteStart: facet.index.byteStart,
				byteEnd: facet.index.byteEnd,
				features: [...facet.features],
			});
		}
	}

	let result = "";
	let cursor = 0;

	for (const group of groups) {
		// Skip facets that would go backwards (overlapping ranges that aren't
		// identical – we already grouped identical ranges above).
		if (group.byteStart < cursor) continue;

		// Append plain text before this facet group
		if (group.byteStart > cursor) {
			result += nlToBr(
				textDecoder.decode(bytes.slice(cursor, group.byteStart)),
			);
		}

		// Decode the facet's text and wrap it with all applicable styles
		let facetText = nlToBr(
			textDecoder.decode(bytes.slice(group.byteStart, group.byteEnd)),
		);

		for (const feature of group.features) {
			facetText = applyStyleForFacet(facetText, feature);
		}

		result += facetText;
		cursor = group.byteEnd;
	}

	// Append any remaining text after the last facet
	if (cursor < bytes.length) {
		result += nlToBr(textDecoder.decode(bytes.slice(cursor)));
	}

	return result;
};

/**
 * Reconstruct a single facet feature from the `data-facet-type` (and related
 * data attributes) stored on an HTML element produced by `applyStyleForFacet`.
 * Returns `null` when the element doesn't carry facet metadata.
 */
const featureFromElement = (el: HTMLElement): AnyFeature | null => {
	const facetType = el.dataset.facetType;
	if (!facetType) return null;

	switch (facetType) {
		case "mention":
			return {
				$type: "app.bsky.richtext.facet#mention",
				did: el.dataset.did || "",
			};
		case "link":
			return {
				$type: "app.bsky.richtext.facet#link",
				uri: el.dataset.uri || (el as HTMLAnchorElement).href || "",
			};
		case "tag":
			return {
				$type: "app.bsky.richtext.facet#tag",
				tag: el.dataset.tag || "",
			};
		case "channel":
			return {
				$type: "social.colibri.richtext.facet#channel",
				channel: el.dataset.channel || "",
			};
		case "bold":
			return {
				$type: "social.colibri.richtext.facet#bold",
			};
		case "italic":
			return {
				$type: "social.colibri.richtext.facet#italic",
			};
		case "underline":
			return {
				$type: "social.colibri.richtext.facet#underline",
			};
		case "strikethrough":
			return {
				$type: "social.colibri.richtext.facet#strikethrough",
			};
		case "code":
			return {
				$type: "social.colibri.richtext.facet#code",
			};
		default:
			return null;
	}
};

/**
 * Walk the DOM tree of a `contentEditable` element and produce a
 * {@link TextWithFacets} value that mirrors the visible content plus any
 * facets that were encoded as `data-facet-type` attributes.
 *
 * Special cases handled:
 * - `<img class="emoji">` (twemoji) → original emoji character from `alt`
 * - `<br>` → newline
 * - Block-level elements without facet data (e.g. `<div>` wrappers injected
 *   by `contentEditable`) → newline before their content
 */
const parseDomToFacets = (root: HTMLElement): TextWithFacets => {
	const facets: Facet[] = [];
	let text = "";

	const BLOCK_TAGS = new Set([
		"DIV",
		"P",
		"BLOCKQUOTE",
		"LI",
		"OL",
		"UL",
		"H1",
		"H2",
		"H3",
		"H4",
		"H5",
		"H6",
	]);

	const walk = (node: Node, isFirstChild: boolean): void => {
		// Plain text
		if (node.nodeType === Node.TEXT_NODE) {
			text += node.textContent || "";
			return;
		}

		if (node.nodeType !== Node.ELEMENT_NODE) return;
		const el = node as HTMLElement;

		// Twemoji images → restore the original emoji from the alt attribute
		if (el.tagName === "IMG" && el.classList.contains("emoji")) {
			text += el.getAttribute("alt") || "";
			return;
		}

		// <br> → newline
		if (el.tagName === "BR") {
			text += "\n";
			return;
		}

		const feature = featureFromElement(el);

		// Non-facet block elements produced by contentEditable (e.g. pressing
		// Enter wraps the new line in a <div>). Insert a newline before the
		// block unless we're at the very start.
		const isBlockWrapper = !feature && BLOCK_TAGS.has(el.tagName);
		if (
			isBlockWrapper &&
			!isFirstChild &&
			text.length > 0 &&
			!text.endsWith("\n")
		) {
			text += "\n";
		}

		// Record the byte position *before* we recurse into children so we
		// know where this facet starts.
		const byteStart = textEncoder.encode(text).byteLength;

		const children = el.childNodes;
		for (let i = 0; i < children.length; i++) {
			walk(children[i], i === 0);
		}

		if (feature) {
			const byteEnd = textEncoder.encode(text).byteLength;
			facets.push({
				index: { byteStart, byteEnd },
				features: [feature],
			} as Facet);
		}
	};

	const topChildren = root.childNodes;
	for (let i = 0; i < topChildren.length; i++) {
		walk(topChildren[i], i === 0);
	}

	return { text, facets };
};

/**
 * After the DOM has been parsed back into facets, run the automatic pattern
 * detectors (`detectFacets`) over the plain text to discover any *new*
 * mentions, links or channels the user may have typed. Detected facets that
 * overlap with an existing DOM-sourced facet are discarded so that
 * metadata-rich facets (e.g. those carrying a resolved DID) are never
 * overwritten.
 */
const mergeWithDetectedFacets = (parsed: TextWithFacets): TextWithFacets => {
	const unicodeText = new UnicodeString(parsed.text);
	const detected = detectFacets(unicodeText);

	if (!detected || detected.length === 0) return parsed;

	const merged = [...parsed.facets];

	for (const detectedFacet of detected) {
		const overlaps = parsed.facets.some(
			(existing) =>
				detectedFacet.index.byteStart < existing.index.byteEnd &&
				detectedFacet.index.byteEnd > existing.index.byteStart,
		);

		if (!overlaps) {
			merged.push(detectedFacet);
		}
	}

	return {
		text: parsed.text,
		facets: merged.sort((a, b) => a.index.byteStart - b.index.byteStart),
	};
};

export const RichTextRenderer: Component<{
	editable?: boolean;
	text: Accessor<TextWithFacets>;
	setInputContent: Setter<TextWithFacets>;
}> = (props) => {
	const rendered = renderWithFacets(props.text());
	const renderedWithEmojis = twemoji.parse(rendered);

	return (
		<p
			class="m-0 rich-text focus:outline-0"
			contentEditable={props.editable}
			innerHTML={renderedWithEmojis}
			onInput={(e) => {
				const parsed = parseDomToFacets(e.currentTarget);
				const result = mergeWithDetectedFacets(parsed);
				props.setInputContent(result);
			}}
		/>
	);
};
