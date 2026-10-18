import type { EmojiPackCardEmoji, EmojiPackCardPack } from "./EmojiPackCard";
import { emojiPackShareUrl } from "./emoji-pack-link";

const FILLS = [
	"#9c66ff",
	"#2dd4bf",
	"#fbbf24",
	"#f472b6",
	"#60a5fa",
	"#a3e635",
	"#fb7185",
	"#c4b5fd",
	"#fdba74",
	"#5eead4",
];

const FACES = [
	"^_^",
	"o_o",
	">_<",
	"-_-",
	"T_T",
	"owo",
	"uwu",
	":3",
	"xD",
	";)",
];

const WORDS = [
	"party",
	"blob",
	"cat",
	"hype",
	"wave",
	"sleepy",
	"cool",
	"thonk",
	"yay",
	"bonk",
	"pat",
	"cry",
	"heart",
	"shrug",
	"zoom",
];

const glyph = (fill: string, face: string) =>
	`data:image/svg+xml,${encodeURIComponent(
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" fill="${fill}"/><text x="24" y="29" font-size="13" text-anchor="middle" font-family="sans-serif" font-weight="700" fill="#111">${face}</text></svg>`,
	)}`;

export const fixtureEmoji = (index: number): EmojiPackCardEmoji => ({
	id: `at://did:plc:lou/social.colibri.emoji/${index}`,
	name: `${WORDS[index % WORDS.length]}_${Math.floor(index / WORDS.length) + 1}`,
	src: glyph(
		FILLS[index % FILLS.length] as string,
		FACES[(index * 3) % FACES.length] as string,
	),
});

export const fixtureEmojis = (count: number) =>
	Array.from({ length: count }, (_, index) => fixtureEmoji(index));

export const LOU = {
	did: "did:plc:lou4colibri",
	name: "Lou",
	handle: "lou.gg",
};

export const LONG_OWNER = {
	did: "did:plc:longownername",
	name: "Someone with a remarkably long display name",
	handle: "someone.with.a.really.long.handle.example.social",
};

export const bigPack: EmojiPackCardPack = {
	name: "Night owls",
	description:
		"Hand drawn reactions from the late night sketching sessions. Free to use anywhere.",
	owner: LOU,
	emojis: fixtureEmojis(150),
};

export const smallPack: EmojiPackCardPack = {
	name: "Tiny trio",
	owner: LOU,
	emojis: fixtureEmojis(3),
};

export const longPack: EmojiPackCardPack = {
	name: "Pixelart by Lis and friends from the late night sketching sessions",
	owner: LONG_OWNER,
	emojis: fixtureEmojis(48),
};

export const packUrl = emojiPackShareUrl({ did: LOU.did, rkey: "3kpackowls" });
