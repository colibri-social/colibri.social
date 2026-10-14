import { Schema } from "prosemirror-model";
import { EditorState } from "prosemirror-state";
import { describe, expect, it } from "vitest";
import {
	codeContextAtPos,
	cursorLine,
	projectBlock,
	projectDoc,
} from "./block-projection";
import { splitHardBreaks } from "./line-blocks";

const schema = new Schema({
	nodes: {
		doc: { content: "block+" },
		paragraph: { content: "inline*", group: "block" },
		text: { group: "inline" },
		hardBreak: { group: "inline", inline: true, selectable: false },
		mention: { group: "inline", inline: true, atom: true },
	},
});

const MENTION = "";
const LEAF = "￼";

const docFrom = (source: string) => {
	const children = [];
	let buffer = "";

	const flush = () => {
		if (buffer === "") return;
		children.push(schema.text(buffer));
		buffer = "";
	};

	for (const char of source) {
		if (char === "\n") {
			flush();
			children.push(schema.nodes.hardBreak.create());
		} else if (char === MENTION) {
			flush();
			children.push(schema.nodes.mention.create());
		} else {
			buffer += char;
		}
	}
	flush();

	return schema.nodes.doc.create(
		null,
		schema.nodes.paragraph.create(null, children),
	);
};

const posOf = (index: number) => index + 1;

const docFromLines = (lines: string[]) =>
	schema.nodes.doc.create(
		null,
		lines.map((line) =>
			schema.nodes.paragraph.create(null, line ? schema.text(line) : null),
		),
	);

describe("projectDoc", () => {
	it("joins paragraphs with newlines mapped to the end of each block", () => {
		const { text, positions, blocks } = projectDoc(
			docFromLines(["ab", "", "c"]),
		);

		expect(text).toBe("ab\n\nc");
		expect(positions).toEqual([1, 2, 3, 5, 7, 8]);
		expect(blocks.map(({ start, end }) => [start, end])).toEqual([
			[0, 2],
			[3, 3],
			[4, 5],
		]);
	});

	it("finds a code block that spans paragraphs", () => {
		const doc = docFromLines(["```ts", "const x = 1"]);

		expect(codeContextAtPos(doc, 9)).toBe("codeblock");
	});
});

describe("splitHardBreaks", () => {
	it("turns every hard break into a paragraph boundary", () => {
		const state = EditorState.create({ doc: docFrom("a\n\nb") });
		const tr = state.tr;

		expect(splitHardBreaks(tr)).toBe(true);
		expect(tr.doc.childCount).toBe(3);
		expect(projectDoc(tr.doc).text).toBe("a\n\nb");
		expect(splitHardBreaks(tr)).toBe(false);
	});
});

describe("projectBlock", () => {
	it("maps hard breaks to newlines and leaf nodes to a placeholder", () => {
		const { text, positions } = projectBlock(
			docFrom(`a\nb${MENTION}c`).child(0),
			0,
		);

		expect(text).toBe(`a\nb${LEAF}c`);
		expect(positions).toEqual([1, 2, 3, 4, 5, 6]);
	});
});

describe("cursorLine", () => {
	it("returns the line around the cursor", () => {
		const { text, positions } = projectBlock(
			docFrom("```ts\nconst x = 1").child(0),
			0,
		);

		expect(cursorLine(text, positions, posOf(9))).toEqual({
			lineStart: 6,
			lineEnd: 17,
			line: "const x = 1",
		});
	});
});

describe("codeContextAtPos", () => {
	it("reports a code block while its closing fence is still missing", () => {
		expect(codeContextAtPos(docFrom("```ts\nconst x = 1"), posOf(17))).toBe(
			"codeblock",
		);
	});

	it("stays outside code for plain text", () => {
		expect(codeContextAtPos(docFrom("hello there"), posOf(11))).toBe(null);
	});

	it("keeps positions aligned across a leaf node before the fence", () => {
		const doc = docFrom(`${MENTION}\n\`\`\`ts\ncode`);

		expect(codeContextAtPos(doc, posOf(12))).toBe("codeblock");
		expect(codeContextAtPos(doc, posOf(0))).toBe(null);
	});

	it("returns null outside a textblock", () => {
		expect(codeContextAtPos(docFrom("hello"), 0)).toBe(null);
	});

	it("reports an inline span", () => {
		const doc = docFrom("a `b` c");

		expect(codeContextAtPos(doc, posOf(3))).toBe("code");
		expect(codeContextAtPos(doc, posOf(6))).toBe(null);
	});
});
