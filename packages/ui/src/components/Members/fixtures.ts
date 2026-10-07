import { storyImages } from "../Banner/story-images";
import type { HoistedRole, Member } from "./MemberList";

export const fixtureRoles: HoistedRole[] = [{ id: "mods", name: "Moderators" }];

export const fixtureMembers = (): Member[] => [
	{
		id: "lou",
		name: "Lou",
		avatarSrc: storyImages.violetIcon(),
		presence: "online",
		status: "Building a nest",
		hoistedRoleId: "mods",
		roleColor: "#c4a7ff",
		owner: true,
	},
	{
		id: "lis",
		name: "Lis",
		avatarSrc: storyImages.tealIcon(),
		presence: "idle",
		status: "Drawing pixel birds",
		hoistedRoleId: "mods",
		roleColor: "#c4a7ff",
	},
	{
		id: "tim",
		name: "Tim",
		avatarColor: "#3f6212",
		presence: "dnd",
		hoistedRoleId: "mods",
		roleColor: "#c4a7ff",
	},
	{
		id: "kris",
		name: "Kris",
		avatarSrc: storyImages.amberIcon(),
		presence: "online",
		status: "Listening to the canal",
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
	{ id: "ola", name: "Ola", avatarColor: "#525252", presence: "offline" },
	{
		id: "pim",
		name: "Pim",
		avatarColor: "#525252",
		presence: "offline",
		status: "Back on Monday",
	},
];
