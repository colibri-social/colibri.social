import { describe, expect, it } from "vitest";
import {
	blueskyUrlRewriter,
	buildBskyProfileUrl,
	DEFAULT_BLUESKY_CLIENT,
	normalizeBskyClientBase,
	resolveBlueskyClient,
	rewriteBskyUrl,
} from "./bluesky-client";
import type { PreferenceStore } from "./preferences/store";

describe("resolveBlueskyClient", () => {
	it("resolves a registry client", () => {
		expect(
			resolveBlueskyClient({
				preferredBlueskyClient: "mu",
				customBlueskyClientBase: "",
			}),
		).toMatchObject({ base: "mu.social", name: "Mu Social" });
	});

	it("falls back to Bluesky for a custom client without a host", () => {
		expect(
			resolveBlueskyClient({
				preferredBlueskyClient: "custom",
				customBlueskyClientBase: "localhost",
			}),
		).toBe(DEFAULT_BLUESKY_CLIENT);
	});

	it("builds a profile URL", () => {
		expect(buildBskyProfileUrl(DEFAULT_BLUESKY_CLIENT, "did:plc:abc")).toBe(
			"https://bsky.app/profile/did:plc:abc",
		);
	});

	it("rejects input without a usable host", () => {
		expect(normalizeBskyClientBase("not a host")).toBeNull();
	});
});

describe("rewriteBskyUrl", () => {
	const deer = resolveBlueskyClient({
		preferredBlueskyClient: "deer",
		customBlueskyClientBase: "",
	});

	it("resolves Deer Social", () => {
		expect(deer).toMatchObject({ base: "deer.social", name: "Deer Social" });
	});

	it("moves a Bluesky link to the preferred client", () => {
		expect(
			rewriteBskyUrl("https://bsky.app/profile/lou.gg/post/3abc?x=1", deer),
		).toBe("https://deer.social/profile/lou.gg/post/3abc?x=1");
		expect(rewriteBskyUrl("https://witchsky.app/profile/lou.gg", deer)).toBe(
			"https://deer.social/profile/lou.gg",
		);
	});

	it("leaves other links alone", () => {
		for (const uri of [
			"https://example.com/profile/lou.gg",
			"https://deer.social/profile/lou.gg",
			"not a url",
			"mailto:hi@bsky.app",
		])
			expect(rewriteBskyUrl(uri, deer)).toBe(uri);
	});

	it("reads the preferred client from preferences", () => {
		const preferences = {
			client: () => ({
				blueskyClient: "custom",
				customBlueskyClientBase: "sky.example.com",
			}),
		} as unknown as Pick<PreferenceStore, "client">;
		expect(
			blueskyUrlRewriter(preferences)("https://bsky.app/profile/lou.gg"),
		).toBe("https://sky.example.com/profile/lou.gg");
	});
});
