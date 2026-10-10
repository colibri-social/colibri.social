import { parseMarkdown } from "@colibri-social/lib";
import { CodeIcon } from "@solar-icons/solid/bold/code";
import { EyeClosedIcon } from "@solar-icons/solid/bold/eye-closed";
import { TextBoldIcon } from "@solar-icons/solid/bold/text-bold";
import { TextCrossIcon } from "@solar-icons/solid/bold/text-cross";
import { TextItalicIcon } from "@solar-icons/solid/bold/text-italic";
import { TextUnderlineIcon } from "@solar-icons/solid/bold/text-underline";
import { Editor, mergeAttributes } from "@tiptap/core";
import { Document } from "@tiptap/extension-document";
import { HardBreak } from "@tiptap/extension-hard-break";
import { Mention } from "@tiptap/extension-mention";
import { Paragraph } from "@tiptap/extension-paragraph";
import { Text } from "@tiptap/extension-text";
import { Placeholder, UndoRedo } from "@tiptap/extensions";
import {
	createEffect,
	createMemo,
	createSignal,
	createUniqueId,
	For,
	type JSX,
	on,
	onCleanup,
	onMount,
	Show,
	untrack,
} from "solid-js";
import { Portal } from "solid-js/web";
import { cx } from "../../utils/cx";
import {
	isWebUrl,
	MARKDOWN_LINK_POLICY,
} from "../../utils/rich-text/link-safety";
import { utf8Length } from "../../utils/text-length";
import { mentionChipClass, timeChipClass } from "../Badge/Badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "../Tooltip/Tooltip";
import { codeContextAtPos } from "./block-projection";
import { readClipboardFacets } from "./clipboard-facets";
import { useRichEditorSources } from "./context";
import {
	activeFormats,
	emojiForShortcode,
	extractFiles,
	type FormatKind,
	fragmentToMarkdown,
	handleListContinuation,
	handleListIndent,
	handleListMarkerDelete,
	handleQuoteContinuation,
	OrderedListAutoNumber,
	ShortcodeEmoji,
	toggleFormat,
	wrapSelectionAsMarkdownLink,
	writeSelectionToClipboard,
} from "./editor-commands";
import {
	channelChipAttrs,
	facetsToProseMirror,
	flattenLegacyEmoji,
} from "./facets-to-prosemirror";
import { MarkdownDecorations } from "./markdown-decorations";
import { proseMirrorToFacets } from "./prosemirror-to-facets";
import { SuggestionList, suggestionOptionId } from "./SuggestionPanel";
import {
	buildSuggestions,
	EMOJI_MIN_QUERY,
	type SuggestionController,
	type SuggestionSession,
	suggestionAttrs,
} from "./suggestions";
import { TimePicker } from "./TimePicker";
import type { RichEditorSources, RichText, TimeAttrs } from "./types";

export type RichEditorPlatform = "mobile" | "desktop";

export type EditorJSON = ReturnType<Editor["getJSON"]>;

export type RichEditorHandle = {
	focus: (position?: "start" | "end") => void;
	blur: () => void;
	clear: () => void;
	isEmpty: () => boolean;
	getValue: () => RichText;
	setValue: (value: RichText | string) => void;
	getJSON: () => EditorJSON | undefined;
	setJSON: (json: EditorJSON) => void;
	insertText: (text: string) => void;
	submit: () => void;
	element: () => HTMLElement | undefined;
};

export type RichEditorProps = {
	platform?: RichEditorPlatform;
	placeholder?: string;
	"aria-label"?: string;
	initialValue?: RichText | string;
	submitOnEnter?: boolean;
	onSubmit?: (
		value: RichText,
	) => boolean | undefined | Promise<boolean | undefined>;
	canSubmit?: (value: RichText) => boolean;
	onChange?: (value: RichText) => void;
	onEscape?: () => void;
	onEditLast?: () => boolean;
	onPasteFiles?: (files: File[]) => void;
	maxLength?: number;
	maxLines?: number;
	lineHeight?: number;
	disabled?: boolean;
	autofocus?: boolean;
	sources?: RichEditorSources;
	ref?: (handle: RichEditorHandle) => void;
	suggestionsClass?: string;
	anchorSuggestionsToParent?: boolean;
	class?: string;
};

