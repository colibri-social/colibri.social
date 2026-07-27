import { describe, expect, it } from "vitest";
import { createFenceRegex, FENCE_REGEX_SOURCE } from "./fenced-code-regex";

const matchAll = (input: string) => [...input.matchAll(createFenceRegex())];

describe("createFenceRegex", () => {
	it("defaults to the global and hasIndices flags", () => {
		const regex = createFenceRegex();
		expect(regex.global).toBe(true);
		expect(regex.hasIndices).toBe(true);
	});

	it("honours explicitly passed flags", () => {
		expect(createFenceRegex("g").hasIndices).toBe(false);
	});

	it("builds from the shared source", () => {
		expect(createFenceRegex().source).toBe(FENCE_REGEX_SOURCE);
	});

	it("returns a fresh regex so lastIndex is never shared", () => {
		expect(createFenceRegex()).not.toBe(createFenceRegex());
	});
});

describe("fence matching", () => {
	it("matches a block at the start of the input", () => {
		const matches = matchAll("```js\nconst a = 1;\n```");

		expect(matches).toHaveLength(1);
		expect(matches[0][1]).toBe("js");
		expect(matches[0][2]).toBe("const a = 1;");
	});

	it("matches a block with no language", () => {
		const matches = matchAll("```\nplain\n```");

		expect(matches).toHaveLength(1);
		expect(matches[0][1]).toBe("");
	});

	it("matches a block that starts on a later line", () => {
		const matches = matchAll("intro\n```js\ncode\n```");

		expect(matches).toHaveLength(1);
		expect(matches[0][2]).toBe("code");
	});

	it("does not match a fence that is not at the start of a line", () => {
		expect(matchAll("text ```js\ncode\n```")).toHaveLength(0);
	});

	it("captures a multi-line body", () => {
		const matches = matchAll("```\none\ntwo\n```");
		expect(matches[0][2]).toBe("one\ntwo");
	});

	it("is non-greedy so two adjacent blocks stay separate", () => {
		const matches = matchAll("```\na\n```\n```\nb\n```");

		expect(matches).toHaveLength(2);
		expect(matches[0][2]).toBe("a");
		expect(matches[1][2]).toBe("b");
	});

	it("does not match an unterminated fence", () => {
		expect(matchAll("```js\ncode")).toHaveLength(0);
	});

	it("accepts language tags containing digits and separators", () => {
		expect(matchAll("```c++\ncode\n```")[0][1]).toBe("c++");
		expect(matchAll("```objective-c\ncode\n```")[0][1]).toBe("objective-c");
		expect(matchAll("```h2\ncode\n```")[0][1]).toBe("h2");
	});

	it("exposes indices when the d flag is set", () => {
		const [match] = matchAll("```\na\n```");
		expect(match.indices?.[0]).toEqual([0, 9]);
	});
});
