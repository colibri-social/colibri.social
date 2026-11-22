import { describe, expect, it } from "vitest";
import type { PreferenceStore } from "../../../data/preferences/store";
import { trustsHost } from "./link-opener";

const preferring = (blueskyClient: string, customBlueskyClientBase = "") =>
	({
		client: () => ({ blueskyClient, customBlueskyClientBase }),
	}) as unknown as Pick<PreferenceStore, "client">;

describe("link trust", () => {
	it("trusts the preferred Bluesky client", () => {
		expect(trustsHost("deer.social", preferring("deer"))).toBe(true);
		expect(trustsHost("Deer.Social", preferring("deer"))).toBe(true);
		expect(
			trustsHost("sky.example.com", preferring("custom", "sky.example.com")),
		).toBe(true);
	});

	it("keeps warning for other Bluesky clients", () => {
		expect(trustsHost("witchsky.app", preferring("deer"))).toBe(false);
	});

	it("keeps the default trusted hosts", () => {
		expect(trustsHost("bsky.app", preferring("deer"))).toBe(true);
	});
});
