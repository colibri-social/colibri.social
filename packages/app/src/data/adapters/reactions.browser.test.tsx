import { describe, expect, it } from "vitest";
import type { ReactionView } from "../types";
import { customReactionResolver, toReactions } from "./reactions";

describe("reaction names", () => {
	const members = new Map();

	it("names unicode, custom and skin-toned reactions", () => {
		const views = [
			{ emoji: "🐦", count: 1, reactors: [] },
			{ emoji: ":kek:", count: 1, reactors: [] },
			{
				emoji: ":old_name:",
				customEmoji: { uri: "at://did:plc:space/blue.moji.collection.item/3k" },
				count: 1,
				reactors: [],
			},
			{ emoji: "👍🏽", count: 1, reactors: [] },
		] as unknown as ReactionView[];
		const resolve = customReactionResolver(undefined, () => ({
			name: "new_name",
			src: "new.png",
		}));
		expect(
			toReactions(views, members, resolve).map((entry) => entry.label),
		).toEqual(["bird", "kek", "new_name", "+1"]);
	});
});
