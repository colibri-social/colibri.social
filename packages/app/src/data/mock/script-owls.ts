import { embeds } from "./embeds";
import { gif, photo, video } from "./media";
import { block, fx, mark, rich } from "./rich";
import type { ScriptContext, ScriptEntry } from "./script-types";

export const owlsScripts = (
	c: ScriptContext,
): Record<string, ScriptEntry[]> => ({
	showcase: [
		{
			by: "rosa",
			text: "Finished the coastline series, three pieces",
			gap: 0,
			files: [
				photo("coast-1", 1200, 1600),
				photo("coast-2", 1600, 1200),
				photo("coast-3", 1200, 1200),
			],
			react: [
				["😍", "hana", "kai", "nina", "lou"],
				["🌊", "rosa", "mira"],
			],
			extraReactions: { "😍": 42 },
		},
		{
			by: "hana",
			text: "Rosa these are stunning. The second one especially, that light!",
			gap: 8,
		},
		{
			by: "kai",
			text: "Ink study from the train",
			gap: 120,
			files: [photo("ink-train", 1000, 1400)],
			react: [["🖋️", "hana", "aiko"]],
		},
		{
			by: "nina",
			text: "Timelapse of the owl commission",
			gap: 300,
			files: [video("ForBiggerJoyrides", 1280, 720)],
			react: [["🦉", "hana", "lou", "rosa", "kai", "ivy"]],
			extraReactions: { "🦉": 17 },
		},
		{
			by: "aiko",
			text: "Watercolor of my neighbor's cat, she has no idea she's famous now",
			gap: 400,
			files: [photo("watercolor-cat", 1400, 1000)],
			react: [["🐈", "lucy", "maya", "hana"]],
		},
		{
			by: "lou",
			text: "First attempt at gouache, be gentle",
			gap: 600,
			files: [photo("gouache-lou", 1200, 900)],
			react: [["👏", "hana", "rosa", "nina", "mira"]],
		},
		{
			by: "hana",
			text: rich(
				mark("@Louis", fx.mention(c.did("lou"))),
				" for a first attempt this is great! The sky gradient is really clean",
			),
			gap: 9,
		},
		{
			by: "mira",
			text: "Character sheet for my comic",
			gap: 900,
			files: [photo("character-sheet", 2000, 1200, "character-sheet.png")],
		},
		{
			by: "theo",
			text: "Album cover I did for a friend's band",
			gap: 500,
			files: [photo("album-cover", 1200, 1200)],
			react: [["🎸", "will", "zoe"]],
		},
		{
			by: "ivy",
			text: "Sketchbook dump",
			gap: 700,
			files: [
				photo("sketch-1", 900, 1200),
				photo("sketch-2", 900, 1200),
				photo("sketch-3", 900, 1200),
				photo("sketch-4", 1200, 900),
				photo("sketch-5", 900, 1200),
			],
		},
		{
			by: "greta",
			text: "Linocut print, edition of 12",
			gap: 300,
			files: [photo("linocut", 1000, 1300)],
			react: [["🔥", "kai", "ivy"]],
		},
		{
			by: "kai",
			text: rich(
				"Exhibition opening is ",
				mark("Saturday", fx.time(c.at(60 * 24 * 2), "date-long")),
				"! Come say hi if you're in Osaka",
			),
			gap: 400,
			embeds: [embeds.museum],
		},
		{
			by: "nina",
			text: "Process video, from sketch to color",
			gap: 200,
			files: [video("ForBiggerFun", 1280, 720)],
		},
	],
	prompts: [
		{
			by: "hana",
			text: rich(
				block([fx.heading(2)], 'Week 40 prompt: "Fog"'),
				"\n",
				mark("Results thread is up!", fx.italic()),
			),
			gap: 0,
		},
		{
			by: "hana",
			text: rich(
				block([fx.heading(2)], 'Week 41 prompt: "Lanterns"'),
				"\n",
				"Any medium. Post in ",
				mark("showcase", fx.channel("showcase")),
				" by ",
				mark("Sunday", fx.time(c.at(60 * 24 * 3), "date-short")),
				".",
			),
			gap: 10080,
			react: [["🏮", "rosa", "kai", "nina", "lou", "aiko"]],
		},
		{ by: "rosa", text: "Ooh, good one", gap: 10 },
		{
			by: "kai",
			text: "I'm doing lanterns as jellyfish, don't steal it",
			gap: 300,
		},
	],
	critique: [
		{
			id: "crit-1",
			by: "lucy",
			text: "Would love feedback on the composition here, it feels off but I can't say why",
			gap: 0,
			files: [photo("crit-lucy", 1400, 1000)],
		},
		{
			by: "mira",
			text: "The horizon sits exactly in the middle, try moving it to the lower third",
			gap: 15,
			reply: "crit-1",
		},
		{ by: "lucy", text: "Oh that's it, thank you!", gap: 4 },
		{
			id: "crit-2",
			by: "maya",
			text: "Hands. Always hands. Help.",
			gap: 300,
			files: [photo("crit-hands", 1000, 1000)],
		},
		{
			by: "aiko",
			text: "Block them as mittens first, then split the fingers. Works every time.",
			gap: 12,
			reply: "crit-2",
		},
		{
			by: "jun",
			text: rich(
				"Seconding that, and look at ",
				mark("Loomis", fx.bold()),
				" for the proportions",
			),
			gap: 3,
		},
		{
			by: "sofia",
			text: "Color palette check, too muddy?",
			gap: 500,
			files: [photo("palette-check", 1200, 800)],
		},
		{
			by: "theo",
			text: "A bit, the greens and browns are fighting. Push the shadows toward blue.",
			gap: 20,
		},
		{
			id: "crit-portrait",
			by: "greta",
			text: "Started a thread for the portrait critique so it doesn't clog the channel",
			gap: 200,
		},
		{
			by: "maya",
			text: rich(
				"Calling the ",
				mark("@Night shift", fx.role("night-shift")),
				", anyone up for a 2am speedpaint tonight?",
			),
			gap: 90,
		},
	],
	gifs: [
		{ by: "will", text: "monday mood", gap: 0, files: [gif("cat")] },
		{
			by: "zoe",
			text: "",
			gap: 3,
			files: [gif("dance")],
			react: [["😂", "will", "lucy"]],
		},
		{
			by: "lucy",
			text: "when the layer you were painting on was the wrong one the whole time",
			gap: 30,
			files: [gif("wow")],
			react: [["💀", "kai", "rosa", "nina", "maya"]],
		},
		{ by: "maya", text: "", gap: 2, files: [gif("thumbs")] },
		{
			by: "kai",
			text: "exhibition prep in a nutshell",
			gap: 200,
			files: [gif("party")],
		},
		{
			by: "rosa",
			text: "",
			gap: 100,
			files: [gif("bird")],
			react: [["🐦", "lou"]],
		},
		{ by: "lou", text: "this channel is my favorite", gap: 4 },
	],
});

const ARCHIVE_LINES = [
	"anyone up?",
	"just finished a piece, posting it tomorrow when it's not 3am",
	"what brushes are you all using these days",
	"the hard round with pressure opacity, always",
	"I need to stop buying sketchbooks I'm not filling",
	"same, I have nine blank ones",
	"working on backgrounds tonight, wish me luck",
	"coffee or tea for late night drawing",
	"tea, coffee makes my lines shaky",
	"does anyone have a good reference site for poses",
	"line art is my nemesis",
	"color is my nemesis",
	"just discovered the lasso fill tool and my life changed",
	"night shift crew checking in 🌙",
	"🦉",
	"good night owls",
	"that's a really nice palette",
	"how long did that take you?",
	"about six hours over two nights",
	"the rain sounds are perfect for drawing tonight",
	"anyone doing the prompt this week?",
	"I'm stuck on the face, it keeps looking angry",
	"flip the canvas, it helps",
	"new tablet arrived!!",
	"which one did you get",
	"trying gouache again after years",
	"my cat just walked across my canvas and honestly improved it",
	"ok that's the funniest thing I've read today",
	"posting a wip, don't judge",
	"love the mood in this one",
];

export const archiveLines = ARCHIVE_LINES;
