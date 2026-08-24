import { describe, expect, it } from "vitest";
import { asSpaceRef } from "../atproto/lexicons";
import { ambiguousCategoryName } from "./channel-category";

const DID = "did:plc:abc123";
const SUPPORT = "support";
const BUGS = "bugs";

const channel = (rkey: string, name: string, category: string) => ({
	space: asSpaceRef(
		`at://${DID}/space/social.colibri.beta.channel.text/${rkey}`,
	),
	name,
	category,
});

const categories = [
	{ rkey: SUPPORT, name: "Support" },
	{ rkey: BUGS, name: "Bugs" },
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

	it("returns nothing when the category key does not resolve", () => {
		const target = channel("general-a", "general", "gone");
		const channels = [target, channel("general-b", "general", BUGS)];

		expect(ambiguousCategoryName(target, channels, categories)).toBeUndefined();
	});
});
