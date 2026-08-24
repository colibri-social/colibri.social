import { describe, expect, it } from "vitest";
import type { RoleView } from "../atproto/views";
import type { Member } from "../contexts/community-payload";
import { canSeeChannel, channelAudience } from "./channel-audience";

const OWNER = "did:plc:owneraaaaaaaaaaaaaaaaaaaa";
const MOD = "did:plc:moderatoraaaaaaaaaaaaaaaa";
const NAMED = "did:plc:namedaaaaaaaaaaaaaaaaaaaa";
const ROLED = "did:plc:roledaaaaaaaaaaaaaaaaaaaa";
const OUTSIDER = "did:plc:outsideraaaaaaaaaaaaaaaa";

const role = (rkey: string, isProtected = false): RoleView =>
	({
		rkey,
		name: rkey,
		permissions: [],
		position: 0,
		hoisted: false,
		mentionable: true,
		protected: isProtected,
		channelOverrides: [],
	}) as unknown as RoleView;

const ROLES = [role("3lkadmin", true), role("3lkbackstage")];

const member = (did: string, roles: string[] = []) =>
	({ did, roles }) as Pick<Member, "did" | "roles">;

const MEMBERS = [
	member(OWNER),
	member(MOD, ["3lkadmin"]),
	member(NAMED),
	member(ROLED, ["3lkbackstage"]),
	member(OUTSIDER),
];

const audienceFor = (visibleToRoles: string[], visibleToMembers: string[]) => ({
	channel: { visibleToRoles, visibleToMembers } as never,
	roles: ROLES,
	ownerDid: OWNER,
});

describe("canSeeChannel", () => {
	it("lets everyone into a channel with no visibility list", () => {
		const open = audienceFor([], []);

		for (const one of MEMBERS) expect(canSeeChannel(one, open)).toBe(true);
	});

	it("keeps a private channel to the roles and members it names", () => {
		const restricted = audienceFor(["3lkbackstage"], [NAMED]);

		expect(canSeeChannel(member(NAMED), restricted)).toBe(true);
		expect(canSeeChannel(member(ROLED, ["3lkbackstage"]), restricted)).toBe(
			true,
		);
		expect(canSeeChannel(member(OUTSIDER), restricted)).toBe(false);
	});

	it("keeps the owner and anyone with a protected role in", () => {
		const restricted = audienceFor(["3lkbackstage"], []);

		expect(canSeeChannel(member(OWNER), restricted)).toBe(true);
		expect(canSeeChannel(member(MOD, ["3lkadmin"]), restricted)).toBe(true);
	});
});

describe("channelAudience", () => {
	it("narrows the roster to the people who can see the channel", () => {
		const listed = channelAudience(MEMBERS, audienceFor([], [NAMED]));

		expect(listed.map((one) => one.did)).toEqual([OWNER, MOD, NAMED]);
	});

	it("leaves an open channel's roster alone", () => {
		expect(channelAudience(MEMBERS, audienceFor([], []))).toHaveLength(
			MEMBERS.length,
		);
	});
});
