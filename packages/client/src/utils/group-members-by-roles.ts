import type { Member } from "../atproto/xrpc/social/colibri/community/listMembers";
import type { Role } from "../atproto/xrpc/social/colibri/community/listRoles";
import { displayableNameFn } from "./displayable-name";

export type MembersByRoles = Array<{
	role: Role;
	members: Array<Member>;
}>;

// One collator for the whole app. `String.localeCompare` builds a fresh one on
// every call, and this runs O(n log n) times per regrouping. Left at the default
// options so the ordering matches `localeCompare` exactly.
const collator = new Intl.Collator();

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

	// Index the buckets and the role table up front — these used to be linear
	// scans run from inside a sort comparator, once per member.
	const bucketIndexByRoleUri = new Map<string, number>();
	result.forEach((entry, index) => {
		if (entry.role.uri) bucketIndexByRoleUri.set(entry.role.uri, index);
	});
	const roleByUri = new Map(roles.map((role) => [role.uri, role]));

	for (const member of members) {
		// The highest hoisted role is the one sitting in the earliest bucket, and
		// the buckets are already ordered by descending position.
		let bucket = -1;
		for (const roleUri of member.roles) {
			const role = roleByUri.get(roleUri);
			if (!role?.hoisted || role.protected) continue;
			const index = bucketIndexByRoleUri.get(roleUri);
			if (index === undefined) continue;
			if (bucket === -1 || index < bucket) bucket = index;
		}

		if (member.data.onlineState === "offline") bucket = offlineIdx - 1;
		else if (bucket === -1) bucket = noRoleOnlineIdx - 1;

		result[bucket].members.push(member);
	}

	// Sort on a precomputed key so the display name is derived once per member
	// instead of twice per comparison.
	for (const entry of result) {
		const names = new Map(
			entry.members.map((member) => [member, displayableNameFn(member)]),
		);
		entry.members.sort((a, b) =>
			collator.compare(names.get(a) ?? "", names.get(b) ?? ""),
		);
	}

	return result.sort((a, b) => b.role.position - a.role.position);
};
