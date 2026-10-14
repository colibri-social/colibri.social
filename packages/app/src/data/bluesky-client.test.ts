import { describe, expect, it } from "vitest";
import {
	buildBskyProfileUrl,
	DEFAULT_BLUESKY_CLIENT,
	mergeBlueskyClientPreference,
	normalizeBskyClientBase,
	parseBlueskyClientPreference,
	resolveBlueskyClient,
} from "./bluesky-client";

describe("parseBlueskyClientPreference", () => {
	it("defaults to Bluesky without stored preferences", () => {
		expect(parseBlueskyClientPreference(null)).toEqual({
			preferredBlueskyClient: "bluesky",
			customBlueskyClientBase: "",
		});
		expect(parseBlueskyClientPreference("not json")).toEqual({
			preferredBlueskyClient: "bluesky",
			customBlueskyClientBase: "",
		});
	});

	it("reads the old client's stored shape", () => {
		expect(
			parseBlueskyClientPreference(
				JSON.stringify({
					theme: "dark",
					preferredBlueskyClient: "custom",
					customBlueskyClientBase: "https://MyClient.app/profile",
				}),
			),
		).toEqual({
			preferredBlueskyClient: "custom",
			customBlueskyClientBase: "myclient.app",
		});
	});

	it("falls back to Bluesky for an unknown client", () => {
		expect(
			parseBlueskyClientPreference(
				JSON.stringify({ preferredBlueskyClient: "gone" }),
			).preferredBlueskyClient,
		).toBe("bluesky");
	});
});

describe("mergeBlueskyClientPreference", () => {
	it("keeps the other stored preferences", () => {
		expect(
			JSON.parse(
				mergeBlueskyClientPreference(JSON.stringify({ theme: "light" }), {
					preferredBlueskyClient: "witchsky",
					customBlueskyClientBase: "",
				}),
			),
		).toEqual({
			theme: "light",
			preferredBlueskyClient: "witchsky",
			customBlueskyClientBase: "",
		});
	});
});

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
