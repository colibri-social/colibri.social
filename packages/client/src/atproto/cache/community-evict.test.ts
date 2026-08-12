import { afterEach, describe, expect, it, vi } from "vitest";
import type { Community as CommunityResponse } from "../xrpc/social/colibri/community/getData";

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
const URI = "at://did:plc:a/social.colibri.community/self";

const payload = () =>
	({
		community: { uri: URI },
		categories: [],
		channels: [],
		roles: [],
		members: [],
		did: "did:plc:a",
	}) as unknown as CommunityResponse;

afterEach(() => {
	deleteCommunity.mockClear();
	cacheEnabled.mockReturnValue(true);
});

describe("evictCommunity", () => {
	it("drops the in-memory copy", () => {
		rememberCommunity(communityKey(NS, URI), payload());

		evictCommunity(NS, URI);

		expect(recallCommunity(communityKey(NS, URI))).toBeUndefined();
	});

	it("drops the stored copy so a rejoin cannot rehydrate it", () => {
		evictCommunity(NS, URI);

		expect(deleteCommunity).toHaveBeenCalledWith(NS, URI);
	});

	it("still clears memory where there is no store to talk to", () => {
		cacheEnabled.mockReturnValue(false);
		rememberCommunity(communityKey(NS, URI), payload());

		evictCommunity(NS, URI);

		expect(recallCommunity(communityKey(NS, URI))).toBeUndefined();
		expect(deleteCommunity).not.toHaveBeenCalled();
	});

	it("leaves other communities alone", () => {
		const other = "at://did:plc:b/social.colibri.community/self";
		rememberCommunity(communityKey(NS, other), payload());

		evictCommunity(NS, URI);

		expect(recallCommunity(communityKey(NS, other))).toBeDefined();
	});
});
