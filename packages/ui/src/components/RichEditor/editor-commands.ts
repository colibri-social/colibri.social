import {
	facetsToSource,
	type MarkdownToken,
	tokenizeMarkdown,
} from "@colibri-social/lib";
import { type Editor, Extension, InputRule } from "@tiptap/core";
import type { Fragment, Node as ProseMirrorNode } from "prosemirror-model";
import {
	type EditorState,
	Plugin,
	TextSelection,
	type Transaction,
} from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { TIPTAP_EMOJIS } from "../../utils/emoji-data";
import { codeContextAt } from "../../utils/rich-text/code-context";
import { MARKDOWN_LINK_POLICY } from "../../utils/rich-text/link-safety";
import { codeContextAtPos, cursorLine, projectDoc } from "./block-projection";
import { buildClipboardHtml } from "./clipboard-facets";
import { customEmojiAttrs } from "./custom-emoji";
import { proseMirrorToFacets } from "./prosemirror-to-facets";
import type { CustomEmojiSuggestion } from "./types";

export type FormatKind =
	| "bold"
	| "italic"
	| "underline"
	| "strikethrough"
	| "code"
	| "spoiler";

export const FORMAT_MARKER: Record<FormatKind, string> = {
	bold: "**",
	italic: "*",
	underline: "__",
	strikethrough: "~~",
	code: "`",
	spoiler: "||",
};

type SelectionProjection = {
	text: string;
	positions: number[];
	from: number;
	to: number;
	selStart: number;
	selEnd: number;
};

type Segment = { start: number; end: number };

