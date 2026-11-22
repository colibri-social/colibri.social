import { describe, expect, it } from "vitest";
import {
	chooseThreadName,
	FALLBACK_THREAD_NAME,
	suggestThreadName,
	threadNameTooLong,
} from "./thread-name";

describe("thread names", () => {
	it("suggests a name from the anchor text like the current client", () => {
		expect(suggestThreadName("  release   plan  ")).toBe("release plan");
		expect(suggestThreadName(undefined)).toBe(FALLBACK_THREAD_NAME);
		const long = "x".repeat(80);
		expect(suggestThreadName(long)).toBe(`${"x".repeat(59)}...`);
	});

	it("prefers the typed name and falls back to the suggestion", () => {
		expect(chooseThreadName("  Ideas ", "suggested")).toBe("Ideas");
		expect(chooseThreadName("   ", "suggested")).toBe("suggested");
		expect(chooseThreadName("", "")).toBe(FALLBACK_THREAD_NAME);
	});

	it("limits names to 128 UTF-8 bytes", () => {
		expect(threadNameTooLong("a".repeat(128))).toBe(false);
		expect(threadNameTooLong("a".repeat(129))).toBe(true);
		expect(threadNameTooLong("é".repeat(65))).toBe(true);
	});
});
