import { afterEach, describe, expect, it, vi } from "vitest";
import type { CommunitySnapshot } from "./schema";

const deleteCommunity = vi.fn(() => Promise.resolve());
const cacheEnabled = vi.fn(() => true);

vi.mock("./store", () => ({
	get cacheEnabled() {
		return cacheEnabled;
	},
	get deleteCommunity() {
		return deleteCommunity;
	},
}));

const { evictCommunity } = await import("./community-evict");
const { recallCommunity, rememberCommunity } = await import(
	"./community-memory"
);
const { communityKey, namespace } = await import("./keys");

const NS = namespace("did:web:appview.test", "did:plc:alice");
const COMMUNITY_DID = "did:plc:a";

const payload = () =>
	({
		community: { did: COMMUNITY_DID, handle: "a.example", name: "a" },
		categories: [],
		channels: [],
		roles: [],
		members: [],
		ts: 0,
	}) as unknown as CommunitySnapshot;

afterEach(() => {
	deleteCommunity.mockClear();
	cacheEnabled.mockReturnValue(true);
});

describe("evictCommunity", () => {
	it("drops the in-memory copy", () => {
		rememberCommunity(communityKey(NS, COMMUNITY_DID), payload());

		evictCommunity(NS, COMMUNITY_DID);

		expect(recallCommunity(communityKey(NS, COMMUNITY_DID))).toBeUndefined();
	});

	it("drops the stored copy so a rejoin cannot rehydrate it", () => {
		evictCommunity(NS, COMMUNITY_DID);

		expect(deleteCommunity).toHaveBeenCalledWith(NS, COMMUNITY_DID);
	});

	it("still clears memory where there is no store to talk to", () => {
		cacheEnabled.mockReturnValue(false);
		rememberCommunity(communityKey(NS, COMMUNITY_DID), payload());

		evictCommunity(NS, COMMUNITY_DID);

		expect(recallCommunity(communityKey(NS, COMMUNITY_DID))).toBeUndefined();
		expect(deleteCommunity).not.toHaveBeenCalled();
	});

	it("leaves other communities alone", () => {
		const other = "did:plc:b";
		rememberCommunity(communityKey(NS, other), payload());

		evictCommunity(NS, COMMUNITY_DID);

		expect(recallCommunity(communityKey(NS, other))).toBeDefined();
	});
});