const LINE_PREFIX_RE = /^((?: {0,3}> ?)*)(\s*(?:-#|#{1,6}|[-*+]|\d+[.)])\s+)?/;

type SelectionSource = Pick<EditorState, "selection" | "doc">;

const textRange = (state: SelectionSource) => {
	const { selection, doc } = state;
	if (selection.$from.parent.isTextblock && selection.$to.parent.isTextblock) {
		return { from: selection.from, to: selection.to };
	}
	const normalized = TextSelection.between(
		doc.resolve(selection.from),
		doc.resolve(selection.to),
	);
	if (
		!normalized.$from.parent.isTextblock ||
		!normalized.$to.parent.isTextblock
	) {
		return null;
	}
	return { from: normalized.from, to: normalized.to };
};

const projectSelection = (
	state: SelectionSource,
): SelectionProjection | null => {
	const range = textRange(state);
	if (!range) return null;
	const { text, positions } = projectDoc(state.doc);
	const selStart = positions.indexOf(range.from);
	const selEnd = positions.indexOf(range.to);
	if (selStart === -1 || selEnd === -1) return null;
	return { text, positions, ...range, selStart, selEnd };
};

const trimSegment = (text: string, start: number, end: number): Segment => {
	let trimmedStart = start;
	let trimmedEnd = end;
	while (trimmedStart < trimmedEnd && /\s/.test(text[trimmedStart])) {
		trimmedStart++;
	}
	while (trimmedEnd > trimmedStart && /\s/.test(text[trimmedEnd - 1])) {
		trimmedEnd--;
	}
	return { start: trimmedStart, end: trimmedEnd };
};

type SegmentLine = Segment & { quoted: boolean; block: boolean };

const formatSegments = ({
	text,
	selStart,
	selEnd,
}: SelectionProjection): Segment[] => {
	const segments: Segment[] = [];
	let previous: SegmentLine | null = null;
	let lineStart = text.lastIndexOf("\n", selStart - 1) + 1;

	while (lineStart <= selEnd) {
		const nextBreak = text.indexOf("\n", lineStart);
		const lineEnd = nextBreak === -1 ? text.length : nextBreak;
		const prefix = LINE_PREFIX_RE.exec(text.slice(lineStart, lineEnd));
		const contentStart = lineStart + (prefix?.[0].length ?? 0);
		const { start, end } = trimSegment(
			text,
			Math.max(selStart, contentStart),
			Math.min(selEnd, lineEnd),
		);
		const line: SegmentLine = {
			start,
			end,
			quoted: !!prefix?.[1],
			block: !!prefix?.[2],
		};

		if (end <= start || codeContextAt(text, start) === "codeblock") {
			previous = null;
		} else if (
			previous &&
			!previous.block &&
			!line.block &&
			previous.quoted === line.quoted
		) {
			segments[segments.length - 1].end = end;
			previous = line;
		} else {
			segments.push({ start, end });
			previous = line;
		}

		if (nextBreak === -1) break;
		lineStart = nextBreak + 1;
	}

	return segments.length > 0 ? segments : [{ start: selStart, end: selEnd }];
};

const tokenExtent = (token: MarkdownToken): Segment => ({
	start: Math.min(token.content[0], ...token.markers.map(([start]) => start)),
	end: Math.max(token.content[1], ...token.markers.map(([, end]) => end)),
});

const covers = (token: MarkdownToken, segment: Segment) => {
	const extent = tokenExtent(token);
	return (
		extent.start <= segment.start &&
		extent.end >= segment.end &&
		token.content[0] < segment.end &&
		token.content[1] > segment.start
	);
};

const coveringToken = (
	tokens: MarkdownToken[],
	kind: FormatKind,
	segment: Segment,
) =>
	tokens
		.filter((token) => token.kind === kind && covers(token, segment))
		.sort(
			(a, b) => a.content[1] - a.content[0] - (b.content[1] - b.content[0]),
		)[0];

export const activeFormats = (editor: Pick<Editor, "state">) => {
	const active = new Set<FormatKind>();
	if (editor.state.selection.empty) return active;
	const projection = projectSelection(editor.state);
	if (!projection) return active;
	const segments = formatSegments(projection);
	const tokens = tokenizeMarkdown(projection.text);
	for (const kind of Object.keys(FORMAT_MARKER) as FormatKind[]) {
		if (segments.every((segment) => coveringToken(tokens, kind, segment))) {
			active.add(kind);
		}
	}
	return active;
};

export const applyFormatToggle = (tr: Transaction, kind: FormatKind) => {
	if (tr.selection.empty) return false;
	const projection = projectSelection({ selection: tr.selection, doc: tr.doc });
	if (!projection) return false;

	const marker = FORMAT_MARKER[kind];
	const { positions } = projection;
	const segments = formatSegments(projection);
	const tokens = tokenizeMarkdown(projection.text);
	const covering = segments.map((segment) =>
		coveringToken(tokens, kind, segment),
	);

	if (covering.every(Boolean)) {
		const ranges = new Map<number, number>();
		for (const token of covering) {
			for (const [start, end] of token?.markers ?? []) {
				ranges.set(positions[start], positions[end]);
			}
		}
		for (const [from, to] of [...ranges].sort(([a], [b]) => b - a)) {
			tr.delete(from, to);
		}
	} else {
		const targets = segments.filter((_, index) => !covering[index]).reverse();
		for (const segment of targets) {
			tr.insertText(marker, positions[segment.end]);
			tr.insertText(marker, positions[segment.start]);
		}
	}

	const from = tr.mapping.map(projection.from, 1);
	const to = tr.mapping.map(projection.to, -1);
	tr.setSelection(
		TextSelection.create(tr.doc, Math.min(from, to), Math.max(from, to)),
	);
	return true;
};

export const toggleFormat = (editor: Editor, kind: FormatKind) => {
	if (editor.state.selection.empty) return;
	editor
		.chain()
		.focus()
		.command(({ tr }) => applyFormatToggle(tr, kind))
		.run();
};

const ORDERED_MARKER_RE = /^(\s*)(\d+)\.(\s)/;
const QUOTE_MARKER_RE = /^ {0,3}> ?/;
const UNORDERED_MARKER_RE = /^(\s*)[-*](\s)/;

type MarkerContext = {
	text: string;
	positions: number[];
	index: number;
	lineStart: number;
	line: string;
};

const markerContext = (editor: Editor): MarkerContext | null => {
	const { selection } = editor.state;
	if (!selection.empty || !selection.$from.parent.isTextblock) return null;

	const { $from } = selection;
	const { text, positions } = projectDoc(editor.state.doc);
	const found = cursorLine(text, positions, $from.pos);
	if (!found) return null;

	const index = positions.indexOf($from.pos);
	if (index === -1 || codeContextAt(text, index) === "codeblock") return null;

	return {
		text,
		positions,
		index,
		lineStart: found.lineStart,
		line: found.line,
	};
};

type ListLine = { indent: string; markerLength: number; ordered: boolean };

const listLine = (line: string): ListLine | null => {
	const ordered = ORDERED_MARKER_RE.exec(line);
	const match = ordered ?? UNORDERED_MARKER_RE.exec(line);
	if (!match) return null;
	return {
		indent: match[1],
		markerLength: match[0].length,
		ordered: !!ordered,
	};
};

const linesBefore = (text: string, lineStart: number) =>
	lineStart === 0 ? [] : text.slice(0, lineStart - 1).split("\n");

const indentTo = (text: string, lineStart: number, indent: string) => {
	const before = linesBefore(text, lineStart);
	for (let index = before.length - 1; index >= 0; index--) {
		const previous = listLine(before[index]);
		if (!previous) return null;
		if (previous.indent.length > indent.length) continue;
		const target = " ".repeat(previous.markerLength);
		return target.length > indent.length ? target : null;
	}
	return null;
};

const outdentTo = (text: string, lineStart: number, indent: string) => {
	if (indent.length === 0) return null;
	const before = linesBefore(text, lineStart);
	for (let index = before.length - 1; index >= 0; index--) {
		const previous = listLine(before[index]);
		if (!previous) break;
		if (previous.indent.length < indent.length) return previous.indent;
	}
	return "";
};

const replaceIndent = (
	editor: Editor,
	positions: number[],
	lineStart: number,
	indent: string,
	target: string,
) => {
	const from = positions[lineStart];
	const to = positions[lineStart + indent.length];
	const caret = editor.state.selection.from;
	const shifted = Math.max(
		from + target.length,
		caret + target.length - indent.length,
	);

	const chain = editor.chain().focus();
	if (to > from) chain.deleteRange({ from, to });
	if (target.length > 0) chain.insertContentAt(from, target);
	chain.setTextSelection(shifted).run();
};

export const handleListIndent = (editor: Editor, outdent: boolean) => {
	const context = markerContext(editor);
	if (!context) return false;
	const { text, positions, lineStart, line } = context;

	const current = listLine(line);
	if (!current) return false;

	const target = outdent
		? outdentTo(text, lineStart, current.indent)
		: indentTo(text, lineStart, current.indent);
	if (target === null || target === current.indent) return true;

	replaceIndent(editor, positions, lineStart, current.indent, target);
	return true;
};

const clearMarker = (editor: Editor, from: number, to: number) => {
	editor.chain().focus().deleteRange({ from, to }).setTextSelection(from).run();
};

export const handleListContinuation = (editor: Editor) => {
	const context = markerContext(editor);
	if (!context) return false;
	const { text, positions, index, lineStart, line } = context;

	const ordered = ORDERED_MARKER_RE.exec(line);
	const match = ordered ?? UNORDERED_MARKER_RE.exec(line);
	if (!match) return false;

	const markerLength = match[0].length;
	if (index < lineStart + markerLength) return false;

	const indent = match[1];
	if (line.slice(markerLength).trim() === "") {
		const target = outdentTo(text, lineStart, indent);
		if (target !== null) {
			replaceIndent(editor, positions, lineStart, indent, target);
			return true;
		}
		clearMarker(
			editor,
			positions[lineStart],
			positions[lineStart + markerLength],
		);
		return true;
	}

	const nextMarker = ordered
		? `${indent}${Number.parseInt(ordered[2], 10) + 1}. `
		: `${indent}${line.trimStart()[0]} `;
	editor.chain().focus().splitBlock().insertContent(nextMarker).run();
	return true;
};

export const handleQuoteContinuation = (editor: Editor) => {
	const context = markerContext(editor);
	if (!context) return false;
	const { positions, index, lineStart, line } = context;

	const match = QUOTE_MARKER_RE.exec(line);
	if (!match) return false;

	const markerLength = match[0].length;
	if (index < lineStart + markerLength) return false;

	if (line.slice(markerLength).trim() === "") {
		clearMarker(
			editor,
			positions[lineStart],
			positions[lineStart + markerLength],
		);
		return true;
	}

	editor.chain().focus().splitBlock().insertContent("> ").run();
	return true;
};

export const handleListMarkerDelete = (editor: Editor) => {
	const context = markerContext(editor);
	if (!context) return false;
	const { positions, index, lineStart, line } = context;

	if (index !== lineStart) return false;
	const ordered = ORDERED_MARKER_RE.exec(line);
	if (!ordered) return false;

	clearMarker(
		editor,
		positions[lineStart],
		positions[lineStart + ordered[0].length],
	);
	return true;
};

export const OrderedListAutoNumber = Extension.create({
	name: "orderedListAutoNumber",
	addProseMirrorPlugins() {
		return [
			new Plugin({
				appendTransaction: (transactions, _oldState, newState) => {
					if (!transactions.some((transaction) => transaction.docChanged)) {
						return null;
					}

					const edits: Array<{ from: number; to: number; text: string }> = [];
					const { text, positions } = projectDoc(newState.doc);
					const levels: Array<{ width: number; counter: number }> = [];
					let index = 0;
					for (const line of text.split("\n")) {
						const item =
							codeContextAt(text, index) === "codeblock"
								? null
								: listLine(line);
						if (!item) {
							levels.length = 0;
							index += line.length + 1;
							continue;
						}

						const width = item.indent.length;
						while (levels.length && levels[levels.length - 1].width > width) {
							levels.pop();
						}
						if (!levels.length || levels[levels.length - 1].width < width) {
							levels.push({ width, counter: 0 });
						}
						const level = levels[levels.length - 1];

						const match = item.ordered ? ORDERED_MARKER_RE.exec(line) : null;
						if (match) {
							level.counter += 1;
							const expected = String(level.counter);
							if (match[2] !== expected) {
								const numberStart = index + match[1].length;
								edits.push({
									from: positions[numberStart],
									to: positions[numberStart + match[2].length],
									text: expected,
								});
							}
						} else {
							level.counter = 0;
						}
						index += line.length + 1;
					}

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

const SHORTCODE_TO_EMOJI = (() => {
	const map = new Map<string, string>();
	for (const item of TIPTAP_EMOJIS) {
		if (!item.emoji) continue;
		for (const shortcode of item.shortcodes) {
			if (!map.has(shortcode)) map.set(shortcode, item.emoji);
		}
	}
	return map;
})();

const TEXT_PRESENTATION = new Set([
	"\u2122\uFE0F",
	"\u00A9\uFE0F",
	"\u00AE\uFE0F",
]);

export const emojiForShortcode = (shortcode: string) => {
	const emoji = SHORTCODE_TO_EMOJI.get(shortcode.toLowerCase());
	return emoji && TEXT_PRESENTATION.has(emoji) ? emoji.slice(0, -1) : emoji;
};

export type ShortcodeEmojiOptions = {
	customEmoji: (name: string) => CustomEmojiSuggestion | undefined;
};

export const ShortcodeEmoji = Extension.create<ShortcodeEmojiOptions>({
	name: "shortcodeEmoji",
	addOptions() {
		return { customEmoji: () => undefined };
	},
	addInputRules() {
		const options = this.options;
		return [
			new InputRule({
				find: /:([a-zA-Z0-9_+-]+):$/,
				handler: ({ state, range, match }) => {
					const name = match[1];
					const start = range.to - name.length - 1;
					if (codeContextAtPos(state.doc, start)) return null;
					const $start = state.doc.resolve(start);
					const before = $start.parent.textBetween(
						Math.max(0, $start.parentOffset - 1),
						$start.parentOffset,
					);
					if (/\d/.test(before) && /^\d+$/.test(name)) return null;
					const lineBefore = $start.parent.textBetween(0, $start.parentOffset);
					if ((lineBefore.match(/`/g)?.length ?? 0) % 2 === 1) return null;
					const custom = options.customEmoji(name);
					if (custom) {
						const node = state.schema.nodes.mention?.create(
							customEmojiAttrs(custom),
						);
						if (!node) return null;
						state.tr.replaceWith(start, range.to, node);
						return;
					}
					const emoji = emojiForShortcode(name);
					if (!emoji) return null;
					state.tr.insertText(emoji, start, range.to);
				},
			}),
		];
	},
});

const mentionMarkdown = (node: ProseMirrorNode) => {
	const { type, label, handle } = node.attrs;
	if (type === "member") return `@${label ?? handle}`;
	if (type === "channel") return `#${label}`;
	if (type === "role" || type === "bridged") return `@${label}`;
	return label ?? "";
};

export const fragmentToMarkdown = (fragment: Fragment): string => {
	let out = "";
	let paragraphs = 0;
	fragment.forEach((node) => {
		const name = node.type.name;
		if (node.isText) {
			out += node.text ?? "";
		} else if (name === "hardBreak") {
			out += "\n";
		} else if (name === "mention") {
			out += mentionMarkdown(node);
		} else if (name === "paragraph") {
			if (paragraphs > 0) out += "\n";
			paragraphs += 1;
			out += fragmentToMarkdown(node.content);
		} else if (node.childCount) {
			out += fragmentToMarkdown(node.content);
		}
	});
	return out;
};

const fragmentToFacets = (fragment: Fragment) =>
	proseMirrorToFacets({
		type: "doc",
		content: fragment.toJSON() ?? [],
	} as ReturnType<Editor["getJSON"]>);

export const writeSelectionToClipboard = (
	view: EditorView,
	event: ClipboardEvent,
) => {
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

export const wrapSelectionAsMarkdownLink = (view: EditorView, url: string) => {
	const { from, to } = view.state.selection;
	if (from === to) return false;

	const label = view.state.doc.textBetween(from, to, "\n", "\n");
	if (!MARKDOWN_LINK_POLICY.allowLink(label, url)) return false;

	const suffix = `](${url})`;
	const tr = view.state.tr;
	tr.insertText(suffix, to, to);
	tr.insertText("[", from, from);
	tr.setSelection(TextSelection.create(tr.doc, to + 1 + suffix.length));
	view.dispatch(tr);
	view.focus();
	return true;
};

export const extractImageFiles = (data: DataTransfer | null): File[] => {
	if (!data) return [];

	const files: File[] = [];
	const seen = new Set<string>();

	const add = (file: File | null) => {
		if (!file?.type.startsWith("image/")) return;
		const key = `${file.name}:${file.size}:${file.type}`;
		if (seen.has(key)) return;
		seen.add(key);
		const extension = file.type.split("/")[1] || "png";
		files.push(
			file.name.trim().length > 0
				? file
				: new File(
						[file],
						`pasted-image-${Date.now()}-${files.length}.${extension}`,
						{ type: file.type },
					),
		);
	};

	for (const item of data.items) {
		if (item.kind === "file" && item.type.startsWith("image/")) {
			add(item.getAsFile());
		}
	}
	for (const file of data.files) add(file);

	return files;
};

export const extractFiles = (data: DataTransfer | null): File[] => {
	if (!data) return [];
	const images = extractImageFiles(data);
	const seen = new Set(images.map((file) => `${file.size}:${file.type}`));
	const others = Array.from(data.files).filter(
		(file) =>
			!file.type.startsWith("image/") && !seen.has(`${file.size}:${file.type}`),
	);
	return [...images, ...others];
};
