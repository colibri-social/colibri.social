import { describe, expect, it } from "vitest";
import {
	communityResolveState,
	isCommunityResolving,
} from "./community-resolve";

const DID = "did:plc:community";
const OTHER = "did:plc:other";

describe("isCommunityResolving", () => {
	it("is never resolving without a community to resolve", () => {
		expect(isCommunityResolving("", true, undefined)).toBe(false);
		expect(isCommunityResolving("", false, DID)).toBe(false);
	});

	it("is resolving while the first load is in flight", () => {
		expect(isCommunityResolving(DID, true, undefined)).toBe(true);
	});

	it("is resolving while a refresh of the settled community is in flight", () => {
		expect(isCommunityResolving(DID, true, DID)).toBe(true);
	});

	it("is resolving when the settled community is not the one in the URL", () => {
		expect(isCommunityResolving(DID, false, OTHER)).toBe(true);
	});

	it("is resolving before anything has settled", () => {
		expect(isCommunityResolving(DID, false, undefined)).toBe(true);
	});

	it("is done once the community in the URL has settled", () => {
		expect(isCommunityResolving(DID, false, DID)).toBe(false);
	});
});

describe("communityResolveState", () => {
	it("is idle when nothing is resolving, whatever the stall flag says", () => {
		expect(communityResolveState(false, false)).toBe("idle");
		expect(communityResolveState(false, true)).toBe("idle");
	});

	it("is resolving while the load is still within its budget", () => {
		expect(communityResolveState(true, false)).toBe("resolving");
	});

	it("is stalled once the load has run out of patience", () => {
		expect(communityResolveState(true, true)).toBe("stalled");
	});
});
