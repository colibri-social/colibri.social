import { describe, expect, it } from "vitest";
import {
	canReadChannel,
	effectivePermissions,
	isAdminRoleSet,
	resolveChannelView,
} from "./category-permissions";
import type { ChannelView, CommunityView, Did, RoleView } from "./types";

const VIEWER = "did:plc:viewer" as Did;

const channel = (overrides: Partial<ChannelView> = {}) =>
	({
		space: "at://did:plc:space/space/social.colibri.beta.channel.text/lounge",
		type: "social.colibri.beta.channel.text",
		name: "lounge",
		category: "staff",
		viewer: { canRead: true, canPost: true, permissions: [] },
		...overrides,
	}) as ChannelView;

const community = (roles: string[], isOwner = false) =>
	({ viewer: { isOwner, roles, permissions: [] } }) as unknown as CommunityView;

const roles = [
	{ rkey: "owner", protected: true },
	{ rkey: "staff", protected: false },
] as RoleView[];

describe("category permissions", () => {
	it("inherits the category's read audience when the channel has none", () => {
		expect(
			effectivePermissions({}, { visibleToRoles: ["staff"] }).visibleToRoles,
		).toEqual(["staff"]);
	});

	it("lets the channel's own audience win", () => {
		const effective = effectivePermissions(
			{ visibleToMembers: [VIEWER] },
			{ visibleToRoles: ["staff"] },
		);
		expect(effective.visibleToRoles).toEqual([]);
		expect(effective.visibleToMembers).toEqual([VIEWER]);
	});

	it("inherits posting rules on their own", () => {
		const effective = effectivePermissions(
			{ visibleToRoles: ["staff"] },
			{ ownerOnly: true },
		);
		expect(effective.ownerOnly).toBe(true);
		expect(effective.visibleToRoles).toEqual(["staff"]);
	});

	it("hides a channel in a private category from members outside it", () => {
		const view = resolveChannelView(
			channel(),
			{ visibleToRoles: ["staff"] },
			{ did: VIEWER, community: community([]), roles },
		);
		expect(view.private).toBe(true);
		expect(view.viewer.canRead).toBe(false);
		expect(view.viewer.canPost).toBe(false);
	});

	it("shows it to the category's roles and to owners", () => {
		const category = { visibleToRoles: ["staff"] };
		expect(
			resolveChannelView(channel(), category, {
				did: VIEWER,
				community: community(["staff"]),
				roles,
			}).viewer.canRead,
		).toBe(true);
		expect(
			resolveChannelView(channel(), category, {
				did: VIEWER,
				community: community(["owner"]),
				roles,
			}).viewer.canRead,
		).toBe(true);
	});
});

describe("channel readers", () => {
	const member = (did: string, held: string[] = []) => ({
		did: did as Did,
		roles: held,
		admin: isAdminRoleSet(held, roles),
	});

	it("lets everyone read a public channel", () => {
		expect(canReadChannel(channel(), undefined, member("did:plc:a"))).toBe(
			true,
		);
	});

	it("limits a private channel to its listed roles, members and admins", () => {
		const secret = channel({
			visibleToRoles: ["staff"],
			visibleToMembers: ["did:plc:guest"],
		});
		expect(canReadChannel(secret, undefined, member("did:plc:a"))).toBe(false);
		expect(
			canReadChannel(secret, undefined, member("did:plc:b", ["staff"])),
		).toBe(true);
		expect(canReadChannel(secret, undefined, member("did:plc:guest"))).toBe(
			true,
		);
		expect(
			canReadChannel(secret, undefined, member("did:plc:c", ["owner"])),
		).toBe(true);
	});

	it("applies the category's audience when the channel has none", () => {
		const inherited = channel();
		expect(
			canReadChannel(
				inherited,
				{ visibleToRoles: ["staff"] },
				member("did:plc:a"),
			),
		).toBe(false);
	});

	it("keeps a channel marked private without an audience to admins", () => {
		const locked = channel({ private: true });
		expect(canReadChannel(locked, undefined, member("did:plc:a"))).toBe(false);
		expect(
			canReadChannel(locked, undefined, member("did:plc:c", ["owner"])),
		).toBe(true);
	});
});
