import twemoji from "@twemoji/api";
import type { Setter } from "solid-js";
import {
	charOffsetToDomPosition,
	renderWithFacets,
	type TextWithFacets,
	type ToolbarState,
} from "./util";

export type HistoryEntry = {
	content: TextWithFacets;
	cursorCharOffset: number | null;
};

export type HistoryState = {
	undoStack: HistoryEntry[];
	redoStack: HistoryEntry[];
	lastCursorCharOffset: number | null;
	inTypingBurst: boolean;
	typingBurstTimer: ReturnType<typeof setTimeout> | null;
};

export const MAX_HISTORY = 100;
export const TYPING_BURST_MS = 400;

/** Deep-clone a TextWithFacets so mutations don't corrupt history. */
export const cloneContent = (c: TextWithFacets): TextWithFacets => ({
	text: c.text,
	facets: c.facets.map((f) => ({
		...f,
		index: { ...f.index },
		features: f.features.map((feat) => ({ ...feat })),
	})),
});

/** Push the current state onto the undo stack (call *before* mutating). */
export const saveForUndo = (
	history: HistoryState,
	getText: () => TextWithFacets,
	cursorCharOffset?: number | null,
) => {
	const content = getText();
	history.undoStack.push({
		content: cloneContent(content),
		cursorCharOffset: cursorCharOffset ?? history.lastCursorCharOffset,
	});
	if (history.undoStack.length > MAX_HISTORY) history.undoStack.shift();
	history.redoStack.length = 0;
};

/** Restore a history entry into the editor. */
export const applyHistoryEntry = (
	entry: HistoryEntry,
	pRef: HTMLParagraphElement,
	setInputContent: Setter<TextWithFacets>,
	setSkipNextEffect: (v: boolean) => void,
	pendingFormats: Set<string>,
	setPendingByteOffset: (v: number | null) => void,
	setToolbarState: Setter<ToolbarState | null>,
	history: HistoryState,
	community?: string,
) => {
	setSkipNextEffect(true);
	setInputContent(entry.content);

	const newRendered = renderWithFacets(entry.content, community);
	pRef.innerHTML = twemoji.parse(newRendered);

	pendingFormats.clear();
	setPendingByteOffset(null);
	setToolbarState(null);

	// Update tracked cursor offset immediately so subsequent
	// undo/redo operations have the correct value even before
	// the async selectionchange event fires.
	history.lastCursorCharOffset = entry.cursorCharOffset;

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
export const performUndo = (
	history: HistoryState,
	getText: () => TextWithFacets,
	pRef: HTMLParagraphElement | undefined,
	setInputContent: Setter<TextWithFacets> | undefined,
	setSkipNextEffect: (v: boolean) => void,
	pendingFormats: Set<string>,
	setPendingByteOffset: (v: number | null) => void,
	setToolbarState: Setter<ToolbarState | null>,
	community?: string,
) => {
	if (history.undoStack.length === 0) return;
	if (!pRef || !setInputContent) return;

	// Flush any in-progress typing burst so its state is captured
	if (history.typingBurstTimer !== null) {
		clearTimeout(history.typingBurstTimer);
		history.typingBurstTimer = null;
	}
	history.inTypingBurst = false;

	// Save current state to redo stack
	const current = getText();
	history.redoStack.push({
		content: cloneContent(current),
		cursorCharOffset: history.lastCursorCharOffset,
	});

	const entry = history.undoStack.pop()!;
	applyHistoryEntry(
		entry,
		pRef,
		setInputContent,
		setSkipNextEffect,
		pendingFormats,
		setPendingByteOffset,
		setToolbarState,
		history,
		community,
	);
};

/** Redoes a singular action. */
export const performRedo = (
	history: HistoryState,
	getText: () => TextWithFacets,
	pRef: HTMLParagraphElement | undefined,
	setInputContent: Setter<TextWithFacets> | undefined,
	setSkipNextEffect: (v: boolean) => void,
	pendingFormats: Set<string>,
	setPendingByteOffset: (v: number | null) => void,
	setToolbarState: Setter<ToolbarState | null>,
	community?: string,
) => {
	if (history.redoStack.length === 0) return;
	if (!pRef || !setInputContent) return;

	// Flush any in-progress typing burst
	if (history.typingBurstTimer !== null) {
		clearTimeout(history.typingBurstTimer);
		history.typingBurstTimer = null;
	}
	history.inTypingBurst = false;

	// Save current state to undo stack
	const current = getText();
	history.undoStack.push({
		content: cloneContent(current),
		cursorCharOffset: history.lastCursorCharOffset,
	});

	const entry = history.redoStack.pop()!;
	applyHistoryEntry(
		entry,
		pRef,
		setInputContent,
		setSkipNextEffect,
		pendingFormats,
		setPendingByteOffset,
		setToolbarState,
		history,
		community,
	);
};

/** Create a fresh history state object. */
export const createHistoryState = (): HistoryState => ({
	undoStack: [],
	redoStack: [],
	lastCursorCharOffset: null,
	inTypingBurst: false,
	typingBurstTimer: null,
});
