import { beforeEach, describe, expect, it } from "vitest";
import { messagesKey, namespace } from "./keys";
import {
	clearMessagesMemory,
	forgetMessages,
	recallMessages,
	rememberMessages,
} from "./messages-memory";
import type { MessagesSnapshot } from "./schema";

const spaceFor = (name: string) =>
	`at://did:plc:community/space/social.colibri.beta.channel.text/${name}`;

const snapshot = (space: string, ts = 0): MessagesSnapshot => ({
	space,
	messages: [],
	hasMore: false,
	ts,
});

const ALICE = namespace("did:web:appview.test", "did:plc:alice");
const BOB = namespace("did:web:appview.test", "did:plc:bob");

const keyFor = (ns: string, name: string) => messagesKey(ns, spaceFor(name));

const NAMES = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];

describe("messages memory cache", () => {
	beforeEach(clearMessagesMemory);

	it("hands back exactly what was remembered", () => {
		const snap = snapshot(spaceFor("a"));
		rememberMessages(keyFor(ALICE, "a"), snap);

		expect(recallMessages(keyFor(ALICE, "a"))).toBe(snap);
	});

	it("misses on a key that was never written", () => {
		expect(recallMessages(keyFor(ALICE, "a"))).toBeUndefined();
	});

	it("keeps namespaces apart so switching account does not leak", () => {
		const mine = snapshot(spaceFor("a"));
		rememberMessages(keyFor(ALICE, "a"), mine);

		expect(recallMessages(keyFor(BOB, "a"))).toBeUndefined();
		expect(recallMessages(keyFor(ALICE, "a"))).toBe(mine);
	});

	it("drops the oldest entry once it is over the bound", () => {
		for (const name of NAMES.slice(0, 8)) {
			rememberMessages(keyFor(ALICE, name), snapshot(spaceFor(name)));
		}
		rememberMessages(keyFor(ALICE, "i"), snapshot(spaceFor("i")));

		expect(recallMessages(keyFor(ALICE, "a"))).toBeUndefined();
		expect(recallMessages(keyFor(ALICE, "i"))).toBeDefined();
		expect(recallMessages(keyFor(ALICE, "h"))).toBeDefined();
	});

	it("counts a recall as a use, so the bound evicts the least recent", () => {
		for (const name of NAMES.slice(0, 8)) {
			rememberMessages(keyFor(ALICE, name), snapshot(spaceFor(name)));
		}

		recallMessages(keyFor(ALICE, "a"));
		rememberMessages(keyFor(ALICE, "i"), snapshot(spaceFor("i")));

		expect(recallMessages(keyFor(ALICE, "a"))).toBeDefined();
		expect(recallMessages(keyFor(ALICE, "b"))).toBeUndefined();
	});

	it("overwrites rather than duplicating a key", () => {
		const first = snapshot(spaceFor("a"), 1);
		const second = snapshot(spaceFor("a"), 2);
		rememberMessages(keyFor(ALICE, "a"), first);
		rememberMessages(keyFor(ALICE, "a"), second);

		expect(recallMessages(keyFor(ALICE, "a"))).toBe(second);
	});

	it("forgets a single entry without touching the others", () => {
		rememberMessages(keyFor(ALICE, "a"), snapshot(spaceFor("a")));
		rememberMessages(keyFor(ALICE, "b"), snapshot(spaceFor("b")));

		forgetMessages(keyFor(ALICE, "a"));

		expect(recallMessages(keyFor(ALICE, "a"))).toBeUndefined();
		expect(recallMessages(keyFor(ALICE, "b"))).toBeDefined();
	});
});
