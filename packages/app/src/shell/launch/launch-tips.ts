import type { Platform } from "../../screen/platform";

type LaunchTip = { text: string; platform?: Platform };

export const LAUNCH_TIPS: readonly LaunchTip[] = [
	{ text: "Type @ to mention someone, or # to link to a channel." },
	{
		text: "Type @time to share a time that everyone sees in their own time zone.",
	},
	{
		text: "Put two vertical bars on each side of some words, like ||this||, to hide them as a spoiler.",
	},
	{
		text: "Type a colon and a few letters, like :heart, to search for an emoji.",
	},
	{ text: "Paste an image into the message box to attach it." },
	{ text: "Save a GIF from any message to find it again in your GIF picker." },
	{
		text: "Follow a thread to find it under Following in the thread list.",
	},
	{ text: "Mentions and replies to your messages land in your Inbox." },
	{
		text: "Press the Up arrow in an empty message box to edit your last message.",
		platform: "desktop",
	},
	{
		text: "Press Shift and Enter to start a new line without sending.",
		platform: "desktop",
	},
	{
		text: "Hold Shift while you delete a message to skip the confirmation.",
		platform: "desktop",
	},
	{
		text: "Drag the edge of the channel list to make it wider or narrower.",
		platform: "desktop",
	},
	{
		text: "Press and hold a message to see everything you can do with it.",
		platform: "mobile",
	},
	{
		text: "Turn on Swipe left to reply in Settings to answer a message with one swipe.",
		platform: "mobile",
	},
	{
		text: "Turn on Double tap to react in Settings to give a message a quick thumbs up.",
		platform: "mobile",
	},
];

export const launchTips = (platform: Platform) =>
	LAUNCH_TIPS.filter((tip) => !tip.platform || tip.platform === platform).map(
		(tip) => tip.text,
	);
