import { createEffect, createSignal, type Component } from "solid-js";
import { createEditorTransaction, createTiptapEditor } from "solid-tiptap";
import { Document } from "@tiptap/extension-document";
import { Text } from "@tiptap/extension-text";
import { Link } from "@tiptap/extension-link";
import { Paragraph } from "@tiptap/extension-paragraph";
import { HardBreak } from "@tiptap/extension-hard-break";
import { Bold } from "@tiptap/extension-bold";
import { Code } from "@tiptap/extension-code";
import { Italic } from "@tiptap/extension-italic";
import { Underline } from "@tiptap/extension-underline";
import { Strike } from "@tiptap/extension-strike";
import { CharacterCount, UndoRedo, Placeholder } from "@tiptap/extensions";
import { Mention } from "@tiptap/extension-mention";
import "./TextEditor.css";
import {
	Tooltip,
	TooltipContent,
	TooltipPortal,
	TooltipTrigger,
} from "../../shadcn-solid/Tooltip";
import type { MemberData } from "../../layouts/CommunityLayout";
import { buildSuggestions } from "./build-suggestions";

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

export const TextEditor: Component<{
	placeholder: string;
	members: Array<MemberData>;
	channels: Array<{ name: string; rkey: string }>;
}> = (props) => {
	let ref!: HTMLDivElement;

	const [placeholder, setPlaceholder] = createSignal(props.placeholder);

	const editor = createTiptapEditor(() => ({
		element: ref!,
		extensions: [
			Document,
			Text,
			Paragraph,
			HardBreak.configure({
				keepMarks: false,
			}),
			Bold,
			Code,
			Italic,
			Underline,
			Strike,
			CharacterCount.configure({
				limit: CHARACTER_LIMIT,
			}),
			UndoRedo,
			Mention.configure({
				renderHTML(params) {
					return [
						"div",
						`${params.options.suggestion.char}${params.node.attrs.label}`,
					];
				},
				suggestions: buildSuggestions(props.members, props.channels),
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

	createEffect(() => console.log(characterPercentage()));

	return (
		<div class="relative w-full flex flex-row border border-border rounded-md focus-within:border-neutral-500 gap-2 pr-2 items-start">
			<div
				ref={ref}
				id="editor"
				class="w-full max-w-[calc(100%-28px)]"
				onKeyDown={(e) => {
					if (e.ctrlKey && e.key === "s") {
						e.stopImmediatePropagation();
						e.stopPropagation();
						e.preventDefault();
						editor()?.commands.toggleStrike();
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
