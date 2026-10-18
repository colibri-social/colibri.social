import { storyImages } from "../Banner/story-images";
import type { RoleIdentity } from "../Roles/RoleBadge";
import type { HoistedRole, Member } from "./MemberList";

export const moderatorRole: HoistedRole = {
	id: "mods",
	name: "Moderators",
	color: "#c4a7ff",
	badge: { kind: "icon", name: "shield-check", color: "#76c4e5" },
};

export const artistRole: RoleIdentity = {
	id: "artists",
	name: "Artists",
	color: "#ffd857",
	badge: { kind: "icon", name: "palette" },
};

export const fixtureRoles: HoistedRole[] = [moderatorRole];

export const fixtureMembers = (): Member[] => [
	{
		id: "lou",
		name: "Lou",
		avatarSrc: storyImages.violetIcon(),
		presence: "online",
		status: "Building a nest",
		hoistedRoleId: "mods",
		role: moderatorRole,
		owner: true,
	},
	{
		id: "lis",
		name: "Lis",
		avatarSrc: storyImages.tealIcon(),
		presence: "idle",
		status: "Drawing pixel birds",
		hoistedRoleId: "mods",
		role: moderatorRole,
	},
	{
		id: "tim",
		name: "Tim",
		avatarColor: "#3f6212",
		presence: "dnd",
		hoistedRoleId: "mods",
		role: moderatorRole,
	},
	{
		id: "kris",
		name: "Kris",
		avatarSrc: storyImages.amberIcon(),
		presence: "online",
		status: "Listening to the canal",
		role: artistRole,
	},
	{ id: "mara", name: "Mara", avatarColor: "#9f1239", presence: "online" },
	{
		id: "noor",
		name: "Noor with a very long display name that keeps going",
		avatarColor: "#1e40af",
		presence: "online",
		status: "A status that is long enough to need truncation in the row",
	},
	{
		id: "helper",
		name: "Colibri helper",
		avatarColor: "#404040",
		presence: "online",
		status: "Type /help",
		bot: true,
	},
	{
		id: "archive",
		name: "Archive bot",
		avatarColor: "#404040",
		presence: "online",
		bot: true,
	},
	{
		id: "ola",
		name: "Ola",
		avatarColor: "#525252",
		presence: "offline",
		status: "Out on the water",
	},
	{
		id: "pim",
		name: "Pim",
		avatarColor: "#525252",
		presence: "offline",
		status: "Back on Monday",
		statusShowWhileOffline: true,
	},
];

const MANY_PRESENCES: Member["presence"][] = [
	"online",
	"online",
	"idle",
	"dnd",
	"offline",
	"offline",
	"offline",
];

const MANY_COLORS = ["#7c3aed", "#b45309", "#9f1239", "#0f766e", "#1d4ed8"];

const MANY_STATUSES = [
	undefined,
	"Building a nest",
	undefined,
	"Listening to the canal",
	undefined,
	"Back on Monday",
];

export const createManyMembers = (count: number): Member[] =>
	Array.from({ length: count }, (_, index) => {
		const presence =
			MANY_PRESENCES[(index * 7 + (index >> 3)) % MANY_PRESENCES.length] ??
			"offline";
		const moderator = index % 37 === 0;
		return {
			id: `member-${index}`,
			name: `Member ${String(index).padStart(4, "0")}`,
			avatarColor: MANY_COLORS[index % MANY_COLORS.length],
			presence,
			status: MANY_STATUSES[index % MANY_STATUSES.length],
			hoistedRoleId: moderator ? moderatorRole.id : undefined,
			role: moderator ? moderatorRole : undefined,
			bot: index % 211 === 5,
		};
	});
