import { describe, expect, it } from "vitest";
import { isBlueskyHost, parseDescribeServer } from "./pds-operator";

describe("isBlueskyHost", () => {
	it("recognises the entryway and the hosted pds fleet", () => {
		expect(isBlueskyHost("bsky.social")).toBe(true);
		expect(isBlueskyHost("shimeji.us-east.host.bsky.network")).toBe(true);
	});

	it("does not claim third-party hosts", () => {
		expect(isBlueskyHost("pds.example.com")).toBe(false);
		expect(isBlueskyHost("notbsky.social")).toBe(false);
	});
});

describe("parseDescribeServer", () => {
	it("points bluesky accounts at the bluesky settings page", () => {
		const operator = parseDescribeServer("bsky.social", {});
		expect(operator.deletionUrl).toBe("https://bsky.app/settings/account");
		expect(operator.deletionLinkLabel).toBe("your Bluesky account settings");
	});

	it("prefers an account page the pds actually serves", () => {
		const operator = parseDescribeServer(
			"bsky.social",
			{},
			"https://bsky.social/account",
		);
		expect(operator.deletionUrl).toBe("https://bsky.social/account");
		expect(operator.deletionLinkLabel).toBe("your account page on bsky.social");
	});

	it("pulls contact and policy links out of the response", () => {
		const operator = parseDescribeServer("pds.example.com", {
			contact: { email: "admin@example.com" },
			links: {
				privacyPolicy: "https://example.com/privacy",
				termsOfService: "https://example.com/terms",
			},
		});

		expect(operator.host).toBe("pds.example.com");
		expect(operator.deletionUrl).toBeUndefined();
		expect(operator.contactEmail).toBe("admin@example.com");
		expect(operator.privacyPolicyUrl).toBe("https://example.com/privacy");
		expect(operator.termsUrl).toBe("https://example.com/terms");
	});

	it("survives a pds that describes nothing useful", () => {
		expect(parseDescribeServer("pds.example.com", undefined)).toEqual({
			host: "pds.example.com",
		});
		expect(parseDescribeServer("pds.example.com", { contact: {} })).toEqual({
			host: "pds.example.com",
		});
	});

	it("ignores non-string fields", () => {
		const operator = parseDescribeServer("pds.example.com", {
			contact: { email: 42 },
			links: { privacyPolicy: "" },
		});
		expect(operator.contactEmail).toBeUndefined();
		expect(operator.privacyPolicyUrl).toBeUndefined();
	});
});
