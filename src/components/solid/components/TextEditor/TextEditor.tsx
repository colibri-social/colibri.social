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
import { useParams } from "@solidjs/router";
import { type Editor, mergeAttributes } from "@tiptap/core";
import twemoji from "@twemoji/api";
import type { Facet } from "@/utils/atproto/rich-text";
import { htmlToDOMOutputSpec } from "@/utils/html-to-dom-output-spec";
import { useChannelContext } from "../../contexts/ChannelContext";
import { useCommunityContext } from "../../contexts/CommunityContext";
import { useGlobalContext } from "../../contexts/GlobalContext";
import Icon from "../../icons/Icon";
import {
	Tooltip,
	TooltipContent,
	TooltipPortal,
	TooltipTrigger,
} from "../../shadcn-solid/Tooltip";
import { EMOJI_DATA } from "../RichTextRenderer/emojiData";
import { buildSuggestions } from "./build-suggestions";
import { proseMirrorToFacets } from "./prosemirror-to-facets";

const CHARACTER_LIMIT = 2048;
const CIRCUMFERENCE = 2 * Math.PI * 8;

type BubbleMenuMark = "bold" | "strike" | "underline" | "code" | "italic";

export const TextEditor: Component<{
	placeholder: string;
	text?: ReturnType<Editor["getJSON"]>;
	sendMessage: (text: string, facets: Array<Facet>) => Promise<boolean>;
	onChange?: (text: string, facets: Array<Facet>) => void;
	submitOnEnter?: boolean;
	onEscape?: () => void;
}> = (props) => {
	let ref!: HTMLDivElement;

	const params = useParams();
	const channel = () => params.channel!;

	const [, { sendSocketMessage }] = useGlobalContext();
	const communityContext = useCommunityContext();
	const channelContext = useChannelContext();

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
					};
				},
			}),
			Text,
			Paragraph,
			HardBreak.configure({
				keepMarks: false,
			}),
			Bold,
			Code,
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
					() => communityContext?.members() ?? [],
					() => channelContext?.channels() ?? [],
					() =>
						Object.keys(EMOJI_DATA).map((x: string) => ({
							name: x,
							emoji: EMOJI_DATA[x],
						})),
				),
			}).extend({
				addAttributes() {
					return {
						id: { default: null },
						label: { default: null },
						handle: { default: null },
						avatar: { default: null },
						type: { default: "member" },
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

		const text = proseMirrorToFacets(editor()!.getJSON());

		props.onChange(text.text, text.facets);
	});

	createEffect(() => {
		if (!editor()) return;

		setIsInitializing(false);
	});

	return (
		<div class="relative w-full flex flex-row border border-border rounded-md focus-within:border-neutral-500 gap-2 pr-2 items-start">
			<div
				class="bubble-menu bg-card border border-border overflow-hidden absolute opacity-0 flex flex-row items-center rounded-sm drop-shadow-black drop-shadow-sm"
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
					<Icon variant="regular" name="text-b-icon" />
				</button>
				<button
					type="button"
					class="flex items-center justify-center w-8 h-8 hover:bg-muted cursor-pointer"
					classList={{
						"bg-muted": activeMarks().some((x) => x === "italic"),
					}}
					onClick={() => editor()?.commands.toggleItalic()}
				>
					<Icon variant="regular" name="text-italic-icon" />
				</button>
				<button
					type="button"
					class="flex items-center justify-center w-8 h-8 hover:bg-muted cursor-pointer"
					classList={{
						"bg-muted": activeMarks().some((x) => x === "underline"),
					}}
					onClick={() => editor()?.commands.toggleUnderline()}
				>
					<Icon variant="regular" name="text-underline-icon" />
				</button>
				<button
					type="button"
					class="flex items-center justify-center w-8 h-8 hover:bg-muted cursor-pointer"
					classList={{
						"bg-muted": activeMarks().some((x) => x === "strike"),
					}}
					onClick={() => editor()?.commands.toggleStrike()}
				>
					<Icon variant="regular" name="text-strikethrough-icon" />
				</button>
				<button
					type="button"
					class="flex items-center justify-center w-8 h-8 hover:bg-muted cursor-pointer"
					classList={{
						"bg-muted": activeMarks().some((x) => x === "code"),
					}}
					onClick={() => editor()?.commands.toggleCode()}
				>
					<Icon variant="regular" name="code-icon" />
				</button>
			</div>
			<div
				ref={ref}
				id="editor"
				class="w-full max-w-[calc(100%-28px)]"
				onKeyDown={(e) => {
					sendSocketMessage({
						action: "typing",
						channel: channel(),
					});

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
