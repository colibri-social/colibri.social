import twemoji from "@twemoji/api";
import {
	type Accessor,
	type Component,
	createEffect,
	createSignal,
	on,
	onCleanup,
	onMount,
	type ParentComponent,
	type Setter,
	Show,
	type JSX,
} from "solid-js";
import { Portal } from "solid-js/web";
import type { Facet } from "@/utils/atproto/rich-text";
import { detectFacets } from "@/utils/atproto/rich-text/detection";
import { UnicodeString } from "@/utils/atproto/rich-text/unicode";
import { Bold } from "../icons/Bold";
import { Code } from "../icons/Code";
import { Italic } from "../icons/Italic";
import { Link } from "../icons/Link";
import { Strikethrough } from "../icons/Strikethrough";
import { Underline } from "../icons/Underline";
import { Button } from "../shadcn-solid/Button";
import {
	Popover,
	PopoverContent,
	PopoverPortal,
	PopoverTrigger,
} from "../shadcn-solid/Popover";
import {
	TextField,
	TextFieldErrorMessage,
	TextFieldInput,
	TextFieldLabel,
} from "../shadcn-solid/text-field";

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
		case "social.colibri.richtext.facet#mention": {
			const did = "did" in feature ? escapeAttr(String(feature.did)) : "";
			return `<div data-facet-type="mention" data-did="${did}" class="bg-primary/15 hover:bg-primary/25 px-1 rounded-xs cursor-pointer inline">${text}</div>`;
		}
		case "social.colibri.richtext.facet#link": {
			const uri =
				"uri" in feature ? escapeAttr(String(feature.uri)) : escapeAttr(text);
			return `<a data-facet-type="link" title="${uri}" data-uri="${uri}" href="${uri}" class="text-primary-foreground font-medium hover:underline inline w-fit" target="_blank">${text}</a>`;
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

	// @ts-expect-error
	return `[UNKNOWN FACET: ${feature.$type}]`;
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
				$type: "social.colibri.richtext.facet#mention",
				did: el.dataset.did || "",
			};
		case "link":
			return {
				$type: "social.colibri.richtext.facet#link",
				uri: el.dataset.uri || (el as HTMLAnchorElement).href || "",
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
 * Strip auto-detected link facets from the parsed output so that
 * {@link mergeWithDetectedFacets} can re-detect them with the correct,
 * up-to-date byte range. This is necessary because `contentEditable`
 * browsers often place newly typed characters *outside* the `<a>` tag,
 * causing the DOM-sourced facet to cover only part of the URL while the
 * user continues typing.
 *
 * A link is considered "auto-detected" when its covered text contains no
 * whitespace (URL-like) and the stored `uri` is a valid URL. Manually
 * labelled links (e.g. "click here" → https://…) contain whitespace in
 * their text and are preserved.
 */
const stripAutoDetectedLinks = (parsed: TextWithFacets): TextWithFacets => {
	const bytes = textEncoder.encode(parsed.text);
	let changed = false;

	const adjustedFacets: Facet[] = [];

	for (const facet of parsed.facets) {
		const linkFeature = facet.features.find(
			(f) => f.$type === "social.colibri.richtext.facet#link",
		);

		if (!linkFeature) {
			adjustedFacets.push(facet);
			continue;
		}

		const facetText = textDecoder.decode(
			bytes.slice(facet.index.byteStart, facet.index.byteEnd),
		);
		const currentUri = "uri" in linkFeature ? String(linkFeature.uri) : "";

		// Auto-detected links have URL-like text (no whitespace) and a
		// valid stored URI. Strip the link feature so detectFacets can
		// re-add it at the correct range. Manual labelled links whose
		// text contains whitespace are kept as-is.
		const isAutoDetected = !/\s/.test(facetText) && isValidUrl(currentUri);

		if (isAutoDetected) {
			changed = true;
			// Preserve any non-link features on this range (e.g. bold)
			const otherFeatures = facet.features.filter(
				(f) => f.$type !== "social.colibri.richtext.facet#link",
			);
			if (otherFeatures.length > 0) {
				adjustedFacets.push({
					...facet,
					features: otherFeatures,
				} as Facet);
			}
			// else: drop the entire facet
		} else {
			adjustedFacets.push(facet);
		}
	}

	return changed ? { text: parsed.text, facets: adjustedFacets } : parsed;
};

/**
 * Deep-compare two facet arrays to determine whether the DOM needs to be
 * re-rendered. Compares byte ranges, feature types, and metadata fields
 * (uri, did, channel) so that only meaningful changes trigger a re-render.
 */
const facetsChanged = (a: Facet[], b: Facet[]): boolean => {
	if (a.length !== b.length) return true;
	for (let i = 0; i < a.length; i++) {
		const fa = a[i];
		const fb = b[i];
		if (fa.index.byteStart !== fb.index.byteStart) return true;
		if (fa.index.byteEnd !== fb.index.byteEnd) return true;
		if (fa.features.length !== fb.features.length) return true;
		for (let j = 0; j < fa.features.length; j++) {
			if (fa.features[j].$type !== fb.features[j].$type) return true;
			const af = fa.features[j] as Record<string, unknown>;
			const bf = fb.features[j] as Record<string, unknown>;
			if (af.uri !== bf.uri || af.did !== bf.did || af.channel !== bf.channel)
				return true;
		}
	}
	return false;
};

/**
 * After the DOM has been parsed back into facets, run the automatic pattern
 * detectors (`detectFacets`) over the plain text to discover any *new*
 * mentions, links or channels the user may have typed. Detected facets that
 * overlap with an existing **non-formatting** DOM-sourced facet (i.e. links,
 * mentions, channels) are discarded so that metadata-rich facets (e.g. those
 * carrying a resolved DID) are never overwritten. Formatting-only facets
 * (bold, italic, etc.) do not block detection.
 */
const mergeWithDetectedFacets = (parsed: TextWithFacets): TextWithFacets => {
	const unicodeText = new UnicodeString(parsed.text);
	const detected = detectFacets(unicodeText);

	if (!detected || detected.length === 0) return parsed;

	const FORMATTING_TYPES = new Set([
		"social.colibri.richtext.facet#bold",
		"social.colibri.richtext.facet#italic",
		"social.colibri.richtext.facet#underline",
		"social.colibri.richtext.facet#strikethrough",
		"social.colibri.richtext.facet#code",
	]);

	const merged = [...parsed.facets];

	for (const detectedFacet of detected) {
		const overlaps = parsed.facets.some(
			(existing) =>
				// Only non-formatting facets block detection
				existing.features.some((f) => !FORMATTING_TYPES.has(f.$type)) &&
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

/**
 * Strips leading and trailing whitespace from the text and adjusts facet
 * byte offsets accordingly. Facets that fall entirely within the trimmed
 * regions are removed; facets that partially overlap are clamped.
 */
export const trimTextWithFacets = (input: TextWithFacets): TextWithFacets => {
	const { text, facets } = input;

	// Find leading and trailing whitespace in the original string
	const leadingMatch = text.match(/^\s+/);
	const trailingMatch = text.match(/\s+$/);
	const leadingWs = leadingMatch ? leadingMatch[0] : "";
	const trailingWs = trailingMatch ? trailingMatch[0] : "";

	if (!leadingWs && !trailingWs) return input;

	const trimmedText = text.slice(
		leadingWs.length,
		text.length - (trailingWs.length || 0),
	);

	// Compute byte-level boundaries for the trimmed region
	const leadingBytes = textEncoder.encode(leadingWs).length;
	const totalBytes = textEncoder.encode(text).length;
	const trailingBytes = textEncoder.encode(trailingWs).length;
	const trimmedEndByte = totalBytes - trailingBytes;

	const newFacets: Facet[] = [];
	for (const facet of facets) {
		// Clamp the facet to the trimmed byte region
		const newStart =
			Math.max(facet.index.byteStart, leadingBytes) - leadingBytes;
		const newEnd = Math.min(facet.index.byteEnd, trimmedEndByte) - leadingBytes;

		// Discard facets that are entirely outside the trimmed region
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

const ToolbarButton: ParentComponent<{
	onClick?: (e: MouseEvent) => void;
	active?: boolean;
}> = (props) => (
	<button
		type="button"
		class="w-8 h-8 flex items-center justify-center cursor-pointer hover:bg-muted/50"
		classList={{ "bg-muted": !!props.active }}
		onMouseDown={(e) => e.preventDefault()}
		onClick={props.onClick}
	>
		{props.children}
	</button>
);

const getSelectionPixels = (selection: Selection | null) => {
	if (!selection || selection.rangeCount === 0) return null;

	const range = selection.getRangeAt(0);

	// Try collapsing to start for a precise caret position
	const collapsed = range.cloneRange();
	collapsed.collapse(true);
	let rect = collapsed.getBoundingClientRect();

	// Fall back to the full range rect when the collapsed rect is degenerate
	// (e.g. Ctrl+A selects everything and the collapsed range sits at an
	// element boundary where getBoundingClientRect returns all zeros)
	if (rect.height === 0) {
		rect = range.getBoundingClientRect();
	}

	if (rect.height === 0) return null;

	return {
		top: rect.top + window.scrollY,
		left: rect.left + window.scrollX,
		bottom: rect.bottom + window.scrollY,
		height: rect.height,
	};
};

type ToolbarPosition = {
	top: number;
	left: number;
	bottom: number;
	height: number;
};

type ToolbarState = {
	position: ToolbarPosition;
	selection: Selection;
	range: Range;
	isBackward: boolean;
	activeFormats: Set<string>;
};

/**
 * Walk the DOM tree of a `contentEditable` element — mirroring the exact same
 * text-construction logic used by {@link parseDomToFacets} — and map a
 * browser {@link Range}'s start/end boundaries to UTF-8 byte offsets within
 * that text.
 *
 * This correctly handles multi-line selections where `startContainer` and
 * `endContainer` live in completely different DOM subtrees.
 */
const getSelectionByteOffsets = (
	root: HTMLElement,
	range: Range,
): {
	byteStart: number;
	byteEnd: number;
	charStart: number;
	charEnd: number;
} | null => {
	let text = "";
	let startCharOffset: number | null = null;
	let endCharOffset: number | null = null;

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

	/** Check whether a range boundary targets `container` at child-index `childIndex`. */
	const checkElementBoundary = (container: Node, childIndex: number) => {
		if (
			range.startContainer === container &&
			range.startOffset === childIndex &&
			startCharOffset === null
		) {
			startCharOffset = text.length;
		}
		if (
			range.endContainer === container &&
			range.endOffset === childIndex &&
			endCharOffset === null
		) {
			endCharOffset = text.length;
		}
	};

	/** Walk all children of `parent`, checking element-level boundaries before each child and after the last. */
	const walkChildren = (parent: Node) => {
		const children = parent.childNodes;
		for (let i = 0; i < children.length; i++) {
			checkElementBoundary(parent, i);
			walk(children[i], i === 0);
		}
		checkElementBoundary(parent, children.length);
	};

	const walk = (node: Node, isFirstChild: boolean): void => {
		// Plain text
		if (node.nodeType === Node.TEXT_NODE) {
			const content = node.textContent || "";
			const nodeStart = text.length;

			if (range.startContainer === node && startCharOffset === null) {
				startCharOffset = nodeStart + range.startOffset;
			}
			if (range.endContainer === node && endCharOffset === null) {
				endCharOffset = nodeStart + range.endOffset;
			}

			text += content;
			return;
		}

		if (node.nodeType !== Node.ELEMENT_NODE) return;
		const el = node as HTMLElement;

		// Twemoji images → original emoji character from alt
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

		// Non-facet block wrappers injected by contentEditable
		const isBlockWrapper = !feature && BLOCK_TAGS.has(el.tagName);
		if (
			isBlockWrapper &&
			!isFirstChild &&
			text.length > 0 &&
			!text.endsWith("\n")
		) {
			text += "\n";
		}

		walkChildren(el);
	};

	walkChildren(root);

	if (startCharOffset === null || endCharOffset === null) return null;

	const byteStart = textEncoder.encode(
		text.substring(0, startCharOffset),
	).byteLength;
	const byteEnd = textEncoder.encode(
		text.substring(0, endCharOffset),
	).byteLength;

	return {
		byteStart,
		byteEnd,
		charStart: startCharOffset,
		charEnd: endCharOffset,
	};
};

/** Map a toolbar format name to the corresponding facet feature. */
const formatTypeToFeature = (type: string, uri?: string): AnyFeature | null => {
	switch (type) {
		case "bold":
			return { $type: "social.colibri.richtext.facet#bold" };
		case "italic":
			return { $type: "social.colibri.richtext.facet#italic" };
		case "underline":
			return { $type: "social.colibri.richtext.facet#underline" };
		case "strikethrough":
			return { $type: "social.colibri.richtext.facet#strikethrough" };
		case "code":
			return { $type: "social.colibri.richtext.facet#code" };
		case "link":
			return { $type: "social.colibri.richtext.facet#link", uri: uri ?? "" };
		default:
			return null;
	}
};

/**
 * Check whether the **entire** byte range `[byteStart, byteEnd)` is covered
 * by facets of the given `featureType`. Multiple adjacent/overlapping facets
 * are merged so that e.g. two bold facets `[0,5)` and `[5,11)` together
 * cover `[0,11)`.
 */
const isFormatActive = (
	facets: Facet[],
	byteStart: number,
	byteEnd: number,
	featureType: string,
): boolean => {
	const overlapping = facets
		.filter(
			(f) =>
				f.features.some((feat) => feat.$type === featureType) &&
				f.index.byteStart < byteEnd &&
				f.index.byteEnd > byteStart,
		)
		.sort((a, b) => a.index.byteStart - b.index.byteStart);

	if (overlapping.length === 0) return false;

	let covered = byteStart;
	for (const f of overlapping) {
		if (f.index.byteStart > covered) return false; // gap
		covered = Math.max(covered, f.index.byteEnd);
		if (covered >= byteEnd) return true;
	}

	return covered >= byteEnd;
};

const FORMAT_TYPES = [
	"bold",
	"italic",
	"underline",
	"strikethrough",
	"code",
] as const;

/**
 * Return the set of format names (e.g. `"bold"`, `"italic"`) that fully
 * cover the given byte range in the current facet list.
 */
const computeActiveFormats = (
	facets: Facet[],
	byteStart: number,
	byteEnd: number,
): Set<string> => {
	const active = new Set<string>();
	for (const fmt of FORMAT_TYPES) {
		if (
			isFormatActive(
				facets,
				byteStart,
				byteEnd,
				`social.colibri.richtext.facet#${fmt}`,
			)
		) {
			active.add(fmt);
		}
	}
	return active;
};

/**
 * Given a character offset into the plain text (as produced by the DOM walk
 * in {@link parseDomToFacets} / {@link getSelectionByteOffsets}), walk the
 * (possibly freshly re-rendered) DOM and return the corresponding
 * `{ node, offset }` pair suitable for {@link Selection.collapse}.
 */
const charOffsetToDomPosition = (
	root: HTMLElement,
	targetCharOffset: number,
): { node: Node; offset: number } | null => {
	let text = "";
	let result: { node: Node; offset: number } | null = null;

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

	const walk = (node: Node, isFirstChild: boolean): boolean => {
		if (result) return true;

		// Plain text
		if (node.nodeType === Node.TEXT_NODE) {
			const content = node.textContent || "";
			const nodeStart = text.length;
			const nodeEnd = nodeStart + content.length;

			if (targetCharOffset >= nodeStart && targetCharOffset <= nodeEnd) {
				result = { node, offset: targetCharOffset - nodeStart };
				return true;
			}

			text += content;
			return false;
		}

		if (node.nodeType !== Node.ELEMENT_NODE) return false;
		const el = node as HTMLElement;

		// Twemoji images → original emoji character from alt
		if (el.tagName === "IMG" && el.classList.contains("emoji")) {
			const alt = el.getAttribute("alt") || "";
			const nodeStart = text.length;
			text += alt;

			if (targetCharOffset >= nodeStart && targetCharOffset <= text.length) {
				// Land cursor right after the <img>
				const parent = el.parentNode;
				if (parent) {
					const idx = Array.from(parent.childNodes).indexOf(el as ChildNode);
					result = { node: parent, offset: idx + 1 };
				}
				return true;
			}
			return false;
		}

		// <br> → newline
		if (el.tagName === "BR") {
			text += "\n";

			if (targetCharOffset === text.length - 1) {
				const parent = el.parentNode;
				if (parent) {
					const idx = Array.from(parent.childNodes).indexOf(el as ChildNode);
					result = { node: parent, offset: idx + 1 };
				}
				return true;
			}
			return false;
		}

		const feature = featureFromElement(el);

		// Non-facet block wrappers injected by contentEditable
		const isBlockWrapper = !feature && BLOCK_TAGS.has(el.tagName);
		if (
			isBlockWrapper &&
			!isFirstChild &&
			text.length > 0 &&
			!text.endsWith("\n")
		) {
			text += "\n";
		}

		const children = el.childNodes;
		for (let i = 0; i < children.length; i++) {
			if (walk(children[i], i === 0)) return true;
		}

		return false;
	};

	const topChildren = root.childNodes;
	for (let i = 0; i < topChildren.length; i++) {
		if (walk(topChildren[i], i === 0)) break;
	}

	// Fallback: place cursor at the very end
	if (!result) {
		if (root.lastChild && root.lastChild.nodeType === Node.TEXT_NODE) {
			result = {
				node: root.lastChild,
				offset: root.lastChild.textContent?.length || 0,
			};
		} else {
			result = { node: root, offset: root.childNodes.length };
		}
	}

	return result;
};

/** Validate that a string is a well-formed http(s) URL. */
const isValidUrl = (value: string): boolean => {
	try {
		const url = new URL(value);
		return url.protocol === "http:" || url.protocol === "https:";
	} catch {
		return false;
	}
};

const Toolbar: Component<{
	state: Accessor<ToolbarState | null>;
	onFormat: (type: string, link?: string) => void;
	onPopoverOpenChange?: (open: boolean) => void;
}> = (props) => {
	const [link, setLink] = createSignal("");
	const [linkError, setLinkError] = createSignal("");
	const [popoverOpen, setPopoverOpen] = createSignal(false);

	const handlePopoverOpenChange = (open: boolean) => {
		setPopoverOpen(open);
		if (!open) {
			setLink("");
			setLinkError("");
		}
		props.onPopoverOpenChange?.(open);
	};

	const handleAddLink = () => {
		const url = link().trim();

		if (!url) {
			setLinkError("Please enter a URL.");
			return;
		}

		if (!isValidUrl(url)) {
			setLinkError("Please enter a valid http or https URL.");
			return;
		}

		setLinkError("");
		props.onFormat("link", url);
		setPopoverOpen(false);
		setLink("");
	};

	return (
		<Show when={props.state()}>
			{(state) => (
				<div
					class="absolute w-fit h-8 bg-card flex items-center border border-border rounded-sm overflow-hidden"
					style={{
						top: `${state().position.top - 48}px`,
						left: `${state().position.left}px`,
					}}
				>
					<ToolbarButton
						onClick={() => props.onFormat("bold")}
						active={state().activeFormats.has("bold")}
					>
						<Bold />
					</ToolbarButton>
					<ToolbarButton
						onClick={() => props.onFormat("italic")}
						active={state().activeFormats.has("italic")}
					>
						<Italic />
					</ToolbarButton>
					<ToolbarButton
						onClick={() => props.onFormat("underline")}
						active={state().activeFormats.has("underline")}
					>
						<Underline />
					</ToolbarButton>
					<ToolbarButton
						onClick={() => props.onFormat("strikethrough")}
						active={state().activeFormats.has("strikethrough")}
					>
						<Strikethrough />
					</ToolbarButton>
					<ToolbarButton
						onClick={() => props.onFormat("code")}
						active={state().activeFormats.has("code")}
					>
						<Code />
					</ToolbarButton>
					<Popover open={popoverOpen()} onOpenChange={handlePopoverOpenChange}>
						<PopoverTrigger>
							<ToolbarButton>
								<Link />
							</ToolbarButton>
						</PopoverTrigger>
						<PopoverPortal>
							<PopoverContent>
								<TextField validationState={linkError() ? "invalid" : "valid"}>
									<TextFieldLabel>Link</TextFieldLabel>
									<TextFieldInput
										type="url"
										value={link()}
										onInput={(e) => {
											setLink(e.currentTarget.value);
											if (linkError()) setLinkError("");
										}}
										onKeyDown={(e) => {
											if (e.key === "Enter") {
												e.preventDefault();
												handleAddLink();
											}
										}}
										autocomplete="off"
										autocorrect="off"
										placeholder="https://colibri.social"
									/>
									<TextFieldErrorMessage>{linkError()}</TextFieldErrorMessage>
								</TextField>
								<div class="w-full flex justify-end">
									<Button
										class="mt-4 cursor-pointer ml-auto"
										onClick={handleAddLink}
									>
										Add
									</Button>
								</div>
							</PopoverContent>
						</PopoverPortal>
					</Popover>
				</div>
			)}
		</Show>
	);
};

export const RichTextRenderer: Component<{
	editable?: boolean;
	text: Accessor<TextWithFacets>;
	setInputContent?: Setter<TextWithFacets>;
	classList?: Record<string, boolean>;
}> = (props) => {
	let pRef: HTMLParagraphElement | undefined;
	let skipNextEffect = false;

	/** Formats armed by a keyboard shortcut on a collapsed cursor, applied on the next insertion. */
	const pendingFormats = new Set<string>();
	/** Byte offset of the cursor when pending formats were armed. */
	let pendingByteOffset: number | null = null;

	// ── Undo / Redo history ────────────────────────────────────
	type HistoryEntry = {
		content: TextWithFacets;
		cursorCharOffset: number | null;
	};

	const undoStack: HistoryEntry[] = [];
	const redoStack: HistoryEntry[] = [];
	const MAX_HISTORY = 100;

	/** Tracks cursor char-offset so we can store it in undo entries. */
	let lastCursorCharOffset: number | null = null;

	/**
	 * Whether we are inside a "typing burst". While true, consecutive
	 * input events won't push additional undo entries — the whole burst
	 * collapses into a single undo step.
	 */
	let inTypingBurst = false;
	let typingBurstTimer: ReturnType<typeof setTimeout> | null = null;
	const TYPING_BURST_MS = 400;

	/** Deep-clone a TextWithFacets so mutations don't corrupt history. */
	const cloneContent = (c: TextWithFacets): TextWithFacets => ({
		text: c.text,
		facets: c.facets.map((f) => ({
			...f,
			index: { ...f.index },
			features: f.features.map((feat) => ({ ...feat })),
		})),
	});

	/** Push the current state onto the undo stack (call *before* mutating). */
	const saveForUndo = (cursorCharOffset?: number | null) => {
		const content = props.text();
		undoStack.push({
			content: cloneContent(content),
			cursorCharOffset: cursorCharOffset ?? lastCursorCharOffset,
		});
		if (undoStack.length > MAX_HISTORY) undoStack.shift();
		redoStack.length = 0;
	};

	/** Restore a history entry into the editor. */
	const applyHistoryEntry = (entry: HistoryEntry) => {
		if (!pRef || !props.setInputContent) return;

		skipNextEffect = true;
		props.setInputContent(entry.content);

		const newRendered = renderWithFacets(entry.content);
		pRef.innerHTML = twemoji.parse(newRendered);

		pendingFormats.clear();
		pendingByteOffset = null;
		setToolbarState(null);

		// Update tracked cursor offset immediately so subsequent
		// undo/redo operations have the correct value even before
		// the async selectionchange event fires.
		lastCursorCharOffset = entry.cursorCharOffset;

		const ref = pRef;
		const offset = entry.cursorCharOffset;
		requestAnimationFrame(() => {
			if (offset !== null) {
				const pos = charOffsetToDomPosition(ref, offset);
				if (pos) {
					const sel = document.getSelection();
					if (sel) sel.collapse(pos.node, pos.offset);
				}
			}
			ref.focus();
		});
	};

	const performUndo = () => {
		if (undoStack.length === 0) return;

		// Flush any in-progress typing burst so its state is captured
		if (typingBurstTimer !== null) {
			clearTimeout(typingBurstTimer);
			typingBurstTimer = null;
		}
		inTypingBurst = false;

		// Save current state to redo stack
		const current = props.text();
		redoStack.push({
			content: cloneContent(current),
			cursorCharOffset: lastCursorCharOffset,
		});

		const entry = undoStack.pop()!;
		applyHistoryEntry(entry);
	};

	const performRedo = () => {
		if (redoStack.length === 0) return;

		// Flush any in-progress typing burst
		if (typingBurstTimer !== null) {
			clearTimeout(typingBurstTimer);
			typingBurstTimer = null;
		}
		inTypingBurst = false;

		// Save current state to undo stack
		const current = props.text();
		undoStack.push({
			content: cloneContent(current),
			cursorCharOffset: lastCursorCharOffset,
		});

		const entry = redoStack.pop()!;
		applyHistoryEntry(entry);
	};

	/** Block the browser's native undo/redo so we handle it ourselves. */
	const handleBeforeInput = (e: InputEvent) => {
		if (e.inputType === "historyUndo" || e.inputType === "historyRedo") {
			e.preventDefault();
		}
	};

	const rendered = renderWithFacets(props.text());
	const renderedWithEmojis = twemoji.parse(rendered);

	// Re-render the contentEditable DOM when the text signal changes externally
	// (e.g. clearing the input after sending a message). Internal changes from
	// typing or toolbar formatting set `skipNextEffect` so we don't clobber
	// the live DOM the user is editing.
	createEffect(
		on(
			() => props.text(),
			(content) => {
				if (skipNextEffect) {
					skipNextEffect = false;
					return;
				}
				if (pRef) {
					const newRendered = renderWithFacets(content);
					pRef.innerHTML = twemoji.parse(newRendered);
				}
				// Clear pending formats and undo/redo history on external text changes
				pendingFormats.clear();
				pendingByteOffset = null;
				undoStack.length = 0;
				redoStack.length = 0;
				inTypingBurst = false;
				if (typingBurstTimer !== null) {
					clearTimeout(typingBurstTimer);
					typingBurstTimer = null;
				}
				lastCursorCharOffset = null;
			},
			{ defer: true },
		),
	);

	// (toolbarState is declared early so applyHistoryEntry can reference it)
	const [toolbarState, setToolbarState] = createSignal<ToolbarState | null>(
		null,
	);

	let popoverOpen = false;

	const handlePopoverOpenChange = (open: boolean) => {
		popoverOpen = open;
	};

	const handleSelection = () => {
		// While the link popover is open, don't update or dismiss the
		// toolbar — the user is interacting with the popover's text field
		// and the selection is expected to leave the contentEditable.
		if (popoverOpen) return;

		// Any cursor movement clears pending formats so they don't
		// unexpectedly apply later.
		pendingFormats.clear();
		pendingByteOffset = null;

		// Track cursor position for undo history entries
		const selForCursor = document.getSelection();
		if (
			selForCursor &&
			selForCursor.rangeCount > 0 &&
			pRef &&
			pRef.contains(selForCursor.anchorNode)
		) {
			const curOffsets = getSelectionByteOffsets(
				pRef,
				selForCursor.getRangeAt(0),
			);
			if (curOffsets) {
				lastCursorCharOffset = curOffsets.charEnd;
			}
		}

		const sel = document.getSelection();
		if (
			pRef &&
			sel &&
			pRef.contains(sel.anchorNode) &&
			sel.type === "Range" &&
			sel.rangeCount > 0
		) {
			const position = getSelectionPixels(sel);
			if (position) {
				const range = sel.getRangeAt(0);
				// A selection is backward when the anchor (where the user started
				// dragging) comes after the focus in document order.
				let isBackward = false;
				if (sel.anchorNode && sel.focusNode) {
					if (sel.anchorNode === sel.focusNode) {
						isBackward = sel.anchorOffset > sel.focusOffset;
					} else {
						const cmp = sel.anchorNode.compareDocumentPosition(sel.focusNode);
						isBackward = (cmp & Node.DOCUMENT_POSITION_PRECEDING) !== 0;
					}
				}

				// Compute which formats fully cover the current selection
				const clonedRange = range.cloneRange();
				const offsets = getSelectionByteOffsets(pRef!, clonedRange);
				const activeFormats = offsets
					? computeActiveFormats(
							props.text().facets,
							offsets.byteStart,
							offsets.byteEnd,
						)
					: new Set<string>();

				setToolbarState({
					position,
					selection: sel,
					range: clonedRange,
					isBackward,
					activeFormats,
				});
			} else {
				setToolbarState(null);
			}
		} else {
			setToolbarState(null);
		}
	};

	const handleFormat = (formatType: string, link?: string) => {
		const state = toolbarState();
		if (!state || !pRef || !props.setInputContent) return;

		const offsets = getSelectionByteOffsets(pRef, state.range);
		if (!offsets) return;

		const feature = formatTypeToFeature(formatType, link);
		if (!feature) return;

		// Save state for undo before applying the format
		saveForUndo(state.isBackward ? offsets.charStart : offsets.charEnd);

		const current = props.text();
		const cursorCharOffset = state.isBackward
			? offsets.charStart
			: offsets.charEnd;

		const featureType = `social.colibri.richtext.facet#${formatType}`;
		const active = isFormatActive(
			current.facets,
			offsets.byteStart,
			offsets.byteEnd,
			featureType,
		);

		let newFacets: Facet[];

		if (active) {
			// Toggle OFF – remove / trim / split overlapping facets of this type
			newFacets = [];
			for (const facet of current.facets) {
				const isTargetType = facet.features.some(
					(f) => f.$type === featureType,
				);
				const overlaps =
					facet.index.byteStart < offsets.byteEnd &&
					facet.index.byteEnd > offsets.byteStart;

				if (!isTargetType || !overlaps) {
					newFacets.push(facet);
					continue;
				}

				// Part before the selection
				if (facet.index.byteStart < offsets.byteStart) {
					newFacets.push({
						...facet,
						index: {
							byteStart: facet.index.byteStart,
							byteEnd: offsets.byteStart,
						},
					} as Facet);
				}

				// Part after the selection
				if (facet.index.byteEnd > offsets.byteEnd) {
					newFacets.push({
						...facet,
						index: {
							byteStart: offsets.byteEnd,
							byteEnd: facet.index.byteEnd,
						},
					} as Facet);
				}
			}
		} else {
			// Toggle ON – add a new facet covering the selection
			newFacets = [
				...current.facets,
				{
					index: {
						byteStart: offsets.byteStart,
						byteEnd: offsets.byteEnd,
					},
					features: [feature],
				} as Facet,
			];
		}

		newFacets.sort((a, b) => a.index.byteStart - b.index.byteStart);

		const newContent: TextWithFacets = {
			text: current.text,
			facets: newFacets,
		};

		skipNextEffect = true;
		props.setInputContent(newContent);

		// Re-render the contentEditable with the new facets
		const newRendered = renderWithFacets(newContent);
		pRef.innerHTML = twemoji.parse(newRendered);

		// Clear the toolbar since the selection is now stale
		setToolbarState(null);
		popoverOpen = false;

		// Restore the cursor at the end of the previously selected range.
		// Use requestAnimationFrame so the browser has finished laying out
		// the freshly-injected innerHTML before we try to place the caret.
		const ref = pRef;
		requestAnimationFrame(() => {
			const pos = charOffsetToDomPosition(ref, cursorCharOffset);
			if (pos) {
				const sel = document.getSelection();
				if (sel) {
					sel.collapse(pos.node, pos.offset);
				}
			}
			ref.focus();
		});
	};

	/**
	 * Handle keyboard shortcuts for toggling formatting facets.
	 * When the cursor is collapsed (no selection), the format is armed as a
	 * "pending format" so that the next typed text inherits the style.
	 *
	 *   Ctrl/Cmd + B → Bold
	 *   Ctrl/Cmd + I → Italic
	 *   Ctrl/Cmd + U → Underline
	 *   Ctrl/Cmd + S → Strikethrough
	 *   Ctrl/Cmd + E → Code
	 */
	const handleKeyDown = (e: KeyboardEvent) => {
		if (!props.editable || !props.setInputContent || !pRef) return;

		// Handle Mentions and channel links

		const isModifier = e.ctrlKey || e.metaKey;
		if (!isModifier) return;

		// ── Undo / Redo ────────────────────────────────────────
		if (e.key.toLowerCase() === "z" && !e.shiftKey) {
			e.preventDefault();
			performUndo();
			return;
		}
		if (
			(e.key.toLowerCase() === "z" && e.shiftKey) ||
			e.key.toLowerCase() === "y"
		) {
			e.preventDefault();
			performRedo();
			return;
		}

		let formatType: string | null = null;
		switch (e.key.toLowerCase()) {
			case "b":
				formatType = "bold";
				break;
			case "i":
				formatType = "italic";
				break;
			case "u":
				formatType = "underline";
				break;
			case "s":
				formatType = "strikethrough";
				break;
			case "e":
				formatType = "code";
				break;
			default:
				return;
		}

		e.preventDefault();

		const sel = document.getSelection();
		if (!sel || sel.rangeCount === 0) return;

		// ── Collapsed cursor → toggle a pending format ──────────────
		if (sel.isCollapsed) {
			if (pendingFormats.has(formatType)) {
				pendingFormats.delete(formatType);
			} else {
				pendingFormats.add(formatType);
			}

			const range = sel.getRangeAt(0);
			const offsets = getSelectionByteOffsets(pRef, range);
			if (offsets) {
				pendingByteOffset = offsets.byteStart;
			}
			return;
		}

		// ── Non-collapsed selection → toggle format immediately ─────
		const range = sel.getRangeAt(0);
		const offsets = getSelectionByteOffsets(pRef, range);
		if (!offsets || offsets.byteStart === offsets.byteEnd) return;

		const feature = formatTypeToFeature(formatType);
		if (!feature) return;

		// Save state for undo before applying the format
		saveForUndo(offsets.charEnd);

		const featureType = `social.colibri.richtext.facet#${formatType}`;
		const current = props.text();

		const active = isFormatActive(
			current.facets,
			offsets.byteStart,
			offsets.byteEnd,
			featureType,
		);

		let newFacets: Facet[];

		if (active) {
			// Toggle OFF – remove / trim / split overlapping facets of this type
			newFacets = [];
			for (const facet of current.facets) {
				const isTargetType = facet.features.some(
					(f) => f.$type === featureType,
				);
				const overlaps =
					facet.index.byteStart < offsets.byteEnd &&
					facet.index.byteEnd > offsets.byteStart;

				if (!isTargetType || !overlaps) {
					newFacets.push(facet);
					continue;
				}

				// Part before the selection
				if (facet.index.byteStart < offsets.byteStart) {
					newFacets.push({
						...facet,
						index: {
							byteStart: facet.index.byteStart,
							byteEnd: offsets.byteStart,
						},
					} as Facet);
				}

				// Part after the selection
				if (facet.index.byteEnd > offsets.byteEnd) {
					newFacets.push({
						...facet,
						index: {
							byteStart: offsets.byteEnd,
							byteEnd: facet.index.byteEnd,
						},
					} as Facet);
				}
			}
		} else {
			// Toggle ON – add a new facet covering the selection
			newFacets = [
				...current.facets,
				{
					index: {
						byteStart: offsets.byteStart,
						byteEnd: offsets.byteEnd,
					},
					features: [feature],
				} as Facet,
			];
		}

		newFacets.sort((a, b) => a.index.byteStart - b.index.byteStart);

		const cursorCharOffset = offsets.charEnd;

		const newContent: TextWithFacets = {
			text: current.text,
			facets: newFacets,
		};

		skipNextEffect = true;
		props.setInputContent(newContent);

		// Re-render the contentEditable with the new facets
		const newRendered = renderWithFacets(newContent);
		pRef.innerHTML = twemoji.parse(newRendered);

		// Clear the toolbar since the selection is now stale
		setToolbarState(null);
		popoverOpen = false;

		// Restore the cursor at the end of the previously selected range
		const ref = pRef;
		requestAnimationFrame(() => {
			const pos = charOffsetToDomPosition(ref, cursorCharOffset);
			if (pos) {
				const sel = document.getSelection();
				if (sel) {
					sel.collapse(pos.node, pos.offset);
				}
			}
			ref.focus();
		});
	};

	onMount(() => {
		document.addEventListener("selectionchange", handleSelection);
	});

	onCleanup(() => {
		document.removeEventListener("selectionchange", handleSelection);
		if (typingBurstTimer !== null) {
			clearTimeout(typingBurstTimer);
			typingBurstTimer = null;
		}
	});

	const handleInput: JSX.InputEventHandlerUnion<
		HTMLParagraphElement,
		InputEvent
	> = (e) => {
		if (!props.setInputContent) return;

		// ── Undo: save state before the first input in a typing burst ──
		if (!inTypingBurst) {
			saveForUndo();
			inTypingBurst = true;
		}
		// Reset the burst timer — after TYPING_BURST_MS of silence the
		// next keystroke will start a new undo group.
		if (typingBurstTimer !== null) clearTimeout(typingBurstTimer);
		typingBurstTimer = setTimeout(() => {
			inTypingBurst = false;
			typingBurstTimer = null;
		}, TYPING_BURST_MS);

		// Save cursor position before twemoji replacement mutates the DOM
		const sel = document.getSelection();
		let cursorCharOffset: number | null = null;
		let cursorByteOffset: number | null = null;
		if (sel && sel.rangeCount > 0 && pRef) {
			const offsets = getSelectionByteOffsets(pRef, sel.getRangeAt(0));
			if (offsets) {
				cursorCharOffset = offsets.charEnd;
				cursorByteOffset = offsets.byteEnd;
			}
		}

		// Replace native emoji characters with twemoji <img> elements
		twemoji.parse(e.currentTarget);

		// Restore cursor after twemoji DOM mutation
		if (cursorCharOffset !== null && pRef && sel) {
			const pos = charOffsetToDomPosition(pRef, cursorCharOffset);
			if (pos) {
				sel.collapse(pos.node, pos.offset);
			}
		}

		const parsed = parseDomToFacets(e.currentTarget);
		const stripped = stripAutoDetectedLinks(parsed);
		let result = mergeWithDetectedFacets(stripped);

		// Deep-compare the final facets against the DOM-sourced facets
		// to decide whether a re-render is needed (e.g. a new URL was
		// detected, or an existing link's range grew).
		const facetsChangedByDetection = facetsChanged(
			parsed.facets,
			result.facets,
		);

		// ── Apply pending formats to newly inserted text ───────
		if (
			pendingFormats.size > 0 &&
			pendingByteOffset !== null &&
			cursorByteOffset !== null &&
			cursorByteOffset > pendingByteOffset &&
			pRef
		) {
			const newFacets = [...result.facets];
			for (const fmt of pendingFormats) {
				const feature = formatTypeToFeature(fmt);
				if (feature) {
					newFacets.push({
						index: {
							byteStart: pendingByteOffset,
							byteEnd: cursorByteOffset,
						},
						features: [feature],
					} as Facet);
				}
			}
			newFacets.sort((a, b) => a.index.byteStart - b.index.byteStart);
			result = { text: result.text, facets: newFacets };

			// Re-render so the formatted wrapper is in the DOM and
			// subsequent typing occurs inside it.
			const newRendered = renderWithFacets(result);
			pRef.innerHTML = twemoji.parse(newRendered);

			if (cursorCharOffset !== null && sel) {
				const pos = charOffsetToDomPosition(pRef, cursorCharOffset);
				if (pos) {
					sel.collapse(pos.node, pos.offset);
				}
			}
		}

		// Always clear pending formats after an input event
		pendingFormats.clear();
		pendingByteOffset = null;

		// If auto-detection added new facets (e.g. a typed URL was
		// recognised as a link) or adjustLinkFacetUris updated a
		// URI, re-render the DOM so the change is visible immediately.
		if (facetsChangedByDetection && pRef) {
			const newRendered = renderWithFacets(result);
			pRef.innerHTML = twemoji.parse(newRendered);

			if (cursorCharOffset !== null && sel) {
				const pos = charOffsetToDomPosition(pRef, cursorCharOffset);
				if (pos) {
					sel.collapse(pos.node, pos.offset);
				}
			}
		}

		// When all meaningful content has been deleted, clear any
		// stale formatting wrappers the browser left behind so
		// new text doesn't inherit the previous style.
		if (
			result.text.replace(/\n/g, "").length === 0 &&
			result.facets.length > 0
		) {
			e.currentTarget.innerHTML = "";
			skipNextEffect = true;
			props.setInputContent({ text: "", facets: [] });
			return;
		}

		skipNextEffect = true;
		props.setInputContent(result);

		// Update tracked cursor offset for future undo entries
		if (cursorCharOffset !== null) {
			lastCursorCharOffset = cursorCharOffset;
		}
	};

	return (
		<>
			<p
				class="m-0 rich-text focus:outline-0 leading-5.5 break-words"
				contentEditable={props.editable}
				innerHTML={renderedWithEmojis}
				classList={props.classList}
				onKeyDown={handleKeyDown}
				onInput={handleInput}
				onBeforeInput={handleBeforeInput}
				ref={pRef}
			/>
			<Show when={props.editable && toolbarState() !== null}>
				<Portal>
					<Toolbar
						state={toolbarState}
						onFormat={handleFormat}
						onPopoverOpenChange={handlePopoverOpenChange}
					/>
				</Portal>
			</Show>
		</>
	);
};
