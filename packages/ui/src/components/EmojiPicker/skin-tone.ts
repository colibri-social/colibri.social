export type SkinTone = 0 | 1 | 2 | 3 | 4 | 5;

export const SKIN_TONES: readonly SkinTone[] = [0, 1, 2, 3, 4, 5];

export const skinToneLabels: Record<SkinTone, string> = {
	0: "Default",
	1: "Light",
	2: "Medium light",
	3: "Medium",
	4: "Medium dark",
	5: "Dark",
};

const MODIFIER_FIRST = 0x1f3fb;
const MODIFIER_LAST = 0x1f3ff;
const VARIATION_SELECTOR = 0xfe0f;
const MODIFIER_BASE = /\p{Emoji_Modifier_Base}/u;
const ZERO_WIDTH_JOINER = "\u200d";
const HANDSHAKE = String.fromCodePoint(0x1f91d);

const isModifier = (point: number) =>
	point >= MODIFIER_FIRST && point <= MODIFIER_LAST;

export const stripSkinTone = (emoji: string) => {
	let result = "";
	for (const character of emoji) {
		const point = character.codePointAt(0) ?? 0;
		if (!isModifier(point)) result += character;
	}
	return result;
};

export const applySkinTone = (emoji: string, tone: SkinTone) => {
	if (tone === 0) return emoji;
	const modifier = String.fromCodePoint(MODIFIER_FIRST + tone - 1);
	const characters = Array.from(stripSkinTone(emoji));
	let result = "";
	for (let index = 0; index < characters.length; index++) {
		const character = characters[index];
		result += character;
		if (!MODIFIER_BASE.test(character)) continue;
		if (character === HANDSHAKE && characters[index - 1] === ZERO_WIDTH_JOINER)
			continue;
		result += modifier;
		if (characters[index + 1]?.codePointAt(0) === VARIATION_SELECTOR) index++;
	}
	return result;
};

export const SKIN_TONE_SAMPLE = String.fromCodePoint(0x270b);