export const DEFAULT_LINE_HEIGHT = 21;
const DEFAULT_MAX_LINES = 8;
const BUBBLE_GAP = 8;
const VIEWPORT_GAP = 8;

const EMPTY_VALUE: RichText = { text: "", facets: [] };

const FORMAT_ACTIONS: Array<{
	kind: FormatKind;
	label: string;
	shortcut?: string;
	icon: () => JSX.Element;
}> = [
	{ kind: "bold", label: "Bold", shortcut: "B", icon: () => <TextBoldIcon /> },
	{
		kind: "italic",
		label: "Italic",
		shortcut: "I",
		icon: () => <TextItalicIcon />,
	},
	{
		kind: "underline",
		label: "Underline",
		shortcut: "U",
		icon: () => <TextUnderlineIcon />,
	},
	{
		kind: "strikethrough",
		label: "Strikethrough",
		shortcut: "S",
		icon: () => <TextCrossIcon />,
	},
	{ kind: "code", label: "Code", icon: () => <CodeIcon /> },
	{ kind: "spoiler", label: "Spoiler", icon: () => <EyeClosedIcon /> },
];

const isMac = () =>
	typeof navigator !== "undefined" &&
	/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

const toDoc = (value: RichText | string, sources: RichEditorSources) =>
	typeof value === "string"
		? facetsToProseMirror(value, [], sources)
		: facetsToProseMirror(value.text, value.facets, sources);

const sameValue = (a: RichText, b: RichText) =>
	a.text === b.text && JSON.stringify(a.facets) === JSON.stringify(b.facets);

const mentionChipSpec = (
	attrs: Record<string, unknown>,
	HTMLAttributes: Record<string, unknown>,
) => {
	const type = String(attrs.type ?? "member");
	const label = String(attrs.label ?? attrs.handle ?? "");
	const base = {
		"data-mention-type": type,
		"data-id": attrs.id ?? undefined,
	};

	if (type === "role") {
		const color = typeof attrs.color === "string" ? attrs.color : undefined;
		return [
			"span",
			mergeAttributes(HTMLAttributes, base, {
				class: mentionChipClass("role"),
				style: `--mention-color: ${color ?? "currentColor"}`,
			}),
			`@${label}`,
		];
	}

	if (type === "time") {
		return [
			"span",
			mergeAttributes(HTMLAttributes, base, {
				class: timeChipClass,
				title: typeof attrs.datetime === "string" ? attrs.datetime : undefined,
			}),
			label,
		];
	}

	if (type === "channel") {
		const prefix: unknown[] = [];
		if (typeof attrs.community === "string" && attrs.community) {
			prefix.push(
				typeof attrs.avatar === "string" && attrs.avatar
					? [
							"img",
							{
								src: attrs.avatar,
								alt: "",
								class:
									"mr-0.5 inline-block size-[0.95em] rounded-[2px] object-cover align-[-0.15em]",
							},
						]
					: ["span", { class: "opacity-70" }, attrs.community],
				["span", { class: "mx-0.5 opacity-60", "aria-hidden": "true" }, "›"],
			);
		} else if (typeof attrs.category === "string" && attrs.category) {
			prefix.push(
				["span", { class: "opacity-70" }, attrs.category],
				["span", { class: "mx-0.5 opacity-60", "aria-hidden": "true" }, "›"],
			);
		}
		return [
			"span",
			mergeAttributes(HTMLAttributes, base, {
				class: mentionChipClass("user"),
			}),
			...prefix,
			`#${label}`,
		];
	}

	if (type === "emoji") {
		return ["span", mergeAttributes(HTMLAttributes, base), label];
	}

	return [
		"span",
		mergeAttributes(HTMLAttributes, base, {
			class: mentionChipClass(type === "bridged" ? "bridged" : "user"),
		}),
		`@${label}`,
	];
};

const mentionText = (attrs: Record<string, unknown>) => {
	const { type, label, handle } = attrs;
	if (type === "member") return `@${label ?? handle}`;
	if (type === "channel") return `#${label}`;
	if (type === "role" || type === "bridged") return `@${label}`;
	return String(label ?? "");
};

