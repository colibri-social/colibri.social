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
export const MESSAGE_HIDE = "message.hide";
export const INVITATION_CREATE = "invitation.create";
export const INVITATION_DELETE = "invitation.delete";

export type Permission = {
	key: string;
	name: string;
	description: string;
};

export const PERMISSIONS: Record<string, Array<Permission>> = {
	Community: [
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
			description: "Create, edit, and assign roles to members",
		},
	],
	Messages: [
		{
			key: MESSAGE_HIDE,
			name: "Hide Messages",
			description: "Hide messages from other members",
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
};
