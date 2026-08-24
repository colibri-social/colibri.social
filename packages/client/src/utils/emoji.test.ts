import { describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false }));
vi.mock("@tauri-apps/plugin-os", () => ({ platform: () => "macos" }));

const { parseEmojiText, splitEmojiSegments } = await import("./emoji");

describe("parseEmojiText", () => {
	it("escapes markup instead of letting it render", () => {
		expect(parseEmojiText("<b>hi</b>")).toBe("&lt;b&gt;hi&lt;/b&gt;");
	});

	it("escapes an angle bracket pair without otherwise touching it", () => {
		expect(parseEmojiText("<>")).toBe("&lt;&gt;");
	});

	it("escapes a script tag rather than dropping it", () => {
		expect(parseEmojiText("<script>alert(1)</script>")).toBe(
			"&lt;script&gt;alert(1)&lt;/script&gt;",
		);
	});

	it("still renders an emoji as a twemoji image", () => {
		const html = parseEmojiText("😀");
		expect(html).toContain("<img");
		expect(html).toContain('class="emoji"');
		expect(html).toContain('alt="😀"');
	});

	it("renders an emoji next to escaped markup", () => {
		const html = parseEmojiText("<b>😀");
		expect(html).toContain("&lt;b&gt;");
		expect(html).toContain("<img");
	});
});

describe("splitEmojiSegments", () => {
	it("keeps the text between two emoji", () => {
		expect(splitEmojiSegments("a😀b😀c")).toEqual([
			{ kind: "text", value: "a" },
			{ kind: "emoji", value: "😀" },
			{ kind: "text", value: "b" },
			{ kind: "emoji", value: "😀" },
			{ kind: "text", value: "c" },
		]);
	});

	it("returns a single text segment when there is no emoji", () => {
		expect(splitEmojiSegments("plain text")).toEqual([
			{ kind: "text", value: "plain text" },
		]);
	});

	it("handles an emoji at each end", () => {
		expect(splitEmojiSegments("😀mid😀")).toEqual([
			{ kind: "emoji", value: "😀" },
			{ kind: "text", value: "mid" },
			{ kind: "emoji", value: "😀" },
		]);
	});

	it("does not treat markup-shaped text as an emoji image", () => {
		expect(splitEmojiSegments('<img src="x" />')).toEqual([
			{ kind: "text", value: '<img src="x" />' },
		]);
	});

	it("returns nothing for empty input", () => {
		expect(splitEmojiSegments("")).toEqual([]);
	});
});
