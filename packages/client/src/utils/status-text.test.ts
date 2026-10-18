import { describe, expect, it } from "vitest";
import {
	clampStatusText,
	clampToBytes,
	STATUS_TEXT_MAX_BYTES,
	utf8Length,
} from "./status-text";

describe("utf8Length", () => {
	it("counts UTF-8 bytes", () => {
		expect(utf8Length("abc")).toBe(3);
		expect(utf8Length("ü")).toBe(2);
		expect(utf8Length("🐦")).toBe(4);
	});
});

describe("clampToBytes", () => {
	it("keeps text within the limit unchanged", () => {
		expect(clampToBytes("hello", 5)).toBe("hello");
	});

	it("cuts on grapheme boundaries", () => {
		const family = "👨‍👩‍👧";
		expect(clampToBytes(`ab${family}`, utf8Length(family) + 1)).toBe("ab");
		expect(clampToBytes(`a${family}b`, utf8Length(family) + 1)).toBe(
			`a${family}`,
		);
	});
});

describe("clampStatusText", () => {
	it("allows 64 ASCII characters", () => {
		const text = "a".repeat(STATUS_TEXT_MAX_BYTES);
		expect(clampStatusText(text)).toBe(text);
		expect(clampStatusText(`${text}b`)).toBe(text);
	});

	it("allows fewer multibyte characters", () => {
		const clamped = clampStatusText("ü".repeat(40));
		expect(clamped).toBe("ü".repeat(32));
		expect(utf8Length(clamped)).toBe(STATUS_TEXT_MAX_BYTES);
	});
});
