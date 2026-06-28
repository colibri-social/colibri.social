import type { Member } from "../atproto/xrpc/social/colibri/community/listMembers";
import type { Role } from "../atproto/xrpc/social/colibri/community/listRoles";
import { displayableNameFn } from "../components/app/user/DisplayableName";

export type MembersByRoles = Array<{
	role: Role;
	members: Array<Member>;
}>;

/**
 * Groups members under their highest hoisted role, falling back to
 * "Online"/"Offline" buckets.
 */
export const groupMembersByRoles = (opts: {
	members: Array<Member>;
	assignableRoles: Array<Role>;
	roles: Array<Role>;
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
			uri: "",
		},
		members: [],
	});

	const offlineIdx = result.push({
		role: {
			name: "Offline",
			channelOverrides: [],
			permissions: [],
			position: 0,
			uri: "",
		},
		members: [],
	});

	for (const member of members) {
		const sortedMemberRoles = [...member.roles]
			.sort(
				(a, b) =>
					result.findIndex((y) => y.role.uri === a) -
					result.findIndex((z) => z.role.uri === b),
			)
			.map((x) => roles.find((y) => y.uri === x))
			.filter((x) => x !== undefined);

		const highestMemberRole = sortedMemberRoles.find(
			(x) => x.hoisted && !x.protected,
		);

		let resultIndex = !highestMemberRole
			? -5
			: result.findIndex((x) => x.role.uri === highestMemberRole.uri);

		if (member.data.onlineState === "offline") {
			resultIndex = offlineIdx - 1;
		}

		if (resultIndex < 0) {
			resultIndex = noRoleOnlineIdx - 1;
		}

		result[resultIndex].members.push(member);
	}

	for (const entry of result) {
		entry.members = entry.members.sort((a, b) =>
			displayableNameFn(a).localeCompare(displayableNameFn(b)),
		);
	}

	return result.sort((a, b) => b.role.position - a.role.position);
};
