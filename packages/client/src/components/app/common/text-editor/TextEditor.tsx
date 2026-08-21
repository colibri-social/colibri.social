import {
	type ColibriRichTextFacet,
	facetsToSource,
	parseMarkdown,
	tokenizeMarkdown,
} from "@colibri-social/lib";
import { type Editor, Extension, mergeAttributes } from "@tiptap/core";
import { BubbleMenu } from "@tiptap/extension-bubble-menu";
import { Document } from "@tiptap/extension-document";
import Emoji, { EmojiSuggestionPluginKey } from "@tiptap/extension-emoji";
import { HardBreak } from "@tiptap/extension-hard-break";
import { Mention } from "@tiptap/extension-mention";
import { Paragraph } from "@tiptap/extension-paragraph";
import { Text } from "@tiptap/extension-text";
import { Placeholder, UndoRedo } from "@tiptap/extensions";
import type { Fragment, Node as ProseMirrorNode } from "prosemirror-model";
import { Plugin } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import {
	type Component,
	createEffect,
	createSignal,
	onCleanup,
	Show,
	untrack,
} from "solid-js";
import { createEditorTransaction, createTiptapEditor } from "solid-tiptap";
import CodeIcon from "~icons/ph/code";
import LinkIcon from "~icons/ph/link";
import LinkBreakIcon from "~icons/ph/link-break";
import SmileyIcon from "~icons/ph/smiley";
import TextBIcon from "~icons/ph/text-b";
import TextItalicIcon from "~icons/ph/text-italic";
import TextStrikethroughIcon from "~icons/ph/text-strikethrough";
import TextUnderlineIcon from "~icons/ph/text-underline";
import { namespace } from "../../../../atproto/cache/keys";
import { parseColibriChannelUrl } from "../../../../atproto/colibri-channel-url";
import type { GifItem } from "../../../../atproto/xrpc/social/colibri/embed/gifTypes";
import { useChannelContext } from "../../../../contexts/Channel";
import {
	useCommunityContext,
	usePermissions,
} from "../../../../contexts/Community";
import { useUserContext } from "../../../../contexts/User";
import { useUserPreferences } from "../../../../contexts/UserPreferences";
import { getAppViewDid } from "../../../../utils/appview";
import {
	readComposerDraft,
	readEditDraft,
	writeComposerDraft,
	writeEditDraft,
} from "../../../../utils/composer-drafts";
import { hasEmoji, parseEmojiText } from "../../../../utils/emoji";
import { TIPTAP_EMOJIS } from "../../../../utils/emoji-data";
import { createFenceRegex } from "../../../../utils/fenced-code-regex";
import { htmlToDOMOutputSpec } from "../../../../utils/html-to-dom-output-spec";
import { linkUrisFromFacets } from "../../../../utils/link-facets";
import { useIsMobile } from "../../../../utils/mobile-pane";
import { safeAreaOverflowPadding } from "../../../../utils/safe-area";
import {
	Tooltip,
	TooltipContent,
	TooltipPortal,
	TooltipTrigger,
} from "../../../ui/Tooltip";
import { isRemovableEmbed } from "../../channel/message/Embed";
import { communityInitials } from "../../community/CommunityAvatar";
import { ComposerMediaPickers, TRIGGER_CLASS } from "../ComposerMediaPickers";
import {
	CHIP_AVATAR_CLASS,
	CHIP_INITIALS_CLASS,
	caretRightSpec,
} from "../channel-chip";
import { EmojiPopover } from "../EmojiPopover";
import { buildSuggestions } from "./build-suggestions";
import { buildClipboardHtml, readClipboardFacets } from "./clipboard-facets";
import { type ChipScope, facetsToProseMirror } from "./facets-to-prosemirror";
import { insertChannelChip } from "./insert-channel-chip";
import { MarkdownDecorations } from "./markdown-code-highlight";
import { proseMirrorToFacets } from "./prosemirror-to-facets";

const CHARACTER_LIMIT = 2048;
const CIRCUMFERENCE = 2 * Math.PI * 8;

const EmojiWithoutSuggestion = Emoji.extend({
	addProseMirrorPlugins() {
		return (this.parent?.() ?? []).filter(
			(plugin) => plugin.spec.key !== EmojiSuggestionPluginKey,
		);
	},
});

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

