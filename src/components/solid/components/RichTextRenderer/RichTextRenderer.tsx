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
import { useNavigate } from "@solidjs/router";
import type { Facet } from "@/utils/atproto/rich-text";
import type { ChannelData } from "@/utils/sdk";
import { useChannelContext } from "../../contexts/ChannelContext";
import {
	ChannelMentionPopup,
	type ChannelMentionState,
} from "./ChannelMentionPopup";
import { Toolbar } from "./Toolbar";
import {
	createHistoryState,
	TYPING_BURST_MS,
	saveForUndo,
	performUndo,
	performRedo,
	type HistoryState,
} from "./history";
import { handleToolbarFormat, toggleFormat } from "./formatToggle";
import {
	charOffsetToDomPosition,
	computeActiveFormats,
	facetsChanged,
	formatTypeToFeature,
	getSelectionByteOffsets,
	getSelectionPixels,
	mergeWithDetectedFacets,
	parseDomToFacets,
	renderWithFacets,
	stripAutoDetectedLinks,
	textEncoder,
	type TextWithFacets,
	type ToolbarState,
} from "./util";

/**
 * A rich text renderer component that parses a given text and renders its facets as HTML.
 * Can be made editable using the `editable` prop.
 */
export const RichTextRenderer: Component<{
	editable?: boolean;
	text: Accessor<TextWithFacets>;
	setInputContent?: Setter<TextWithFacets>;
	classList?: Record<string, boolean>;
}> = (props) => {
	const navigate = useNavigate();
	let pRef: HTMLParagraphElement | undefined;
	let skipNextEffect = false;
	const setSkipNextEffect = (v: boolean) => {
		skipNextEffect = v;
	};

	/** Formats armed by a keyboard shortcut on a collapsed cursor, applied on the next insertion. */
	const pendingFormats = new Set<string>();
	/** Byte offset of the cursor when pending formats were armed. */
	let pendingByteOffset: number | null = null;
	const setPendingByteOffset = (v: number | null) => {
		pendingByteOffset = v;
	};

	// ── History ────────────────────────────────────────────────
	const history: HistoryState = createHistoryState();

	// ── Toolbar ────────────────────────────────────────────────
	const [toolbarState, setToolbarState] = createSignal<ToolbarState | null>(
		null,
	);
	let popoverOpen = false;
	const setPopoverOpen = (v: boolean) => {
		popoverOpen = v;
	};

	const handlePopoverOpenChange = (open: boolean) => {
		popoverOpen = open;
	};

	// ── Channel mention autocomplete ───────────────────────────
	const channelCtx = useChannelContext();
	const [channelMentionState, setChannelMentionState] =
		createSignal<ChannelMentionState | null>(null);

	const availableChannels = (): Array<ChannelData> => {
		return channelCtx?.channels() ?? [];
	};

	const community = (): string => {
		return channelCtx?.community() ?? "";
	};

	/** Block the browser's native undo/redo so we handle it ourselves. */
	const handleBeforeInput = (e: InputEvent) => {
		if (e.inputType === "historyUndo" || e.inputType === "historyRedo") {
			e.preventDefault();
		}
	};

	// ── Initial render ─────────────────────────────────────────
	const rendered = renderWithFacets(props.text(), community());
	const renderedWithEmojis = twemoji.parse(rendered);

	// Re-render the contentEditable DOM when the text signal changes externally
	createEffect(
		on(
			() => props.text(),
			(content) => {
				if (skipNextEffect) {
					skipNextEffect = false;
					return;
				}
				if (pRef) {
					const newRendered = renderWithFacets(content, community());
					pRef.innerHTML = twemoji.parse(newRendered);
				}
				pendingFormats.clear();
				pendingByteOffset = null;
				history.undoStack.length = 0;
				history.redoStack.length = 0;
				history.inTypingBurst = false;
				if (history.typingBurstTimer !== null) {
					clearTimeout(history.typingBurstTimer);
					history.typingBurstTimer = null;
				}
				history.lastCursorCharOffset = null;
			},
			{ defer: true },
		),
	);

	// ── Selection handling ─────────────────────────────────────
	const handleSelection = () => {
		if (popoverOpen) return;

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
				history.lastCursorCharOffset = curOffsets.charEnd;
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
				let isBackward = false;
				if (sel.anchorNode && sel.focusNode) {
					if (sel.anchorNode === sel.focusNode) {
						isBackward = sel.anchorOffset > sel.focusOffset;
					} else {
						const cmp = sel.anchorNode.compareDocumentPosition(sel.focusNode);
						isBackward = (cmp & Node.DOCUMENT_POSITION_PRECEDING) !== 0;
					}
				}

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

	// ── Toolbar format handler ─────────────────────────────────
	const handleFormat = (formatType: string, link?: string) => {
		handleToolbarFormat(
			formatType,
			toolbarState,
			() => props.text(),
			pRef,
			props.setInputContent,
			setSkipNextEffect,
			setToolbarState,
			setPopoverOpen,
			history,
			link,
			community(),
		);
	};

	// ── Channel mention helpers ────────────────────────────────

	/**
	 * Get the pixel position of the caret. Used to position the channel
	 * mention popup above the cursor.
	 */
	const getCaretPixelPosition = (): { top: number; left: number } | null => {
		const sel = document.getSelection();
		if (!sel || sel.rangeCount === 0) return null;
		const range = sel.getRangeAt(0).cloneRange();
		range.collapse(true);
		const rect = range.getBoundingClientRect();
		if (rect.height === 0) return null;
		return {
			top: rect.top,
			left: rect.left,
		};
	};

	/**
	 * Scans text before the cursor to find an active `#query` pattern.
	 * Returns the query string and offsets if found, or null.
	 */
	const detectChannelMentionTrigger = (): {
		query: string;
		hashCharOffset: number;
		hashByteOffset: number;
	} | null => {
		if (!pRef) return null;

		const sel = document.getSelection();
		if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return null;

		const offsets = getSelectionByteOffsets(pRef, sel.getRangeAt(0));
		if (!offsets) return null;

		const currentText = props.text().text;
		const textBeforeCursor = currentText.substring(0, offsets.charEnd);

		// Search backwards from the cursor for a `#` that signals a channel mention.
		// The `#` must be at the start of the text or preceded by whitespace.
		const hashIndex = textBeforeCursor.lastIndexOf("#");
		if (hashIndex === -1) return null;

		// Verify the `#` is at the start or preceded by a space/newline
		if (hashIndex > 0) {
			const charBefore = textBeforeCursor[hashIndex - 1];
			if (charBefore !== " " && charBefore !== "\n" && charBefore !== "\t") {
				return null;
			}
		}

		const query = textBeforeCursor.substring(hashIndex + 1);

		// Don't trigger if there's a space in the query (user moved on)
		if (/\s/.test(query)) return null;

		const hashByteOffset = textEncoder.encode(
			textBeforeCursor.substring(0, hashIndex),
		).byteLength;

		return {
			query,
			hashCharOffset: hashIndex,
			hashByteOffset,
		};
	};

	/**
	 * Update the channel mention popup state based on the current cursor position.
	 */
	const updateChannelMention = () => {
		if (!props.editable || availableChannels().length === 0) {
			setChannelMentionState(null);
			return;
		}

		const trigger = detectChannelMentionTrigger();
		if (!trigger) {
			setChannelMentionState(null);
			return;
		}

		const caretPos = getCaretPixelPosition();
		if (!caretPos) {
			setChannelMentionState(null);
			return;
		}

		setChannelMentionState({
			query: trigger.query,
			top: caretPos.top,
			left: caretPos.left,
			hashCharOffset: trigger.hashCharOffset,
			hashByteOffset: trigger.hashByteOffset,
		});
	};

	/**
	 * Called when the user selects a channel from the autocomplete popup.
	 * Replaces the `#query` text with a channel mention facet.
	 */
	const handleChannelSelect = (channel: ChannelData) => {
		const state = channelMentionState();
		if (!state || !pRef || !props.setInputContent) return;

		saveForUndo(history, () => props.text());

		const current = props.text();
		const currentText = current.text;

		// The text to replace: from the `#` to the current cursor
		const sel = document.getSelection();
		if (!sel || sel.rangeCount === 0) return;

		const cursorOffsets = getSelectionByteOffsets(pRef, sel.getRangeAt(0));
		if (!cursorOffsets) return;

		const beforeHash = currentText.substring(0, state.hashCharOffset);
		const afterCursor = currentText.substring(cursorOffsets.charEnd);
		const channelText = `#${channel.name}`;
		const newText = beforeHash + channelText + " " + afterCursor;

		const hashByteOffset = textEncoder.encode(beforeHash).byteLength;
		const channelTextBytes = textEncoder.encode(channelText).byteLength;
		const spaceBytes = 1; // space is 1 byte

		// Adjust existing facets: remove any that overlap with the replaced region,
		// and shift facets that come after
		const replacedByteStart = hashByteOffset;
		const replacedByteEnd = cursorOffsets.byteEnd;
		const insertedBytes = channelTextBytes + spaceBytes;
		const byteShift = insertedBytes - (replacedByteEnd - replacedByteStart);

		const newFacets: Facet[] = [];
		for (const facet of current.facets) {
			// Completely inside the replaced region — drop it
			if (
				facet.index.byteStart >= replacedByteStart &&
				facet.index.byteEnd <= replacedByteEnd
			) {
				continue;
			}
			// Completely before the replaced region — keep as-is
			if (facet.index.byteEnd <= replacedByteStart) {
				newFacets.push(facet);
				continue;
			}
			// Completely after the replaced region — shift
			if (facet.index.byteStart >= replacedByteEnd) {
				newFacets.push({
					...facet,
					index: {
						byteStart: facet.index.byteStart + byteShift,
						byteEnd: facet.index.byteEnd + byteShift,
					},
				} as Facet);
				continue;
			}
			// Partial overlap — drop (edge case; shouldn't happen often)
		}

		// Add the channel mention facet
		newFacets.push({
			index: {
				byteStart: hashByteOffset,
				byteEnd: hashByteOffset + channelTextBytes,
			},
			features: [
				{
					$type: "social.colibri.richtext.facet#channel",
					channel: channel.rkey,
				},
			],
		} as Facet);

		newFacets.sort((a, b) => a.index.byteStart - b.index.byteStart);

		const newContent: TextWithFacets = {
			text: newText,
			facets: newFacets,
		};

		skipNextEffect = true;
		props.setInputContent(newContent);

		const newRendered = renderWithFacets(newContent, community());
		pRef.innerHTML = twemoji.parse(newRendered);

		// Place cursor after the channel mention + space
		const cursorCharOffset = state.hashCharOffset + channelText.length + 1; // +1 for the space

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

		setChannelMentionState(null);
	};

	const handleChannelDismiss = () => {
		setChannelMentionState(null);
	};

	// ── Keyboard shortcut handling ─────────────────────────────
	const handleKeyDown = (e: KeyboardEvent) => {
		if (!props.editable || !props.setInputContent || !pRef) return;

		const isModifier = e.ctrlKey || e.metaKey;
		if (!isModifier) return;

		// ── Undo / Redo ────────────────────────────────────────
		if (e.key.toLowerCase() === "z" && !e.shiftKey) {
			e.preventDefault();
			performUndo(
				history,
				() => props.text(),
				pRef,
				props.setInputContent,
				setSkipNextEffect,
				pendingFormats,
				setPendingByteOffset,
				setToolbarState,
				community(),
			);
			return;
		}
		if (
			(e.key.toLowerCase() === "z" && e.shiftKey) ||
			e.key.toLowerCase() === "y"
		) {
			e.preventDefault();
			performRedo(
				history,
				() => props.text(),
				pRef,
				props.setInputContent,
				setSkipNextEffect,
				pendingFormats,
				setPendingByteOffset,
				setToolbarState,
				community(),
			);
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

		// ── Collapsed cursor → toggle a pending format ──────────
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

		// ── Non-collapsed selection → toggle format immediately ──
		const range = sel.getRangeAt(0);
		const offsets = getSelectionByteOffsets(pRef, range);
		if (!offsets || offsets.byteStart === offsets.byteEnd) return;

		const feature = formatTypeToFeature(formatType);
		if (!feature) return;

		saveForUndo(history, () => props.text(), offsets.charEnd);

		toggleFormat(
			formatType,
			offsets,
			offsets.charEnd,
			() => props.text(),
			pRef,
			props.setInputContent,
			setSkipNextEffect,
			setToolbarState,
			setPopoverOpen,
			undefined,
			community(),
		);
	};

	// ── Input handling ─────────────────────────────────────────
	const handleInput: JSX.InputEventHandlerUnion<
		HTMLParagraphElement,
		InputEvent
	> = (e) => {
		if (!props.setInputContent) return;

		// ── Undo: save state before the first input in a typing burst ──
		if (!history.inTypingBurst) {
			saveForUndo(history, () => props.text());
			history.inTypingBurst = true;
		}
		if (history.typingBurstTimer !== null)
			clearTimeout(history.typingBurstTimer);
		history.typingBurstTimer = setTimeout(() => {
			history.inTypingBurst = false;
			history.typingBurstTimer = null;
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

		// While the channel mention popup is active, suppress any
		// auto-detected channel facets that weren't already present in the
		// DOM-sourced parse (i.e., only strip the newly detected ones so
		// the `#query` text stays plain while the user picks a channel).
		// Already-confirmed channel facets that live in the DOM are kept.
		if (channelMentionState() !== null) {
			const domChannelFacets = new Set(
				parsed.facets
					.filter((f) =>
						f.features.some(
							(feat) => feat.$type === "social.colibri.richtext.facet#channel",
						),
					)
					.map((f) => `${f.index.byteStart}:${f.index.byteEnd}`),
			);

			result = {
				text: result.text,
				facets: result.facets.filter((f) => {
					const isChannel = f.features.some(
						(feat) => feat.$type === "social.colibri.richtext.facet#channel",
					);
					if (!isChannel) return true;
					// Keep it only if it was already in the DOM-parsed facets
					return domChannelFacets.has(
						`${f.index.byteStart}:${f.index.byteEnd}`,
					);
				}),
			};
		}

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

			const newRendered = renderWithFacets(result, community());
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

		// If auto-detection added new facets, re-render
		if (facetsChangedByDetection && pRef) {
			const newRendered = renderWithFacets(result, community());
			pRef.innerHTML = twemoji.parse(newRendered);

			if (cursorCharOffset !== null && sel) {
				const pos = charOffsetToDomPosition(pRef, cursorCharOffset);
				if (pos) {
					sel.collapse(pos.node, pos.offset);
				}
			}
		}

		// When all meaningful content has been deleted, clear stale wrappers
		if (
			result.text.replace(/\n/g, "").length === 0 &&
			result.facets.length > 0
		) {
			e.currentTarget.innerHTML = "";
			skipNextEffect = true;
			props.setInputContent({ text: "", facets: [] });
			setChannelMentionState(null);
			return;
		}

		skipNextEffect = true;
		props.setInputContent(result);

		if (cursorCharOffset !== null) {
			history.lastCursorCharOffset = cursorCharOffset;
		}

		// Update channel mention popup after input
		// Use a microtask so the DOM and props.text() are settled
		queueMicrotask(() => {
			updateChannelMention();
		});
	};

	// ── Lifecycle ──────────────────────────────────────────────
	onMount(() => {
		document.addEventListener("selectionchange", handleSelection);
	});

	onCleanup(() => {
		document.removeEventListener("selectionchange", handleSelection);
		if (history.typingBurstTimer !== null) {
			clearTimeout(history.typingBurstTimer);
			history.typingBurstTimer = null;
		}
	});

	/** Intercept clicks on channel mention links for SPA navigation. */
	const handleClick = (e: MouseEvent) => {
		const target = (e.target as HTMLElement).closest<HTMLAnchorElement>(
			"a[data-facet-type='channel']",
		);
		if (!target) return;

		e.preventDefault();
		const href = target.getAttribute("href");
		if (href) {
			navigate(href);
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
				onClick={handleClick}
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
			<Show when={props.editable && channelMentionState() !== null}>
				<Portal>
					<ChannelMentionPopup
						state={channelMentionState}
						channels={availableChannels}
						onSelect={handleChannelSelect}
						onDismiss={handleChannelDismiss}
					/>
				</Portal>
			</Show>
		</>
	);
};
