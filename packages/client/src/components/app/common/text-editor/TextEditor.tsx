import { Blockquote } from "@tiptap/extension-blockquote";
import { Bold } from "@tiptap/extension-bold";
import { BubbleMenu } from "@tiptap/extension-bubble-menu";
import { Code } from "@tiptap/extension-code";
import { Document } from "@tiptap/extension-document";
import Emoji from "@tiptap/extension-emoji";
import { HardBreak } from "@tiptap/extension-hard-break";
import { Italic } from "@tiptap/extension-italic";
import { Link } from "@tiptap/extension-link";
import { Mention } from "@tiptap/extension-mention";
import { Paragraph } from "@tiptap/extension-paragraph";
import { Strike } from "@tiptap/extension-strike";
import { Text } from "@tiptap/extension-text";
import { Underline } from "@tiptap/extension-underline";
import { CharacterCount, Placeholder, UndoRedo } from "@tiptap/extensions";
import { type Component, createEffect, createSignal, untrack } from "solid-js";
import { createEditorTransaction, createTiptapEditor } from "solid-tiptap";
import "./TextEditor.css";
import type { ColibriRichTextFacet } from "@colibri-social/lib";
import { type Editor, mergeAttributes } from "@tiptap/core";
import twemoji from "@twemoji/api";
import CodeIcon from "~icons/ph/code";
import TextBIcon from "~icons/ph/text-b";
import TextItalicIcon from "~icons/ph/text-italic";
import TextStrikethroughIcon from "~icons/ph/text-strikethrough";
import TextUnderlineIcon from "~icons/ph/text-underline";
import { useCommunityContext } from "../../../../contexts/Community";
import { htmlToDOMOutputSpec } from "../../../../utils/html-to-dom-output-spec";
import {
	Tooltip,
	TooltipContent,
	TooltipPortal,
	TooltipTrigger,
} from "../../../ui/Tooltip";
import { EMOJI_DATA } from "../rich-text-renderer/emojiData";
import { buildSuggestions } from "./build-suggestions";
import { MarkdownCodeHighlight } from "./markdown-code-highlight";
import { proseMirrorToFacets } from "./prosemirror-to-facets";
import { useChannelContext } from "../../../../contexts/Channel";
import { useUserContext } from "../../../../contexts/User";
import { createFenceRegex } from "../../../../utils/fenced-code-regex";

const CHARACTER_LIMIT = 2048;
const CIRCUMFERENCE = 2 * Math.PI * 8;

type BubbleMenuMark = "bold" | "strike" | "underline" | "code" | "italic";

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
}> = (props) => {
	let ref!: HTMLDivElement;

	const user = useUserContext();
	const channel = useChannelContext();
	const community = useCommunityContext();

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

							if (this.editor.isActive("blockquote")) {
								return false;
							}

							if (isInFencedCodeBlock(this.editor)) {
								return this.editor.commands.setHardBreak();
							}

							const json = this.editor.getJSON();
							const text = proseMirrorToFacets(json);
							this.editor.commands.clearContent();
							Promise.resolve(props.sendMessage(text.text, text.facets))
								.then((shouldClear) => {
									if (shouldClear === false && !this.editor.isDestroyed) {
										this.editor.commands.setContent(json);
									}
								})
								.catch(() => {
									if (!this.editor.isDestroyed) {
										this.editor.commands.setContent(json);
									}
								});
							return true;
						},
						Escape: () => {
							props.onEscape?.();
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
			HardBreak.configure({
				keepMarks: false,
			}),
			Bold,
			Code.configure({
				HTMLAttributes: { spellcheck: "false", autocorrect: "off" },
			}),
			Blockquote,
			MarkdownCodeHighlight,
			Italic,
			Underline,
			Strike.extend({
				addKeyboardShortcuts() {
					return {
						"Mod-s": () => this.editor.commands.toggleStrike(),
					};
				},
			}),
			CharacterCount.configure({
				limit: CHARACTER_LIMIT,
			}),
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
				shouldShow: (params) => {
					if (params.state.selection.$from === params.state.selection.$to) {
						setBubbleMenuVisible(false);
						return false;
					}

					const isBold = params.editor.isActive("bold");
					const isItalic = params.editor.isActive("italic");
					const isUnderline = params.editor.isActive("underline");
					const isStrikethrough = params.editor.isActive("strike");
					const isCode = params.editor.isActive("code");

					setActiveMarks(
						[
							isBold && "bold",
							isItalic && "italic",
							isUnderline && "underline",
							isStrikethrough && "strike",
							isCode && "code",
						].filter((x) => typeof x === "string") as Array<BubbleMenuMark>,
					);

					setBubbleMenuVisible(true);
					return true;
				},
			}),
			Link.configure({
				defaultProtocol: "https",
			}),
			Placeholder.configure({
				placeholder: () => placeholder(),
			}),
			Emoji.configure(),
		],
		content: untrack(() => props.text),
	}));

	const characterCountTransaction = createEditorTransaction(
		editor,
		(editor) => editor?.storage.characterCount.characters() || 0,
	);

	const characterPercentage = () =>
		Math.round((100 / CHARACTER_LIMIT) * characterCountTransaction());

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
				class="bubble-menu w-full bg-card border border-border overflow-hidden absolute opacity-0 flex flex-row items-center rounded-sm drop-shadow-black drop-shadow-sm"
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
					onClick={() => editor()?.commands.toggleBold()}
				>
					<TextBIcon />
				</button>
				<button
					type="button"
					class="flex items-center justify-center w-8 h-8 hover:bg-muted cursor-pointer"
					classList={{
						"bg-muted": activeMarks().some((x) => x === "italic"),
					}}
					onClick={() => editor()?.commands.toggleItalic()}
				>
					<TextItalicIcon />
				</button>
				<button
					type="button"
					class="flex items-center justify-center w-8 h-8 hover:bg-muted cursor-pointer"
					classList={{
						"bg-muted": activeMarks().some((x) => x === "underline"),
					}}
					onClick={() => editor()?.commands.toggleUnderline()}
				>
					<TextUnderlineIcon />
				</button>
				<button
					type="button"
					class="flex items-center justify-center w-8 h-8 hover:bg-muted cursor-pointer"
					classList={{
						"bg-muted": activeMarks().some((x) => x === "strike"),
					}}
					onClick={() => editor()?.commands.toggleStrike()}
				>
					<TextStrikethroughIcon />
				</button>
				<button
					type="button"
					class="flex items-center justify-center w-8 h-8 hover:bg-muted cursor-pointer"
					classList={{
						"bg-muted": activeMarks().some((x) => x === "code"),
					}}
					onClick={() => editor()?.commands.toggleCode()}
				>
					<CodeIcon />
				</button>
			</div>
			<div
				ref={ref}
				id={`editor`}
				class={`${props.mainEditor ? "" : "temp-editor"} w-full max-w-[calc(100%-28px)]`}
				onKeyDown={(e) => {
					if (e.ctrlKey && e.key === "s") {
						e.stopImmediatePropagation();
						e.stopPropagation();
						e.preventDefault();
					}
				}}
			/>
			<Tooltip>
				<TooltipTrigger>
					<svg
						height="20"
						width="20"
						viewBox="0 0 20 20"
						aria-hidden="true"
						class="mt-2"
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
		</div>
	);
};
