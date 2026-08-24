import { describe, expect, it } from "vitest";
import { escapeAttr, escapeHtml } from "./html-escape";

describe("escapeHtml", () => {
	it("escapes the three markup characters", () => {
		expect(escapeHtml("<b>hi</b>")).toBe("&lt;b&gt;hi&lt;/b&gt;");
		expect(escapeHtml("<>")).toBe("&lt;&gt;");
		expect(escapeHtml("a & b")).toBe("a &amp; b");
	});

	it("escapes the ampersand first so entities are not swallowed", () => {
		expect(escapeHtml("&lt;")).toBe("&amp;lt;");
	});

	it("leaves plain text alone", () => {
		expect(escapeHtml("hello world")).toBe("hello world");
		expect(escapeHtml("")).toBe("");
	});
});

describe("escapeAttr", () => {
	it("also escapes both quote characters", () => {
		expect(escapeAttr(`a"b'c`)).toBe("a&quot;b&#39;c");
	});

	it("escapes an attribute break-out attempt", () => {
		expect(escapeAttr('" onerror="alert(1)')).toBe(
			"&quot; onerror=&quot;alert(1)",
		);
	});
});
