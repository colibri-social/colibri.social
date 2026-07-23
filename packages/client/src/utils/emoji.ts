import { isTauri } from "@tauri-apps/api/core";
import { platform } from "@tauri-apps/plugin-os";
import twemoji from "@twemoji/api";

export const EMOJI_IMG_CLASS = "emoji";

function emojiAssetBase(): string {
	const bundled =
		isTauri() &&
		(location.protocol === "tauri:" || location.hostname === "tauri.localhost");
	if (!bundled) return "/twemoji/";
	const os = platform();
	if (os === "android") return "/twemoji/";
	if (os === "windows") return "http://emoji.localhost/";
	return "emoji://localhost/";
}

twemoji.base = emojiAssetBase();

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
// do not call @twemoji/api directly anywhere else. Every emoji renders as an
// image (uniform box across browsers, correct ZWJ sequence composition), the
// same pipeline the picker uses via twemojiImageSrc.
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