export const RichEditor = (props: RichEditorProps) => {
	const contextSources = useRichEditorSources();
	const sources = (): RichEditorSources => ({
		...contextSources,
		...props.sources,
	});
	const platform = () => props.platform ?? "mobile";
	const submitOnEnter = () => props.submitOnEnter ?? platform() === "desktop";
	const lineHeight = () => props.lineHeight ?? DEFAULT_LINE_HEIGHT;
	const listId = `rich-editor-suggestions-${createUniqueId()}`;

	let host!: HTMLDivElement;
	let bubble: HTMLDivElement | undefined;
	let plainPasteRequested = false;

	const [editor, setEditor] = createSignal<Editor>();
	const [revision, setRevision] = createSignal(0);
	const [focused, setFocused] = createSignal(false);
	const [session, setSession] = createSignal<SuggestionSession | null>(null);
	const [activeIndex, setActiveIndex] = createSignal(0);
	const [dismissed, setDismissed] = createSignal(false);
	const [timeMode, setTimeMode] = createSignal(false);
	const [bubbleAt, setBubbleAt] = createSignal<{
		left: number;
		top: number;
		below: boolean;
	} | null>(null);
	const [formats, setFormats] = createSignal<Set<FormatKind>>(new Set());

	const value = createMemo<RichText>(
		() => {
			revision();
			const instance = editor();
			if (!instance || instance.isDestroyed) return EMPTY_VALUE;
			return proseMirrorToFacets(instance.getJSON());
		},
		EMPTY_VALUE,
		{ equals: sameValue },
	);

	const empty = createMemo(() => {
		revision();
		return editor()?.isEmpty ?? true;
	});

	const suggestionVisible = () => {
		const current = session();
		if (!current || dismissed()) return false;
		if (timeMode()) return true;
		return current.trigger !== ":" || current.query.length >= EMOJI_MIN_QUERY;
	};

	const selectSuggestion = (index: number) => {
		const current = session();
		const item = current?.items[index];
		if (!current || !item) return;
		if (item.kind === "time") {
			setTimeMode(true);
			return;
		}
		const attrs = suggestionAttrs(item);
		if (attrs) current.command(attrs);
	};

	const controller: SuggestionController = {
		start: (next) => {
			setDismissed(false);
			setTimeMode(false);
			setActiveIndex(0);
			setSession(next);
		},
		update: (next) => {
			const previous = session();
			if (!previous || previous.query !== next.query) setActiveIndex(0);
			setSession(next);
		},
		keyDown: (event) => {
			if (timeMode() || !suggestionVisible()) return false;
			const current = session();
			if (!current) return false;
			if (event.key === "Escape") {
				setDismissed(true);
				return true;
			}
			const count = current.items.length;
			if (count === 0) return false;
			if (event.key === "ArrowDown") {
				setActiveIndex((index) => (index + 1) % count);
				return true;
			}
			if (event.key === "ArrowUp") {
				setActiveIndex((index) => (index - 1 + count) % count);
				return true;
			}
			if (
				(event.key === "Enter" || event.key === "Tab") &&
				!event.isComposing
			) {
				if (event.shiftKey && event.key === "Enter") return false;
				selectSuggestion(Math.min(activeIndex(), count - 1));
				return true;
			}
			return false;
		},
		exit: () => {
			setSession(null);
			setTimeMode(false);
			setDismissed(false);
		},
	};

	const pickTime = (attrs: TimeAttrs) => {
		const current = session();
		if (!current) return;
		current.command(attrs);
		setTimeMode(false);
	};

	const cancelTime = () => {
		const current = session();
		setTimeMode(false);
		if (!current) return;
		current.editor.chain().focus().deleteRange(current.range).run();
	};

	const dismissTime = () => {
		setTimeMode(false);
		setDismissed(true);
	};

	const canSubmit = (current: RichText) => {
		if (props.canSubmit) return props.canSubmit(current);
		if (current.text.trim().length === 0) return false;
		return (
			props.maxLength === undefined ||
			utf8Length(current.text) <= props.maxLength
		);
	};

	const submit = () => {
		const instance = editor();
		if (!instance || instance.isDestroyed || props.disabled) return;
		const json = instance.getJSON();
		const current = proseMirrorToFacets(json);
		if (!canSubmit(current)) return;
		instance.commands.clearContent(true);
		const restore = () => {
			if (instance.isDestroyed || !instance.isEmpty) return;
			instance.commands.setContent(json, { emitUpdate: true });
		};
		let result: ReturnType<NonNullable<RichEditorProps["onSubmit"]>>;
		try {
			result = props.onSubmit?.(current);
		} catch {
			restore();
			return;
		}
		Promise.resolve(result).then((accepted) => {
			if (accepted === false) restore();
		}, restore);
	};

	const insertParsedText = (instance: Editor, text: string) => {
		const parsed = parseMarkdown(text, [], MARKDOWN_LINK_POLICY);
		const { content } = facetsToProseMirror(
			parsed.text,
			parsed.facets,
			sources(),
		);
		const inline =
			content.length === 1 && content[0]?.type === "paragraph"
				? (content[0].content ?? [])
				: content;
		instance.chain().focus().insertContent(inline).run();
	};

	const updateBubble = () => {
		const instance = editor();
		if (
			platform() !== "desktop" ||
			!instance ||
			instance.isDestroyed ||
			!instance.isFocused
		) {
			setBubbleAt(null);
			return;
		}
		const { selection } = instance.state;
		if (selection.empty) {
			setBubbleAt(null);
			return;
		}
		if (codeContextAtPos(instance.state.doc, selection.from) === "codeblock") {
			setBubbleAt(null);
			return;
		}
		const start = instance.view.coordsAtPos(selection.from);
		const end = instance.view.coordsAtPos(selection.to, -1);
		const below = start.top < 56;
		const left = Math.max(VIEWPORT_GAP, Math.min(start.left, end.left));
		setBubbleAt({
			left,
			top: below ? end.bottom + BUBBLE_GAP : start.top - BUBBLE_GAP,
			below,
		});
		setFormats(activeFormats(instance));
	};

	onMount(() => {
		const initial = untrack(() =>
			props.initialValue === undefined
				? undefined
				: toDoc(props.initialValue, sources()),
		);

		const instance = new Editor({
			element: host,
			content: initial,
			editable: !untrack(() => props.disabled),
			extensions: [
				Document.extend({
					addKeyboardShortcuts() {
						return {
							Enter: () => {
								if (this.editor.view.composing) return false;
								const { doc, selection } = this.editor.state;
								if (
									codeContextAtPos(doc, selection.$from.pos) === "codeblock"
								) {
									return this.editor.commands.setHardBreak();
								}
								if (!submitOnEnter()) {
									if (handleQuoteContinuation(this.editor)) return true;
									if (handleListContinuation(this.editor)) return true;
									return this.editor.commands.setHardBreak();
								}
								submit();
								return true;
							},
							Escape: () => {
								if (!props.onEscape) return false;
								props.onEscape();
								return true;
							},
							Delete: () => handleListMarkerDelete(this.editor),
							Tab: () => handleListIndent(this.editor, false),
							"Shift-Tab": () => handleListIndent(this.editor, true),
							"Mod-b": () => {
								toggleFormat(this.editor, "bold");
								return true;
							},
							"Mod-i": () => {
								toggleFormat(this.editor, "italic");
								return true;
							},
							"Mod-u": () => {
								toggleFormat(this.editor, "underline");
								return true;
							},
							"Mod-s": () => {
								toggleFormat(this.editor, "strikethrough");
								return true;
							},
							ArrowUp: () => {
								if (!this.editor.isEmpty || !props.onEditLast) return false;
								return props.onEditLast();
							},
						};
					},
				}),
				Text,
				Paragraph,
				HardBreak.extend({
					addKeyboardShortcuts() {
						return {
							"Shift-Enter": () => {
								if (handleQuoteContinuation(this.editor)) return true;
								if (handleListContinuation(this.editor)) return true;
								return this.editor.commands.setHardBreak();
							},
							"Mod-Enter": () => this.editor.commands.setHardBreak(),
						};
					},
				}).configure({ keepMarks: false }),
				MarkdownDecorations.configure({
					highlightCode: () => sources().highlightCode,
				}),
				OrderedListAutoNumber,
				ShortcodeEmoji,
				UndoRedo,
				Mention.configure({
					HTMLAttributes: { "data-type": "mention" },
					suggestions: buildSuggestions(sources, controller),
				}).extend({
					addAttributes() {
						return {
							id: { default: null },
							label: { default: null },
							handle: { default: null },
							avatar: { default: null },
							community: { default: null },
							category: { default: null },
							color: { default: null },
							type: { default: "member" },
							datetime: { default: null },
							style: { default: null },
							registration: { default: null },
							platform: { default: null },
						};
					},
					renderText({ node }) {
						return mentionText(node.attrs);
					},
					renderHTML({ node, HTMLAttributes }) {
						return mentionChipSpec(node.attrs, HTMLAttributes) as never;
					},
				}),
				Placeholder.configure({
					placeholder: () => props.placeholder ?? "",
				}),
			],
			editorProps: {
				attributes: {
					role: "textbox",
					"aria-multiline": "true",
					"aria-autocomplete": "list",
					spellcheck: "true",
					class: "outline-none",
				},
				clipboardTextSerializer: (slice) => fragmentToMarkdown(slice.content),
				handleDOMEvents: {
					keydown: (_view, event) => {
						if (event.key === "v" || event.key === "V") {
							plainPasteRequested =
								event.shiftKey && (event.metaKey || event.ctrlKey);
						}
						if (event.key === "s" && (event.ctrlKey || event.metaKey)) {
							event.preventDefault();
						}
						return false;
					},
					copy: (view, event) => writeSelectionToClipboard(view, event),
					cut: (view, event) => {
						if (!writeSelectionToClipboard(view, event)) return false;
						view.dispatch(view.state.tr.deleteSelection());
						return true;
					},
					beforeinput: (_view, event) => {
						if (!props.onPasteFiles) return false;
						const input = event as InputEvent;
						if (
							input.inputType !== "insertFromPaste" &&
							input.inputType !== "insertReplacementText"
						) {
							return false;
						}
						const files = extractFiles(input.dataTransfer);
						if (files.length === 0) return false;
						props.onPasteFiles(files);
						event.preventDefault();
						return true;
					},
				},
				handlePaste: (view, event) => {
					const current = editor();
					if (!current || current.isDestroyed) return false;
					const data = event.clipboardData;

					if (props.onPasteFiles) {
						const files = extractFiles(data);
						if (files.length > 0) {
							props.onPasteFiles(files);
							return true;
						}
					}

					const plain = plainPasteRequested;
					plainPasteRequested = false;
					const pastedText = data?.getData("text/plain") ?? "";
					const trimmed = pastedText.trim();

					if (
						!plain &&
						trimmed &&
						!/\s/.test(trimmed) &&
						isWebUrl(trimmed) &&
						!sources().matchChannelUrl?.(trimmed) &&
						wrapSelectionAsMarkdownLink(view, trimmed)
					) {
						return true;
					}

					if (codeContextAtPos(view.state.doc, view.state.selection.from)) {
						return false;
					}

					const payload = plain
						? null
						: readClipboardFacets(data?.getData("text/html"));
					if (payload) {
						const { content } = facetsToProseMirror(
							payload.text,
							payload.facets,
							sources(),
						);
						const inline =
							content.length === 1 && content[0]?.type === "paragraph"
								? (content[0].content ?? [])
								: content;
						current.chain().focus().insertContent(inline).run();
						return true;
					}

					if (!plain && trimmed) {
						const match = sources().matchChannelUrl?.(trimmed);
						if (match) {
							insertChannelUrl(current, match.channelId, match);
							return true;
						}
					}

					if (!pastedText.includes("\n")) return false;
					insertParsedText(current, pastedText);
					return true;
				},
			},
		});

		const bump = () => setRevision((count) => count + 1);
		const onUpdate = () =>
			props.onChange?.(proseMirrorToFacets(instance.getJSON()));
		const onFocus = () => {
			setFocused(true);
			updateBubble();
		};
		const onBlur = ({ event }: { event: FocusEvent }) => {
			if (
				bubble &&
				event.relatedTarget instanceof Node &&
				bubble.contains(event.relatedTarget)
			) {
				return;
			}
			setFocused(false);
			setBubbleAt(null);
		};
		instance.on("transaction", bump);
		instance.on("update", onUpdate);
		instance.on("selectionUpdate", updateBubble);
		instance.on("focus", onFocus);
		instance.on("blur", onBlur);
		setEditor(instance);

		if (untrack(() => props.autofocus)) {
			queueMicrotask(() => {
				if (!instance.isDestroyed) instance.commands.focus("end");
			});
		}

		const reposition = () => {
			if (bubbleAt()) updateBubble();
		};
		window.addEventListener("resize", reposition);
		host.addEventListener("scroll", reposition, true);

		onCleanup(() => {
			window.removeEventListener("resize", reposition);
			host.removeEventListener("scroll", reposition, true);
			instance.off("transaction", bump);
			instance.off("update", onUpdate);
			instance.off("selectionUpdate", updateBubble);
			instance.off("focus", onFocus);
			instance.off("blur", onBlur);
			instance.destroy();
			setEditor(undefined);
		});
	});

	const insertChannelUrl = (
		instance: Editor,
		channelId: string,
		match: NonNullable<
			ReturnType<NonNullable<RichEditorSources["matchChannelUrl"]>>
		>,
	) => {
		const chip = match.chip ?? sources().resolveChannel?.(channelId);
		instance
			.chain()
			.focus()
			.insertContent([
				{
					type: "mention",
					attrs: channelChipAttrs(channelId, chip ?? { label: channelId }),
				},
				{ type: "text", text: " " },
			])
			.run();
		if (chip || !match.resolve) return;
		void match.resolve().then((resolved) => {
			if (!resolved || instance.isDestroyed) return;
			const mention = instance.state.schema.nodes.mention;
			const tr = instance.state.tr;
			instance.state.doc.descendants((node, pos) => {
				if (
					node.type === mention &&
					node.attrs.type === "channel" &&
					node.attrs.id === channelId &&
					node.attrs.label === channelId
				) {
					tr.setNodeMarkup(
						pos,
						undefined,
						channelChipAttrs(channelId, resolved),
					);
				}
			});
			if (!tr.steps.length) return;
			tr.setMeta("addToHistory", false);
			instance.view.dispatch(tr);
		});
	};

	createEffect(
		on(
			() => props.disabled,
			(disabled) => editor()?.setEditable(!disabled),
			{ defer: true },
		),
	);

	createEffect(
		on(
			() => props.placeholder,
			() => {
				const instance = editor();
				if (instance && !instance.isDestroyed) {
					instance.view.dispatch(
						instance.state.tr.setMeta("placeholder", true),
					);
				}
			},
			{ defer: true },
		),
	);

	createEffect(() => {
		const instance = editor();
		if (!instance) return;
		const dom = instance.view.dom;
		const label = props["aria-label"] ?? props.placeholder;
		if (label) dom.setAttribute("aria-label", label);
		else dom.removeAttribute("aria-label");
		dom.setAttribute("enterkeyhint", submitOnEnter() ? "send" : "enter");
		if (props.disabled) dom.setAttribute("aria-disabled", "true");
		else dom.removeAttribute("aria-disabled");
		if (suggestionVisible() && !timeMode()) {
			dom.setAttribute("aria-controls", listId);
			const count = session()?.items.length ?? 0;
			if (count > 0) {
				dom.setAttribute(
					"aria-activedescendant",
					suggestionOptionId(listId, Math.min(activeIndex(), count - 1)),
				);
			} else {
				dom.removeAttribute("aria-activedescendant");
			}
		} else {
			dom.removeAttribute("aria-controls");
			dom.removeAttribute("aria-activedescendant");
		}
	});

	const handle: RichEditorHandle = {
		focus: (position = "end") => editor()?.commands.focus(position),
		blur: () => editor()?.commands.blur(),
		clear: () => editor()?.commands.clearContent(true),
		isEmpty: () => empty(),
		getValue: () => value(),
		setValue: (next) => {
			const instance = editor();
			if (!instance) return;
			instance.commands.setContent(toDoc(next, sources()), {
				emitUpdate: false,
			});
		},
		getJSON: () => editor()?.getJSON(),
		setJSON: (json) => {
			const instance = editor();
			if (!instance) return;
			instance.commands.setContent(
				flattenLegacyEmoji(json, emojiForShortcode),
				{
					emitUpdate: false,
				},
			);
		},
		insertText: (text) => {
			const instance = editor();
			if (!instance) return;
			if (text.includes("\n")) insertParsedText(instance, text);
			else instance.chain().focus().insertContent(text).run();
		},
		submit,
		element: () => editor()?.view.dom,
	};
	props.ref?.(handle);

	return (
		<div
			data-rich-editor=""
			data-platform={platform()}
			data-empty={empty() || undefined}
			data-focused={focused() || undefined}
			data-disabled={props.disabled || undefined}
			class={cx(
				"min-w-0 flex-1",
				!props.anchorSuggestionsToParent && "relative",
				props.class,
			)}
		>
			<div
				ref={host}
				class="overflow-y-auto overscroll-contain text-base text-foreground"
				style={{
					"line-height": `${lineHeight()}px`,
					"max-height": `${(props.maxLines ?? DEFAULT_MAX_LINES) * lineHeight()}px`,
				}}
			/>
			<Show when={suggestionVisible() && session()}>
				{(current) => (
					<div
						data-suggestions=""
						data-trigger={current().trigger}
						class={cx(
							"absolute inset-x-0 bottom-full z-30 mb-2 max-h-[min(20rem,45dvh)] overflow-y-auto overscroll-contain rounded-control-lg border border-border bg-popover shadow-overlay",
							props.suggestionsClass,
						)}
					>
						<Show
							when={timeMode()}
							fallback={
								<SuggestionList
									id={listId}
									trigger={current().trigger}
									items={current().items}
									activeIndex={activeIndex}
									onActiveIndexChange={setActiveIndex}
									onSelect={selectSuggestion}
								/>
							}
						>
							<TimePicker
								onPick={pickTime}
								onCancel={cancelTime}
								onDismiss={dismissTime}
							/>
						</Show>
					</div>
				)}
			</Show>
			<Show when={bubbleAt()}>
				{(position) => (
					<Portal>
						<div
							ref={bubble}
							role="toolbar"
							aria-label="Formatting"
							data-format-bubble=""
							data-placement={position().below ? "below" : "above"}
							class="fixed z-50 flex w-fit items-center gap-0.5 rounded-control border border-border bg-popover p-0.5 shadow-overlay"
							style={{
								left: `${position().left}px`,
								top: `${position().top}px`,
								transform: position().below ? undefined : "translateY(-100%)",
							}}
							onPointerDown={(event) => event.preventDefault()}
						>
							<For each={FORMAT_ACTIONS}>
								{(action) => (
									<Tooltip>
										<TooltipTrigger
											as="button"
											type="button"
											aria-label={action.label}
											aria-pressed={formats().has(action.kind)}
											data-format={action.kind}
											onClick={() => {
												const instance = editor();
												if (!instance) return;
												toggleFormat(instance, action.kind);
												updateBubble();
											}}
											class={cx(
												"flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-control-sm outline-none [&_svg]:size-5",
												"text-muted-foreground hover:bg-popover-highlight hover:text-foreground",
												"aria-pressed:bg-popover-highlight aria-pressed:text-foreground",
												"focus-ring-inset",
											)}
										>
											{action.icon()}
										</TooltipTrigger>
										<TooltipContent>
											{action.shortcut
												? `${action.label} (${isMac() ? "⌘" : "Ctrl+"}${action.shortcut})`
												: action.label}
										</TooltipContent>
									</Tooltip>
								)}
							</For>
						</div>
					</Portal>
				)}
			</Show>
		</div>
	);
};
