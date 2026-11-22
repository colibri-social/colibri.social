export type EmojiSegment =
	| { kind: "text"; value: string }
	| { kind: "emoji"; value: string };

export const JUMBO_EMOJI_LIMIT = 27;
export const EMOJI_GLYPH_EM = 1.25;
export const EMOJI_FONT_FAMILY = "Colibri Emoji";

const JUMBO_SCAN_LIMIT = JUMBO_EMOJI_LIMIT * 40;
const ZWJ = String.fromCodePoint(0x200d);
const VARIATION_SELECTOR = new RegExp(String.fromCodePoint(0xfe0f), "g");
const EMOJI_GRAPHEME = new RegExp(
	`\\p{Emoji_Presentation}|\\p{Emoji_Modifier}|${String.fromCodePoint(0xfe0f)}|${String.fromCodePoint(0x20e3)}`,
	"u",
);
const PICTOGRAPHIC = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
const KEYCAP = new RegExp(
	`^[0-9#*]${String.fromCodePoint(0xfe0f)}?\\u20e3$`,
	"u",
);
const MAYBE_EMOJI = new RegExp(
	`[\\p{Extended_Pictographic}\\p{Regional_Indicator}${String.fromCodePoint(0x20e3)}]`,
	"u",
);

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

export const isEmojiGrapheme = (grapheme: string) =>
	KEYCAP.test(grapheme) ||
	(PICTOGRAPHIC.test(grapheme) && EMOJI_GRAPHEME.test(grapheme));

let segmenter: Intl.Segmenter | undefined;

export const graphemes = (text: string): string[] => {
	if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
		segmenter ??= new Intl.Segmenter(undefined, { granularity: "grapheme" });
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
	MAYBE_EMOJI.test(text) &&
	graphemes(text).some((grapheme) => isEmojiGrapheme(grapheme));

export const emojiOnlyCount = (text: string) => {
	if (text.length > JUMBO_SCAN_LIMIT || !MAYBE_EMOJI.test(text)) return 0;
	let count = 0;
	for (const grapheme of graphemes(text)) {
		if (isEmojiGrapheme(grapheme)) count += 1;
		else if (grapheme.trim().length > 0) return 0;
	}
	return count;
};

export const isJumboEmojiText = (text: string) => {
	const count = emojiOnlyCount(text);
	return count > 0 && count <= JUMBO_EMOJI_LIMIT;
};
