import type { Facet } from "@/utils/atproto/rich-text";
import { detectFacets } from "@/utils/atproto/rich-text/detection";
import { UnicodeString } from "@/utils/atproto/rich-text/unicode";

export type TextWithFacets = {
	text: string;
	facets: Array<Facet>;
};

export const textEncoder = new TextEncoder();
export const textDecoder = new TextDecoder();

export type AnyFeature = Facet["features"][number];

/**
 * Convert newline characters to `<br>` tags for HTML output.
 */
const nlToBr = (s: string): string => s.replace(/\n/g, "<br>");

/**
 * Escape a string for safe use inside an HTML attribute value.
 */
const escapeAttr = (s: string): string =>
	s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/**
 * Wraps the facet's text content in the appropriate HTML element, embedding
 * `data-facet-type` (and any metadata like `data-did`, `data-uri`,
 * `data-channel`) so the reverse parser can reconstruct the facet losslessly.
 */
const applyStyleForFacet = (
	text: string,
	feature: AnyFeature,
	community?: string,
): string => {
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
			if (community) {
				const href = escapeAttr(`/c/${community}/${channel}`);
				return `<a data-facet-type="channel" data-channel="${channel}" href="${href}" class="bg-blue-500/15 hover:bg-blue-500/25 px-1 rounded-xs cursor-pointer inline no-underline text-foreground">${text}</a>`;
			}
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

	// @ts-expect-error - Fallback just to be sure
	return `[UNKNOWN FACET: ${feature.$type}]`;
};

/**
 * Renders text with facets. Facets use byte offsets into the
 * UTF-8 encoded text, so we work with the encoded bytes directly and build
 * the result string by walking through sorted, non-overlapping segments.
 *
 * When multiple facets share the same byte range, all of their features are
 * applied as nested wrappers.
 */
