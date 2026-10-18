import { describe, expect, it } from "vitest";
import {
	buildBskyProfileUrl,
	DEFAULT_BLUESKY_CLIENT,
	normalizeBskyClientBase,
	resolveBlueskyClient,
} from "./bluesky-client";

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
