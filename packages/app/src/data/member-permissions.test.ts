import { describe, expect, it } from "vitest";
import { memberPermissions, rankOf } from "./member-permissions";
import type { RoleView } from "./types";

const role = (rkey: string, position: number, extra: Partial<RoleView> = {}) =>
	({ rkey, name: rkey, position, ...extra }) as RoleView;

const roles = [
	role("owner", 100, { protected: true }),
	role("admin", 50),
	role("mod", 30),
	role("member", 10),
];

const base = {
	viewerDid: "did:plc:viewer",
	viewerIsOwner: false,
	viewerPermissions: ["role.manage", "member.kick", "member.ban"],
	viewerRoles: ["mod"],
	targetDid: "did:plc:target",
	targetRoles: ["member"],
	roles,
	requiresApproval: true,
};

describe("member permissions", () => {
	it("ranks the protected role above every other role", () => {
		expect(rankOf(["owner"], roles)).toBe(Number.POSITIVE_INFINITY);
		expect(rankOf(["mod", "member"], roles)).toBe(30);
		expect(rankOf([], roles)).toBe(Number.NEGATIVE_INFINITY);
	});

	it("lets a moderator act on members below them", () => {
		const result = memberPermissions(base);
		expect(result.canKick).toBe(true);
		expect(result.canBan).toBe(true);
		expect([...result.manageableRoles]).toEqual(["member"]);
	});

	it("blocks actions on equal or higher ranks and on the owner", () => {
		expect(memberPermissions({ ...base, targetRoles: ["mod"] }).canBan).toBe(
			false,
		);
		expect(
			memberPermissions({
				...base,
				viewerIsOwner: true,
				targetRoles: ["owner"],
			}).canBan,
		).toBe(false);
	});

	it("never offers kick or ban on yourself", () => {
		const result = memberPermissions({
			...base,
			viewerIsOwner: true,
			targetDid: base.viewerDid,
		});
		expect(result.canKick).toBe(false);
		expect(result.canBan).toBe(false);
		expect(result.manageableRoles.has("admin")).toBe(true);
	});

	it("only offers kick when joining needs approval", () => {
		expect(
			memberPermissions({ ...base, requiresApproval: false }).canKick,
		).toBe(false);
	});

	it("needs the matching permission", () => {
		const result = memberPermissions({ ...base, viewerPermissions: [] });
		expect(result).toEqual({
			manageableRoles: new Set(),
			canKick: false,
			canBan: false,
		});
	});
});
