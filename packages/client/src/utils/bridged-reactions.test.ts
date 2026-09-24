import { describe, expect, it } from "vitest";
import type { BridgedReactor, ReactionView } from "../atproto/views";
import { foldBridgedReaction } from "./bridged-reactions";

const alice = {
	registration: "3lkbridgeaaaa",
	platform: "chat",
	remoteId: "alice-1",
	name: "Alice",
} as BridgedReactor;
const bob = { ...alice, remoteId: "bob-1", name: "Bob" } as BridgedReactor;

const colibriReaction = {
	emoji: "👍",
	count: 1,
	reactors: ["did:plc:member"],
} as ReactionView;

describe("foldBridgedReaction", () => {
	it("starts a new emoji group for the first bridged reactor", () => {
		expect(foldBridgedReaction([], "🎉", alice, true)).toEqual([
			{ emoji: "🎉", count: 1, reactors: [], bridgedReactors: [alice] },
		]);
	});

	it("adds to an existing group without touching Colibri reactors", () => {
		const [reaction] = foldBridgedReaction(
			[colibriReaction],
			"👍",
			alice,
			true,
		);

		expect(reaction).toMatchObject({
			count: 2,
			reactors: ["did:plc:member"],
			bridgedReactors: [alice],
		});
	});

	it("ignores the same person reacting twice", () => {
		const once = foldBridgedReaction([], "🎉", alice, true);

		expect(foldBridgedReaction(once, "🎉", alice, true)).toEqual(once);
	});

	it("removes one person and drops the group when nobody is left", () => {
		const both = foldBridgedReaction(
			foldBridgedReaction([], "🎉", alice, true),
			"🎉",
			bob,
			true,
		);
		const one = foldBridgedReaction(both, "🎉", alice, false);

		expect(one[0]).toMatchObject({ count: 1, bridgedReactors: [bob] });
		expect(foldBridgedReaction(one, "🎉", bob, false)).toEqual([]);
	});
});
