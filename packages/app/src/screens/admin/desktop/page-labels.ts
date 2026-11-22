import type { AdminLayer, AdminPage } from "../../../shell/layers";

const LABELS: Record<AdminPage, string> = {
	overview: "Manage Space",
	profile: "Space profile",
	messages: "Messages",
	transfer: "Transfer ownership",
	members: "Members",
	emoji: "Emoji Packs",
	"emoji-pack": "Emoji pack",
	roles: "Roles",
	role: "Role",
	invites: "Invite links",
	invite: "Invite link",
	channel: "Channel settings",
	"channel-permissions": "Permissions",
	"channel-audience": "Audience",
	category: "Category settings",
	"category-permissions": "Permissions",
	"category-audience": "Audience",
	"role-permissions": "Permissions",
	"role-members": "Members",
	bridges: "Bridges",
	bridge: "Bridge",
	"bridge-new": "New Bridge",
	"bridge-connect": "Connect a bridge",
	"bridge-code": "New Bridge",
	hosting: "Hosting",
	"hosting-move": "Move to another server",
};

export const adminPageLabel = (layer: AdminLayer) => LABELS[layer.page];
