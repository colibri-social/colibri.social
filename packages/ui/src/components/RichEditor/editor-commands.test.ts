import { Schema } from "prosemirror-model";
import {
	AllSelection,
	EditorState,
	type Selection,
	TextSelection,
} from "prosemirror-state";
import { describe, expect, it } from "vitest";
import { projectDoc } from "./block-projection";
import {
	activeFormats,
	applyFormatToggle,
	type FormatKind,
} from "./editor-commands";

const schema = new Schema({
	nodes: {
		doc: { content: "block+" },
		paragraph: { content: "inline*", group: "block" },
		text: { group: "inline" },
	},
});

const docFrom = (source: string) =>
	schema.nodes.doc.create(
		null,
		source
			.split("\n")
			.map((line) =>
				schema.nodes.paragraph.create(null, line ? schema.text(line) : null),
			),
	);

const selectAll = (source: string) => {
	const doc = docFrom(source);
	return EditorState.create({ doc, selection: new AllSelection(doc) });
};

const selectText = (source: string, start: number, end: number) => {
	const doc = docFrom(source);
	const { positions } = projectDoc(doc);
	return EditorState.create({
		doc,
		selection: TextSelection.create(doc, positions[start], positions[end]),
	});
};

const toggle = (state: EditorState, kind: FormatKind) => {
	const tr = state.tr;
	expect(applyFormatToggle(tr, kind)).toBe(true);
	return state.apply(tr);
};

const sourceOf = (state: EditorState) => projectDoc(state.doc).text;

const selectedText = ({
	doc,
	selection,
}: {
	doc: EditorState["doc"];
	selection: Selection;
}) => doc.textBetween(selection.from, selection.to, "\n");

describe("applyFormatToggle with select all", () => {
	it("wraps every line of a paragraph in one pair of markers", () => {
		const bold = toggle(selectAll("hello\nworld"), "bold");
		expect(sourceOf(bold)).toBe("**hello\nworld**");
		expect(selectedText(bold)).toBe("hello\nworld");
		expect(activeFormats({ state: bold }).has("bold")).toBe(true);

		const plain = toggle(bold, "bold");
		expect(sourceOf(plain)).toBe("hello\nworld");
		expect(activeFormats({ state: plain }).has("bold")).toBe(false);
	});

	it("wraps italic the same way", () => {
		const italic = toggle(selectAll("hello\nworld"), "italic");
		expect(sourceOf(italic)).toBe("*hello\nworld*");
		expect(activeFormats({ state: italic }).has("italic")).toBe(true);
		expect(sourceOf(toggle(italic, "italic"))).toBe("hello\nworld");
	});

	it("wraps each run of lines separately across a blank line", () => {
		const bold = toggle(selectAll("one\ntwo\n\nthree"), "bold");
		expect(sourceOf(bold)).toBe("**one\ntwo**\n\n**three**");
		expect(selectedText(bold)).toBe("one\ntwo**\n\n**three");
		expect(activeFormats({ state: bold }).has("bold")).toBe(true);

		const plain = toggle(bold, "bold");
		expect(sourceOf(plain)).toBe("one\ntwo\n\nthree");
		expect(selectedText(plain)).toBe("one\ntwo\n\nthree");
	});

	it("only wraps the runs that are not formatted yet", () => {
		const bold = toggle(selectAll("**one**\n\ntwo"), "bold");
		expect(sourceOf(bold)).toBe("**one**\n\n**two**");
		expect(sourceOf(toggle(bold, "bold"))).toBe("one\n\ntwo");
	});

	it("keeps list markers outside the markers", () => {
		const bold = toggle(selectAll("- seeds\n- suet"), "bold");
		expect(sourceOf(bold)).toBe("- **seeds**\n- **suet**");
		expect(activeFormats({ state: bold }).has("bold")).toBe(true);
		expect(sourceOf(toggle(bold, "bold"))).toBe("- seeds\n- suet");
	});

	it("keeps quote markers outside the markers", () => {
		const bold = toggle(selectAll("> seeds\n> suet"), "bold");
		expect(sourceOf(bold)).toBe("> **seeds\n> suet**");
		expect(activeFormats({ state: bold }).has("bold")).toBe(true);
		expect(sourceOf(toggle(bold, "bold"))).toBe("> seeds\n> suet");
	});

	it("splits runs where a quote starts or ends", () => {
		const bold = toggle(selectAll("seeds\n> suet"), "bold");
		expect(sourceOf(bold)).toBe("**seeds**\n> **suet**");
		expect(sourceOf(toggle(bold, "bold"))).toBe("seeds\n> suet");
	});

	it("leaves fenced code untouched", () => {
		const bold = toggle(selectAll("seeds\n\n```\ncode\n```"), "bold");
		expect(sourceOf(bold)).toBe("**seeds**\n\n```\ncode\n```");
	});
});

describe("applyFormatToggle with a text selection", () => {
	it("wraps the selected word and keeps it selected", () => {
		const bold = toggle(selectText("hello world", 6, 11), "bold");
		expect(sourceOf(bold)).toBe("hello **world**");
		expect(selectedText(bold)).toBe("world");
		expect(activeFormats({ state: bold }).has("bold")).toBe(true);

		const plain = toggle(bold, "bold");
		expect(sourceOf(plain)).toBe("hello world");
		expect(selectedText(plain)).toBe("world");
	});

	it("ignores an empty selection", () => {
		const state = selectText("hello", 2, 2);
		expect(applyFormatToggle(state.tr, "bold")).toBe(false);
	});
});
