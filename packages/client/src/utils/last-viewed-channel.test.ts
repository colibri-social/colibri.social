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
