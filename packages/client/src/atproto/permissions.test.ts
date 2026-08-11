import { describe, expect, it } from "vitest";
import {
	APPROVAL_MANAGE,
	COMMUNITY_MANAGE,
	getPermissionCeiling,
	grantsPermission,
	isRoleBelowCeiling,
	MESSAGE_HIDE,
	PERMISSIONS,
	ROLE_MANAGE,
} from "./permissions";
import type { Role } from "./xrpc/social/colibri/community/listRoles";

const role = (
	uri: string,
	position: number,
	permissions: Array<string>,
): Role =>
	({
		uri,
		position,
		permissions,
		name: uri,
	}) as Role;

const MOD = role("at://x/role/mod", 10, [ROLE_MANAGE, MESSAGE_HIDE]);
const HELPER = role("at://x/role/helper", 5, [MESSAGE_HIDE]);
const ADMIN = role("at://x/role/admin", 20, [ROLE_MANAGE]);
const ROLES = [MOD, HELPER, ADMIN];

describe("getPermissionCeiling", () => {
	it("gives an owner an unbounded ceiling regardless of roles", () => {
		expect(getPermissionCeiling([], [], ROLE_MANAGE, true)).toBe(
			Number.POSITIVE_INFINITY,
		);
	});

	it("ignores the roles a non-owner holds when they grant nothing", () => {
		expect(getPermissionCeiling(ROLES, [HELPER.uri], ROLE_MANAGE, false)).toBe(
			Number.NEGATIVE_INFINITY,
		);
	});

	it("returns negative infinity when the member holds no roles at all", () => {
		expect(getPermissionCeiling(ROLES, [], ROLE_MANAGE, false)).toBe(
			Number.NEGATIVE_INFINITY,
		);
	});

	it("takes the highest position among roles granting the permission", () => {
		expect(
			getPermissionCeiling(
				ROLES,
				[HELPER.uri, MOD.uri, ADMIN.uri],
				ROLE_MANAGE,
				false,
			),
		).toBe(ADMIN.position);
	});

	it("ignores higher roles that do not grant the permission", () => {
		expect(
			getPermissionCeiling(ROLES, [MOD.uri, ADMIN.uri], MESSAGE_HIDE, false),
		).toBe(MOD.position);
	});

	it("ignores role uris that do not resolve to a known role", () => {
		expect(
			getPermissionCeiling(ROLES, ["at://x/role/ghost"], ROLE_MANAGE, false),
		).toBe(Number.NEGATIVE_INFINITY);
	});

	it("does not leak permissions across different keys", () => {
		expect(
			getPermissionCeiling(ROLES, [ADMIN.uri], COMMUNITY_MANAGE, false),
		).toBe(Number.NEGATIVE_INFINITY);
	});
});

describe("grantsPermission", () => {
	const APPROVER = role("at://x/role/approver", 15, [APPROVAL_MANAGE]);
	const WITH_APPROVER = [...ROLES, APPROVER];

	it("grants when a held role carries the permission", () => {
		expect(
			grantsPermission(
				WITH_APPROVER,
				[HELPER.uri, APPROVER.uri],
				APPROVAL_MANAGE,
			),
		).toBe(true);
	});

	it("refuses when no held role carries the permission", () => {
		expect(
			grantsPermission(WITH_APPROVER, [HELPER.uri, MOD.uri], APPROVAL_MANAGE),
		).toBe(false);
	});

	it("refuses when the member holds no roles", () => {
		expect(grantsPermission(WITH_APPROVER, [], APPROVAL_MANAGE)).toBe(false);
	});

	it("does not grant a permission from a role the member does not hold", () => {
		expect(grantsPermission(WITH_APPROVER, [MOD.uri], APPROVAL_MANAGE)).toBe(
			false,
		);
	});

	it("ignores role uris that do not resolve to a known role", () => {
		expect(
			grantsPermission(WITH_APPROVER, ["at://x/role/ghost"], APPROVAL_MANAGE),
		).toBe(false);
	});

	it("refuses when the role list is empty", () => {
		expect(grantsPermission([], [APPROVER.uri], APPROVAL_MANAGE)).toBe(false);
	});
});

describe("isRoleBelowCeiling", () => {
	it("allows managing a strictly lower role", () => {
		expect(isRoleBelowCeiling(MOD.position, HELPER)).toBe(true);
	});

	it("refuses a role at the same position as the ceiling", () => {
		expect(isRoleBelowCeiling(MOD.position, MOD)).toBe(false);
	});

	it("refuses a role above the ceiling", () => {
		expect(isRoleBelowCeiling(MOD.position, ADMIN)).toBe(false);
	});

	it("lets an owner manage everything", () => {
		expect(isRoleBelowCeiling(Number.POSITIVE_INFINITY, ADMIN)).toBe(true);
	});

	it("lets a member with no granting role manage nothing", () => {
		expect(isRoleBelowCeiling(Number.NEGATIVE_INFINITY, HELPER)).toBe(false);
	});
});

describe("PERMISSIONS catalogue", () => {
	const all = Object.values(PERMISSIONS).flat();

	it("has a unique key for every permission", () => {
		const keys = all.map((p) => p.key);
		expect(new Set(keys).size).toBe(keys.length);
	});

	it("gives every permission a name and description", () => {
		for (const permission of all) {
			expect(permission.name.length).toBeGreaterThan(0);
			expect(permission.description.length).toBeGreaterThan(0);
		}
	});

	it("exposes every exported key through the catalogue", () => {
		const keys = new Set(all.map((p) => p.key));
		expect(keys.has(ROLE_MANAGE)).toBe(true);
		expect(keys.has(MESSAGE_HIDE)).toBe(true);
		expect(keys.has(COMMUNITY_MANAGE)).toBe(true);
	});
});
