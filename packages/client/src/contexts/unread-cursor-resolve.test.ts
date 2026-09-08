import { describe, expect, it } from "vitest";
import {
	isTrustedCursorSource,
	resolveCursorFast,
} from "./unread-cursor-resolve";

const resolve = (
	overrides?: Partial<Parameters<typeof resolveCursorFast>[0]>,
) =>
	resolveCursorFast({
		local: undefined,
		snapshot: undefined,
		hint: "unknown",
		...overrides,
	});

describe("resolveCursorFast", () => {
	it("prefers the locally tracked cursor", () => {
		expect(
			resolve({ local: "3local", snapshot: "3snap", hint: "read" }),
		).toEqual({ cursor: "3local", source: "local", resolved: true });
	});

	it("falls back to the cached window's cursor", () => {
		expect(resolve({ snapshot: "3snap", hint: "unread" })).toEqual({
			cursor: "3snap",
			source: "snapshot",
			resolved: true,
		});
	});

	it("settles with no cursor when the channel is known to be read", () => {
		expect(resolve({ hint: "read" })).toEqual({
			cursor: undefined,
			source: "hint",
			resolved: true,
		});
	});

	it("defers to the network when the channel is known to have unread messages", () => {
		expect(resolve({ hint: "unread" })).toEqual({
			cursor: undefined,
			source: "network",
			resolved: false,
		});
	});

	it("defers to the network when no unread status has loaded", () => {
		expect(resolve({ hint: "unknown" })).toEqual({
			cursor: undefined,
			source: "network",
			resolved: false,
		});
	});

	it("keeps a local cursor of the empty string, which is still an answer", () => {
		expect(resolve({ local: "", hint: "unread" }).source).toBe("local");
	});
});

describe("isTrustedCursorSource", () => {
	it("trusts every source that actually answered", () => {
		for (const source of ["local", "snapshot", "hint", "network"] as const) {
			expect(isTrustedCursorSource(source)).toBe(true);
		}
	});

	it("does not trust a position chosen after giving up waiting", () => {
		expect(isTrustedCursorSource("timeout")).toBe(false);
	});
});
