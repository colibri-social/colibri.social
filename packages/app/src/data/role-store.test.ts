import { describe, expect, it } from "vitest";
import {
	countChange,
	newRolePlacement,
	reorderedPositions,
	stripRole,
	upsertRole,
	viewerFrom,
} from "./role-store";
import type { CommunityView, MemberView, RoleView } from "./types";

const role = (rkey: string, position: number, permissions: string[] = []) =>
	({ rkey, name: rkey, position, permissions, memberCount: 1 }) as RoleView;

describe("role store helpers", () => {
	it("keeps roles sorted by rank when one is added or moved", () => {
		const roles = [role("owner", 3), role("mods", 2), role("crew", 1)];
		expect(
			upsertRole(roles, role("new", 0)).map((entry) => entry.rkey),
		).toEqual(["owner", "mods", "crew", "new"]);
		expect(
			upsertRole(roles, role("crew", 2.5)).map((entry) => entry.rkey),
		).toEqual(["owner", "crew", "mods"]);
	});

	it("hands out positions below the protected role", () => {
		expect(reorderedPositions([role("a", 1), role("b", 2)], 5)).toEqual([2, 1]);
		expect(
			reorderedPositions([role("a", 1), role("b", 2), role("c", 3)], 3),
		).toEqual([2, 1, 0]);
	});

	it("keeps reordered roles above the Members role", () => {
		expect(reorderedPositions([role("a", 1), role("b", 2)], 1000, -3)).toEqual([
			-2, -3,
		]);
	});

	it("places a new role below every other role and above Members", () => {
		const members = { ...role("members", 0), default: true } as RoleView;
		const owner = { ...role("owner", 1000), protected: true } as RoleView;
		expect(newRolePlacement([owner, members])).toEqual({ position: 1 });
		expect(
			newRolePlacement([owner, role("mods", 5), role("crew", 3), members]),
		).toEqual({ position: 2 });
		expect(
			newRolePlacement([owner, role("mods", 2), role("crew", 1), members]),
		).toEqual({ position: 0, membersPosition: -1 });
		expect(newRolePlacement([owner, role("crew", -2), members])).toEqual({
			position: -3,
			membersPosition: -4,
		});
		expect(newRolePlacement([owner, role("crew", 2)])).toEqual({
			position: 1,
		});
	});

	it("recomputes the viewer's permissions from the roles they hold", () => {
		const view = {
			did: "did:plc:x",
			viewer: { isOwner: false, roles: ["mods", "gone"], permissions: [] },
		} as unknown as CommunityView;
		const next = viewerFrom(view, [
			role("mods", 2, ["member.kick", "role.manage"]),
			role("crew", 1, ["thread.create"]),
		]);
		expect(next.viewer.roles).toEqual(["mods"]);
		expect(next.viewer.permissions).toEqual(["member.kick", "role.manage"]);
		expect(
			viewerFrom(view, [role("crew", 1, ["thread.create"])], ["crew"]).viewer
				.permissions,
		).toEqual(["thread.create"]);
	});

	it("adjusts member counts and strips deleted roles", () => {
		const counted = countChange([role("a", 2), role("b", 1)], ["a"], ["b"]);
		expect(counted.map((entry) => entry.memberCount)).toEqual([0, 2]);
		const members = [{ roles: ["a", "b"] }, { roles: ["b"] }] as MemberView[];
		expect(stripRole(members, "a").map((member) => member.roles)).toEqual([
			["b"],
			["b"],
		]);
	});
});
