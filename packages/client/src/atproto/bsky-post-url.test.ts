import { afterEach, describe, expect, it } from "vitest";
import { resolveBlueskyClient } from "./bluesky-alternatives";
import {
	buildBskyPostUrl,
	buildBskyProfileUrl,
	isBskyHost,
	parseBskyPostUrl,
	rewriteBskyUrl,
	setCustomBskyHost,
} from "./bsky-post-url";

const bluesky = resolveBlueskyClient({
	preferredBlueskyClient: "bluesky",
	customBlueskyClientBase: "",
});

const custom = resolveBlueskyClient({
	preferredBlueskyClient: "custom",
	customBlueskyClientBase: "myclient.app",
});

afterEach(() => {
	setCustomBskyHost(null);
});

describe("isBskyHost", () => {
	it("knows the registry hosts", () => {
		expect(isBskyHost("bsky.app")).toBe(true);
		expect(isBskyHost("deer.social")).toBe(true);
	});

	it("knows a registered custom host, and forgets it again", () => {
		expect(isBskyHost("myclient.app")).toBe(false);

		setCustomBskyHost("myclient.app");
		expect(isBskyHost("myclient.app")).toBe(true);

		setCustomBskyHost(null);
		expect(isBskyHost("myclient.app")).toBe(false);
	});
});

describe("parseBskyPostUrl", () => {
	it("reads a permalink on a registry host", () => {
		expect(
			parseBskyPostUrl("https://bsky.app/profile/alice.test/post/3kabc"),
		).toEqual({ authority: "alice.test", rkey: "3kabc" });
	});

	it("reads a permalink on the custom host once it is registered", () => {
		const uri = "https://myclient.app/profile/alice.test/post/3kabc";
		expect(parseBskyPostUrl(uri)).toBeNull();

		setCustomBskyHost("myclient.app");
		expect(parseBskyPostUrl(uri)).toEqual({
			authority: "alice.test",
			rkey: "3kabc",
		});
	});

	it("ignores unrelated hosts and paths", () => {
		expect(
			parseBskyPostUrl("https://example.com/profile/alice.test/post/3kabc"),
		).toBeNull();
		expect(parseBskyPostUrl("https://bsky.app/profile/alice.test")).toBeNull();
		expect(parseBskyPostUrl("not a url")).toBeNull();
	});
});

describe("buildBskyPostUrl / buildBskyProfileUrl", () => {
	it("points at the resolved client", () => {
		expect(buildBskyPostUrl(custom, "alice.test", "3kabc")).toBe(
			"https://myclient.app/profile/alice.test/post/3kabc",
		);
		expect(buildBskyProfileUrl(bluesky, "did:plc:abc")).toBe(
			"https://bsky.app/profile/did:plc:abc",
		);
	});
});

describe("rewriteBskyUrl", () => {
	it("swaps a registry host for the preferred client", () => {
		expect(rewriteBskyUrl("https://bsky.app/profile/alice.test", custom)).toBe(
			"https://myclient.app/profile/alice.test",
		);
	});

	it("leaves a URL already on the preferred host alone", () => {
		expect(rewriteBskyUrl("https://bsky.app/profile/alice.test", bluesky)).toBe(
			"https://bsky.app/profile/alice.test",
		);
	});

	it("leaves unrelated hosts alone", () => {
		expect(rewriteBskyUrl("https://example.com/hello", custom)).toBe(
			"https://example.com/hello",
		);
	});

	it("rewrites away from a registered custom host", () => {
		setCustomBskyHost("myclient.app");
		expect(
			rewriteBskyUrl("https://myclient.app/profile/alice.test", bluesky),
		).toBe("https://bsky.app/profile/alice.test");
	});
});
