import { embeds } from "./embeds";
import { audio, gif, pdf, photo, video, zip } from "./media";
import { block, fx, mark, rich } from "./rich";
import type { ScriptContext, ScriptEntry } from "./script-types";

const CODE_TS = `export const createStack = (options: StackOptions) => {
	const [depth, setDepth] = createSignal(0);
	const push = (layer: Layer) => setDepth((value) => value + 1);
	return { depth, push };
};`;

const CODE_RUST = `pub async fn list_messages(
    State(app): State<AppState>,
    Query(params): Query<ListMessages>,
) -> Result<Json<Page<MessageView>>, ApiError> {
    let limit = params.limit.unwrap_or(50).min(100);
    let page = app.db.messages(&params.channel, params.cursor, limit).await?;
    Ok(Json(page))
}`;

const CODE_JSON = `{
  "lexicon": 1,
  "id": "social.colibri.beta.actor.setStatus",
  "defs": {
    "main": {
      "type": "procedure",
      "input": { "encoding": "application/json" }
    }
  }
}`;

const CODE_CSS = `.pane[data-moving] {
  will-change: transform;
}

.pane:not([data-active]) {
  visibility: hidden;
}`;

const LONG_UPDATE =
	"Okay, long one, sorry in advance. I spent the weekend profiling the mobile build on my phone and the numbers are honestly better than I expected. Cold start is down to about 900 ms on a mid-range Android device, and most of that is the WebView itself spinning up rather than our code. The message list stays at a flat memory profile even after scrolling through a few thousand messages, which means the virtualization is doing its job. Where we still lose frames is the moment a pane starts moving: the browser promotes the layer, rasterizes it, and if the pane has a lot of images that first frame can take 30 ms. My plan is to promote only the two panes involved in a gesture, keep everything else flat, and hide panes that are fully covered so the compositor can drop them. I also want to stop resizing the whole shell for every keyboard animation frame, because that forces a layout of everything on every frame. If anyone has a cheap Android phone lying around, please try the preview build and tell me where it stutters. Specific steps help a lot: which Space, which channel, what you tapped, and roughly how long it felt. Screenshots of the performance overlay are a bonus. Thank you all, this group keeps making the app better every week and I really appreciate the patience while we rebuild the client from the ground up. One more thing: the archive channel in Night Owls is a great stress test, it has a very long history.";

