import { describe, expect, it } from "vitest";
import type { Community as CommunityResponse } from "../atproto/xrpc/social/colibri/community/getData";
import {
	emptyCommunityPayload,
	isCommunityPayload,
	payloadForUri,
} from "./community-payload";

const payload = (uri: string, memberDids: Array<string>): CommunityResponse =>
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
		members: memberDids.map((did) => ({ did })),
		did: "did:plc:community",
	}) as unknown as CommunityResponse;

const A = payload("at://did:plc:a/social.colibri.community/self", [
	"did:plc:1",
]);
describe("emptyCommunityPayload", () => {
	it("has every collection the context spreads into place", () => {
		const empty = emptyCommunityPayload();

		expect(empty.members).toEqual([]);
		expect(empty.roles).toEqual([]);
		expect(empty.channels).toEqual([]);
		expect(empty.categories).toEqual([]);
		expect(empty.community.uri).toBe("");
		expect(empty.community.categoryOrder).toEqual([]);
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
		} as unknown as CommunityResponse;

		expect(isCommunityPayload(partial)).toBe(false);
	});

	it("rejects a payload without community details", () => {
		const partial = {
			...A,
			community: undefined,
		} as unknown as CommunityResponse;

		expect(isCommunityPayload(partial)).toBe(false);
	});

	it.each([
		"channels",
		"roles",
		"categories",
	])("rejects a cached payload written before %s existed", (field) => {
		const stale = { ...A, [field]: undefined } as unknown as CommunityResponse;

		expect(isCommunityPayload(stale)).toBe(false);
	});

	it("rejects a payload whose roster is not a list", () => {
		const stale = {
			...A,
			members: { "did:plc:1": {} },
		} as unknown as CommunityResponse;

		expect(isCommunityPayload(stale)).toBe(false);
	});

	it("rejects a null community block", () => {
		const stale = { ...A, community: null } as unknown as CommunityResponse;

		expect(isCommunityPayload(stale)).toBe(false);
	});
});

describe("payloadForUri", () => {
	it("hands back the payload when it belongs to the uri", () => {
		expect(payloadForUri(A, A.community.uri)).toBe(A);
	});

	it("rejects a payload from a different community", () => {
		expect(
			payloadForUri(A, "at://did:plc:b/social.colibri.community/self"),
		).toBeUndefined();
	});

	it("rejects an absent payload", () => {
		expect(payloadForUri(undefined, A.community.uri)).toBeUndefined();
	});

	it("rejects every payload while no community is selected", () => {
		expect(payloadForUri(A, "")).toBeUndefined();
		expect(payloadForUri(emptyCommunityPayload(), "")).toBeUndefined();
	});
});
