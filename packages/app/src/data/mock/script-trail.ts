import { embeds } from "./embeds";
import { file, gif, photo } from "./media";
import { block, fx, mark, rich } from "./rich";
import type { ScriptContext, ScriptEntry } from "./script-types";

const gpx = (name: string, size: number) =>
	file(name, "application/gpx+xml", size, `https://example.com/routes/${name}`);

export const trailScripts = (
	c: ScriptContext,
): Record<string, ScriptEntry[]> => ({
	planning: [
		{
			by: "omar",
			text: rich(
				block([fx.heading(2)], "Dolomites loop"),
				"\n",
				"Dates: ",
				mark("Oct 18", fx.time(c.at(60 * 24 * 8), "date-short")),
				" to ",
				mark("Oct 20", fx.time(c.at(60 * 24 * 10), "date-short")),
				"\n",
				block([fx.list(true)], "Who's in?"),
				"\n",
				block([fx.list(true)], "Who can drive?"),
				"\n",
				block([fx.list(true)], "Hut or tent?"),
			),
			gap: 0,
			react: [["🙋", "elsa", "sam", "lou", "greta"]],
		},
		{ by: "elsa", text: "In! I can drive, room for three", gap: 20 },
		{ by: "sam", text: "In, tent please, the huts are booked out", gap: 30 },
		{
			id: "lou-stove",
			by: "lou",
			text: "Count me in, I'll bring the stove",
			gap: 50,
		},
		{
			by: "greta",
			text: "Maybe, depends on work. Will know by Wednesday",
			gap: 80,
		},
		{
			by: "omar",
			text: rich(
				"Route options ",
				mark("@Guides", fx.role("guides")),
				", let me know what you think",
			),
			gap: 200,
			embeds: [embeds.trail],
		},
		{
			by: "elsa",
			text: "The loop is perfect for day one, then Lago di Sorapis on day two?",
			gap: 15,
		},
		{ by: "omar", text: "Yes!! Love that", gap: 5 },
		{
			by: "trailbot",
			text: rich(
				mark("Conditions update:", fx.bold()),
				" snow above 2400 m, microspikes recommended. ",
				mark("Updated 2 hours ago", fx.subtext()),
			),
			gap: 300,
		},
		{
			by: "sam",
			text: "Good to know. I have spare microspikes if anyone needs them",
			gap: 20,
		},
		{
			by: "marco",
			text: "I can't make it this time, have fun! Send photos",
			gap: 400,
		},
		{
			by: "omar",
			text: rich(
				mark("@Louis", fx.mention(c.did("lou"))),
				" can you check if your stove takes the screw-on canisters?",
			),
			gap: 120,
		},
		{ by: "aiko", text: "Carpool from the station works for me", gap: 60 },
		{ by: "oscar", text: "I'm in for day two only if that's okay", gap: 90 },
		{ by: "omar", text: "Of course!", gap: 3 },
		{
			by: "greta",
			text: "Perfect, then I'll skip packing mine and bring extra gas canisters",
			gap: 6,
			reply: "lou-stove",
		},
		{
			by: "omar",
			text: rich(
				"Reminder for ",
				mark("@Regulars", fx.role("regulars")),
				": the hut deposit is due Friday, send it my way",
			),
			gap: 4,
		},
	],
	routes: [
		{
			by: "elsa",
			text: "GPX for the loop",
			gap: 0,
			files: [gpx("tre-cime-loop.gpx", 184_220)],
		},
		{
			by: "omar",
			text: "And Sorapis",
			gap: 10,
			files: [gpx("lago-di-sorapis.gpx", 96_410)],
		},
		{
			by: "sam",
			text: "Elevation profile, it's steeper than it looks",
			gap: 120,
			files: [photo("elevation-profile", 1600, 600, "elevation.png")],
		},
		{
			by: "elsa",
			text: rich(
				"Note: the last ",
				mark("2 km", fx.bold()),
				" are exposed, keep an eye on the wind",
			),
			gap: 30,
		},
		{
			by: "luca",
			text: "Old route from last year, in case it's useful",
			gap: 900,
			forward: {
				space: "trail",
				channel: "planning",
				channelName: "planning",
				by: "omar",
				text: "Last year's route, worked great in September",
				files: [gpx("2025-route.gpx", 120_000)],
				minutesBefore: 525600,
			},
		},
	],
	gear: [
		{
			by: "sam",
			text: "Selling my old 2-person tent, barely used",
			gap: 0,
			files: [photo("tent", 1400, 1000)],
		},
		{ by: "greta", text: "How much?", gap: 30 },
		{
			by: "sam",
			text: "Make me an offer, mostly want it to go to a good home",
			gap: 10,
		},
		{
			by: "theo",
			text: "Anyone tried trail runners for multi-day hikes? Thinking of ditching boots",
			gap: 400,
		},
		{
			by: "elsa",
			text: "Switched two years ago, never going back. Just bring good socks.",
			gap: 20,
			react: [["🧦", "sam", "omar"]],
		},
		{
			by: "will",
			text: "My pack list for the weekend, roast it",
			gap: 300,
			files: [
				file(
					"pack-list.pdf",
					"application/pdf",
					64_000,
					"https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
				),
			],
		},
		{
			by: "rosa",
			text: "Three headlamps is a choice",
			gap: 15,
			react: [["😂", "will", "sam", "elsa"]],
		},
		{ by: "will", text: "you can never have too many headlamps", gap: 2 },
		{
			by: "petra",
			text: "my reaction to the price of new rain shells",
			gap: 200,
			files: [gif("wow")],
		},
	],
	matrix: [
		{
			by: "maxb",
			text: "Hey from the Matrix side! Can you all see this?",
			gap: 0,
		},
		{
			by: "omar",
			text: rich(
				"Loud and clear ",
				mark("@Max", fx.bridged("matrix", "@max:matrix.org")),
			),
			gap: 3,
			react: [["👋", "maxb", "elsa"]],
		},
		{ by: "juneb", text: "Bridge is working, nice", gap: 5 },
		{ by: "maxb", text: "Reactions come through too?", gap: 2 },
		{ by: "elsa", text: "Yep, I can see June's thumbs up", gap: 1 },
		{
			by: "maxb",
			text: "Photo from last weekend",
			gap: 300,
			files: [photo("matrix-summit", 1600, 1000)],
			react: [["⛰️", "omar", "elsa", "lou"]],
		},
		{ by: "juneb", text: "Wow, where is that?", gap: 10 },
		{ by: "maxb", text: "Seceda ridge, early morning", gap: 3 },
		{
			by: "lou",
			text: rich(
				mark("@June", fx.bridged("matrix", "@june:matrix.org")),
				" you should join us next time",
			),
			gap: 30,
		},
		{ by: "juneb", text: "Would love to!", gap: 20 },
	],
	photos: [],
});
