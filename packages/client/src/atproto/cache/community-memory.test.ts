import { beforeEach, describe, expect, it } from "vitest";
import type { Community as CommunityResponse } from "../xrpc/social/colibri/community/getData";
import {
	forgetCommunity,
	recallCommunity,
	rememberCommunity,
} from "./community-memory";
import { communityKey, namespace } from "./keys";

const payload = (uri: string): CommunityResponse =>
	({
		community: {
			uri,
			name: uri,
			description: "",
			categoryOrder: [],
			requiresApprovalToJoin: false,
			appview: "did:web:appview.test",
		},
		categories: [],
		channels: [],
		roles: [],
		members: [],
		did: "did:plc:community",
	}) as unknown as CommunityResponse;

const uriFor = (name: string) =>
	`at://did:plc:${name}/social.colibri.community/self`;

const ALICE = namespace("did:web:appview.test", "did:plc:alice");
const BOB = namespace("did:web:appview.test", "did:plc:bob");

const keyFor = (ns: string, name: string) => communityKey(ns, uriFor(name));

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
		const a = payload(uriFor("a"));
		rememberCommunity(keyFor(ALICE, "a"), a);

		expect(recallCommunity(keyFor(ALICE, "a"))).toBe(a);
	});

	it("misses on a key that was never written", () => {
		expect(recallCommunity(keyFor(ALICE, "a"))).toBeUndefined();
	});

	it("keeps namespaces apart so switching account does not leak", () => {
		const mine = payload(uriFor("a"));
		rememberCommunity(keyFor(ALICE, "a"), mine);

		expect(recallCommunity(keyFor(BOB, "a"))).toBeUndefined();
		expect(recallCommunity(keyFor(ALICE, "a"))).toBe(mine);
	});

	it("drops the oldest entry once it is over the bound", () => {
		for (const name of ["a", "b", "c", "d", "e"]) {
			rememberCommunity(keyFor(ALICE, name), payload(uriFor(name)));
		}
		rememberCommunity(keyFor(ALICE, "f"), payload(uriFor("f")));

		expect(recallCommunity(keyFor(ALICE, "a"))).toBeUndefined();
		expect(recallCommunity(keyFor(ALICE, "f"))).toBeDefined();
		expect(recallCommunity(keyFor(ALICE, "e"))).toBeDefined();
	});

	it("counts a recall as a use, so the bound evicts the least recent", () => {
		for (const name of ["a", "b", "c", "d", "e"]) {
			rememberCommunity(keyFor(ALICE, name), payload(uriFor(name)));
		}

		recallCommunity(keyFor(ALICE, "a"));
		rememberCommunity(keyFor(ALICE, "f"), payload(uriFor("f")));

		expect(recallCommunity(keyFor(ALICE, "a"))).toBeDefined();
		expect(recallCommunity(keyFor(ALICE, "b"))).toBeUndefined();
	});

	it("overwrites rather than duplicating a key", () => {
		const first = payload(uriFor("a"));
		const second = payload(uriFor("a"));
		rememberCommunity(keyFor(ALICE, "a"), first);
		rememberCommunity(keyFor(ALICE, "a"), second);

		expect(recallCommunity(keyFor(ALICE, "a"))).toBe(second);
	});

	it("forgets a single entry without touching the others", () => {
		rememberCommunity(keyFor(ALICE, "a"), payload(uriFor("a")));
		rememberCommunity(keyFor(ALICE, "b"), payload(uriFor("b")));

		forgetCommunity(keyFor(ALICE, "a"));

		expect(recallCommunity(keyFor(ALICE, "a"))).toBeUndefined();
		expect(recallCommunity(keyFor(ALICE, "b"))).toBeDefined();
	});
});
