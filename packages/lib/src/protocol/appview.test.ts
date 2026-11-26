import { describe, expect, it } from "vitest";
import { normalizeAppViewUrl } from "./appview";

describe("normalizeAppViewUrl", () => {
	it("adds https to a bare host and keeps only the origin", () => {
		expect(normalizeAppViewUrl(" chat.example.com/app ")).toBe(
			"https://chat.example.com",
		);
	});

	it("keeps an explicit http origin with a port", () => {
		expect(normalizeAppViewUrl("http://127.0.0.1:3000")).toBe(
			"http://127.0.0.1:3000",
		);
	});

	it("rejects empty input, other protocols and hosts with spaces", () => {
		expect(normalizeAppViewUrl("   ")).toBeNull();
		expect(normalizeAppViewUrl("ftp://chat.example.com")).toBeNull();
		expect(normalizeAppViewUrl("not a server")).toBeNull();
		expect(normalizeAppViewUrl("https://not%20a%20server")).toBeNull();
	});
});
