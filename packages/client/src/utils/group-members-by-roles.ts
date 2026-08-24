import type { RoleView } from "../atproto/views";
import type { Member } from "../contexts/community-payload";

export type MembersByRoles = Array<{
	role: RoleView;
	members: Array<Member>;
}>;

const collator = new Intl.Collator();

export const groupMembersByRoles = (opts: {
	members: Array<Member>;
	assignableRoles: Array<RoleView>;
	roles: Array<RoleView>;
}): MembersByRoles => {
	const { members, assignableRoles, roles } = opts;

	const result: MembersByRoles = assignableRoles
		.slice()
		.filter((x) => !!x.hoisted)
		.filter((x) => !x.protected)
		.sort((a, b) => b.position - a.position)
		.map((x) => ({ role: x, members: [] }));

	const noRoleOnlineIdx = result.push({
		role: {
			name: "Online",
			channelOverrides: [],
			permissions: [],
			position: 0,
			rkey: "",
		},
		members: [],
	});

	const offlineIdx = result.push({
		role: {
			name: "Offline",
			channelOverrides: [],
			permissions: [],
			position: 0,
			rkey: "",
		},
		members: [],
	});

	const bucketIndexByRoleKey = new Map<string, number>();
	result.forEach((entry, index) => {
		if (entry.role.rkey) bucketIndexByRoleKey.set(entry.role.rkey, index);
	});
	const roleByKey = new Map(roles.map((role) => [role.rkey, role]));

	for (const member of members) {
		let bucket = -1;
		for (const roleKey of member.roles) {
			const role = roleByKey.get(roleKey);
			if (!role?.hoisted || role.protected) continue;
			const index = bucketIndexByRoleKey.get(roleKey);
			if (index === undefined) continue;
			if (bucket === -1 || index < bucket) bucket = index;
		}

		if (member.data.onlineState === "offline") bucket = offlineIdx - 1;
		else if (bucket === -1) bucket = noRoleOnlineIdx - 1;

		result[bucket].members.push(member);
	}

	for (const entry of result) {
		const names = new Map(
			entry.members.map((member) => [member, member.data.displayName]),
		);
		entry.members.sort((a, b) =>
			collator.compare(names.get(a) ?? "", names.get(b) ?? ""),
		);
	}

	return result.sort((a, b) => b.role.position - a.role.position);
};
