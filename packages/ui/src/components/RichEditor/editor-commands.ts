import { facetsToSource, tokenizeMarkdown } from "@colibri-social/lib";
import { type Editor, Extension, InputRule } from "@tiptap/core";
import type { Fragment, Node as ProseMirrorNode } from "prosemirror-model";
import { Plugin, TextSelection } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { TIPTAP_EMOJIS } from "../../utils/emoji-data";
import { codeContextAt } from "../../utils/rich-text/code-context";
import { MARKDOWN_LINK_POLICY } from "../../utils/rich-text/link-safety";
import { codeContextAtPos, cursorLine, projectBlock } from "./block-projection";
import { buildClipboardHtml } from "./clipboard-facets";
import { proseMirrorToFacets } from "./prosemirror-to-facets";

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
	selStart: number;
	selEnd: number;
};

const projectSelection = (editor: Editor): SelectionProjection | null => {
	const { selection } = editor.state;
	const block = selection.$from.parent;
	if (!block.isTextblock || selection.$from.parent !== selection.$to.parent) {
		return null;
	}
	const { text, positions } = projectBlock(block, selection.$from.before());
	const selStart = positions.indexOf(selection.from);
	const selEnd = positions.indexOf(selection.to);
	if (selStart === -1 || selEnd === -1) return null;
	return { text, positions, selStart, selEnd };
};

const containingTokens = (projection: SelectionProjection, kind: FormatKind) =>
	tokenizeMarkdown(projection.text)
		.filter(
			(token) =>
				token.kind === kind &&
				token.content[0] <= projection.selStart &&
				token.content[1] >= projection.selEnd,
		)
		.sort(
			(a, b) => a.content[1] - a.content[0] - (b.content[1] - b.content[0]),
		);

export const activeFormats = (editor: Editor): Set<FormatKind> => {
	const active = new Set<FormatKind>();
	if (editor.state.selection.empty) return active;
	const projection = projectSelection(editor);
	if (!projection) return active;
	for (const token of tokenizeMarkdown(projection.text)) {
		if (!(token.kind in FORMAT_MARKER)) continue;
		if (
			token.content[0] <= projection.selStart &&
			token.content[1] >= projection.selEnd
		) {
			active.add(token.kind as FormatKind);
		}
	}
	return active;
};

export const toggleFormat = (editor: Editor, kind: FormatKind) => {
	const marker = FORMAT_MARKER[kind];
	const { from, to } = editor.state.selection;
	if (from === to) return;

	const length = marker.length;
	const wrap = () => {
		editor
			.chain()
			.focus()
			.insertContentAt(to, marker)
			.insertContentAt(from, marker)
			.setTextSelection({ from: from + length, to: to + length })
			.run();
	};

	const projection = projectSelection(editor);
	if (!projection) {
		wrap();
		return;
	}

	const [token] = containingTokens(projection, kind);
	if (!token) {
		wrap();
		return;
	}

	const { positions, selStart } = projection;
	const ranges = token.markers
		.map(([start, end]) => ({ from: positions[start], to: positions[end] }))
		.sort((a, b) => b.from - a.from);
	const removedBefore = token.markers
		.filter(([, end]) => end <= selStart)
		.reduce(
			(sum, [start, end]) => sum + (positions[end] - positions[start]),
			0,
		);

	let chain = editor.chain().focus();
	for (const range of ranges) chain = chain.deleteRange(range);
	chain
		.setTextSelection({ from: from - removedBefore, to: to - removedBefore })
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
	const { text, positions } = projectBlock($from.parent, $from.before());
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
	editor.chain().focus().setHardBreak().insertContent(nextMarker).run();
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

	editor.chain().focus().setHardBreak().insertContent("> ").run();
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
					newState.doc.descendants((node, pos) => {
						if (!node.isTextblock) return;

						const { text, positions } = projectBlock(node, pos);
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

export const emojiForShortcode = (shortcode: string) =>
	SHORTCODE_TO_EMOJI.get(shortcode.toLowerCase());

export const ShortcodeEmoji = Extension.create({
	name: "shortcodeEmoji",
	addInputRules() {
		return [
			new InputRule({
				find: /(?:^|\s):([a-zA-Z0-9_+-]+):$/,
				handler: ({ state, range, match }) => {
					const emoji = emojiForShortcode(match[1]);
					if (!emoji) return null;
					const start = range.to - match[1].length - 1;
					if (codeContextAtPos(state.doc, start)) return null;
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