export const hqScripts = (c: ScriptContext): Record<string, ScriptEntry[]> => ({
	welcome: [
		{
			by: "lou",
			text: rich(
				block([fx.heading(1)], "Welcome to Colibri HQ"),
				"\n",
				"This is where we build Colibri in the open. A few ground rules:\n",
				block([fx.list(true)], "Be kind, assume good intent"),
				"\n",
				block(
					[fx.list(true)],
					"Keep bug reports in ",
					mark("dev", fx.channel("dev")),
				),
				"\n",
				block(
					[fx.list(true)],
					"No spoilers for unreleased features outside ",
					mark("design", fx.channel("design")),
				),
				"\n",
				block(
					[fx.subtext()],
					"Questions? Ping ",
					mark("@Moderators", fx.role("mods")),
					".",
				),
			),
			gap: 0,
		},
		{
			by: "birdbot",
			text: "Tip: long-press any message to react, reply or copy a link.",
			gap: 2,
		},
		{
			by: "mira",
			text: "Hi everyone! 👋",
			gap: 4000,
			react: [["👋", "lou", "tomas", "kris"]],
		},
	],
	announcements: [
		{
			by: "lou",
			text: rich(
				block([fx.heading(2)], "Spaces alpha is live"),
				"\n",
				"Spaces are rolling out to everyone in the alpha. ",
				mark("Huge", fx.bold()),
				" thanks to ",
				mark("@Testers", fx.role("testers")),
				" for weeks of bug reports.\n",
				block([fx.list()], "Roles with icon and image badges"),
				"\n",
				block([fx.list()], "Private channels"),
				"\n",
				block([fx.list(false, 1)], "visible to roles or members"),
				"\n",
				block([fx.list()], "Threads in every text channel"),
			),
			gap: 0,
			react: [
				["🎉", "mira", "tomas", "kris", "ana", "jun", "noor"],
				["❤️", "priya", "eli"],
			],
			extraReactions: { "🎉": 31, "❤️": 12 },
		},
		{
			by: "lou",
			text: rich(
				"Maintenance window ",
				mark("tomorrow", fx.time(c.at(60 * 20), "datetime-long")),
				". Expect about ",
				mark("15 minutes", fx.bold()),
				" of read-only mode.",
			),
			gap: 4320,
			react: [["👍", "kris", "ana"]],
		},
		{
			by: "lou",
			text: rich(
				"New docs for bridges are up: ",
				mark(
					"https://atproto.com/guides/overview",
					fx.link("https://atproto.com/guides/overview"),
				),
			),
			gap: 2880,
			embeds: [embeds.atproto],
		},
		{
			by: "lou",
			text: rich(
				"Design system v2 is ready for review ",
				mark("@Core team", fx.role("core")),
				". Feedback in ",
				mark("design", fx.channel("design")),
				" please.",
			),
			gap: 1500,
			files: [photo("colibri-ds-cover", 1600, 900, "design-system-v2.png")],
			react: [["🔥", "mira", "ivy", "lucy"]],
			extraReactions: { "🔥": 18 },
		},
	],
	releases: [
		{
			by: "relay",
			text: rich(
				mark("v0.4.0", fx.bold()),
				" shipped to the alpha channel\n",
				block([fx.list()], "Faster channel switching"),
				"\n",
				block([fx.list()], "Fixed a crash when opening empty threads"),
			),
			gap: 0,
		},
		{
			by: "relay",
			text: rich(
				mark("v0.4.1", fx.bold()),
				" hotfix: push notifications on Android 15",
			),
			gap: 2000,
		},
		{
			by: "relay",
			text: rich(
				mark("v0.4.2", fx.bold()),
				" shipped\n",
				block([fx.list()], "Emoji picker remembers skin tone"),
				"\n",
				block([fx.list()], "Status can clear itself after a while"),
			),
			gap: 3500,
			files: [zip("colibri-0.4.2-symbols.zip", 18_442_001)],
		},
		{
			by: "relay",
			text: rich(
				mark("v0.5.0-beta.1", fx.bold()),
				" is in TestFlight and the Play beta track",
			),
			gap: 2600,
			react: [["🚀", "mira", "kris", "lou"]],
		},
	],
	general: [
		{ by: "tomas", text: "morning all ☕", gap: 0 },
		{
			by: "kris",
			text: "Morning! Did anyone else get the new build overnight?",
			gap: 3,
		},
		{ by: "tomas", text: "yep, the space rail feels way snappier", gap: 2 },
		{
			by: "jun",
			text: "FREE CRYPTO GIVEAWAY click here to claim before it expires",
			gap: 1,
			hidden: true,
		},
		{
			by: "tomas",
			text: "the little join animation between the tab and the panel is so nice",
			gap: 1,
		},
		{
			id: "q-dark",
			by: "noor",
			text: "Is there a way to switch to the light theme yet? Asking for my eyes at 2pm 😅",
			gap: 14,
		},
		{
			by: "priya",
			text: rich(
				"Settings, then ",
				mark("Appearance", fx.bold()),
				". It follows the system by default.",
			),
			reply: "q-dark",
			gap: 3,
			react: [["🙏", "noor"]],
		},
		{
			by: "jun",
			text: "ok this is a test of the emoji font 🐦‍🔥 👩🏽‍🎨 🧑🏿‍💻 🏳️‍🌈 🫶🏼",
			gap: 25,
			react: [
				["🐦‍🔥", "lou", "mira"],
				["😂", "kris"],
			],
		},
		{
			by: "lou",
			text: rich(
				"Looks right on my end ",
				mark("@Jun Park", fx.mention(c.did("jun"))),
				", even the phoenix renders",
			),
			gap: 2,
		},
		{
			by: "eli",
			text: rich(
				"Quick question about permissions, do private channels hide from ",
				mark("everyone", fx.italic()),
				" or just non-members?",
			),
			gap: 40,
		},
		{
			by: "ana",
			text: "Everyone who isn't in the allowed roles or members list. They won't even see the name.",
			gap: 4,
		},
		{ by: "eli", text: "Perfect, thanks", gap: 1 },
		{
			by: "zoe",
			text: "who wants to see my new desk setup",
			gap: 90,
			files: [
				photo("desk-setup-1", 1200, 900),
				photo("desk-setup-2", 900, 1200),
			],
			react: [["😍", "ivy", "maya", "lou"]],
		},
		{ by: "maya", text: "the plant!! what kind is it", gap: 2 },
		{ by: "zoe", text: "pothos, impossible to kill, highly recommend", gap: 1 },
		{
			by: "felix",
			text: "I'm going to be away for a while, see you all in a few weeks",
			gap: 200,
			replyDeleted: true,
		},
		{
			by: "will",
			text: rich(
				mark("Spoiler for the newest episode:", fx.bold()),
				" ",
				mark("the bird was the narrator all along", fx.spoiler()),
			),
			gap: 30,
		},
		{ by: "lucy", text: "WILL", gap: 1, react: [["😤", "lucy", "ravi"]] },
		{
			by: "ravi",
			text: "I haven't watched it yet but I'm also not clicking that",
			gap: 1,
		},
		{
			by: "dev",
			text: "forwarding this from the dev channel since it's relevant here",
			gap: 60,
			forward: {
				space: "hq",
				channel: "dev",
				channelName: "dev",
				by: "tomas",
				text: "Heads up: the beta API moved to spaces-api.colibri.social. Old tokens keep working until next week.",
				minutesBefore: 300,
			},
		},
		{
			by: "mira",
			text: "look what someone posted in the art club",
			gap: 8,
			forward: {
				space: "owls",
				channel: "showcase",
				channelName: "showcase",
				by: "hana",
				text: "Finished the heron series, all three panels are up now",
				minutesBefore: 90,
			},
		},
		{
			by: "jonas",
			text: "relaying this, can't share where it came from",
			gap: 12,
			forward: {
				space: "trail",
				channel: "hidden",
				channelName: "stewards",
				by: "tomas",
				text: "Reminder that the spring release freeze starts Monday",
				minutesBefore: 200,
				hidden: true,
			},
		},
		{
			by: "petra",
			text: rich(
				"Is the meetup still on ",
				mark("next Friday", fx.time(c.at(60 * 24 * 6), "date-long")),
				"?",
			),
			gap: 45,
		},
		{
			by: "lou",
			text: rich(
				"Yes! Starts at ",
				mark("6pm", fx.time(c.at(60 * 24 * 6 + 60 * 3), "time-short")),
				". I'll post the address closer to the day.",
			),
			gap: 6,
			react: [["🙌", "petra", "zoe", "will"]],
		},
		{
			by: "yusuf",
			text: "Late to this but congrats on the alpha launch everyone",
			gap: 300,
		},
		{
			by: "theo",
			text: "Tested the voice rooms with five people, crystal clear",
			gap: 30,
		},
		{
			by: "sofia",
			text: "is it just me or did reactions get a tiny pop animation",
			gap: 20,
		},
		{ by: "mira", text: "not just you, it's new ✨", gap: 1, edited: true },
		{
			by: "ben",
			text: "This channel moves so fast I keep missing stuff",
			gap: 70,
		},
		{
			by: "kris",
			text: "That's what the unread marker is for 😄 it opens right where you left off",
			gap: 3,
		},
		{
			by: "jonas",
			text: rich(
				"Found the old GIF picker bug again: ",
				mark("searching while scrolling resets the grid", fx.code()),
				". Filed it.",
			),
			gap: 120,
		},
		{ by: "priya", text: "Thanks Jonas, I'll take a look today", gap: 4 },
		{
			by: "lena",
			text: "Has anyone tried the Linux build on Wayland?",
			gap: 90,
		},
		{
			by: "tomas",
			text: "Running it on COSMIC right now. Works fine apart from the tray icon.",
			gap: 6,
		},
		{ by: "noor", text: "gif time", gap: 40, files: [gif("party")] },
		{
			by: "ivy",
			text: "the duck is back 🦆",
			gap: 15,
			react: [["🦆", "ivy", "lou", "mira", "kris", "noor"]],
		},
		{
			by: "lou",
			text: rich(
				"Heads up ",
				mark("@Testers", fx.role("testers")),
				", new preview build in an hour. Please hammer the swipe gestures.",
			),
			gap: 25,
		},
		{ by: "maya", text: "on it", gap: 2 },
		{ by: "jun", text: "on it x2", gap: 1 },
		{ by: "zoe", text: "my thumb is ready", gap: 1, react: [["👍", "lou"]] },
		{
			by: "will",
			text: rich(
				"Here's the podcast episode where they talk about decentralized chat ",
				mark(
					"https://www.youtube.com/watch?v=aqz-KE-bpKQ",
					fx.link("https://www.youtube.com/watch?v=aqz-KE-bpKQ"),
				),
			),
			gap: 50,
			embeds: [embeds.video],
		},
		{ by: "ravi", text: "saving that for my commute", gap: 4 },
		{
			by: "kris",
			text: rich(
				"Reminder that ",
				mark("@Louis", fx.mention(c.did("lou"))),
				" is doing the design review stream later",
			),
			gap: 30,
		},
		{
			by: "mira",
			text: rich(
				mark("@Louis", fx.mention(c.did("lou"))),
				" can you share the link to the new tab bar mocks here too?",
			),
			gap: 12,
		},
		{ by: "tomas", text: "brb, coffee refill", gap: 6 },
		{
			by: "noor",
			text: "Is anyone else seeing images load slowly on the train? Or is it my connection",
			gap: 18,
		},
		{
			by: "priya",
			text: "Your connection probably. The skeletons should show until they arrive.",
			gap: 2,
		},
		{ by: "noor", text: "yep they do, looks clean", gap: 1 },
		{
			by: "zoe",
			text: rich(
				"hot take: ",
				mark("dark mode", fx.bold()),
				" is the only mode",
			),
			gap: 40,
		},
		{
			by: "ivy",
			text: "light mode at the beach, dark mode everywhere else",
			gap: 2,
		},
		{
			id: "lou-beach",
			by: "lou",
			text: rich(
				mark("@Ivy Chen", fx.mention(c.did("ivy"))),
				" correct answer",
			),
			gap: 1,
			react: [["💯", "ivy", "zoe"]],
		},
		{
			by: "ivy",
			text: "I knew you'd back me up on this one",
			gap: 2,
			reply: "lou-beach",
		},
	],
	"off-topic": [
		{
			by: "rosa",
			text: "Saw a kingfisher by the river today!!",
			gap: 0,
			files: [photo("kingfisher", 1400, 1000)],
			react: [["🐦", "lou", "hana", "nina"]],
		},
		{ by: "hana", text: "so jealous, I've never seen one in person", gap: 6 },
		{ by: "nina", text: "the colors look fake, nature is wild", gap: 3 },
		{ by: "kai", text: "Weekend plans anyone?", gap: 300 },
		{ by: "ben", text: "Board games and a lot of sleeping", gap: 4 },
		{
			by: "lucy",
			text: "baking bread for the first time, wish me luck 🍞",
			gap: 7,
		},
		{
			by: "lucy",
			text: "update: it is a brick",
			gap: 240,
			files: [photo("bread-brick", 1000, 1000)],
			react: [["😂", "ben", "kai", "zoe", "will"]],
		},
		{ by: "will", text: "a delicious brick though", gap: 2 },
		{
			by: "zoe",
			text: "here's a song I've had on repeat all week",
			gap: 400,
			files: [audio("night-drive.mp3")],
		},
		{ by: "kai", text: "this is so good", gap: 30 },
		{
			by: "rosa",
			text: "reaction to the weather today",
			gap: 600,
			files: [gif("wow")],
		},
		{
			by: "theo",
			text: rich(
				"Anyone read ",
				mark("The Overstory", fx.italic()),
				"? Just finished it and need to talk about it",
			),
			gap: 200,
		},
		{ by: "maya", text: "Yes! The ending wrecked me", gap: 20 },
	],
	design: [
		{
			by: "lou",
			text: rich(
				"New tab bar exploration, feedback welcome ",
				mark(
					"https://www.figma.com/design/Wu9dGXB3xLxokb5ss2Gmx2/Colibri",
					fx.link(
						"https://www.figma.com/design/Wu9dGXB3xLxokb5ss2Gmx2/Colibri",
					),
				),
			),
			gap: 0,
			embeds: [embeds.figma],
		},
		{
			by: "ivy",
			text: "Loving the pill behind the active tab. Could the label be a touch heavier?",
			gap: 12,
		},
		{
			by: "mira",
			text: "Agree on the weight. Also the badge dot feels a bit big next to the icon.",
			gap: 5,
		},
		{ by: "lou", text: "Good calls, trying semibold and a 10px dot", gap: 4 },
		{
			by: "lou",
			text: "Before and after:",
			gap: 30,
			files: [
				photo("tabbar-before", 1170, 400, "tab-bar-before.png"),
				photo("tabbar-after", 1170, 400, "tab-bar-after.png"),
			],
			react: [["😍", "ivy", "mira", "lucy"]],
		},
		{ by: "lucy", text: "After is so much cleaner", gap: 3 },
		{
			by: "ivy",
			text: rich(
				"One more thought: the ",
				mark("channel panel", fx.bold()),
				" border could fade at the bottom so it doesn't fight the tab bar",
			),
			gap: 40,
		},
		{
			by: "mira",
			text: "Here are the mobile frames, all 50 of them, in one PDF",
			gap: 200,
			files: [pdf("colibri-mobile-frames.pdf", 12_480_000)],
		},
		{
			by: "lou",
			text: "Screen recording of the new swipe between panes",
			gap: 120,
			files: [video()],
			react: [["🔥", "tomas", "kris", "mira", "ivy"]],
		},
		{ by: "tomas", text: "the parallax underneath sells it", gap: 3 },
		{
			by: "kris",
			text: rich(
				"Can we get the scrim a little darker? On OLED it's hard to tell the layers apart. ",
				mark("Edit: never mind, it's fine on the real device", fx.strike()),
			),
			gap: 6,
			edited: true,
		},
		{
			by: "ivy",
			text: "Color study for the role badges",
			gap: 300,
			files: [
				photo("badge-colors-1", 800, 800),
				photo("badge-colors-2", 800, 800),
				photo("badge-colors-3", 800, 800),
				photo("badge-colors-4", 800, 800),
			],
		},
		{ by: "mira", text: "third one!", gap: 4, react: [["3️⃣", "lou", "lucy"]] },
		{
			by: "lou",
			text: rich(
				block([fx.quote()], "Restraint is the hardest part of design."),
				"\n",
				"Pinning this as our motto for the redesign 😄",
			),
			gap: 500,
			react: [["📌", "mira", "ivy"]],
		},
		{
			by: "ivy",
			text: rich(
				"Type scale check: ",
				mark("Hanken Grotesk", fx.bold()),
				" for UI, ",
				mark("Geist Mono", fx.code()),
				" for code",
			),
			gap: 60,
		},
	],
	dev: [
		{
			by: "eli",
			text: rich(
				"Signals docs for anyone new to Solid: ",
				mark(
					"https://docs.solidjs.com/concepts/signals",
					fx.link("https://docs.solidjs.com/concepts/signals"),
				),
			),
			gap: 0,
			embeds: [embeds.solid],
		},
		{
			by: "jonas",
			text: rich(
				"Same link without the card, testing suppression: ",
				mark(
					"https://docs.solidjs.com/concepts/signals",
					fx.link("https://docs.solidjs.com/concepts/signals"),
				),
			),
			gap: 4,
			suppress: ["https://docs.solidjs.com/concepts/signals"],
		},
		{
			by: "tomas",
			text: rich(
				"Heads up: the beta API moved to ",
				mark("spaces-api.colibri.social", fx.code()),
				". Old tokens keep working until next week.",
			),
			gap: 20,
			react: [["👍", "kris", "priya"]],
		},
		{
			id: "stack-driver",
			by: "kris",
			text: rich(
				"Here's the stack driver I mentioned:\n",
				block([fx.codeblock("ts")], CODE_TS),
			),
			gap: 30,
		},
		{
			by: "priya",
			text: "Nice and small. Does the spring keep the release velocity?",
			gap: 5,
		},
		{
			by: "kris",
			text: "Yes, it seeds the spring with the finger's speed so it never stops dead",
			gap: 3,
		},
		{
			by: "tomas",
			text: rich(
				"And the server side of listMessages:\n",
				block([fx.codeblock("rust")], CODE_RUST),
			),
			gap: 80,
		},
		{
			by: "eli",
			text: rich(
				"Shouldn't the limit cap be ",
				mark("100", fx.code()),
				" in the lexicon too?",
			),
			gap: 6,
		},
		{ by: "tomas", text: "It is, this just mirrors it", gap: 2 },
		{
			by: "priya",
			text: rich(
				"Lexicon for the status change:\n",
				block([fx.codeblock("json")], CODE_JSON),
			),
			gap: 120,
		},
		{
			by: "lou",
			text: rich(
				"CSS for hiding covered panes:\n",
				block([fx.codeblock("css")], CODE_CSS),
				"\n",
				block([fx.subtext()], "content-visibility helps too"),
			),
			gap: 60,
		},
		{
			by: "jonas",
			text: "Build is failing on main",
			gap: 300,
			files: [photo("ci-failure", 1600, 1000, "ci-failure.png")],
		},
		{
			by: "priya",
			text: rich(
				"Looking. Probably the ",
				mark("tsbuildinfo", fx.code()),
				" cache again.",
			),
			gap: 3,
		},
		{
			by: "priya",
			text: "Fixed, it was a stale build cache",
			gap: 20,
			react: [["🙏", "jonas", "tomas"]],
		},
		{
			by: "lou",
			text: LONG_UPDATE,
			gap: 600,
			react: [
				["❤️", "mira", "kris", "tomas", "priya"],
				["👀", "eli"],
			],
		},
		{ by: "kris", text: "That's a great write-up, thanks Louis", gap: 15 },
		{
			by: "tomas",
			text: rich(
				"Here are the symbols for the crash ",
				mark("@Priya Raman", fx.mention(c.did("priya"))),
			),
			gap: 100,
			files: [zip("symbols-0.5.0.zip", 22_800_000)],
		},
		{
			by: "lou",
			text: rich(
				mark("@Core team", fx.role("core")),
				" sync at ",
				mark("3pm", fx.time(c.at(120), "time-short")),
				" today, ",
				mark("relative", fx.time(c.at(120), "relative")),
			),
			gap: 40,
		},
	],
	typing: [
		{
			by: "mira",
			text: "This channel cycles through typing states. Sit back and watch the composer.",
			gap: 0,
		},
	],
	mutations: [
		{
			by: "tomas",
			text: "Things in here get edited, deleted and reacted to on a loop.",
			gap: 0,
		},
		{
			by: "kris",
			text: "This one was hidden by a moderator. Long press it to unhide.",
			gap: 1,
			hidden: true,
		},
		{ by: "lou", text: "Edit me, delete me, react to me", gap: 2 },
		{ by: "lou", text: "Another one of mine to play with", gap: 1 },
		{
			by: "kris",
			text: "Long press any message for the actions drawer",
			gap: 3,
		},
		{ by: "priya", text: "Swipe one to reply if that setting is on", gap: 2 },
		{
			by: "lou",
			text: "Try sending a message with the word fail in it",
			gap: 1,
		},
	],
	"mod-room": [
		{
			by: "ana",
			text: "Heads up, we had a spam wave in general last night. All cleaned up.",
			gap: 0,
		},
		{
			by: "noor",
			text: "Thanks! Should we turn on approval for new members?",
			gap: 10,
		},
		{ by: "lou", text: "Let's watch it for a week first", gap: 30 },
		{
			by: "eli",
			text: rich(
				"Log export for reference ",
				mark("(internal only)", fx.subtext()),
			),
			gap: 200,
			files: [pdf("moderation-log-week-41.pdf", 98_220)],
		},
		{
			by: "ana",
			text: rich(
				"Reminder: we use ",
				mark("labels", fx.underline()),
				" before bans whenever we can",
			),
			gap: 300,
		},
	],
});
