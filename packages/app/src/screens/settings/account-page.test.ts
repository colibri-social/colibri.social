import { describe, expect, it } from "vitest";
import { accountPageUrl } from "./account-page";

describe("accountPageUrl", () => {
	it("points at the account page on the authorization server", () => {
		expect(accountPageUrl("https://pds.example.com")).toBe(
			"https://pds.example.com/account",
		);
	});

	it("sends Bluesky-hosted accounts to the Bluesky authorization server", () => {
		expect(accountPageUrl("https://bsky.social")).toBe(
			"https://bsky.social/account",
		);
	});

	it("replaces any path on the issuer", () => {
		expect(accountPageUrl("https://auth.example.com/oauth/")).toBe(
			"https://auth.example.com/account",
		);
	});
});
