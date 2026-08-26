import { describe, expect, it } from "vitest";
import type { RoleView } from "../atproto/views";
import type { Member } from "../contexts/community-payload";
import { groupMembersByRoles } from "./group-members-by-roles";

const role = (rkey: string, position: number, hoisted: boolean): RoleView =>
	({
		rkey,
		position,
		hoisted,
		name: rkey,
		permissions: [],
		channelOverrides: [],
	}) as unknown as RoleView;

const member = (
	did: string,
	roles: Array<string>,
	onlineState: string,
): Member =>
	({
		did,
		roles,
		data: { displayName: did, onlineState },
	}) as unknown as Member;

describe("groupMembersByRoles", () => {
	it("keeps a hoisted role at a negative position above Online and Offline", () => {
		const fresh = role("fresh", -1, true);
		const result = groupMembersByRoles({
			members: [
				member("did:a", [fresh.rkey], "online"),
				member("did:b", [], "online"),
				member("did:c", [], "offline"),
			],
			assignableRoles: [fresh],
			roles: [fresh],
		});

		expect(result.map((entry) => entry.role.name)).toEqual([
			"fresh",
			"Online",
			"Offline",
		]);
		expect(result[0].members.map((m) => m.did)).toEqual(["did:a"]);
		expect(result[1].members.map((m) => m.did)).toEqual(["did:b"]);
		expect(result[2].members.map((m) => m.did)).toEqual(["did:c"]);
	});

	it("orders hoisted roles from the highest position down", () => {
		const top = role("top", 3, true);
		const bottom = role("bottom", -5, true);
		const result = groupMembersByRoles({
			members: [],
			assignableRoles: [bottom, top],
			roles: [bottom, top],
		});

		expect(result.map((entry) => entry.role.name)).toEqual([
			"top",
			"bottom",
			"Online",
			"Offline",
		]);
	});
});
