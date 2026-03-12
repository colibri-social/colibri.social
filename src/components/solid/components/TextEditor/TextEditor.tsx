import { Bold } from "@tiptap/extension-bold";
import { Code } from "@tiptap/extension-code";
import { Document } from "@tiptap/extension-document";
import { HardBreak } from "@tiptap/extension-hard-break";
import { Italic } from "@tiptap/extension-italic";
import { Link } from "@tiptap/extension-link";
import { Mention } from "@tiptap/extension-mention";
import { Paragraph } from "@tiptap/extension-paragraph";
import { Strike } from "@tiptap/extension-strike";
import { Text } from "@tiptap/extension-text";
import { BubbleMenu } from "@tiptap/extension-bubble-menu";
import { Bold as BoldIcon } from "../../icons/Bold";
import { Underline as UnderlineIcon } from "../../icons/Underline";
import { Strikethrough as StrikethroughIcon } from "../../icons/Strikethrough";
import { Italic as ItalicIcon } from "../../icons/Italic";
import { Code as CodeIcon } from "../../icons/Code";

import { Underline } from "@tiptap/extension-underline";
import { CharacterCount, Placeholder, UndoRedo } from "@tiptap/extensions";
import { type Component, createEffect, createSignal } from "solid-js";
import { createEditorTransaction, createTiptapEditor } from "solid-tiptap";
import "./TextEditor.css";
import { mergeAttributes } from "@tiptap/core";
import type { Facet } from "@/utils/atproto/rich-text";
import { useChannelContext } from "../../contexts/ChannelContext";
import { useCommunityContext } from "../../contexts/CommunityContext";
import {
	Tooltip,
	TooltipContent,
	TooltipPortal,
	TooltipTrigger,
} from "../../shadcn-solid/Tooltip";
import { buildSuggestions } from "./build-suggestions";
import { prosemirrorToFacets } from "./prosemirror-to-facets";

const CHARACTER_LIMIT = 2048;
const CIRCUMFERENCE = 2 * Math.PI * 8;

const isElInViewport = (el: Element | undefined) => {
	if (!el) return true;

	var rect = el?.getBoundingClientRect();

	return (
		rect.top >= 0 &&
		rect.left >= 0 &&
		rect.bottom <=
			(window.innerHeight || document.documentElement.clientHeight) &&
		rect.right <= (window.innerWidth || document.documentElement.clientWidth)
	);
};

type BubbleMenuMark = "bold" | "strike" | "underline" | "code" | "italic";

export const TextEditor: Component<{
	placeholder: string;
	sendMessage: (text: string, facets: Array<Facet>) => Promise<boolean>;
}> = (props) => {
	let ref!: HTMLDivElement;

	const communityContext = useCommunityContext();
	const channelContext = useChannelContext();

	const [bubbleMenuVisible, setBubbleMenuVisible] = createSignal(false);
	const [activeMarks, setActiveMarks] = createSignal<Array<BubbleMenuMark>>([]);
	const [placeholder, setPlaceholder] = createSignal(props.placeholder);

	const editor = createTiptapEditor(() => ({
		element: ref!,
		extensions: [
			Document.extend({
				addKeyboardShortcuts() {
					return {
						Enter: () => {
							const text = prosemirrorToFacets(this.editor.getJSON());
							props.sendMessage(text.text, text.facets);
							this.editor.commands.clearContent();
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
					communityContext?.members() ?? [],
					channelContext?.channels() ?? [],
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
				renderHTML({ node, HTMLAttributes }) {
					const { type, label, id, handle } = node.attrs;

					return [
						"span",
						mergeAttributes(HTMLAttributes, {
							"data-mention-type": type,
							"data-id": id,
							class: ` px-1 rounded-xs ${type === "member" ? "bg-primary/25" : "bg-blue-400/25"}`,
						}),
						type === "channel" ? `#${label}` : `@${label ?? handle}`,
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
				placeholder: placeholder(),
			}),
		],
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

	createEffect(() => {
		const selectionState = selectionStateTransaction();

		const selection = selectionState.state.selection;

		if (selection.empty || selection.$from.pos !== selection.$to.pos) return;

		const element = selectionState.$pos(selection.$anchor.pos).element;
		const isInView = isElInViewport(element);

		if (!isInView) {
			editor()!.commands.scrollIntoView();
		}
	});

	createEffect(() => {
		const placeholder = props.placeholder;

		setPlaceholder(placeholder);
	});

	return (
		<div class="relative w-full flex flex-row border border-border rounded-md focus-within:border-neutral-500 gap-2 pr-2 items-start">
			<div
				class="bubble-menu bg-card border border-border overflow-hidden absolute opacity-0  flex flex-row items-center rounded-sm drop-shadow-black drop-shadow-sm"
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
					<BoldIcon />
				</button>
				<button
					type="button"
					class="flex items-center justify-center w-8 h-8 hover:bg-muted cursor-pointer"
					classList={{
						"bg-muted": activeMarks().some((x) => x === "italic"),
					}}
					onClick={() => editor()?.commands.toggleItalic()}
				>
					<ItalicIcon />
				</button>
				<button
					type="button"
					class="flex items-center justify-center w-8 h-8 hover:bg-muted cursor-pointer"
					classList={{
						"bg-muted": activeMarks().some((x) => x === "underline"),
					}}
					onClick={() => editor()?.commands.toggleUnderline()}
				>
					<UnderlineIcon />
				</button>
				<button
					type="button"
					class="flex items-center justify-center w-8 h-8 hover:bg-muted cursor-pointer"
					classList={{
						"bg-muted": activeMarks().some((x) => x === "strike"),
					}}
					onClick={() => editor()?.commands.toggleStrike()}
				>
					<StrikethroughIcon />
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
				id="editor"
				class="w-full max-w-[calc(100%-28px)]"
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
