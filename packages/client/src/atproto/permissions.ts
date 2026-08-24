import type { RoleView } from "./views";

export const COMMUNITY_MANAGE = "community.manage";
export const COMMUNITY_DELETE = "community.delete";
export const APPROVAL_MANAGE = "approval.manage";
export const CATEGORY_CREATE = "category.create";
export const CATEGORY_UPDATE = "category.update";
export const CATEGORY_DELETE = "category.delete";
export const CHANNEL_CREATE = "channel.create";
export const CHANNEL_UPDATE = "channel.update";
export const CHANNEL_DELETE = "channel.delete";
export const MEMBER_KICK = "member.kick";
export const MEMBER_BAN = "member.ban";
export const MEMBER_UNBAN = "member.unban";
export const ROLE_MANAGE = "role.manage";
export const LABEL_APPLY = "label.apply";
export const MODERATION_VIEW_LOG = "moderation.viewLog";
export const INVITATION_CREATE = "invitation.create";
export const INVITATION_DELETE = "invitation.delete";
export const VOICE_MODERATE = "voice.moderate";
export const MENTION_ROLES = "mention.roles";

export type PermissionDescriptor = {
	key: string;
	name: string;
	description: string;
};

export const PERMISSIONS: Record<string, Array<PermissionDescriptor>> = {
	Community: [
		{
			key: COMMUNITY_MANAGE,
			name: "Manage Community",
			description:
				"Edit the community's name, description, icon, and join settings",
		},
		{
			key: COMMUNITY_DELETE,
			name: "Delete Community",
			description: "Delete the community entirely",
		},
	],
	Approvals: [
		{
			key: APPROVAL_MANAGE,
			name: "Manage Approvals",
			description: "Approve or reject pending membership requests",
		},
	],
	Categories: [
		{
			key: CATEGORY_CREATE,
			name: "Create Categories",
			description: "Create new categories",
		},
		{
			key: CATEGORY_UPDATE,
			name: "Update Categories",
			description: "Rename or reorder categories",
		},
		{
			key: CATEGORY_DELETE,
			name: "Delete Categories",
			description: "Delete categories",
		},
	],
	Channels: [
		{
			key: CHANNEL_CREATE,
			name: "Create Channels",
			description: "Create new channels",
		},
		{
			key: CHANNEL_UPDATE,
			name: "Update Channels",
			description: "Rename or modify channels",
		},
		{
			key: CHANNEL_DELETE,
			name: "Delete Channels",
			description: "Delete channels",
		},
	],
	Members: [
		{
			key: MEMBER_KICK,
			name: "Kick Members",
			description: "Remove members from the community",
		},
		{
			key: MEMBER_BAN,
			name: "Ban Members",
			description: "Ban members from the community",
		},
		{
			key: MEMBER_UNBAN,
			name: "Unban Members",
			description: "Lift bans on previously banned members",
		},
	],
	Roles: [
		{
			key: ROLE_MANAGE,
			name: "Manage Roles",
			description:
				"Create, edit, and assign roles to members. Can only manage roles below their highest role with this permission.",
		},
	],
	Moderation: [
		{
			key: LABEL_APPLY,
			name: "Apply Labels",
			description:
				"Apply and negate moderation labels on messages and other content",
		},
		{
			key: MODERATION_VIEW_LOG,
			name: "View Moderation Log",
			description: "See the community's history of kicks, bans, and unbans",
		},
	],
	Invitations: [
		{
			key: INVITATION_CREATE,
			name: "Create Invitations",
			description: "Generate invitation links",
		},
		{
			key: INVITATION_DELETE,
			name: "Delete Invitations",
			description: "Revoke existing invitation links",
		},
	],
	Voice: [
		{
			key: VOICE_MODERATE,
			name: "Moderate Voice",
			description:
				"Server-mute, server-deafen, and disconnect members in voice channels",
		},
	],
	Mentions: [
		{
			key: MENTION_ROLES,
			name: "Mention All Roles",
			description: "Ping roles that aren't marked as mentionable.",
		},
	],
};

export const grantsPermission = (
	roles: Array<RoleView>,
	memberRoleKeys: Array<string>,
	permission: string,
): boolean =>
	memberRoleKeys.some((rkey) =>
		roles.some(
			(role) => role.rkey === rkey && role.permissions.includes(permission),
		),
	);

export const getPermissionCeiling = (
	roles: Array<RoleView>,
	memberRoleKeys: Array<string>,
	permission: string,
	isOwner: boolean,
): number => {
	if (isOwner) return Number.POSITIVE_INFINITY;
	return memberRoleKeys.reduce((max, rkey) => {
		const role = roles.find((r) => r.rkey === rkey);
		if (role?.permissions.includes(permission) && role.position > max) {
			return role.position;
		}
		return max;
	}, Number.NEGATIVE_INFINITY);
};

export const isRoleBelowCeiling = (ceiling: number, role: RoleView): boolean =>
	role.position < ceiling;
