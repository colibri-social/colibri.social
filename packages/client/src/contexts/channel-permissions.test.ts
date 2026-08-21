import { describe, expect, it } from "vitest";
import {
	canSendMessagesInChannel,
	isChannelRestricted,
} from "./channel-permissions";

const OWNER = "did:plc:owner";
const MEMBER = "did:plc:member";
const ROLE_A = "at://did:plc:owner/social.colibri.role/a";
const ROLE_B = "at://did:plc:owner/social.colibri.role/b";

describe("isChannelRestricted", () => {
	it("treats a plain channel as open", () => {
		expect(isChannelRestricted(undefined)).toBe(false);
		expect(isChannelRestricted({})).toBe(false);
		expect(isChannelRestricted({ allowedRoles: [], allowedMembers: [] })).toBe(
			false,
		);
	});

	it("detects each kind of restriction", () => {
		expect(isChannelRestricted({ ownerOnly: true })).toBe(true);
		expect(isChannelRestricted({ allowedRoles: [ROLE_A] })).toBe(true);
		expect(isChannelRestricted({ allowedMembers: [MEMBER] })).toBe(true);
	});
});

describe("canSendMessagesInChannel", () => {
	it("refuses non-members even in an open channel", () => {
		expect(
			canSendMessagesInChannel({
				channel: {},
				memberRoles: undefined,
				isCommunityOwner: false,
				userDid: MEMBER,
			}),
		).toBe(false);
	});

	it("allows any member in an unrestricted channel", () => {
		expect(
			canSendMessagesInChannel({
				channel: {},
				memberRoles: [],
				isCommunityOwner: false,
				userDid: MEMBER,
			}),
		).toBe(true);
	});

	it("allows the community owner in an owner-only channel", () => {
		expect(
			canSendMessagesInChannel({
				channel: { ownerOnly: true },
				memberRoles: [],
				isCommunityOwner: true,
				userDid: OWNER,
			}),
		).toBe(true);
	});

	it("refuses everyone else in an owner-only channel", () => {
		expect(
			canSendMessagesInChannel({
				channel: { ownerOnly: true },
				memberRoles: [ROLE_A],
				isCommunityOwner: false,
				userDid: MEMBER,
			}),
		).toBe(false);
	});

	it("allows an explicitly allow-listed member", () => {
		expect(
			canSendMessagesInChannel({
				channel: { allowedMembers: [MEMBER] },
				memberRoles: [],
				isCommunityOwner: false,
				userDid: MEMBER,
			}),
		).toBe(true);
	});

	it("allows a member holding one of the allowed roles", () => {
		expect(
			canSendMessagesInChannel({
				channel: { allowedRoles: [ROLE_A, ROLE_B] },
				memberRoles: [ROLE_B],
				isCommunityOwner: false,
				userDid: MEMBER,
			}),
		).toBe(true);
	});

	it("refuses a member whose roles do not match", () => {
		expect(
			canSendMessagesInChannel({
				channel: { allowedRoles: [ROLE_A] },
				memberRoles: [ROLE_B],
				isCommunityOwner: false,
				userDid: MEMBER,
			}),
		).toBe(false);
	});

	it("refuses a member who is neither allow-listed nor holds a role", () => {
		expect(
			canSendMessagesInChannel({
				channel: { allowedMembers: [OWNER], allowedRoles: [ROLE_A] },
				memberRoles: [ROLE_B],
				isCommunityOwner: false,
				userDid: MEMBER,
			}),
		).toBe(false);
	});
});
