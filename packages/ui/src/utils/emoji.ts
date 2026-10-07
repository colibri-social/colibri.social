import { createSignal } from "solid-js";

export type EmojiAssetResolver = (
	codepoint: string,
	emoji: string,
) => string | undefined;

export type EmojiSegment =
	| { kind: "text"; value: string }
	| { kind: "emoji"; value: string };

export const JUMBO_EMOJI_LIMIT = 27;

const ZWJ = String.fromCodePoint(0x200d);
const VARIATION_SELECTOR = new RegExp(String.fromCodePoint(0xfe0f), "g");
const EMOJI_GRAPHEME = new RegExp(
	`\\p{Emoji_Presentation}|\\p{Emoji_Modifier}|${String.fromCodePoint(0xfe0f)}|${String.fromCodePoint(0x20e3)}`,
	"u",
);
const PICTOGRAPHIC = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

const [resolver, setResolver] = createSignal<EmojiAssetResolver | undefined>(
	undefined,
);

export const emojiAssetResolver = resolver;

export const setEmojiAssetResolver = (next: EmojiAssetResolver | null) => {
	setResolver(() => next ?? undefined);
};

export const twemojiAssetResolver =
	(base: string, size = "72x72", extension = ".png"): EmojiAssetResolver =>
	(codepoint) =>
		`${base.endsWith("/") ? base : `${base}/`}${size}/${codepoint}${extension}`;

export const toEmojiCodepoint = (emoji: string) => {
	const value = emoji.includes(ZWJ)
		? emoji
		: emoji.replace(VARIATION_SELECTOR, "");
	const points: string[] = [];
	for (const character of value) {
		const point = character.codePointAt(0);
		if (point !== undefined) points.push(point.toString(16));
	}
	return points.join("-");
};

export const emojiImageSrc = (emoji: string) =>
	resolver()?.(toEmojiCodepoint(emoji), emoji);

export const isEmojiGrapheme = (grapheme: string) =>
	PICTOGRAPHIC.test(grapheme) && EMOJI_GRAPHEME.test(grapheme);

const graphemes = (text: string): string[] => {
	if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
		const segmenter = new Intl.Segmenter(undefined, {
			granularity: "grapheme",
		});
		return Array.from(segmenter.segment(text), (part) => part.segment);
	}
	return Array.from(text);
};

export const splitEmojiSegments = (text: string): EmojiSegment[] => {
	const segments: EmojiSegment[] = [];
	let buffer = "";
	for (const grapheme of graphemes(text)) {
		if (isEmojiGrapheme(grapheme)) {
			if (buffer) segments.push({ kind: "text", value: buffer });
			buffer = "";
			segments.push({ kind: "emoji", value: grapheme });
		} else {
			buffer += grapheme;
		}
	}
	if (buffer) segments.push({ kind: "text", value: buffer });
	return segments;
};

export const hasEmoji = (text: string) =>
	splitEmojiSegments(text).some((segment) => segment.kind === "emoji");

export const emojiOnlyCount = (text: string) => {
	let count = 0;
	for (const segment of splitEmojiSegments(text)) {
		if (segment.kind === "emoji") count += 1;
		else if (segment.value.trim().length > 0) return 0;
	}
	return count;
};

export const isJumboEmojiText = (text: string) => {
	const count = emojiOnlyCount(text);
	return count > 0 && count <= JUMBO_EMOJI_LIMIT;
};
