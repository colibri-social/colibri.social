import { describe, expect, it } from "vitest";
import { orderCollections } from "./delete-account";

describe("orderCollections", () => {
	it("drops collections that are not colibri's", () => {
		expect(
			orderCollections([
				"app.bsky.actor.profile",
				"social.colibri.message",
				"chat.bsky.convo",
			]),
		).toEqual(["social.colibri.message"]);
	});

	it("deletes the signal record last so the appview follows the rest", () => {
		const ordered = orderCollections([
			"social.colibri.actor.data",
			"social.colibri.message",
			"social.colibri.reaction",
		]);
		expect(ordered.at(-1)).toBe("social.colibri.actor.data");
		expect(ordered).toHaveLength(3);
	});

	it("returns an empty list for a repo with nothing of ours", () => {
		expect(orderCollections(["app.bsky.feed.post"])).toEqual([]);
	});

	it("is stable regardless of the order the pds reports", () => {
		const a = orderCollections([
			"social.colibri.reaction",
			"social.colibri.actor.data",
			"social.colibri.message",
		]);
		const b = orderCollections([
			"social.colibri.actor.data",
			"social.colibri.message",
			"social.colibri.reaction",
		]);
		expect(a).toEqual(b);
	});
});
