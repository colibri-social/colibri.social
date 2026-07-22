import twemoji from "@twemoji/api";
import emojiData from "unicode-emoji-json/data-by-emoji.json";

export const EMOJI_IMG_CLASS = "emoji";

// packages/assets/files/twemoji.woff2 is mrdrogdrog/twemoji-color-font v15.0.3,
// which tracks Unicode Emoji 15.0 — anything newer must use the image fallback.
const FONT_MAX_UNICODE_VERSION = 15.0;

// Populate with specific emoji found (via manual QA) to render as split
// glyphs through the bundled font despite being <= FONT_MAX_UNICODE_VERSION.
const FONT_UNSUPPORTED_OVERRIDES = new Set<string>([]);

type EmojiEntry = { unicode_version: string };
const EMOJI_DATA = emojiData as Record<string, EmojiEntry>;

function getUnicodeVersion(emoji: string): number {
	const entry = EMOJI_DATA[emoji];
	return entry
		? Number.parseFloat(entry.unicode_version)
		: Number.POSITIVE_INFINITY;
}

export function isFontRenderable(emoji: string): boolean {
	return (
		getUnicodeVersion(emoji) <= FONT_MAX_UNICODE_VERSION &&
		!FONT_UNSUPPORTED_OVERRIDES.has(emoji)
	);
}

function toEmojiCodepoint(rawEmoji: string): string {
	const hasZwj = rawEmoji.includes("\u200D");
	const stripped = hasZwj ? rawEmoji : rawEmoji.replace(/\uFE0F/g, "");
	return twemoji.convert.toCodePoint(stripped);
}

// Mirrors twemoji's own default image-src generator so JSX call sites (the
// emoji picker) render from the same pinned asset source as parseEmojiText
// below, instead of a separately hardcoded CDN URL.
export function twemojiImageSrc(rawEmoji: string): string {
	return `${twemoji.base}${twemoji.size}/${toEmojiCodepoint(rawEmoji)}${twemoji.ext}`;
}

// Single entry point for converting arbitrary text into emoji-rendered HTML —
// do not call @twemoji/api directly anywhere else. Inline emoji always render
// as images (uniform box across browsers); the color font is used only by the
// picker grid via isFontRenderable/twemojiImageSrc.
export function parseEmojiText(text: string): string {
	return twemoji.parse(text, {
		className: EMOJI_IMG_CLASS,
		attributes: () => ({ loading: "lazy", decoding: "async" }),
	});
}

export function hasEmoji(text: string): boolean {
	return twemoji.test(text);
}

export function emojiOnlyCount(text: string): number {
	let count = 0;
	const withoutEmoji = twemoji.replace(text, () => {
		count += 1;
		return "";
	});
	return count > 0 && withoutEmoji.trim().length === 0 ? count : 0;
}
