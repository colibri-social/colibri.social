import { describe, expect, it } from "vitest";
import { codeContextAt } from "./code-context";

const at = (text: string, index: number) => codeContextAt(text, index);
const atEnd = (text: string) => codeContextAt(text, text.length);

describe("codeContextAt", () => {
	it("treats an unclosed fence as a code block up to the end of the text", () => {
		expect(atEnd("```ts\nconst x = 1")).toBe("codeblock");
	});

	it("treats the opening fence line as a code block", () => {
		expect(at("```ts", 5)).toBe("codeblock");
		expect(at("```ts\n", 6)).toBe("codeblock");
	});

	it("covers a closed fence from its opening marker", () => {
		expect(at("```ts\ncode\n```", 0)).toBe("codeblock");
		expect(at("```ts\ncode\n```", 8)).toBe("codeblock");
	});

	it("leaves the position after a closing fence outside the block", () => {
		expect(atEnd("```ts\ncode\n```")).toBe(null);
	});

	it("leaves text after a closed fence outside the block", () => {
		expect(atEnd("```ts\ncode\n```\nafter")).toBe(null);
	});

	it("recognises tilde fences", () => {
		expect(atEnd("~~~\ncode")).toBe("codeblock");
		expect(atEnd("~~~\ncode\n~~~")).toBe(null);
	});

	it("only closes a fence with a marker at least as long", () => {
		expect(atEnd("````\ncode\n```\nmore")).toBe("codeblock");
		expect(atEnd("````\ncode\n````\nmore")).toBe(null);
	});

	it("does not open a fence from an inline backtick run", () => {
		expect(atEnd("see ```code``` here")).toBe(null);
	});

	it("recognises a closed inline span", () => {
		expect(at("`x`", 1)).toBe("code");
		expect(at("`x`", 3)).toBe(null);
		expect(at("`x`", 0)).toBe(null);
	});

	it("ignores an unclosed inline span", () => {
		expect(at("`x", 2)).toBe(null);
		expect(atEnd("use the ` char")).toBe(null);
	});

	it("returns null for plain text", () => {
		expect(atEnd("hello there")).toBe(null);
		expect(at("", 0)).toBe(null);
	});
});
