import { createStore } from "solid-js/store";
import { storyImages } from "../Banner/story-images";
import {
	type InboxCategory,
	type InboxNotification,
	type InboxSpace,
	type InboxStatus,
	matchesFilter,
} from "./inbox-data";

export const INBOX_NOW = new Date(2026, 9, 9, 14, 20);

const at = (hours: number, minutes: number, dayOffset = 0) =>
	new Date(2026, 9, 9 + dayOffset, hours, minutes);

export const inboxSpaces = (): InboxSpace[] => [
	{
		id: "flock",
		name: "Colibri Social Flock",
		iconSrc: storyImages.violetIcon(),
	},
	{ id: "birds", name: "Bird watchers", iconSrc: storyImages.tealIcon() },
	{ id: "canal", name: "Canal walks", iconSrc: storyImages.amberIcon() },
	{ id: "atproto", name: "AT Protocol devs" },
	{
		id: "long",
		name: "The longest Space name anyone has ever typed into Colibri",
	},
];

const moderators = { name: "Moderators", color: "#f97316" };

const base: Omit<InboxNotification, "id">[] = [
	{
		kind: "mention",
		spaceId: "flock",
		channelName: "general",
		author: "Mira",
		team: true,
		timestamp: at(14, 12),
		mentionLabel: "@louis",
		text: "can you take a look at the release notes before we ship the beta?",
		read: false,
	},
	{
		kind: "reply",
		spaceId: "birds",
		channelName: "sightings",
		author: "Jonas Becker",
		nameColor: "#34d399",
		timestamp: at(13, 58),
		replyTo: "Spotted a kingfisher by the old mill this morning!",
		text: "No way, I've been trying to get a photo of one for weeks. Which side of the river?",
		read: false,
	},
	{
		kind: "roleMention",
		spaceId: "flock",
		channelName: "moderation",
		author: "Alex",
		role: moderators,
		timestamp: at(13, 31),
		mentionLabel: "@Moderators",
		mentionRoleColor: moderators.color,
		text: "there's a spam wave in #introductions, could someone lock the channel for an hour?",
		read: false,
	},
	{
		kind: "mention",
		spaceId: "long",
		channelName: "a-channel-with-an-unreasonably-long-name-for-testing",
		threadName: "Planning the summer meetup in Hamburg",
		author: "Someone with a very long display name that keeps going",
		timestamp: at(12, 4),
		mentionLabel: "@louis",
		text: "Very long text content for the message. It keeps going so the preview has to clamp it after a couple of lines, and there is a lot of text here that keeps going and going and going without stopping at all.",
		read: false,
	},
	{
		kind: "reply",
		spaceId: "atproto",
		channelName: "lexicons",
		threadName: "Status expiry",
		author: "Priya",
		timestamp: at(11, 45),
		replyTo:
			"I'd add expiresAt as an optional datetime and let the AppView filter it.",
		text: "Agreed. We should also keep a way to clear it explicitly.",
		read: false,
	},
	{
		kind: "mention",
		spaceId: "canal",
		channelName: "routes",
		author: "Tomasz",
		timestamp: at(9, 2),
		mentionLabel: "@louis",
		text: "the towpath near the lock is closed this weekend, want to take the north route?",
		read: false,
	},
	{
		kind: "reply",
		spaceId: "flock",
		channelName: "design",
		author: "Mira",
		team: true,
		timestamp: at(18, 40, -1),
		replyTo: "Here's the new inbox mock for desktop.",
		text: "Love the grouping. Could the unread dot be a little more prominent?",
		read: false,
	},
	{
		kind: "mention",
		spaceId: "birds",
		channelName: "events",
		author: "Hanna",
		timestamp: at(16, 15, -1),
		mentionLabel: "@louis",
		text: "you're on the list for Saturday's dawn walk.",
		read: false,
	},
	{
		kind: "roleMention",
		spaceId: "atproto",
		channelName: "announcements",
		author: "Sam",
		role: { name: "Maintainers", color: "#60a5fa" },
		timestamp: at(10, 30, -1),
		mentionLabel: "@Maintainers",
		mentionRoleColor: "#60a5fa",
		text: "office hours move to Thursday this week.",
		read: false,
	},
];

const filler = (index: number): Omit<InboxNotification, "id"> => {
	const spaces = ["flock", "birds", "canal", "atproto"];
	const channels = ["general", "random", "help", "showcase"];
	const reply = index % 3 === 0;
	return {
		kind: reply ? "reply" : "mention",
		spaceId: spaces[index % spaces.length] ?? "flock",
		channelName: channels[index % channels.length] ?? "general",
		author:
			["Mira", "Jonas Becker", "Alex", "Priya", "Tomasz"][index % 5] ?? "",
		timestamp: at(
			20 - (index % 10),
			(index * 7) % 60,
			-2 - Math.floor(index / 6),
		),
		mentionLabel: reply ? undefined : "@louis",
		replyTo: reply
			? "Does anyone have the link to the meeting notes?"
			: undefined,
		text: reply
			? `Here you go, notes from session ${index + 1} are pinned in the channel.`
			: `quick question about item ${index + 1} on the agenda when you have a minute.`,
		read: false,
	};
};

export const inboxNotifications = (count = 40): InboxNotification[] => {
	const all = [
		...base,
		...Array.from({ length: Math.max(0, count - base.length) }, (_, index) =>
			filler(index),
		),
	].slice(0, count);
	return all.map((item, index) => ({ ...item, id: `n${index + 1}` }));
};

export const createInboxStore = (options?: {
	notifications?: InboxNotification[];
	status?: InboxStatus;
}) => {
	const [state, setState] = createStore({
		spaces: inboxSpaces(),
		notifications: options?.notifications ?? inboxNotifications(),
		status: options?.status ?? ("ready" as InboxStatus),
	});
	const remove = (seen: (item: InboxNotification) => boolean) =>
		setState("notifications", (items) => items.filter((item) => !seen(item)));
	return {
		state,
		markRead: (id: string) => remove((item) => item.id === id),
		markAllRead: () => remove(() => true),
		markCategoryRead: (category: InboxCategory) =>
			remove((item) => matchesFilter(item, category)),
		markSpaceRead: (spaceId: string) =>
			remove((item) => item.spaceId === spaceId),
		setStatus: (status: InboxStatus) => setState("status", status),
	};
};
