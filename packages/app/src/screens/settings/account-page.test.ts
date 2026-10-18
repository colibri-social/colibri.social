import { describe, expect, it } from "vitest";
import { accountPageUrl } from "./account-page";

describe("accountPageUrl", () => {
	it("points at the account page on the person's own server", () => {
		expect(accountPageUrl("pds.example.com")).toBe(
			"https://pds.example.com/account",
		);
	});

	it("sends Bluesky-hosted accounts to their Bluesky account settings", () => {
		expect(accountPageUrl("morel.us-east.host.bsky.network")).toBe(
			"https://bsky.app/settings/account",
		);
		expect(accountPageUrl("bsky.social")).toBe(
			"https://bsky.app/settings/account",
		);
	});
});
