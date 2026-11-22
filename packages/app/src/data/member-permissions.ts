import type { RoleView } from "./types";

export type MemberPermissionInput = {
	viewerDid: string;
	viewerIsOwner: boolean;
	viewerPermissions: readonly string[];
	viewerRoles: readonly string[];
	targetDid: string;
	targetRoles: readonly string[];
	roles: readonly RoleView[];
	requiresApproval: boolean;
};

export type MemberPermissions = {
	manageableRoles: ReadonlySet<string>;
	canKick: boolean;
	canBan: boolean;
};

export const rankOf = (
	memberRoles: readonly string[],
	roles: readonly RoleView[],
	isOwner = false,
) => {
	if (isOwner) return Number.POSITIVE_INFINITY;
	let rank = Number.NEGATIVE_INFINITY;
	for (const role of roles) {
		if (!memberRoles.includes(role.rkey)) continue;
		if (role.protected) return Number.POSITIVE_INFINITY;
		rank = Math.max(rank, role.position);
	}
	return rank;
};

export const memberPermissions = (
	input: MemberPermissionInput,
): MemberPermissions => {
	const allowed = (permission: string) =>
		input.viewerIsOwner || input.viewerPermissions.includes(permission);
	const viewerRank = rankOf(
		input.viewerRoles,
		input.roles,
		input.viewerIsOwner,
	);
	const targetRank = rankOf(input.targetRoles, input.roles);
	const self = input.viewerDid === input.targetDid;
	const outranks = !self && viewerRank > targetRank;
	const manageableRoles = new Set(
		allowed("role.manage")
			? input.roles
					.filter((role) => !role.protected && role.position < viewerRank)
					.map((role) => role.rkey)
			: [],
	);
	return {
		manageableRoles,
		canKick: outranks && input.requiresApproval && allowed("member.kick"),
		canBan: outranks && allowed("member.ban"),
	};
};

export const canModerateVoice = (input: MemberPermissionInput): boolean => {
	if (input.viewerDid === input.targetDid) return false;
	if (
		!input.viewerIsOwner &&
		!input.viewerPermissions.includes("voice.moderate")
	) {
		return false;
	}
	return (
		rankOf(input.viewerRoles, input.roles, input.viewerIsOwner) >
		rankOf(input.targetRoles, input.roles)
	);
};
