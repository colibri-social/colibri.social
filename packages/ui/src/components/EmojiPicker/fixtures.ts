import type { EmojiUsage } from "../../utils/emoji-usage";
import type { EmojiPack } from "./EmojiPicker";

const glyph = (fill: string, text: string) =>
	`data:image/svg+xml,${encodeURIComponent(
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect x="2" y="2" width="28" height="28" rx="8" fill="${fill}"/><text x="16" y="21" font-family="sans-serif" font-size="13" font-weight="700" text-anchor="middle" fill="#fff">${text}</text></svg>`,
	)}`;

export const fixturePacks: EmojiPack[] = [
	{
		id: "pixelart",
		name: "Pixelart by Lis",
		author: "timtinkers.online",
		emojis: [
			{ id: "tux", name: "tux", src: glyph("#334155", "TX") },
			{ id: "opsec", name: "opsec", src: glyph("#b45309", "OP") },
			{ id: "colibri", name: "colibri", src: glyph("#8e51ff", "CO") },
			{ id: "ship", name: "shipit", src: glyph("#0f766e", "SH") },
		],
	},
	{
		id: "ungrouped",
		name: "Ungrouped",
		emojis: [
			{ id: "blob", name: "blobwave", src: glyph("#db2777", "BW") },
			{ id: "broken", name: "broken_image", src: "data:image/png;base64,AAAA" },
		],
	},
];

export const fixtureUsage = (): Record<string, EmojiUsage> => {
	const now = Date.now();
	return {
		"🔥": { count: 12, lastUsed: now },
		"👍🏽": { count: 9, lastUsed: now - 1000 },
		"🫡": { count: 4, lastUsed: now - 2000 },
		"❤️": { count: 3, lastUsed: now - 3000 },
	};
};
