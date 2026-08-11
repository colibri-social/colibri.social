import { describe, expect, it } from "vitest";
import type { Community as CommunityResponse } from "../atproto/xrpc/social/colibri/community/getData";
import {
	createCommunityPayloadHold,
	emptyCommunityPayload,
	isCommunityPayload,
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
const B = payload("at://did:plc:b/social.colibri.community/self", [
	"did:plc:2",
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

describe("createCommunityPayloadHold", () => {
	it("passes a payload straight through", () => {
		const hold = createCommunityPayloadHold();

		expect(hold(A)).toBe(A);
	});

	it("keeps serving the last payload when the read comes back empty", () => {
		const hold = createCommunityPayloadHold();
		hold(A);

		expect(hold(undefined)).toBe(A);
		expect(hold(undefined).members).toEqual(A.members);
	});

	it("swaps to a newer payload", () => {
		const hold = createCommunityPayloadHold();
		hold(A);

		expect(hold(B)).toBe(B);
		expect(hold(undefined)).toBe(B);
	});

	it("never returns a partial object before anything has arrived", () => {
		const hold = createCommunityPayloadHold();

		expect(hold(undefined).members).toEqual([]);
		expect(hold(undefined).community.uri).toBe("");
	});

	it("refuses to hold a payload that is missing collections", () => {
		const hold = createCommunityPayloadHold();
		hold(A);
		const partial = {
			...B,
			members: undefined,
		} as unknown as CommunityResponse;

		expect(hold(partial)).toBe(A);
	});
});