export const renderWithFacets = (
	input: TextWithFacets,
	community?: string,
): string => {
	const bytes = textEncoder.encode(input.text);

	const sortedFacets = [...input.facets].sort((a, b) => {
		if (a.index.byteStart !== b.index.byteStart) {
			return a.index.byteStart - b.index.byteStart;
		}
		return a.index.byteEnd - b.index.byteEnd;
	});

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
		if (group.byteStart < cursor) continue;

		if (group.byteStart > cursor) {
			result += nlToBr(
				textDecoder.decode(bytes.slice(cursor, group.byteStart)),
			);
		}

		let facetText = nlToBr(
			textDecoder.decode(bytes.slice(group.byteStart, group.byteEnd)),
		);

		// If a channel mention is present, render ONLY the channel mention
		// style - other formatting features are stripped to prevent forgery.
		const channelFeature = group.features.find(
			(f) => f.$type === "social.colibri.richtext.facet#channel",
		);
		const mentionFeature = group.features.find(
			(f) => f.$type === "social.colibri.richtext.facet#mention",
		);

		if (channelFeature) {
			facetText = applyStyleForFacet(facetText, channelFeature, community);
		} else if (mentionFeature) {
			facetText = applyStyleForFacet(facetText, mentionFeature, community);
		} else {
			for (const feature of group.features) {
				facetText = applyStyleForFacet(facetText, feature, community);
			}
		}

		result += facetText;
		cursor = group.byteEnd;
	}

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
export const featureFromElement = (el: HTMLElement): AnyFeature | null => {
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
 * TextWithFacets value that mirrors the visible content plus any
 * facets that were encoded as `data-facet-type` attributes.
 *
 * Special cases:
 * - `<img class="emoji">` (twemoji) -> original emoji character from `alt`
 * - `<br>` -> newline
 * - Block-level elements without facet data (e.g. `<div>` wrappers injected
 *   by `contentEditable`) -> newline before their content
 */
export const parseDomToFacets = (root: HTMLElement): TextWithFacets => {
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

		// Twemoji images
		if (el.tagName === "IMG" && el.classList.contains("emoji")) {
			text += el.getAttribute("alt") || "";
			return;
		}

		// <br>
		if (el.tagName === "BR") {
			text += "\n";
			return;
		}

		const feature = featureFromElement(el);

		// Non-facet block elements produced by contentEditable (e.g. pressing
		// Enter wraps the new line in a <div>).
		const isBlockWrapper = !feature && BLOCK_TAGS.has(el.tagName);
		if (
			isBlockWrapper &&
			!isFirstChild &&
			text.length > 0 &&
			!text.endsWith("\n")
		) {
			text += "\n";
		}

		// Record the byte position before we recurse into children so we
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
 * mergeWithDetectedFacets can re-detect them with the correct,
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
export const stripAutoDetectedLinks = (
	parsed: TextWithFacets,
): TextWithFacets => {
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

		const isAutoDetected = !/\s/.test(facetText) && isValidUrl(currentUri);

		if (isAutoDetected) {
			changed = true;
			const otherFeatures = facet.features.filter(
				(f) => f.$type !== "social.colibri.richtext.facet#link",
			);
			if (otherFeatures.length > 0) {
				adjustedFacets.push({
					...facet,
					features: otherFeatures,
				} as Facet);
			}
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
export const facetsChanged = (a: Facet[], b: Facet[]): boolean => {
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
 * detectors (`detectFacets`) over the plain text to discover any new
 * mentions, links or channels the user may have typed. Detected facets that
 * overlap with an existing non-formatting DOM-sourced facet (i.e. links,
 * mentions, channels) are discarded so that metadata-rich facets (e.g. those
 * carrying a resolved DID) are never overwritten. Formatting-only facets
 * (bold, italic, etc.) do not block detection.
 */
export const mergeWithDetectedFacets = (
	parsed: TextWithFacets,
): TextWithFacets => {
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

/**
 * Attempts to get pixel values for a selection's bounding box.
 * @param selection The selection
 * @returns
 */
export const getSelectionPixels = (selection: Selection | null) => {
	if (!selection || selection.rangeCount === 0) return null;

	const range = selection.getRangeAt(0);

	const collapsed = range.cloneRange();
	collapsed.collapse(true);
	let rect = collapsed.getBoundingClientRect();

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

export type ToolbarPosition = {
	top: number;
	left: number;
	bottom: number;
	height: number;
};

export type ToolbarState = {
	position: ToolbarPosition;
	selection: Selection;
	range: Range;
	isBackward: boolean;
	activeFormats: Set<string>;
};

/**
 * Walk the DOM tree of a `contentEditable` element, mirroring the exact same
 * text-construction logic used by parseDomToFacets, and map a
 * browser Range's start/end boundaries to UTF-8 byte offsets within
 * that text.
 * @param root The root HTML element to get the selection byte offsets for.
 * @param range The current selection range.
 */
export const getSelectionByteOffsets = (
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

	/**
	 * Check whether a range boundary targets `container` at child-index `childIndex`.
	 * @param container The Node to check the boundary for.
	 * @param childIndex the index of this child.
	 */
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

	/**
	 * Walk all children of `parent`, checking element-level boundaries before each child and after the last.
	 * @param parent The node to walk the children of.
	 */
	const walkChildren = (parent: Node) => {
		const children = parent.childNodes;
		for (let i = 0; i < children.length; i++) {
			checkElementBoundary(parent, i);
			walk(children[i], i === 0);
		}
		checkElementBoundary(parent, children.length);
	};

	/**
	 * Walk a single node.
	 * @param node The node to walk
	 * @param isFirstChild Whether this node is the first child of its parent
	 */
	const walk = (node: Node, isFirstChild: boolean): void => {
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

		// Twemoji images
		if (el.tagName === "IMG" && el.classList.contains("emoji")) {
			text += el.getAttribute("alt") || "";
			return;
		}

		if (el.tagName === "BR") {
			text += "\n";
			return;
		}

		const feature = featureFromElement(el);

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

/**
 * Map a toolbar format name to the corresponding facet feature.
 * @param type The format type
 * @param uri The URI of the link facet. Only needed when `type` is a link.
 */
export const formatTypeToFeature = (
	type: string,
	uri?: string,
): AnyFeature | null => {
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
 *
 * @param facets A list of active facets
 * @param byteStart The UTF-8 byte start of the active selection
 * @param byteEnd The UTF-8 byte end of the active selection
 * @param featureType The type of feature to check for
 */
export const isFormatActive = (
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

export const FORMAT_TYPES = [
	"bold",
	"italic",
	"underline",
	"strikethrough",
	"code",
] as const;

/**
 * Return the set of format names (e.g. `"bold"`, `"italic"`) that fully
 * cover the given byte range in the current facet list.
 *
 * @param facets The active facets.
 * @param byteStart The UTF-8 byte start of the active selection
 * @param byteEnd The UTF-8 byte end of the active selection
 */
export const computeActiveFormats = (
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
 * in parseDomToFacets / getSelectionByteOffsets), walk the
 * (possibly freshly re-rendered) DOM and return the corresponding
 * `{ node, offset }` pair suitable for Selection.collapse.
 *
 * @param root The root element to walk.
 * @param targetCharOffset The character offset into the plain text.
 */
export const charOffsetToDomPosition = (
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

		if (el.tagName === "IMG" && el.classList.contains("emoji")) {
			const alt = el.getAttribute("alt") || "";
			const nodeStart = text.length;
			text += alt;

			if (targetCharOffset >= nodeStart && targetCharOffset <= text.length) {
				const parent = el.parentNode;
				if (parent) {
					const idx = Array.from(parent.childNodes).indexOf(el as ChildNode);
					result = { node: parent, offset: idx + 1 };
				}
				return true;
			}
			return false;
		}

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

/**
 * Validate that a string is a well-formed http(s) URL.
 * @param value The value to check
 */
export const isValidUrl = (value: string): boolean => {
	try {
		const url = new URL(value);
		return url.protocol === "http:" || url.protocol === "https:";
	} catch {
		return false;
	}
};
