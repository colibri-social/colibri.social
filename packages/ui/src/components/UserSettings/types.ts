import type { DoubleTapAction } from "../MessageActions/MessageGestures";

export type NotificationLevel = "all" | "mentionsAndReplies" | "nothing";

export const NOTIFICATION_LEVEL_COPY: Record<
	NotificationLevel,
	{ title: string; description: string }
> = {
	all: {
		title: "All messages",
		description: "Every new message in the Spaces you've joined.",
	},
	mentionsAndReplies: {
		title: "Mentions and replies",
		description: "Only when someone mentions you or replies to you.",
	},
	nothing: {
		title: "Nothing",
		description: "No notifications at all.",
	},
};

export const NOTIFICATION_LEVELS: readonly NotificationLevel[] = [
	"all",
	"mentionsAndReplies",
	"nothing",
];

export const isNotificationLevel = (
	value: string,
): value is NotificationLevel =>
	(NOTIFICATION_LEVELS as readonly string[]).includes(value);

export type ThemePreference = "system" | "dark" | "light";

export type BlueskyClientChoice =
	| "anisota"
	| "blacksky"
	| "bluesky"
	| "deer"
	| "mu"
	| "northsky"
	| "witchsky"
	| "custom";

export type SwipeLeftAction = "members" | "reply";

export type TouchGestures = {
	swipeLeftAction: SwipeLeftAction;
	doubleTapEnabled: boolean;
	doubleTapAction: DoubleTapAction;
	doubleTapReactionEmoji: string;
};
