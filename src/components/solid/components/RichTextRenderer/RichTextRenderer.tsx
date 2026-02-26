import twemoji from "@twemoji/api";
import {
	type Accessor,
	type Component,
	createEffect,
	createSignal,
	type JSX,
	on,
	onCleanup,
	onMount,
	type Setter,
	Show,
} from "solid-js";
import { Portal } from "solid-js/web";
import type { Facet } from "@/utils/atproto/rich-text";
import { Toolbar } from "./Toolbar";
import {
	charOffsetToDomPosition,
	computeActiveFormats,
	facetsChanged,
	formatTypeToFeature,
	getSelectionByteOffsets,
	getSelectionPixels,
	isFormatActive,
	mergeWithDetectedFacets,
	parseDomToFacets,
	renderWithFacets,
	stripAutoDetectedLinks,
	type TextWithFacets,
	type ToolbarState,
} from "./util";

/**
 * A rich text renderer component that parses a given text and renders it's facets as HTML.
 * Can be made editable using the `editable` prop.
 */
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

	/** Undoes a singular action. */
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

	/** Redoes a singula action. */
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

	/** Changes the popover state */
	const handlePopoverOpenChange = (open: boolean) => {
		popoverOpen = open;
	};

	/** Handles selection on the text, checking for active facets in the process and positioning the popover. */
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

	/**
	 * Handles the formatting for a given format by adding/removing the facet of that type to the given selection.
	 * @param formatType The format to apply
	 * @param link Only specify if the formatType is `link`.
	 */
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
	 *   - Ctrl/Cmd + B → Bold
	 *   - Ctrl/Cmd + I → Italic
	 *   - Ctrl/Cmd + U → Underline
	 *   - Ctrl/Cmd + S → Strikethrough
	 *   - Ctrl/Cmd + E → Code
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

	/**
	 * The initial input handler used on the contenteditable container
	 * @param e The input event.
	 */
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
				class="m-0 rich-text focus:outline-0 leading-5.5 wrap-break-word"
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
