import { beforeEach, describe, expect, it } from "vitest";
import {
	forgetCommunity,
	recallCommunity,
	rememberCommunity,
} from "./community-memory";
import { communityKey, namespace } from "./keys";
import type { CommunitySnapshot } from "./schema";

const payload = (did: string): CommunitySnapshot =>
	({
		community: {
			did,
			handle: `${did}.example`,
			name: did,
			managingApp: "did:web:appview.test",
			requiresApprovalToJoin: false,
			linkEmbeds: true,
			viewer: { isMember: false },
		},
		categories: [],
		channels: [],
		roles: [],
		members: [],
		ts: 0,
	}) as unknown as CommunitySnapshot;

const didFor = (name: string) => `did:plc:${name}`;

const ALICE = namespace("did:web:appview.test", "did:plc:alice");
const BOB = namespace("did:web:appview.test", "did:plc:bob");

const keyFor = (ns: string, name: string) => communityKey(ns, didFor(name));

const forgetAll = () => {
	for (const ns of [ALICE, BOB]) {
		for (const name of ["a", "b", "c", "d", "e", "f", "g"]) {
			forgetCommunity(keyFor(ns, name));
		}
	}
};

describe("community memory cache", () => {
	beforeEach(forgetAll);

	it("hands back exactly what was remembered", () => {
		const a = payload(didFor("a"));
		rememberCommunity(keyFor(ALICE, "a"), a);

		expect(recallCommunity(keyFor(ALICE, "a"))).toBe(a);
	});

	it("misses on a key that was never written", () => {
		expect(recallCommunity(keyFor(ALICE, "a"))).toBeUndefined();
	});

	it("keeps namespaces apart so switching account does not leak", () => {
		const mine = payload(didFor("a"));
		rememberCommunity(keyFor(ALICE, "a"), mine);

		expect(recallCommunity(keyFor(BOB, "a"))).toBeUndefined();
		expect(recallCommunity(keyFor(ALICE, "a"))).toBe(mine);
	});

	it("drops the oldest entry once it is over the bound", () => {
		for (const name of ["a", "b", "c", "d", "e"]) {
			rememberCommunity(keyFor(ALICE, name), payload(didFor(name)));
		}
		rememberCommunity(keyFor(ALICE, "f"), payload(didFor("f")));

		expect(recallCommunity(keyFor(ALICE, "a"))).toBeUndefined();
		expect(recallCommunity(keyFor(ALICE, "f"))).toBeDefined();
		expect(recallCommunity(keyFor(ALICE, "e"))).toBeDefined();
	});

	it("counts a recall as a use, so the bound evicts the least recent", () => {
		for (const name of ["a", "b", "c", "d", "e"]) {
			rememberCommunity(keyFor(ALICE, name), payload(didFor(name)));
		}

		recallCommunity(keyFor(ALICE, "a"));
		rememberCommunity(keyFor(ALICE, "f"), payload(didFor("f")));

		expect(recallCommunity(keyFor(ALICE, "a"))).toBeDefined();
		expect(recallCommunity(keyFor(ALICE, "b"))).toBeUndefined();
	});

	it("overwrites rather than duplicating a key", () => {
		const first = payload(didFor("a"));
		const second = payload(didFor("a"));
		rememberCommunity(keyFor(ALICE, "a"), first);
		rememberCommunity(keyFor(ALICE, "a"), second);

		expect(recallCommunity(keyFor(ALICE, "a"))).toBe(second);
	});

	it("forgets a single entry without touching the others", () => {
		rememberCommunity(keyFor(ALICE, "a"), payload(didFor("a")));
		rememberCommunity(keyFor(ALICE, "b"), payload(didFor("b")));

		forgetCommunity(keyFor(ALICE, "a"));

		expect(recallCommunity(keyFor(ALICE, "a"))).toBeUndefined();
		expect(recallCommunity(keyFor(ALICE, "b"))).toBeDefined();
	});
});
