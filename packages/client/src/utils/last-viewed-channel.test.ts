import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	lastViewedChannelPath,
	readLastViewedChannel,
	rememberLastViewedChannel,
} from "./last-viewed-channel";

const createLocalStorage = () => {
	const store = new Map<string, string>();
	return {
		getItem: (key: string) =>
			store.has(key) ? (store.get(key) as string) : null,
		setItem: (key: string, value: string) => {
			store.set(key, value);
		},
		removeItem: (key: string) => {
			store.delete(key);
		},
		clear: () => store.clear(),
	};
};

const DID = "did:plc:abc123";
const TEXT = "social.colibri.beta.channel.text";
const SPACE = `at://${DID}/space/${TEXT}/general`;

const store = (value: unknown) => {
	localStorage.setItem(`${DID}:last-viewed`, JSON.stringify(value));
};

beforeEach(() => {
	vi.stubGlobal("localStorage", createLocalStorage());
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("readLastViewedChannel", () => {
	it("round-trips what the channel context remembers", () => {
		rememberLastViewedChannel(DID, { space: SPACE, type: TEXT });

		expect(readLastViewedChannel(DID)).toEqual({ space: SPACE, type: TEXT });
	});

	it("reads entries that name the space field `space`", () => {
		store({ space: SPACE, type: TEXT });

		expect(readLastViewedChannel(DID)).toEqual({ space: SPACE, type: TEXT });
	});

	it("has nothing to say before a channel is opened", () => {
		expect(readLastViewedChannel(DID)).toBeUndefined();
	});

	it("ignores a malformed entry", () => {
		localStorage.setItem(`${DID}:last-viewed`, "{not json");

		expect(readLastViewedChannel(DID)).toBeUndefined();
	});

	it("ignores an entry without a type", () => {
		store({ uri: SPACE });

		expect(readLastViewedChannel(DID)).toBeUndefined();
	});

	it("keeps communities apart", () => {
		rememberLastViewedChannel(DID, { space: SPACE, type: TEXT });

		expect(readLastViewedChannel("did:plc:other")).toBeUndefined();
	});

	it("survives a storage accessor that throws", () => {
		vi.stubGlobal("localStorage", {
			getItem: () => {
				throw new Error("blocked");
			},
			setItem: () => {
				throw new Error("blocked");
			},
		});

		expect(() =>
			rememberLastViewedChannel(DID, { space: SPACE, type: TEXT }),
		).not.toThrow();
		expect(readLastViewedChannel(DID)).toBeUndefined();
	});
});

describe("lastViewedChannelPath", () => {
	it("builds the channel route from the stored entry", () => {
		rememberLastViewedChannel(DID, { space: SPACE, type: TEXT });

		expect(lastViewedChannelPath(`/app/c/${DID}`)).toBe(
			`/app/c/${DID}/${TEXT}/general`,
		);
	});

	it("ignores paths outside a community", () => {
		rememberLastViewedChannel(DID, { space: SPACE, type: TEXT });

		expect(lastViewedChannelPath("/app")).toBeUndefined();
	});
});

describe("cold start restore", () => {
	const load = async () => {
		vi.resetModules();
		return import("./last-viewed-channel");
	};

	it("restores the last community once per session", async () => {
		const first = await load();
		first.rememberLastViewedChannel(DID, { space: SPACE, type: TEXT });

		const fresh = await load();
		expect(fresh.claimColdStartCommunity(() => true)).toBe(DID);
		expect(fresh.claimColdStartCommunity(() => true)).toBeUndefined();
		expect(fresh.takeColdStartRestore(DID)).toBe(true);
		expect(fresh.takeColdStartRestore(DID)).toBe(false);
	});

	it("skips a community the user is no longer a member of", async () => {
		const first = await load();
		first.rememberLastViewedChannel(DID, { space: SPACE, type: TEXT });

		const fresh = await load();
		expect(fresh.claimColdStartCommunity(() => false)).toBeUndefined();
		expect(fresh.takeColdStartRestore(DID)).toBe(false);
	});

	it("drops the pending restore once another channel opens first", async () => {
		const first = await load();
		first.rememberLastViewedChannel(DID, { space: SPACE, type: TEXT });

		const fresh = await load();
		fresh.claimColdStartCommunity(() => true);
		fresh.rememberLastViewedChannel(DID, { space: SPACE, type: TEXT });
		expect(fresh.takeColdStartRestore(DID)).toBe(false);
	});
});

describe("cancelColdStartRestore", () => {
	it("stops a claimed restore from running", async () => {
		vi.resetModules();
		const first = await import("./last-viewed-channel");
		first.rememberLastViewedChannel(DID, { space: SPACE, type: TEXT });

		vi.resetModules();
		const fresh = await import("./last-viewed-channel");
		fresh.claimColdStartCommunity(() => true);
		fresh.cancelColdStartRestore();
		expect(fresh.isColdStartRestorePending(DID)).toBe(false);
		expect(fresh.takeColdStartRestore(DID)).toBe(false);
	});
});
