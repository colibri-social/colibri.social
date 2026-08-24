import { afterEach, describe, expect, it, vi } from "vitest";
import { parseColibriInviteUrl } from "./colibri-invite-url";

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("parseColibriInviteUrl", () => {
	it("reads the code from a colibri.social invite", () => {
		expect(parseColibriInviteUrl("https://colibri.social/invite/abc123")).toBe(
			"abc123",
		);
	});

	it("reads the code from the spaces alpha origin", () => {
		expect(
			parseColibriInviteUrl("https://spaces.colibri.social/invite/abc123"),
		).toBe("abc123");
	});

	it("reads the code from whichever origin the app is served from", () => {
		vi.stubGlobal("window", { location: { host: "colibri.example" } });

		expect(parseColibriInviteUrl("https://colibri.example/invite/abc123")).toBe(
			"abc123",
		);
	});

	it("ignores an invite path on an unrelated host", () => {
		expect(
			parseColibriInviteUrl("https://example.com/invite/abc123"),
		).toBeNull();
	});

	it("ignores a colibri url that is not an invite", () => {
		expect(parseColibriInviteUrl("https://colibri.social/app/c/x")).toBeNull();
	});

	it("ignores something that is not a url", () => {
		expect(parseColibriInviteUrl("abc123")).toBeNull();
	});
});
