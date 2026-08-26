import { describe, expect, it } from "vitest";
import { PERMISSIONS as LEXICON_PERMISSIONS } from "./lexicons";
import {
	APPROVAL_MANAGE,
	COMMUNITY_MANAGE,
	getPermissionCeiling,
	grantsPermission,
	isRoleBelowCeiling,
	LABEL_APPLY,
	nextRolePosition,
	PERMISSIONS,
	ROLE_MANAGE,
	reorderedRolePositions,
} from "./permissions";
import type { RoleView } from "./views";

const role = (
	rkey: string,
	position: number,
	permissions: Array<string>,
): RoleView =>
	({
		rkey,
		position,
		permissions,
		name: rkey,
	}) as RoleView;

const MOD = role("mod", 10, [ROLE_MANAGE, LABEL_APPLY]);
const HELPER = role("helper", 5, [LABEL_APPLY]);
const ADMIN = role("admin", 20, [ROLE_MANAGE]);
const ROLES = [MOD, HELPER, ADMIN];
const OWNER = role("owner", 1000, [ROLE_MANAGE]);

describe("getPermissionCeiling", () => {
	it("gives an owner an unbounded ceiling regardless of roles", () => {
		expect(getPermissionCeiling([], [], ROLE_MANAGE, true)).toBe(
			Number.POSITIVE_INFINITY,
		);
	});

	it("ignores the roles a non-owner holds when they grant nothing", () => {
		expect(getPermissionCeiling(ROLES, [HELPER.rkey], ROLE_MANAGE, false)).toBe(
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
				[HELPER.rkey, MOD.rkey, ADMIN.rkey],
				ROLE_MANAGE,
				false,
			),
		).toBe(ADMIN.position);
	});

	it("ignores higher roles that do not grant the permission", () => {
		expect(
			getPermissionCeiling(ROLES, [MOD.rkey, ADMIN.rkey], LABEL_APPLY, false),
		).toBe(MOD.position);
	});

	it("ignores role keys that do not resolve to a known role", () => {
		expect(getPermissionCeiling(ROLES, ["ghost"], ROLE_MANAGE, false)).toBe(
			Number.NEGATIVE_INFINITY,
		);
	});

	it("does not leak permissions across different keys", () => {
		expect(
			getPermissionCeiling(ROLES, [ADMIN.rkey], COMMUNITY_MANAGE, false),
		).toBe(Number.NEGATIVE_INFINITY);
	});
});

describe("grantsPermission", () => {
	const APPROVER = role("approver", 15, [APPROVAL_MANAGE]);
	const WITH_APPROVER = [...ROLES, APPROVER];

	it("grants when a held role carries the permission", () => {
		expect(
			grantsPermission(
				WITH_APPROVER,
				[HELPER.rkey, APPROVER.rkey],
				APPROVAL_MANAGE,
			),
		).toBe(true);
	});

	it("refuses when no held role carries the permission", () => {
		expect(
			grantsPermission(WITH_APPROVER, [HELPER.rkey, MOD.rkey], APPROVAL_MANAGE),
		).toBe(false);
	});

	it("refuses when the member holds no roles", () => {
		expect(grantsPermission(WITH_APPROVER, [], APPROVAL_MANAGE)).toBe(false);
	});

	it("does not grant a permission from a role the member does not hold", () => {
		expect(grantsPermission(WITH_APPROVER, [MOD.rkey], APPROVAL_MANAGE)).toBe(
			false,
		);
	});

	it("ignores role keys that do not resolve to a known role", () => {
		expect(grantsPermission(WITH_APPROVER, ["ghost"], APPROVAL_MANAGE)).toBe(
			false,
		);
	});

	it("refuses when the role list is empty", () => {
		expect(grantsPermission([], [APPROVER.rkey], APPROVAL_MANAGE)).toBe(false);
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

describe("nextRolePosition", () => {
	it("places the first role just below the owner role", () => {
		expect(nextRolePosition([OWNER])).toBe(999);
	});

	it("places a new role below the lowest existing one", () => {
		expect(nextRolePosition([OWNER, ...ROLES])).toBe(HELPER.position - 1);
	});

	it("goes below zero once the lowest role sits at zero", () => {
		expect(nextRolePosition([OWNER, role("base", 0, [])])).toBe(-1);
	});

	it("falls back to zero with no roles to compare against", () => {
		expect(nextRolePosition([])).toBe(0);
	});

	it("stays below the position of every role the creator could hold", () => {
		const roles = [OWNER, ...ROLES];
		const created = nextRolePosition(roles);
		for (const existing of roles) {
			expect(existing.position).toBeGreaterThan(created);
		}
	});

	it("leaves the created role manageable by the lowest ceiling", () => {
		const roles = [OWNER, role("base", 0, [ROLE_MANAGE])];
		const created = role("new", nextRolePosition(roles), []);
		expect(isRoleBelowCeiling(0, created)).toBe(true);
	});
});

describe("reorderedRolePositions", () => {
	it("numbers roles densely from the top down", () => {
		expect(reorderedRolePositions([ADMIN, MOD, HELPER], 1000)).toEqual([
			3, 2, 1,
		]);
	});

	it("keeps every role below an owner role sitting low", () => {
		expect(reorderedRolePositions([ADMIN, MOD, HELPER], 0)).toEqual([
			-1, -2, -3,
		]);
	});

	it("returns nothing for an empty ordering", () => {
		expect(reorderedRolePositions([], 1000)).toEqual([]);
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
		expect(keys.has(LABEL_APPLY)).toBe(true);
		expect(keys.has(COMMUNITY_MANAGE)).toBe(true);
	});

	it("matches the lexicon's permission vocabulary exactly", () => {
		const keys = new Set(all.map((p) => p.key));
		for (const permission of LEXICON_PERMISSIONS) {
			expect(keys.has(permission)).toBe(true);
		}
		for (const key of keys) {
			expect(LEXICON_PERMISSIONS as ReadonlyArray<string>).toContain(key);
		}
	});
});
