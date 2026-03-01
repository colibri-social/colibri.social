import twemoji from "@twemoji/api";
import type { Setter } from "solid-js";
import type { Facet } from "@/utils/atproto/rich-text";
import { saveForUndo, type HistoryState } from "./history";
import {
	charOffsetToDomPosition,
	formatTypeToFeature,
	getSelectionByteOffsets,
	isFormatActive,
	renderWithFacets,
	type TextWithFacets,
	type ToolbarState,
} from "./util";

/**
 * Toggles a formatting facet on or off for the given byte range.
 * Used by both the toolbar button handler and keyboard shortcut handler
 * when a non-collapsed selection is present.
 */
export const toggleFormat = (
	formatType: string,
	offsets: {
		byteStart: number;
		byteEnd: number;
		charStart: number;
		charEnd: number;
	},
	cursorCharOffset: number,
	getText: () => TextWithFacets,
	pRef: HTMLParagraphElement,
	setInputContent: Setter<TextWithFacets>,
	setSkipNextEffect: (v: boolean) => void,
	setToolbarState: Setter<ToolbarState | null>,
	setPopoverOpen: (v: boolean) => void,
	link?: string,
	community?: string,
) => {
	const feature = formatTypeToFeature(formatType, link);
	if (!feature) return;

	const featureType = `social.colibri.richtext.facet#${formatType}`;
	const current = getText();

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
			const isTargetType = facet.features.some((f) => f.$type === featureType);
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

	setSkipNextEffect(true);
	setInputContent(newContent);

	// Re-render the contentEditable with the new facets
	const newRendered = renderWithFacets(newContent, community);
	pRef.innerHTML = twemoji.parse(newRendered);

	// Clear the toolbar since the selection is now stale
	setToolbarState(null);
	setPopoverOpen(false);

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
 * Handles the formatting action triggered from the toolbar.
 * Reads the current toolbar state to determine offsets and delegates to toggleFormat.
 */
export const handleToolbarFormat = (
	formatType: string,
	toolbarState: () => ToolbarState | null,
	getText: () => TextWithFacets,
	pRef: HTMLParagraphElement | undefined,
	setInputContent: Setter<TextWithFacets> | undefined,
	setSkipNextEffect: (v: boolean) => void,
	setToolbarState: Setter<ToolbarState | null>,
	setPopoverOpen: (v: boolean) => void,
	history: HistoryState,
	link?: string,
	community?: string,
) => {
	const state = toolbarState();
	if (!state || !pRef || !setInputContent) return;

	const offsets = getSelectionByteOffsets(pRef, state.range);
	if (!offsets) return;

	// Save state for undo before applying the format
	saveForUndo(
		history,
		getText,
		state.isBackward ? offsets.charStart : offsets.charEnd,
	);

	const cursorCharOffset = state.isBackward
		? offsets.charStart
		: offsets.charEnd;

	toggleFormat(
		formatType,
		offsets,
		cursorCharOffset,
		getText,
		pRef,
		setInputContent,
		setSkipNextEffect,
		setToolbarState,
		setPopoverOpen,
		link,
		community,
	);
};
