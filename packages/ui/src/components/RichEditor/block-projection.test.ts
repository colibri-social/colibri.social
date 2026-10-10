import { Schema } from "prosemirror-model";
import { describe, expect, it } from "vitest";
import { codeContextAtPos, cursorLine, projectBlock } from "./block-projection";

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
