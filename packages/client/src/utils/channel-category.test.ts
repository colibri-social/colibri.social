import { describe, expect, it } from "vitest";
import { ambiguousCategoryName } from "./channel-category";

const DID = "did:plc:abc123";
const SUPPORT = `at://${DID}/social.colibri.category/support`;
const BUGS = `at://${DID}/social.colibri.category/bugs`;

const channel = (rkey: string, name: string, category: string) => ({
	uri: `at://${DID}/social.colibri.channel/${rkey}`,
	name,
	category,
});

const categories = [
	{ uri: SUPPORT, name: "Support" },
	{ uri: BUGS, name: "Bugs" },
];

describe("ambiguousCategoryName", () => {
	it("returns nothing when the name is unique", () => {
		const target = channel("general", "general", SUPPORT);
		const channels = [target, channel("triage", "triage", BUGS)];

		expect(ambiguousCategoryName(target, channels, categories)).toBeUndefined();
	});

	it("returns the category name when another channel shares the name", () => {
		const target = channel("general-a", "general", SUPPORT);
		const channels = [target, channel("general-b", "general", BUGS)];

		expect(ambiguousCategoryName(target, channels, categories)).toBe("Support");
	});

	it("treats names differing only in case as a collision", () => {
		const target = channel("general-a", "General", SUPPORT);
		const channels = [target, channel("general-b", "general", BUGS)];

		expect(ambiguousCategoryName(target, channels, categories)).toBe("Support");
	});

	it("does not collide a channel with itself", () => {
		const target = channel("general", "general", SUPPORT);

		expect(ambiguousCategoryName(target, [target], categories)).toBeUndefined();
	});

	it("returns nothing for an uncategorized channel", () => {
		const target = channel("general-a", "general", "");
		const channels = [target, channel("general-b", "general", BUGS)];

		expect(ambiguousCategoryName(target, channels, categories)).toBeUndefined();
	});

	it("returns nothing when the category uri does not resolve", () => {
		const target = channel(
			"general-a",
			"general",
			`at://${DID}/social.colibri.category/gone`,
		);
		const channels = [target, channel("general-b", "general", BUGS)];

		expect(ambiguousCategoryName(target, channels, categories)).toBeUndefined();
	});
});
