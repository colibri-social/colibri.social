import { Blockquote } from "@tiptap/extension-blockquote";
import { BubbleMenu } from "@tiptap/extension-bubble-menu";
import { Document } from "@tiptap/extension-document";
import Emoji from "@tiptap/extension-emoji";
import { HardBreak } from "@tiptap/extension-hard-break";
import { Mention } from "@tiptap/extension-mention";
import { Paragraph } from "@tiptap/extension-paragraph";
import { Text } from "@tiptap/extension-text";
import { Placeholder, UndoRedo } from "@tiptap/extensions";
import {
	type Component,
	createEffect,
	createSignal,
	Show,
	untrack,
} from "solid-js";
import { createEditorTransaction, createTiptapEditor } from "solid-tiptap";
import "./TextEditor.css";
import {
	type ColibriRichTextFacet,
	tokenizeMarkdown,
} from "@colibri-social/lib";
import { type Editor, mergeAttributes } from "@tiptap/core";
import twemoji from "@twemoji/api";
import { TextSelection } from "prosemirror-state";
import CodeIcon from "~icons/ph/code";
import SmileyIcon from "~icons/ph/smiley";
import TextBIcon from "~icons/ph/text-b";
import TextItalicIcon from "~icons/ph/text-italic";
import TextStrikethroughIcon from "~icons/ph/text-strikethrough";
import TextUnderlineIcon from "~icons/ph/text-underline";
import type { GifItem } from "../../../../atproto/xrpc/social/colibri/embed/gifTypes";
import { useChannelContext } from "../../../../contexts/Channel";
import { useCommunityContext } from "../../../../contexts/Community";
import { useUserContext } from "../../../../contexts/User";
import { useUserPreferences } from "../../../../contexts/UserPreferences";
import { createFenceRegex } from "../../../../utils/fenced-code-regex";
import { htmlToDOMOutputSpec } from "../../../../utils/html-to-dom-output-spec";
import { useIsMobile } from "../../../../utils/mobile-pane";
import {
	Tooltip,
	TooltipContent,
	TooltipPortal,
	TooltipTrigger,
} from "../../../ui/Tooltip";
import { ComposerMediaPickers } from "../ComposerMediaPickers";
import { EmojiPopover } from "../EmojiPopover";
import { EMOJI_DATA } from "../rich-text-renderer/emojiData";
import { buildSuggestions } from "./build-suggestions";
import { MarkdownDecorations } from "./markdown-code-highlight";
import { proseMirrorToFacets } from "./prosemirror-to-facets";

const CHARACTER_LIMIT = 2048;
const CIRCUMFERENCE = 2 * Math.PI * 8;

type BubbleMenuMark = "bold" | "strike" | "underline" | "code" | "italic";

type ToggleKind = "bold" | "italic" | "underline" | "strikethrough" | "code";

const KIND_MARKER: Record<ToggleKind, string> = {
	bold: "**",
	italic: "*",
	underline: "__",
	strikethrough: "~~",
	code: "`",
};

/**
 * Toggles literal markdown markers around the current selection
 */
const toggleMarker = (editor: Editor, kind: ToggleKind): void => {
	const marker = KIND_MARKER[kind];
	const { state } = editor;
	const { from, to } = state.selection;
	if (from === to) return;

	const len = marker.length;
	const simpleWrap = () => {
		editor
			.chain()
			.focus()
			.insertContentAt(to, marker)
			.insertContentAt(from, marker)
			.setTextSelection({ from: from + len, to: to + len })
			.run();
	};

	const block = state.selection.$from.parent;
	if (!block.isTextblock) {
		simpleWrap();
		return;
	}
	const blockStart = state.selection.$from.start();

	let text = "";
	const positions: number[] = [];
	block.forEach((child, offset) => {
		if (child.isText && child.text) {
			for (let i = 0; i < child.text.length; i++) {
				positions.push(blockStart + offset + i);
			}
			text += child.text;
		} else if (child.type.name === "hardBreak") {
			positions.push(blockStart + offset);
			text += "\n";
		} else {
			positions.push(blockStart + offset);
			text += "￼";
		}
	});
	positions.push(blockStart + block.content.size);

	const selStart = positions.indexOf(from);
	const selEnd = positions.indexOf(to);
	if (selStart === -1 || selEnd === -1) {
		simpleWrap();
		return;
	}

	const containing = tokenizeMarkdown(text)
		.filter(
			(t) =>
				t.kind === kind && t.content[0] <= selStart && t.content[1] >= selEnd,
		)
		.sort(
			(a, b) => a.content[1] - a.content[0] - (b.content[1] - b.content[0]),
		);

	if (containing.length === 0) {
		simpleWrap();
		return;
	}

	const token = containing[0];
	const ranges = token.markers
		.map(([s, e]) => ({ from: positions[s], to: positions[e] }))
		.sort((a, b) => b.from - a.from);
	const removedBefore = token.markers
		.filter(([, e]) => e <= selStart)
		.reduce((sum, [s, e]) => sum + (positions[e] - positions[s]), 0);

	let chain = editor.chain().focus();
	for (const range of ranges) chain = chain.deleteRange(range);
	chain
		.setTextSelection({ from: from - removedBefore, to: to - removedBefore })
		.run();
};

