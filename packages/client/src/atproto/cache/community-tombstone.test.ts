import { describe, expect, it } from "vitest";
import {
	clearCommunityDeleting,
	isCommunityGone,
	isCommunityInert,
	markCommunityDeleting,
	tombstoneCommunity,
} from "./community-tombstone";
import { communityKey, namespace } from "./keys";

const NS = namespace("did:web:appview.test", "did:plc:alice");

const key = (did: string) => communityKey(NS, did);

describe("community tombstones", () => {
	it("says nothing about a community it has never heard of", () => {
		expect(isCommunityInert(key("did:plc:unknown"))).toBe(false);
		expect(isCommunityGone(key("did:plc:unknown"))).toBe(false);
	});

	it("holds off on a community that is being deleted without writing it off", () => {
		const target = key("did:plc:deleting");

		markCommunityDeleting(target);

		expect(isCommunityInert(target)).toBe(true);
		expect(isCommunityGone(target)).toBe(false);
	});

	it("brings a community back when the delete fails", () => {
		const target = key("did:plc:failed");

		markCommunityDeleting(target);
		clearCommunityDeleting(target);

		expect(isCommunityInert(target)).toBe(false);
		expect(isCommunityGone(target)).toBe(false);
	});

	it("writes off a community for good once it is deleted", () => {
		const target = key("did:plc:deleted");

		tombstoneCommunity(target);

		expect(isCommunityInert(target)).toBe(true);
		expect(isCommunityGone(target)).toBe(true);
	});

	it("takes over from the pending mark when the delete lands", () => {
		const target = key("did:plc:landed");

		markCommunityDeleting(target);
		tombstoneCommunity(target);
		clearCommunityDeleting(target);

		expect(isCommunityGone(target)).toBe(true);
		expect(isCommunityInert(target)).toBe(true);
	});

	it("leaves the community next to it alone", () => {
		const target = key("did:plc:target");
		const neighbour = key("did:plc:neighbour");

		markCommunityDeleting(target);
		tombstoneCommunity(target);

		expect(isCommunityInert(neighbour)).toBe(false);
		expect(isCommunityGone(neighbour)).toBe(false);
	});

	it("keeps a community written off across another account's namespace", () => {
		const other = namespace("did:web:appview.test", "did:plc:bob");
		const mine = key("did:plc:shared");

		tombstoneCommunity(mine);

		expect(isCommunityGone(communityKey(other, "did:plc:shared"))).toBe(false);
	});
});
