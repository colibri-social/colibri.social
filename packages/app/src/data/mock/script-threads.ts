import { embeds } from "./embeds";
import { photo } from "./media";
import { fx, mark, rich } from "./rich";
import type { ScriptContext, ScriptEntry } from "./script-types";

export type ThreadSeed = {
	space: string;
	channel: string;
	tkey: string;
	name: string;
	anchor: string;
	by: string;
	entries: ScriptEntry[];
	following?: boolean;
	unread?: boolean;
};

export const threadSeeds = (c: ScriptContext): ThreadSeed[] => [
	{
		space: "owls",
		channel: "critique",
		tkey: "portrait-critique",
		name: "Portrait critique",
		anchor: "crit-portrait",
		by: "greta",
		following: true,
		unread: true,
		entries: [
			{
				by: "greta",
				text: "Here's the portrait, the eyes feel lifeless to me",
				gap: 2,
				files: [photo("portrait-greta", 1000, 1300)],
			},
			{
				by: "mira",
				text: "Add a tiny highlight in each iris and soften the lower lid line",
				gap: 10,
			},
			{
				by: "aiko",
				text: "Also the left eye is a bit higher than the right, could be on purpose though",
				gap: 6,
			},
			{ by: "greta", text: "Not on purpose 😅 fixing", gap: 3 },
			{
				by: "greta",
				text: "Better?",
				gap: 90,
				files: [photo("portrait-greta-v2", 1000, 1300)],
				react: [["👏", "mira", "aiko", "hana"]],
			},
			{
				by: "hana",
				text: rich(
					"So much better. ",
					mark("@Louis", fx.mention(c.did("lou"))),
					" come look at this glow-up",
				),
				gap: 12,
			},
		],
	},
	{
		space: "owls",
		channel: "critique",
		tkey: "hands-help",
		name: "Hands help",
		anchor: "crit-2",
		by: "maya",
		entries: [
			{
				by: "maya",
				text: "Tried the mitten trick",
				gap: 30,
				files: [photo("hands-v2", 1000, 1000)],
			},
			{
				by: "aiko",
				text: "Yes! Now the thumb needs to wrap around more",
				gap: 20,
			},
			{ by: "jun", text: "Getting there, keep at it", gap: 5 },
			{
				by: "maya",
				text: "Third try, I think this is it",
				gap: 240,
				files: [photo("hands-v3", 1000, 1000)],
				react: [["🙌", "aiko", "jun"]],
			},
		],
	},
	{
		space: "hq",
		channel: "dev",
		tkey: "spring-tuning",
		name: "Spring tuning",
		anchor: "stack-driver",
		by: "kris",
		following: true,
		entries: [
			{
				by: "kris",
				text: rich(
					"Starting with ",
					mark("response 0.38", fx.code()),
					" and critical damping",
				),
				gap: 10,
			},
			{
				by: "priya",
				text: "Feels a bit slow on a big tablet, maybe scale with width?",
				gap: 8,
			},
			{
				by: "lou",
				text: rich(
					"Native apps keep the duration constant, I'd rather match that ",
					mark(
						"https://developer.apple.com/documentation/swiftui/spring",
						fx.link("https://developer.apple.com/documentation/swiftui/spring"),
					),
				),
				gap: 15,
				embeds: [embeds.springs],
			},
			{
				by: "kris",
				text: "Fair. Keeping it fixed.",
				gap: 4,
				react: [["👍", "lou", "priya"]],
			},
		],
	},
];