type FenceMatchIndices = RegExpMatchArray & {
	indices: Array<[number, number]>;
};

/**
 * Whether the cursor currently sits inside a ```lang fenced code block.
 * Fences aren't a separate node (see MarkdownCodeHighlight) — they're plain
 * text within a single textblock where newlines are hardBreaks — so we
 * rebuild the block text with a doc-position map and run the same shared
 * fence regex used by the highlighter and facet detection.
 */
const isInFencedCodeBlock = (editor: Editor): boolean => {
	const { selection } = editor.state;
	const block = selection.$from.parent;
	if (!block.isTextblock) return false;

	const blockStart = selection.$from.start();

	let text = "";
	const positions: number[] = [];
	block.forEach((child, offset) => {
		if (child.isText && child.text) {
			for (let i = 0; i < child.text.length; i++) {
				positions.push(blockStart + offset + i);
			}
			text += child.text;
		} else if (child.type.name === "hardBreak") {
			positions.push(blockStart + offset);
			text += "\n";
		}
	});
	positions.push(blockStart + block.content.size);

	const cursorPos = selection.$from.pos;

	const matches = [...text.matchAll(createFenceRegex())] as FenceMatchIndices[];

	// Inside the body of a complete fence (both markers already present).
	for (const match of matches) {
		const [matchStart, matchEnd] = match.indices[0];
		if (cursorPos > positions[matchStart] && cursorPos < positions[matchEnd]) {
			return true;
		}
	}

	// On the opening fence marker line (e.g. "```ts") before the closing
	// fence exists — the regex above can't match an unterminated block, so
	// detect the marker line itself and keep Enter from sending while the
	// author is still opening the block. The lang char class mirrors
	// FENCE_REGEX_SOURCE so both treat the same marker syntax.
	const cursorIndex = positions.indexOf(cursorPos);
	if (cursorIndex !== -1) {
		const lineStart = text.lastIndexOf("\n", cursorIndex - 1) + 1;
		const nextBreak = text.indexOf("\n", cursorIndex);
		const lineEnd = nextBreak === -1 ? text.length : nextBreak;

		// The closing fence line of a complete block is also just "```", but a
		// cursor sitting past it should send, not extend the block. A complete
		// match's `indices[0]` ends right after its closing fence, so a line
		// whose end coincides with that is the closing marker — skip it.
		const onClosingFence = matches.some(
			(m) => m.indices[0][1] === lineEnd && lineStart === lineEnd - 3,
		);

		if (
			!onClosingFence &&
			/^```[a-zA-Z0-9_+-]*$/.test(text.slice(lineStart, lineEnd))
		) {
			return true;
		}
	}

	return false;
};

/**
 * Smart Shift+Enter inside a blockquote
 */
const handleQuoteExit = (editor: Editor): boolean => {
	const { state } = editor;
	const sel = state.selection;
	if (!sel.empty) return false;

	const $from = sel.$from;
	let bqDepth = -1;
	for (let d = $from.depth; d > 0; d--) {
		if ($from.node(d).type.name === "blockquote") {
			bqDepth = d;
			break;
		}
	}
	if (bqDepth === -1) return false;

	const block = $from.parent;
	if (!block.isTextblock) return false;
	const blockStart = $from.start();

	let text = "";
	const positions: number[] = [];
	block.forEach((child, offset) => {
		if (child.isText && child.text) {
			for (let i = 0; i < child.text.length; i++) {
				positions.push(blockStart + offset + i);
			}
			text += child.text;
		} else if (child.type.name === "hardBreak") {
			positions.push(blockStart + offset);
			text += "\n";
		} else {
			positions.push(blockStart + offset);
			text += "￼";
		}
	});
	positions.push(blockStart + block.content.size);

	// Only exit from the end of the quote with two trailing empty lines.
	if ($from.pos !== positions[text.length]) return false;
	let trailingNewlines = 0;
	for (let i = text.length - 1; i >= 0 && text[i] === "\n"; i--) {
		trailingNewlines++;
	}
	if (trailingNewlines < 2) return false;

	const delFrom = positions[text.length - 2];
	const afterBlockquote = $from.after(bqDepth);

	let tr = state.tr.delete(delFrom, $from.pos);
	const insertAt = tr.mapping.map(afterBlockquote);
	const paragraph = state.schema.nodes.paragraph.createAndFill();
	if (paragraph) {
		tr = tr.insert(insertAt, paragraph);
		tr = tr.setSelection(TextSelection.near(tr.doc.resolve(insertAt + 1)));
	}
	editor.view.dispatch(tr.scrollIntoView());
	return true;
};

/**
 * Backspace at the start of an empty line directly after a blockquote
 */
const handleQuoteBackspace = (editor: Editor): boolean => {
	const { state } = editor;
	const sel = state.selection;
	if (!sel.empty) return false;

	const $from = sel.$from;
	if (!$from.parent.isTextblock) return false;

	if ($from.parentOffset === 0 && $from.parent.content.size === 0) {
		const paraStart = $from.before($from.depth);
		const nodeBefore = state.doc.resolve(paraStart).nodeBefore;
		if (!nodeBefore || nodeBefore.type.name !== "blockquote") return false;

		let tr = state.tr.delete(paraStart, paraStart + $from.parent.nodeSize);
		tr = tr.setSelection(TextSelection.near(tr.doc.resolve(paraStart - 1), -1));
		editor.view.dispatch(tr.scrollIntoView());
		return true;
	}

	let bqDepth = -1;
	for (let d = $from.depth; d > 0; d--) {
		if ($from.node(d).type.name === "blockquote") {
			bqDepth = d;
			break;
		}
	}
	if (bqDepth === -1) return false;

	const block = $from.parent;
	const blockStart = $from.start();
	let text = "";
	const positions: number[] = [];
	block.forEach((child, offset) => {
		if (child.isText && child.text) {
			for (let i = 0; i < child.text.length; i++) {
				positions.push(blockStart + offset + i);
			}
			text += child.text;
		} else if (child.type.name === "hardBreak") {
			positions.push(blockStart + offset);
			text += "\n";
		} else {
			positions.push(blockStart + offset);
			text += "￼";
		}
	});
	positions.push(blockStart + block.content.size);

	if ($from.pos !== positions[text.length]) return false;
	if (text.length === 0 || text[text.length - 1] !== "\n") return false;

	const delFrom = positions[text.length - 1];
	const afterBlockquote = $from.after(bqDepth);
	let tr = state.tr.delete(delFrom, $from.pos);
	const insertAt = tr.mapping.map(afterBlockquote);
	const paragraph = state.schema.nodes.paragraph.createAndFill();
	if (paragraph) {
		tr = tr.insert(insertAt, paragraph);
		tr = tr.setSelection(TextSelection.near(tr.doc.resolve(insertAt + 1)));
	}
	editor.view.dispatch(tr.scrollIntoView());
	return true;
};

export const TextEditor: Component<{
	placeholder: string;
	text?: ReturnType<Editor["getJSON"]>;
	sendMessage: (
		text: string,
		facets: Array<ColibriRichTextFacet>,
	) => Promise<boolean>;
	onChange?: (text: string, facets: Array<ColibriRichTextFacet>) => void;
	submitOnEnter?: boolean;
	onEscape?: () => void;
	mainEditor?: boolean;
	onEmptyChange?: (empty: boolean) => void;
	registerSubmit?: (submit: () => void) => void;
	onProgress?: (percentage: number) => void;
}> = (props) => {
	let ref!: HTMLDivElement;

	const user = useUserContext();
	const channel = useChannelContext();
	const community = useCommunityContext();

	const runSend = (instance: Editor) => {
		const json = instance.getJSON();
		const text = proseMirrorToFacets(json);
		if (text.text.length > CHARACTER_LIMIT) return;
		instance.commands.clearContent();
		Promise.resolve(props.sendMessage(text.text, text.facets))
			.then((shouldClear) => {
				if (shouldClear === false && !instance.isDestroyed) {
					instance.commands.setContent(json);
				}
			})
			.catch(() => {
				if (!instance.isDestroyed) {
					instance.commands.setContent(json);
				}
			});
	};

	const [bubbleMenuVisible, setBubbleMenuVisible] = createSignal(false);
	const [activeMarks, setActiveMarks] = createSignal<Array<BubbleMenuMark>>([]);
	const [placeholder, setPlaceholder] = createSignal(props.placeholder);
	const [isInitializing, setIsInitializing] = createSignal(true);

	const editor = createTiptapEditor(() => ({
		element: ref!,
		extensions: [
			Document.extend({
				addKeyboardShortcuts() {
					return {
						Enter: () => {
							if (props.submitOnEnter === false) return false;

							if (isInFencedCodeBlock(this.editor)) {
								return this.editor.commands.setHardBreak();
							}

							runSend(this.editor);
							return true;
						},
						Escape: () => {
							props.onEscape?.();
							return true;
						},
						Backspace: () => handleQuoteBackspace(this.editor),
						"Mod-b": () => {
							toggleMarker(this.editor, "bold");
							return true;
						},
						"Mod-i": () => {
							toggleMarker(this.editor, "italic");
							return true;
						},
						"Mod-u": () => {
							toggleMarker(this.editor, "underline");
							return true;
						},
						"Mod-s": () => {
							toggleMarker(this.editor, "strikethrough");
							return true;
						},
						ArrowUp: () => {
							if (!this.editor.isEmpty) return false;

							const lastMessageByUser = channel
								.messages()
								.findLast((x) => x.author.did === user.did);

							if (!lastMessageByUser) return true;

							channel.setEditingMessage(lastMessageByUser);

							return true;
						},
					};
				},
			}),
			Text,
			Paragraph,
			Blockquote,
			HardBreak.extend({
				addKeyboardShortcuts() {
					return {
						"Shift-Enter": () => {
							if (handleQuoteExit(this.editor)) return true;
							return this.editor.commands.setHardBreak();
						},
						"Mod-Enter": () => this.editor.commands.setHardBreak(),
					};
				},
			}).configure({
				keepMarks: false,
			}),
			MarkdownDecorations,
			UndoRedo,
			Mention.configure({
				HTMLAttributes: { "data-type": "mention" },
				suggestions: buildSuggestions(
					() => community().members ?? [],
					() => community().channels ?? [],
					() =>
						Object.keys(EMOJI_DATA).map((x: string) => ({
							name: x,
							emoji: EMOJI_DATA[x],
						})),
					props.mainEditor,
				),
			}).extend({
				addAttributes() {
					return {
						id: { default: null },
						label: { default: null },
						handle: { default: null },
						avatar: { default: null },
						type: { default: "member" },
						datetime: { default: null },
						style: { default: null },
					};
				},
				renderText({ node }) {
					const { type, label, handle } = node.attrs;

					if (type === "member") {
						return `@${label ?? handle}`;
					} else if (type === "channel") {
						return `#${label}`;
					} else {
						return label;
					}
				},
				renderHTML({ node, HTMLAttributes }) {
					const { type, label, id, handle } = node.attrs;

					let colorClass = "";
					let contents = "";

					if (type === "member") {
						colorClass = "bg-primary/25";
						contents = `@${label ?? handle}`;
					} else if (type === "channel") {
						colorClass = "bg-blue-400/25";
						contents = `#${label}`;
					} else if (type === "time") {
						colorClass = "bg-orange-400/25";
						contents = label;
					} else {
						return htmlToDOMOutputSpec(twemoji.parse(label))[0];
					}

					return [
						"span",
						mergeAttributes(HTMLAttributes, {
							"data-mention-type": type,
							"data-id": id,
							class: ` px-1 rounded-xs ${colorClass}`,
						}),
						contents,
					];
				},
			}),
			BubbleMenu.configure({
				element: document.querySelector<HTMLElement>(".bubble-menu"),
				getReferencedVirtualElement: () => {
					const instance = editor();
					if (!instance || instance.isDestroyed) return null;
					const coords = instance.view.coordsAtPos(
						instance.state.selection.from,
					);
					const rect: DOMRect = {
						width: 0,
						height: coords.bottom - coords.top,
						top: coords.top,
						bottom: coords.bottom,
						left: coords.left,
						right: coords.left,
						x: coords.left,
						y: coords.top,
						toJSON: () => ({}),
					};
					return { getBoundingClientRect: () => rect };
				},
				options: { placement: "top-start", offset: 6 },
				shouldShow: (params) => {
					if (params.state.selection.$from === params.state.selection.$to) {
						setBubbleMenuVisible(false);
						return false;
					}

					setActiveMarks([]);

					setBubbleMenuVisible(true);
					return true;
				},
			}),
			Placeholder.configure({
				placeholder: () => placeholder(),
			}),
			Emoji.configure(),
		],
		content: untrack(() => props.text),
	}));

	const characterCountTransaction = createEditorTransaction(editor, (editor) =>
		editor ? proseMirrorToFacets(editor.getJSON()).text.length : 0,
	);

	const characterPercentage = () =>
		Math.min(
			100,
			Math.round((100 / CHARACTER_LIMIT) * characterCountTransaction()),
		);

	const isMobile = useIsMobile();

	const [emojiOpen, setEmojiOpen] = createSignal(false);

	const handleEmojiOpenChange = (open: boolean) => {
		setEmojiOpen(open);
		if (!open) setTimeout(() => editor()?.commands.focus(), 0);
	};

	const insertEmoji = (emoji: string) => {
		const instance = editor();
		if (!instance || instance.isDestroyed) return;
		instance.chain().focus().insertContent(emoji).run();
	};

	const { pushRecentGif } = useUserPreferences();

	/**
	 * Sends a picked GIF as its own message (Discord-style). The media URL
	 * becomes the message text wrapped in a link facet so it renders inline (see
	 * `Embed`), and is recorded in recents.
	 */
	const sendGif = (gif: GifItem) => {
		const byteEnd = new TextEncoder().encode(gif.mediaUrl).length;
		const facet: ColibriRichTextFacet = {
			index: { byteStart: 0, byteEnd },
			features: [
				{ $type: "social.colibri.richtext.facet#link", uri: gif.mediaUrl },
			],
		};
		pushRecentGif(gif);
		void props.sendMessage(gif.mediaUrl, [facet]);
	};

	createEffect(() => props.onProgress?.(characterPercentage()));

	const isEmptyTransaction = createEditorTransaction(
		editor,
		(editor) => editor?.isEmpty ?? true,
	);

	createEffect(() => props.onEmptyChange?.(isEmptyTransaction()));

	createEffect(() => {
		const instance = editor();
		if (!instance) return;
		props.registerSubmit?.(() => runSend(instance));
	});

	const selectionStateTransaction = createEditorTransaction(
		editor,
		(editor) => ({ state: editor!.state, $pos: editor!.$pos }),
	);

	let previousPos = -1;

	createEffect(() => {
		const selectionState = selectionStateTransaction();
		const selection = selectionState.state.selection;
		if (!selection.empty || selection.$from.pos !== selection.$to.pos) return;

		if (selection.$anchor.pos === previousPos) return;
		previousPos = selection.$anchor.pos;

		const currentEditor = editor();
		if (!currentEditor || currentEditor.isDestroyed) return;

		const coords = currentEditor.view.coordsAtPos(selection.$anchor.pos);
		const container = currentEditor.view.dom;
		const containerRect = container.getBoundingClientRect();

		const isOutside =
			coords.top < containerRect.top || coords.bottom > containerRect.bottom;

		if (isOutside) {
			untrack(() => {
				currentEditor.view.dispatch(currentEditor.state.tr.scrollIntoView());
			});
		}
	});

	createEffect(() => {
		const placeholder = props.placeholder;

		setPlaceholder(placeholder);
	});

	createEffect(() => {
		if (!editor() || editor()?.isFocused) return;

		editor()!.commands.focus("end", { scrollIntoView: true });
	});

	createEffect(() => {
		if (!editor() || !props.onChange || isInitializing()) return;

		editor()?.on("selectionUpdate", () => {
			const text = proseMirrorToFacets(editor()!.getJSON());

			props.onChange!(text.text, text.facets);
		});
	});

	createEffect(() => {
		if (!editor()) return;

		setIsInitializing(false);
	});

	return (
		<div
			class="w-full flex flex-row border border-border rounded-md focus-within:border-neutral-500 gap-2 pr-2 items-start"
			classList={{ relative: !props.mainEditor }}
		>
			<div
				class="bubble-menu w-fit bg-card border border-border overflow-hidden absolute opacity-0 flex flex-row items-center rounded-sm drop-shadow-black drop-shadow-sm"
				classList={{
					"pointer-events-none": !bubbleMenuVisible(),
				}}
			>
				<button
					type="button"
					class="flex items-center justify-center w-8 h-8 hover:bg-muted cursor-pointer"
					classList={{
						"bg-muted": activeMarks().some((x) => x === "bold"),
					}}
					onClick={() => editor() && toggleMarker(editor()!, "bold")}
				>
					<TextBIcon />
				</button>
				<button
					type="button"
					class="flex items-center justify-center w-8 h-8 hover:bg-muted cursor-pointer"
					classList={{
						"bg-muted": activeMarks().some((x) => x === "italic"),
					}}
					onClick={() => editor() && toggleMarker(editor()!, "italic")}
				>
					<TextItalicIcon />
				</button>
				<button
					type="button"
					class="flex items-center justify-center w-8 h-8 hover:bg-muted cursor-pointer"
					classList={{
						"bg-muted": activeMarks().some((x) => x === "underline"),
					}}
					onClick={() => editor() && toggleMarker(editor()!, "underline")}
				>
					<TextUnderlineIcon />
				</button>
				<button
					type="button"
					class="flex items-center justify-center w-8 h-8 hover:bg-muted cursor-pointer"
					classList={{
						"bg-muted": activeMarks().some((x) => x === "strike"),
					}}
					onClick={() => editor() && toggleMarker(editor()!, "strikethrough")}
				>
					<TextStrikethroughIcon />
				</button>
				<button
					type="button"
					class="flex items-center justify-center w-8 h-8 hover:bg-muted cursor-pointer"
					classList={{
						"bg-muted": activeMarks().some((x) => x === "code"),
					}}
					onClick={() => editor() && toggleMarker(editor()!, "code")}
				>
					<CodeIcon />
				</button>
			</div>
			<div
				ref={ref}
				id={`editor`}
				class={`${props.mainEditor ? "" : "temp-editor"} flex-1 min-w-0`}
				onKeyDown={(e) => {
					if (e.ctrlKey && e.key === "s") {
						e.stopImmediatePropagation();
						e.stopPropagation();
						e.preventDefault();
					}
				}}
			/>
			<Show
				when={props.mainEditor}
				fallback={
					<EmojiPopover
						emojiPopoverOpen={emojiOpen}
						setEmojiPopoverOpen={handleEmojiOpenChange}
						onEmojiSelect={insertEmoji}
						placement="top-end"
					>
						<button
							type="button"
							aria-label="Insert emoji"
							class="mt-1.5 shrink-0 w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-none"
						>
							<SmileyIcon width={20} height={20} />
						</button>
					</EmojiPopover>
				}
			>
				<ComposerMediaPickers
					onEmojiSelect={insertEmoji}
					onGifSelect={sendGif}
				/>
			</Show>
			<Show when={!(isMobile() && props.mainEditor)}>
				<Tooltip>
					<TooltipTrigger>
						<svg
							height="20"
							width="20"
							viewBox="0 0 20 20"
							aria-hidden="true"
							class="mt-2 shrink-0"
							classList={{
								"text-primary": characterPercentage() < 90,
								"text-yellow-500":
									characterPercentage() >= 90 && characterPercentage() < 100,
								"text-red-500": characterPercentage() === 100,
							}}
						>
							{/* Background track */}
							<circle
								r="8"
								cx="10"
								cy="10"
								fill="transparent"
								stroke="var(--muted-foreground)"
								stroke-width="2"
								opacity="0.2"
							/>
							{/* Progress arc */}
							<circle
								r="8"
								cx="10"
								cy="10"
								fill="transparent"
								stroke="currentColor"
								stroke-width="2"
								stroke-dasharray={`${(characterPercentage() / 100) * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
								transform="rotate(-90) translate(-20)"
							/>
						</svg>
					</TooltipTrigger>
					<TooltipPortal>
						<TooltipContent>
							<span>
								{" "}
								{characterCountTransaction()}/{CHARACTER_LIMIT} characters
							</span>
						</TooltipContent>
					</TooltipPortal>
				</Tooltip>
			</Show>
		</div>
	);
};