const ORDERED_MARKER_RE = /^(\s*)(\d+)\.(\s)/;
const QUOTE_MARKER_RE = /^ {0,3}> ?/;
const UNORDERED_MARKER_RE = /^(\s*)[-*](\s)/;

const projectCurrentBlock = (
	editor: Editor,
): { pos: number; text: string; positions: number[] } => {
	const { $from } = editor.state.selection;
	const blockStart = $from.start();
	let text = "";
	const positions: number[] = [];
	$from.parent.forEach((child, offset) => {
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
	positions.push(blockStart + $from.parent.content.size);
	return { pos: $from.pos, text, positions };
};

const cursorLine = (
	text: string,
	positions: number[],
	cursorPos: number,
): { lineStart: number; lineEnd: number; line: string } | null => {
	const cursorIndex = positions.indexOf(cursorPos);
	if (cursorIndex === -1) return null;
	const lineStart = text.lastIndexOf("\n", cursorIndex - 1) + 1;
	const nl = text.indexOf("\n", cursorIndex);
	const lineEnd = nl === -1 ? text.length : nl;
	return { lineStart, lineEnd, line: text.slice(lineStart, lineEnd) };
};

const handleListContinuation = (editor: Editor): boolean => {
	const { selection } = editor.state;
	if (!selection.empty || !selection.$from.parent.isTextblock) return false;

	const { pos, text, positions } = projectCurrentBlock(editor);
	const found = cursorLine(text, positions, pos);
	if (!found) return false;
	const { lineStart, line } = found;

	const ordered = ORDERED_MARKER_RE.exec(line);
	const unordered = ordered ? null : UNORDERED_MARKER_RE.exec(line);
	const match = ordered ?? unordered;
	if (!match) return false;

	const markerLen = match[0].length;

	if (positions.indexOf(pos) < lineStart + markerLen) return false;

	const isEmptyItem = line.slice(markerLen).trim() === "";

	if (isEmptyItem) {
		const from = positions[lineStart];
		const to = positions[lineStart + markerLen];
		editor
			.chain()
			.focus()
			.deleteRange({ from, to })
			.setTextSelection(from)
			.run();
		return true;
	}

	const nextMarker = ordered
		? `${Number.parseInt(ordered[2], 10) + 1}. `
		: "- ";
	editor.chain().focus().setHardBreak().insertContent(nextMarker).run();
	return true;
};

/**
 * Shift+Enter on a quote line continues the quote on the next line, or clears
 * the marker when the line holds nothing but the marker
 */
const handleQuoteContinuation = (editor: Editor): boolean => {
	const { selection } = editor.state;
	if (!selection.empty || !selection.$from.parent.isTextblock) return false;

	const { pos, text, positions } = projectCurrentBlock(editor);
	const found = cursorLine(text, positions, pos);
	if (!found) return false;
	const { lineStart, line } = found;

	const match = QUOTE_MARKER_RE.exec(line);
	if (!match) return false;

	const markerLen = match[0].length;
	if (positions.indexOf(pos) < lineStart + markerLen) return false;

	if (line.slice(markerLen).trim() === "") {
		const from = positions[lineStart];
		const to = positions[lineStart + markerLen];
		editor
			.chain()
			.focus()
			.deleteRange({ from, to })
			.setTextSelection(from)
			.run();
		return true;
	}

	editor.chain().focus().setHardBreak().insertContent("> ").run();
	return true;
};

const handleListMarkerDelete = (editor: Editor): boolean => {
	const { selection } = editor.state;
	if (!selection.empty || !selection.$from.parent.isTextblock) return false;

	const { pos, text, positions } = projectCurrentBlock(editor);
	const found = cursorLine(text, positions, pos);
	if (!found) return false;
	const { lineStart, line } = found;

	if (positions.indexOf(pos) !== lineStart) return false;
	const ordered = ORDERED_MARKER_RE.exec(line);
	if (!ordered) return false;

	const from = positions[lineStart];
	const to = positions[lineStart + ordered[0].length];
	editor.chain().focus().deleteRange({ from, to }).setTextSelection(from).run();
	return true;
};

const OrderedListAutoNumber = Extension.create({
	name: "orderedListAutoNumber",
	addProseMirrorPlugins() {
		return [
			new Plugin({
				appendTransaction: (transactions, _oldState, newState) => {
					if (!transactions.some((t) => t.docChanged)) return null;

					const edits: Array<{ from: number; to: number; text: string }> = [];
					newState.doc.descendants((node, pos) => {
						if (!node.isTextblock) return;

						let text = "";
						const positions: number[] = [];
						node.forEach((child, offset) => {
							if (child.isText && child.text) {
								for (let i = 0; i < child.text.length; i++) {
									positions.push(pos + 1 + offset + i);
								}
								text += child.text;
							} else if (child.type.name === "hardBreak") {
								positions.push(pos + 1 + offset);
								text += "\n";
							} else {
								positions.push(pos + 1 + offset);
								text += "￼";
							}
						});
						positions.push(pos + 1 + node.content.size);

						let counter = 0;
						let index = 0;
						for (const line of text.split("\n")) {
							const match = ORDERED_MARKER_RE.exec(line);
							if (match) {
								counter += 1;
								const expected = String(counter);
								if (match[2] !== expected) {
									const numStart = index + match[1].length;
									const numEnd = numStart + match[2].length;
									edits.push({
										from: positions[numStart],
										to: positions[numEnd],
										text: expected,
									});
								}
							} else {
								counter = 0;
							}
							index += line.length + 1;
						}
					});

					if (edits.length === 0) return null;
					const tr = newState.tr;
					edits.sort((a, b) => b.from - a.from);
					for (const edit of edits)
						tr.insertText(edit.text, edit.from, edit.to);
					return tr.steps.length ? tr : null;
				},
			}),
		];
	},
});

const mentionMarkdown = (node: ProseMirrorNode): string => {
	const { type, label, handle } = node.attrs;
	if (type === "member") return `@${label ?? handle}`;
	if (type === "channel") return `#${label}`;
	if (type === "role") return `@${label}`;
	return label ?? "";
};

const fragmentToMarkdown = (fragment: Fragment): string => {
	let out = "";
	fragment.forEach((node) => {
		const name = node.type.name;
		if (node.isText) {
			out += node.text ?? "";
		} else if (name === "hardBreak") {
			out += "\n";
		} else if (name === "mention") {
			out += mentionMarkdown(node);
		} else if (name === "paragraph") {
			if (out && !out.endsWith("\n")) out += "\n";
			out += fragmentToMarkdown(node.content);
		} else if (node.childCount) {
			out += fragmentToMarkdown(node.content);
		}
	});
	return out;
};

const fragmentToFacets = (
	fragment: Fragment,
): { text: string; facets: Array<ColibriRichTextFacet> } =>
	proseMirrorToFacets({
		type: "doc",
		content: fragment.toJSON() ?? [],
	} as ReturnType<Editor["getJSON"]>);

const flattenPaste = (
	content: ReturnType<Editor["getJSON"]>["content"],
): ReturnType<Editor["getJSON"]>["content"] =>
	content.length === 1 && content[0]?.type === "paragraph"
		? ((content[0].content ?? []) as ReturnType<Editor["getJSON"]>["content"])
		: content;

const writeSelectionToClipboard = (
	view: EditorView,
	event: ClipboardEvent,
): boolean => {
	const slice = view.state.selection.content();
	if (slice.size === 0 || !event.clipboardData) return false;

	const { text, facets } = fragmentToFacets(slice.content);
	if (!text) return false;

	const { source } = facetsToSource(text, facets);
	event.clipboardData.setData("text/plain", source);
	event.clipboardData.setData("text/html", buildClipboardHtml(text, facets));
	event.preventDefault();
	return true;
};

/**
 * Pulls image files out of a `DataTransfer`. Works for both `ClipboardEvent`
 * (paste gesture) and `InputEvent` (Android IME rich-content insertion, e.g.
 * tapping the Gboard clipboard image chip)
 */
const extractImageFiles = (data: DataTransfer | null): Array<File> => {
	if (!data) return [];

	const files: Array<File> = [];
	const seen = new Set<string>();

	const add = (file: File | null) => {
		if (!file?.type.startsWith("image/")) return;
		const key = `${file.name}:${file.size}:${file.type}`;
		if (seen.has(key)) return;
		seen.add(key);
		const ext = file.type.split("/")[1] || "png";
		const named =
			file.name.trim().length > 0
				? file
				: new File(
						[file],
						`pasted-image-${Date.now()}-${files.length}.${ext}`,
						{
							type: file.type,
						},
					);
		files.push(named);
	};

	for (const item of data.items) {
		if (item.kind === "file" && item.type.startsWith("image/")) {
			add(item.getAsFile());
		}
	}
	for (const file of data.files) add(file);

	return files;
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
	onImagePaste?: (files: Array<File>) => void;
	blocked?: () => boolean;
	embedsEnabled?: () => boolean;
	onEmbedsEnabledChange?: (enabled: boolean) => void;
}> = (props) => {
	let ref!: HTMLDivElement;

	let plainPasteRequested = false;

	const user = useUserContext();
	const channel = useChannelContext();
	const community = useCommunityContext();
	const permissions = usePermissions();

	const chipScope = (): ChipScope => ({
		communities: user.communities,
		categories: community().categories ?? [],
		currentCommunityUri: community().community.uri,
	});

	const mentionableRoles = () =>
		(community().assignableRoles ?? []).filter(
			(role) => role.mentionable || permissions.canMentionRoles(user.did),
		);

	const runSend = (instance: Editor) => {
		if (props.blocked?.()) return;
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
						Delete: () => handleListMarkerDelete(this.editor),
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
			}).configure({
				keepMarks: false,
			}),
			MarkdownDecorations,
			OrderedListAutoNumber,
			UndoRedo,
			Mention.configure({
				HTMLAttributes: { "data-type": "mention" },
				suggestions: buildSuggestions(
					(query, limit) => community().utils.searchMembers(query, limit),
					() => community().channels ?? [],
					() => mentionableRoles(),
					() => community().categories ?? [],
					props.mainEditor,
				),
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
					};
				},
				renderText({ node }) {
					const { type, label, handle } = node.attrs;

					if (type === "member") {
						return `@${label ?? handle}`;
					} else if (type === "channel") {
						return `#${label}`;
					} else if (type === "role") {
						return `@${label}`;
					} else {
						return label;
					}
				},
				renderHTML({ node, HTMLAttributes }) {
					const {
						type,
						label,
						id,
						handle,
						color,
						avatar,
						community,
						category,
					} = node.attrs;

					let colorClass = "";
					let contents = "";

					if (type === "member") {
						colorClass = "bg-primary/25";
						contents = `@${label ?? handle}`;
					} else if (type === "channel") {
						colorClass = "bg-blue-400/25";
						contents = `#${label}`;

						if (community) {
							return [
								"span",
								mergeAttributes(HTMLAttributes, {
									"data-mention-type": type,
									"data-id": id,
									class: ` px-1 rounded-xs ${colorClass}`,
								}),
								avatar
									? [
											"img",
											{ src: avatar, alt: community, class: CHIP_AVATAR_CLASS },
										]
									: [
											"span",
											{ class: CHIP_INITIALS_CLASS },
											communityInitials(community),
										],
								caretRightSpec(),
								contents,
							];
						}

						if (category) {
							return [
								"span",
								mergeAttributes(HTMLAttributes, {
									"data-mention-type": type,
									"data-id": id,
									class: ` px-1 rounded-xs ${colorClass}`,
								}),
								["span", { class: "opacity-70" }, category],
								caretRightSpec(),
								contents,
							];
						}
					} else if (type === "role") {
						contents = `@${label}`;
						return [
							"span",
							mergeAttributes(HTMLAttributes, {
								"data-mention-type": type,
								"data-id": id,
								class: " px-1 rounded-xs",
								style: color
									? `background-color: color-mix(in srgb, ${color} 25%, transparent); color: ${color};`
									: "background-color: color-mix(in srgb, currentColor 25%, transparent);",
							}),
							contents,
						];
					} else if (type === "time") {
						colorClass = "bg-orange-400/25";
						contents = label;
					} else {
						return htmlToDOMOutputSpec(parseEmojiText(label))[0];
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
				options: {
					placement: "top-start",
					offset: 6,
					flip: () => ({ padding: safeAreaOverflowPadding() }),
					shift: () => ({ padding: safeAreaOverflowPadding() }),
				},
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
			EmojiWithoutSuggestion.configure({ emojis: TIPTAP_EMOJIS }),
		],
		editorProps: {
			clipboardTextSerializer: (slice) => fragmentToMarkdown(slice.content),
			handleDOMEvents: {
				keydown: (_view, event) => {
					if (event.key === "v" || event.key === "V") {
						plainPasteRequested =
							event.shiftKey && (event.metaKey || event.ctrlKey);
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
					if (!props.onImagePaste) return false;
					const inputEvent = event as InputEvent;
					if (
						inputEvent.inputType !== "insertFromPaste" &&
						inputEvent.inputType !== "insertReplacementText"
					) {
						return false;
					}
					const images = extractImageFiles(inputEvent.dataTransfer);
					if (images.length === 0) return false;
					props.onImagePaste(images);
					event.preventDefault();
					return true;
				},
			},
			handlePaste: (view, event) => {
				const instance = editor();
				if (!instance || instance.isDestroyed) return false;

				if (props.onImagePaste) {
					const images = extractImageFiles(event.clipboardData);
					if (images.length > 0) {
						props.onImagePaste(images);
						return true;
					}
				}

				const plain = plainPasteRequested;
				plainPasteRequested = false;

				const payload = plain
					? null
					: readClipboardFacets(event.clipboardData?.getData("text/html"));
				if (payload) {
					const { content } = facetsToProseMirror(
						payload.text,
						payload.facets,
						community().members ?? [],
						community().channels ?? [],
						community().assignableRoles ?? [],
						chipScope(),
					);
					instance.chain().focus().insertContent(flattenPaste(content)).run();
					return true;
				}

				if (!plain) {
					const pastedText = event.clipboardData?.getData("text/plain")?.trim();
					const channelTarget = pastedText
						? parseColibriChannelUrl(pastedText)
						: null;
					if (pastedText && channelTarget) {
						insertChannelChip(view, pastedText, channelTarget, {
							xrpc: user.xrpc,
							communities: user.communities,
							channels: community().channels ?? [],
							categories: community().categories ?? [],
							currentCommunityUri: community().community.uri,
							ns: namespace(getAppViewDid(), user.did),
						});
						return true;
					}
				}

				const text = event.clipboardData?.getData("text/plain");
				if (!text) return false;
				if (!text.includes("\n") && !hasEmoji(text)) return false;

				const parsed = parseMarkdown(text, []);
				const { content } = facetsToProseMirror(
					parsed.text,
					parsed.facets,
					community().members ?? [],
					community().channels ?? [],
					community().assignableRoles ?? [],
					chipScope(),
				);
				instance.chain().focus().insertContent(flattenPaste(content)).run();
				return true;
			},
		},
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

	const hasLink = createEditorTransaction(editor, (editor) =>
		editor
			? linkUrisFromFacets(proseMirrorToFacets(editor.getJSON()).facets).some(
					isRemovableEmbed,
				)
			: false,
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
		instance
			.chain()
			.focus()
			.insertContent({
				type: "mention",
				attrs: { type: "emoji", label: emoji },
			})
			.run();
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

	createEffect(() => {
		const instance = editor();
		if (!instance) return;
		instance.setEditable(!props.blocked?.());
	});

	const selectionStateTransaction = createEditorTransaction(
		editor,
		(editor) => ({ state: editor!.state, $pos: editor!.$pos }),
	);

	let previousPos = -1;

	createEffect(() => {
		if (isMobile()) return;

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
		if (isMobile()) return;

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

	if (props.mainEditor) {
		type BufferKey =
			| { kind: "channel"; uri: string }
			| { kind: "edit"; uri: string };

		let bufferKey: BufferKey | undefined;
		let loadedInstance: Editor | undefined;
		let latest: ReturnType<Editor["getJSON"]> | undefined;
		let latestEmpty = true;
		let saveTimer: ReturnType<typeof setTimeout> | undefined;

		const sameKey = (a: BufferKey | undefined, b: BufferKey) =>
			a !== undefined && a.kind === b.kind && a.uri === b.uri;

		const persist = (key: BufferKey | undefined) => {
			if (saveTimer) {
				clearTimeout(saveTimer);
				saveTimer = undefined;
			}
			if (key?.kind === "channel") {
				writeComposerDraft(key.uri, latestEmpty ? undefined : latest);
			}
		};

		const applyBuffer = (instance: Editor, forceFocus: boolean) => {
			if (!latestEmpty && latest) instance.commands.setContent(latest);
			else instance.commands.clearContent();
			latest = instance.getJSON();
			latestEmpty = instance.isEmpty;
			if (forceFocus) {
				setTimeout(
					() => instance.commands.focus("end", { scrollIntoView: true }),
					0,
				);
			} else if (instance.isFocused && !isMobile()) {
				instance.commands.focus("end");
			}
		};

		createEffect(() => {
			const instance = editor();
			const editingMsg = isMobile() ? channel.editingMessage() : undefined;
			const key: BufferKey = editingMsg
				? { kind: "edit", uri: editingMsg.uri }
				: { kind: "channel", uri: channel.channelUri() };
			if (!instance) return;

			untrack(() => {
				const keyChanged = !sameKey(bufferKey, key);
				if (!keyChanged && loadedInstance === instance) return;

				if (keyChanged) {
					persist(bufferKey);
					bufferKey = key;

					if (key.kind === "edit" && editingMsg) {
						const draft = readEditDraft(editingMsg.uri);
						latest = facetsToProseMirror(
							draft?.text ?? editingMsg.text,
							draft?.facets ?? editingMsg.facets ?? [],
							community().members ?? [],
							community().channels ?? [],
							community().assignableRoles ?? [],
							chipScope(),
						);
						latestEmpty = false;
					} else {
						const saved = key.uri ? readComposerDraft(key.uri) : undefined;
						latest = saved;
						latestEmpty = !saved;
					}
				}

				loadedInstance = instance;
				applyBuffer(instance, keyChanged && key.kind === "edit");
			});
		});

		createEffect(() => {
			const instance = editor();
			if (!instance) return;

			const handler = () => {
				latest = instance.getJSON();
				latestEmpty = instance.isEmpty;
				if (saveTimer) clearTimeout(saveTimer);
				saveTimer = setTimeout(() => {
					saveTimer = undefined;
					if (!bufferKey) return;
					if (bufferKey.kind === "channel") {
						writeComposerDraft(bufferKey.uri, latestEmpty ? undefined : latest);
					} else if (!latestEmpty && latest) {
						writeEditDraft(bufferKey.uri, proseMirrorToFacets(latest));
					}
				}, 200);
			};

			instance.on("update", handler);
			onCleanup(() => instance.off("update", handler));
		});

		onCleanup(() => persist(bufferKey));
	}

	return (
		<div
			class="w-full flex flex-row border border-border rounded-md focus-within:border-neutral-500 gap-2 pr-2 items-start leading-[1.75]"
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
							class="mt-1 shrink-0 w-6 h-[1lh] min-h-6 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-none"
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
			<Show when={props.embedsEnabled !== undefined && hasLink()}>
				<Tooltip>
					<TooltipTrigger
						aria-label={
							props.embedsEnabled?.()
								? "Hide link previews for this message"
								: "Show link previews for this message"
						}
						aria-pressed={!props.embedsEnabled?.()}
						class={TRIGGER_CLASS}
						classList={{ "text-primary!": props.embedsEnabled?.() }}
						onMouseDown={(e: MouseEvent) => e.preventDefault()}
						onClick={() =>
							props.onEmbedsEnabledChange?.(!props.embedsEnabled?.())
						}
					>
						<Show
							when={props.embedsEnabled?.()}
							fallback={<LinkBreakIcon width={20} height={20} />}
						>
							<LinkIcon width={20} height={20} />
						</Show>
					</TooltipTrigger>
					<TooltipPortal>
						<TooltipContent>
							<span>
								{props.embedsEnabled?.()
									? "Link previews on"
									: "Link previews off"}
							</span>
						</TooltipContent>
					</TooltipPortal>
				</Tooltip>
			</Show>
			<Show when={!(isMobile() && props.mainEditor)}>
				<Tooltip>
					<TooltipTrigger class="mt-1 h-[1lh] min-h-6 flex items-center shrink-0 bg-transparent border-none p-0">
						<svg
							height="20"
							width="20"
							viewBox="0 0 20 20"
							aria-hidden="true"
							class="shrink-0"
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
