import { describe, expect, it } from "vitest";
import type { CommunityPayload } from "./community-payload";
import {
	emptyCommunityPayload,
	isCommunityPayload,
	payloadForCommunity,
	sameRoles,
} from "./community-payload";

const payload = (did: string, memberDids: Array<string>): CommunityPayload =>
	({
		community: {
			did,
			handle: `${did}.example.com`,
			name: did,
			description: "",
			requiresApprovalToJoin: false,
			linkEmbeds: true,
			managingApp: "did:web:appview.test",
			viewer: { isMember: true },
		},
		categories: [],
		channels: [],
		roles: [],
		members: memberDids.map((memberDid) => ({ did: memberDid })),
	}) as unknown as CommunityPayload;

const A = payload("did:plc:a", ["did:plc:1"]);

describe("emptyCommunityPayload", () => {
	it("has every collection the context spreads into place", () => {
		const empty = emptyCommunityPayload();

		expect(empty.members).toEqual([]);
		expect(empty.roles).toEqual([]);
		expect(empty.channels).toEqual([]);
		expect(empty.categories).toEqual([]);
		expect(empty.community.did).toBe("");
	});

	it("hands out an independent instance each call", () => {
		const first = emptyCommunityPayload();
		const second = emptyCommunityPayload();

		expect(first).not.toBe(second);
		expect(first.members).not.toBe(second.members);
	});
});

describe("isCommunityPayload", () => {
	it("accepts a full payload", () => {
		expect(isCommunityPayload(A)).toBe(true);
	});

	it("rejects a missing payload", () => {
		expect(isCommunityPayload(undefined)).toBe(false);
	});

	it("rejects a payload without a member roster", () => {
		const partial = {
			...A,
			members: undefined,
		} as unknown as CommunityPayload;

		expect(isCommunityPayload(partial)).toBe(false);
	});

	it("rejects a payload without community details", () => {
		const partial = {
			...A,
			community: undefined,
		} as unknown as CommunityPayload;

		expect(isCommunityPayload(partial)).toBe(false);
	});

	it.each([
		"channels",
		"roles",
		"categories",
	])("rejects a cached payload written before %s existed", (field) => {
		const stale = { ...A, [field]: undefined } as unknown as CommunityPayload;

		expect(isCommunityPayload(stale)).toBe(false);
	});

	it("rejects a payload whose roster is not a list", () => {
		const stale = {
			...A,
			members: { "did:plc:1": {} },
		} as unknown as CommunityPayload;

		expect(isCommunityPayload(stale)).toBe(false);
	});

	it("rejects a null community block", () => {
		const stale = { ...A, community: null } as unknown as CommunityPayload;

		expect(isCommunityPayload(stale)).toBe(false);
	});
});

describe("payloadForCommunity", () => {
	it("hands back the payload when it belongs to the community", () => {
		expect(payloadForCommunity(A, A.community.did)).toBe(A);
	});

	it("rejects a payload from a different community", () => {
		expect(payloadForCommunity(A, "did:plc:b")).toBeUndefined();
	});

	it("rejects an absent payload", () => {
		expect(payloadForCommunity(undefined, A.community.did)).toBeUndefined();
	});

	it("rejects every payload while no community is selected", () => {
		expect(payloadForCommunity(A, "")).toBeUndefined();
		expect(payloadForCommunity(emptyCommunityPayload(), "")).toBeUndefined();
	});
});

describe("sameRoles", () => {
	it("ignores the order roles arrive in", () => {
		expect(sameRoles(["3lka", "3lkb"], ["3lkb", "3lka"])).toBe(true);
	});

	it("spots a granted role", () => {
		expect(sameRoles(["3lka"], ["3lka", "3lkb"])).toBe(false);
	});

	it("spots a revoked role", () => {
		expect(sameRoles(["3lka", "3lkb"], ["3lka"])).toBe(false);
	});

	it("spots a swapped role of the same count", () => {
		expect(sameRoles(["3lka"], ["3lkb"])).toBe(false);
	});

	it("treats an unknown previous member as a change", () => {
		expect(sameRoles(undefined, [])).toBe(false);
		expect(sameRoles(undefined, undefined)).toBe(true);
	});
});
