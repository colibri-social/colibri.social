import { useNavigate } from "@solidjs/router";
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
import { cn } from "@/utils/cn";
import { purify } from "@/utils/purify";
import type { ChannelData } from "@/utils/sdk";
import { useChannelContext } from "../../contexts/ChannelContext";
import {
	ChannelMentionPopup,
	type ChannelMentionState,
} from "./ChannelMentionPopup";
import { EMOJI_DATA, searchEmoji } from "./emojiData";
import { EmojiMentionPopup, type EmojiMentionState } from "./EmojiMentionPopup";
import { handleToolbarFormat, toggleFormat } from "./formatToggle";
import {
	createHistoryState,
	type HistoryState,
	performRedo,
	performUndo,
	saveForUndo,
	TYPING_BURST_MS,
} from "./history";
import { Toolbar } from "./Toolbar";
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
	type TextWithFacets,
	type ToolbarState,
	textEncoder,
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
	placeholder?: string;
	id?: string;
	class?: string;
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

	const history: HistoryState = createHistoryState();

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

	const channelCtx = useChannelContext();
	const [channelMentionState, setChannelMentionState] =
		createSignal<ChannelMentionState | null>(null);
	const [emojiMentionState, setEmojiMentionState] =
		createSignal<EmojiMentionState | null>(null);

	const availableChannels = (): Array<ChannelData> => {
		return channelCtx?.channels() ?? [];
	};

	const community = (): string => {
		return channelCtx?.community() ?? "";
	};

	/** Blocks the browser's native undo/redo so we handle it ourselves. */
	const handleBeforeInput = (e: InputEvent) => {
		if (e.inputType === "historyUndo" || e.inputType === "historyRedo") {
			e.preventDefault();
		}
	};

	const rendered = renderWithFacets(props.text(), community());
	const renderedWithEmojis = twemoji.parse(rendered);

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

	const handleSelection = () => {
		if (popoverOpen) return;

		pendingFormats.clear();
		pendingByteOffset = null;

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
	/**
	 * Detect whether the cursor is currently inside a `:query` emoji trigger.
	 * Returns the query string and the char offset of the leading colon,
	 * or null if the cursor is not in such a position.
	 */
	const detectEmojiTrigger = (): {
		query: string;
		colonCharOffset: number;
	} | null => {
		if (!pRef) return null;

		const sel = document.getSelection();
		if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return null;

		const offsets = getSelectionByteOffsets(pRef, sel.getRangeAt(0));
		if (!offsets) return null;

		const currentText = props.text().text;
		const textBeforeCursor = currentText.substring(0, offsets.charEnd);

		// Find the last unmatched colon before the cursor.
		const colonIndex = textBeforeCursor.lastIndexOf(":");
		if (colonIndex === -1) return null;

		// The colon must be preceded by a word boundary (start of text,
		// whitespace, or newline) so we don't trigger inside URLs etc.
		if (colonIndex > 0) {
			const charBefore = textBeforeCursor[colonIndex - 1];
			if (charBefore !== " " && charBefore !== "\n" && charBefore !== "\t") {
				return null;
			}
		}

		const query = textBeforeCursor.substring(colonIndex + 1);

		// Query must not contain spaces or another colon (that would be a
		// closed :name: sequence the user already finished typing).
		if (/[\s:]/.test(query)) return null;

		// Require at least one character typed after the colon so we don't
		// pop up immediately on every standalone colon.
		if (query.length === 0) return null;

		return { query, colonCharOffset: colonIndex };
	};

	const updateEmojiMention = () => {
		if (!props.editable) {
			setEmojiMentionState(null);
			return;
		}

		const trigger = detectEmojiTrigger();
		if (!trigger) {
			setEmojiMentionState(null);
			return;
		}

		const caretPos = getCaretPixelPosition();
		if (!caretPos) {
			setEmojiMentionState(null);
			return;
		}

		// Close channel popup when emoji popup becomes active.
		setChannelMentionState(null);

		setEmojiMentionState({
			query: trigger.query,
			top: caretPos.top,
			left: caretPos.left,
			colonCharOffset: trigger.colonCharOffset,
		});
	};

	/**
	 * Called when the user selects an emoji from the autocomplete popup.
	 * Replaces the `:query` text with the raw Unicode emoji character.
	 */
	const handleEmojiSelect = (entry: { name: string; emoji: string }) => {
		const state = emojiMentionState();
		if (!state || !pRef || !props.setInputContent) return;

		saveForUndo(history, () => props.text());

		const current = props.text();
		const currentText = current.text;

		const sel = document.getSelection();
		if (!sel || sel.rangeCount === 0) return;

		const cursorOffsets = getSelectionByteOffsets(pRef, sel.getRangeAt(0));
		if (!cursorOffsets) return;

		// Replace from the colon up to (and including) the current cursor
		// position with the emoji character followed by a space.
		const beforeColon = currentText.substring(0, state.colonCharOffset);
		const afterCursor = currentText.substring(cursorOffsets.charEnd);
		const newText = `${beforeColon}${entry.emoji} ${afterCursor}`;

		const colonByteOffset = textEncoder.encode(beforeColon).byteLength;
		const emojiBytes = textEncoder.encode(entry.emoji).byteLength;
		const spaceBytes = 1;
		const replacedByteStart = colonByteOffset;
		const replacedByteEnd = cursorOffsets.byteEnd;
		const insertedBytes = emojiBytes + spaceBytes;
		const byteShift = insertedBytes - (replacedByteEnd - replacedByteStart);

		// Shift all facets that sit after the replaced range.
		const newFacets = current.facets
			.filter(
				(f) =>
					!(
						f.index.byteStart >= replacedByteStart &&
						f.index.byteEnd <= replacedByteEnd
					),
			)
			.map((f) => {
				if (f.index.byteEnd <= replacedByteStart) return f;
				if (f.index.byteStart >= replacedByteEnd) {
					return {
						...f,
						index: {
							byteStart: f.index.byteStart + byteShift,
							byteEnd: f.index.byteEnd + byteShift,
						},
					} as typeof f;
				}
				return f;
			});

		const newContent: TextWithFacets = { text: newText, facets: newFacets };

		skipNextEffect = true;
		props.setInputContent(newContent);

		const newRendered = renderWithFacets(newContent, community());
		pRef.innerHTML = twemoji.parse(newRendered);

		// Place the caret after the inserted emoji + space.
		const cursorCharOffset =
			state.colonCharOffset + [...entry.emoji].length + 1; // +1 for space
		const ref = pRef;
		requestAnimationFrame(() => {
			const pos = charOffsetToDomPosition(ref, cursorCharOffset);
			if (pos) {
				const domSel = document.getSelection();
				if (domSel) {
					domSel.collapse(pos.node, pos.offset);
				}
			}
			ref.focus();
		});

		setEmojiMentionState(null);
	};

	const handleEmojiDismiss = () => {
		setEmojiMentionState(null);
	};

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

		const hashIndex = textBeforeCursor.lastIndexOf("#");
		if (hashIndex === -1) return null;

		if (hashIndex > 0) {
			const charBefore = textBeforeCursor[hashIndex - 1];
			if (charBefore !== " " && charBefore !== "\n" && charBefore !== "\t") {
				return null;
			}
		}

		const query = textBeforeCursor.substring(hashIndex + 1);

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

		// Close emoji popup when channel popup becomes active.
		setEmojiMentionState(null);

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

		const sel = document.getSelection();
		if (!sel || sel.rangeCount === 0) return;

		const cursorOffsets = getSelectionByteOffsets(pRef, sel.getRangeAt(0));
		if (!cursorOffsets) return;

		const beforeHash = currentText.substring(0, state.hashCharOffset);
		const afterCursor = currentText.substring(cursorOffsets.charEnd);
		const channelText = `#${channel.name}`;
		const newText = `${beforeHash}${channelText} ${afterCursor}`;

		const hashByteOffset = textEncoder.encode(beforeHash).byteLength;
		const channelTextBytes = textEncoder.encode(channelText).byteLength;
		const spaceBytes = 1;

		const replacedByteStart = hashByteOffset;
		const replacedByteEnd = cursorOffsets.byteEnd;
		const insertedBytes = channelTextBytes + spaceBytes;
		const byteShift = insertedBytes - (replacedByteEnd - replacedByteStart);

		const newFacets: Facet[] = [];
		for (const facet of current.facets) {
			if (
				facet.index.byteStart >= replacedByteStart &&
				facet.index.byteEnd <= replacedByteEnd
			) {
				continue;
			}
			if (facet.index.byteEnd <= replacedByteStart) {
				newFacets.push(facet);
				continue;
			}
			if (facet.index.byteStart >= replacedByteEnd) {
				newFacets.push({
					...facet,
					index: {
						byteStart: facet.index.byteStart + byteShift,
						byteEnd: facet.index.byteEnd + byteShift,
					},
				} as Facet);
			}
		}

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

	createEffect(
		on(
			() => props.editable,
			(editable) => {
				if (!editable) return;

				if (!pRef) return;

				pRef.focus();

				const sel = document.getSelection();
				if (sel) {
					const range = document.createRange();
					range.selectNodeContents(pRef);
					range.collapse(false);
					sel.removeAllRanges();
					sel.addRange(range);
				}
			},
		),
	);

	const handleKeyDown = (e: KeyboardEvent) => {
		if (!props.editable || !props.setInputContent || !pRef) return;

		const isModifier = e.ctrlKey || e.metaKey;
		if (!isModifier) return;

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

	const handleInput: JSX.InputEventHandlerUnion<
		HTMLParagraphElement,
		InputEvent
	> = (e) => {
		if (!props.setInputContent) return;

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

		twemoji.parse(e.currentTarget);

		if (cursorCharOffset !== null && pRef && sel) {
			const pos = charOffsetToDomPosition(pRef, cursorCharOffset);
			if (pos) {
				sel.collapse(pos.node, pos.offset);
			}
		}

		const parsed = parseDomToFacets(e.currentTarget);

		// ── Colon-completion: :name: → emoji ─────────────────────────────
		// If the character just typed was ":" and the text immediately before
		// the cursor matches :[validName]:, substitute it now — before any
		// further processing — so the emoji lands in plain text and twemoji
		// can render it.
		if (
			cursorCharOffset !== null &&
			props.setInputContent &&
			pRef &&
			parsed.text[cursorCharOffset - 1] === ":"
		) {
			const textBeforeCursor = parsed.text.substring(0, cursorCharOffset);
			// Find the opening colon (must be word-boundary-preceded or at start)
			const openColon = textBeforeCursor.lastIndexOf(":", cursorCharOffset - 2);
			if (openColon !== -1) {
				const isWordBoundary =
					openColon === 0 ||
					parsed.text[openColon - 1] === " " ||
					parsed.text[openColon - 1] === "\n" ||
					parsed.text[openColon - 1] === "\t";
				if (isWordBoundary) {
					const maybeName = parsed.text.substring(
						openColon + 1,
						cursorCharOffset - 1,
					);
					const emojiChar =
						maybeName.length > 0 ? EMOJI_DATA[maybeName] : undefined;
					if (emojiChar) {
						// Perform substitution inline, identically to handleEmojiSelect.
						const beforeColon = parsed.text.substring(0, openColon);
						const afterCursor = parsed.text.substring(cursorCharOffset);
						const newText = `${beforeColon}${emojiChar} ${afterCursor}`;

						const colonByteOffset = textEncoder.encode(beforeColon).byteLength;
						const emojiByteLen = textEncoder.encode(emojiChar).byteLength;
						const replacedByteStart = colonByteOffset;
						const replacedByteEnd = textEncoder.encode(
							parsed.text.substring(0, cursorCharOffset),
						).byteLength;
						const insertedBytes = emojiByteLen + 1; // +1 space
						const byteShift =
							insertedBytes - (replacedByteEnd - replacedByteStart);

						const newFacets = parsed.facets
							.filter(
								(f) =>
									!(
										f.index.byteStart >= replacedByteStart &&
										f.index.byteEnd <= replacedByteEnd
									),
							)
							.map((f) => {
								if (f.index.byteEnd <= replacedByteStart) return f;
								if (f.index.byteStart >= replacedByteEnd) {
									return {
										...f,
										index: {
											byteStart: f.index.byteStart + byteShift,
											byteEnd: f.index.byteEnd + byteShift,
										},
									} as typeof f;
								}
								return f;
							});

						const newContent: TextWithFacets = {
							text: newText,
							facets: newFacets,
						};
						skipNextEffect = true;
						props.setInputContent(newContent);

						const newRendered = renderWithFacets(newContent, community());
						pRef.innerHTML = twemoji.parse(newRendered);

						const newCursorCharOffset = openColon + [...emojiChar].length + 1;
						const ref = pRef;
						requestAnimationFrame(() => {
							const pos = charOffsetToDomPosition(ref, newCursorCharOffset);
							if (pos) {
								const domSel = document.getSelection();
								if (domSel) domSel.collapse(pos.node, pos.offset);
							}
							ref.focus();
						});

						setEmojiMentionState(null);
						history.lastCursorCharOffset = newCursorCharOffset;
						return;
					}
				}
			}
		}
		// ─────────────────────────────────────────────────────────────────

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

		pendingFormats.clear();
		pendingByteOffset = null;

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

		queueMicrotask(() => {
			updateChannelMention();
			updateEmojiMention();
		});
	};

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
				class={cn(
					"m-0 text-foreground rich-text focus:outline-0 leading-5.5 wrap-break-word relative before:absolute before:w-full before:h-full before:content-(--placeholder) before:text-muted-foreground before:pointer-events-none",
					props.class,
				)}
				style={
					props.placeholder && props.text().text.trim().length === 0
						? { "--placeholder": `"${props.placeholder}"` }
						: undefined
				}
				contentEditable={props.editable}
				innerHTML={purify(renderedWithEmojis)}
				classList={props.classList}
				onKeyDown={handleKeyDown}
				onInput={handleInput}
				onBeforeInput={handleBeforeInput}
				onClick={handleClick}
				ref={pRef}
				id={props.id}
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
			<Show when={props.editable && emojiMentionState() !== null}>
				<Portal>
					<EmojiMentionPopup
						state={emojiMentionState}
						results={() => searchEmoji(emojiMentionState()?.query ?? "")}
						onSelect={handleEmojiSelect}
						onDismiss={handleEmojiDismiss}
					/>
				</Portal>
			</Show>
		</>
	);
};
