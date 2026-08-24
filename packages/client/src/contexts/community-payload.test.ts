import { describe, expect, it } from "vitest";
import type { CommunityPayload, Member } from "./community-payload";
import {
	emptyCommunityPayload,
	isCommunityPayload,
	patchMemberData,
	payloadForCommunity,
	sameRoles,
	withMemberPresence,
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

const member = (): Member =>
	({
		did: "did:plc:member",
		handle: "member.example.com",
		roles: [],
		joinedAt: "2026-08-24T00:00:00.000Z",
		actor: {
			did: "did:plc:member",
			handle: "member.example.com",
			displayName: "Member",
			presence: { onlineState: "online", voice: { channel: "at://vc" } },
		},
		data: { displayName: "Member", onlineState: "online" },
	}) as unknown as Member;

describe("withMemberPresence", () => {
	it("moves the roster bucket and the avatar dot together", () => {
		const next = withMemberPresence(member(), { onlineState: "offline" });

		expect(next.data.onlineState).toBe("offline");
		expect(next.actor.presence?.onlineState).toBe("offline");
	});

	it("coerces an unknown state to offline on both sides", () => {
		const next = withMemberPresence(member(), {
			onlineState: "hibernating",
		} as never);

		expect(next.data.onlineState).toBe("offline");
	});

	it("keeps the voice state the event carries", () => {
		const next = withMemberPresence(member(), {
			onlineState: "away",
			voice: { channel: "at://vc-b" },
		} as never);

		expect(next.actor.presence?.voice?.channel).toBe("at://vc-b");
	});
});

describe("patchMemberData", () => {
	it("mirrors an optimistic state change onto the actor", () => {
		const next = patchMemberData(member(), { onlineState: "dnd" });

		expect(next.data.onlineState).toBe("dnd");
		expect(next.actor.presence?.onlineState).toBe("dnd");
	});

	it("leaves the voice state alone", () => {
		const next = patchMemberData(member(), { onlineState: "dnd" });

		expect(next.actor.presence?.voice?.channel).toBe("at://vc");
	});

	it("leaves presence untouched for an unrelated patch", () => {
		const next = patchMemberData(member(), { displayName: "Renamed" });

		expect(next.data.displayName).toBe("Renamed");
		expect(next.actor.presence?.onlineState).toBe("online");
	});
});
