import { describe, expect, it } from "vitest";
import {
	DEFAULT_BLUESKY_CLIENT,
	isKnownBlueskyClientID,
	normalizeBskyClientBase,
	resolveBlueskyClient,
} from "./bluesky-alternatives";

describe("normalizeBskyClientBase", () => {
	it("keeps a bare hostname", () => {
		expect(normalizeBskyClientBase("myclient.app")).toBe("myclient.app");
	});

	it("strips the scheme, path and trailing slash", () => {
		expect(normalizeBskyClientBase("https://myclient.app/")).toBe(
			"myclient.app",
		);
		expect(normalizeBskyClientBase("http://myclient.app/profile/me")).toBe(
			"myclient.app",
		);
	});

	it("trims and lowercases", () => {
		expect(normalizeBskyClientBase("  MyClient.App  ")).toBe("myclient.app");
	});

	it("rejects input without a usable host", () => {
		expect(normalizeBskyClientBase("")).toBeNull();
		expect(normalizeBskyClientBase("   ")).toBeNull();
		expect(normalizeBskyClientBase("localhost")).toBeNull();
		expect(normalizeBskyClientBase("not a host")).toBeNull();
	});
});

describe("resolveBlueskyClient", () => {
	it("resolves a registry client", () => {
		const client = resolveBlueskyClient({
			preferredBlueskyClient: "deer",
			customBlueskyClientBase: "",
		});

		expect(client.base).toBe("deer.social");
		expect(client.name).toBe("Deer Social");
	});

	it("collapses a gradient to its middle stop", () => {
		expect(
			resolveBlueskyClient({
				preferredBlueskyClient: "northsky",
				customBlueskyClientBase: "",
			}).accentColor,
		).toBe("#9f3def");
	});

	it("resolves a custom client without an icon", () => {
		const client = resolveBlueskyClient({
			preferredBlueskyClient: "custom",
			customBlueskyClientBase: "https://myclient.app/",
		});

		expect(client.base).toBe("myclient.app");
		expect(client.name).toBe("myclient.app");
		expect(client.id).toBe("custom");
	});

	it("falls back to Bluesky for a custom client with no host", () => {
		expect(
			resolveBlueskyClient({
				preferredBlueskyClient: "custom",
				customBlueskyClientBase: "",
			}),
		).toEqual(DEFAULT_BLUESKY_CLIENT);
	});

	it("falls back to Bluesky for an id that is no longer in the registry", () => {
		expect(
			resolveBlueskyClient({
				preferredBlueskyClient: "retired" as never,
				customBlueskyClientBase: "",
			}),
		).toEqual(DEFAULT_BLUESKY_CLIENT);
	});
});

describe("isKnownBlueskyClientID", () => {
	it("accepts registry ids and the custom id", () => {
		expect(isKnownBlueskyClientID("bluesky")).toBe(true);
		expect(isKnownBlueskyClientID("custom")).toBe(true);
	});

	it("rejects anything else", () => {
		expect(isKnownBlueskyClientID("retired")).toBe(false);
		expect(isKnownBlueskyClientID(undefined)).toBe(false);
	});
});
