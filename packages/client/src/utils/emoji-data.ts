import type { EmojiItem } from "@tiptap/extension-emoji";
import byEmoji from "unicode-emoji-json/data-by-emoji.json";
import emojiComponents from "unicode-emoji-json/data-emoji-components.json";

export type EmojiMeta = {
	name: string;
	slug: string;
	group: string;
	emoji_version: string;
	unicode_version: string;
	skin_tone_support: boolean;
};

const EMOJI_BY_CHAR = byEmoji as Record<string, EmojiMeta>;

export const EMOJI_COMPONENTS = emojiComponents as Record<string, string>;

export const EMOJI_ALIASES: Record<string, string> = {
	"+1": "thumbs_up",
	"-1": "thumbs_down",
	thumbsup: "thumbs_up",
	thumbsdown: "thumbs_down",
	tada: "party_popper",
	joy: "face_with_tears_of_joy",
	rofl: "rolling_on_the_floor_laughing",
	sob: "loudly_crying_face",
	heart: "red_heart",
	"100": "hundred_points",
	smile: "grinning_face_with_smiling_eyes",
	smiley: "grinning_face_with_big_eyes",
	grin: "beaming_face_with_smiling_eyes",
	wink: "winking_face",
	heart_eyes: "smiling_face_with_heart_eyes",
	sunglasses: "smiling_face_with_sunglasses",
	thinking: "thinking_face",
	pray: "folded_hands",
	clap: "clapping_hands",
	wave: "waving_hand",
	muscle: "flexed_biceps",
	poop: "pile_of_poo",
	shit: "pile_of_poo",
	cry: "crying_face",
	laughing: "grinning_squinting_face",
	blush: "smiling_face_with_smiling_eyes",
	stuck_out_tongue: "face_with_tongue",
	confused: "confused_face",
	smirk: "smirking_face",
	flushed: "flushed_face",
	scream: "face_screaming_in_fear",
	disappointed: "disappointed_face",
	angry: "angry_face",
	rage: "enraged_face",
	sweat_smile: "grinning_face_with_sweat",
	sleeping: "sleeping_face",
	raised_hands: "raising_hands",
	point_up: "index_pointing_up",
	v: "victory_hand",
	white_check_mark: "check_mark_button",
	check: "check_mark_button",
	x: "cross_mark",
	question: "red_question_mark",
	exclamation: "red_exclamation_mark",
	boom: "collision",
};

const EMOJI_BY_SLUG = new Map<string, string>();
const ALIASES_BY_SLUG = new Map<string, string[]>();

for (const [char, meta] of Object.entries(EMOJI_BY_CHAR)) {
	EMOJI_BY_SLUG.set(meta.slug, char);
}
for (const [alias, slug] of Object.entries(EMOJI_ALIASES)) {
	const list = ALIASES_BY_SLUG.get(slug) ?? [];
	list.push(alias);
	ALIASES_BY_SLUG.set(slug, list);
}

export function aliasesForSlug(slug: string): string[] {
	return ALIASES_BY_SLUG.get(slug) ?? [];
}

type PickerEmoji = EmojiMeta & { emoji: string };
type PickerGroup = { name: string; slug: string; emojis: PickerEmoji[] };

export const EMOJI_DATA_RECORD: Record<string, PickerEmoji> =
	Object.fromEntries(
		Object.entries(EMOJI_BY_CHAR).map(([char, meta]) => [
			char,
			{ emoji: char, ...meta },
		]),
	);

export function slugForEmoji(char: string): string | undefined {
	const direct = EMOJI_DATA_RECORD[char];
	if (direct) return direct.slug;
	const toggled = char.endsWith("\uFE0F") ? char.slice(0, -1) : `${char}\uFE0F`;
	return EMOJI_DATA_RECORD[toggled]?.slug;
}

export const EMOJI_GROUPS: PickerGroup[] = (() => {
	const groups = new Map<string, PickerGroup>();
	const order: string[] = [];
	for (const [char, meta] of Object.entries(EMOJI_BY_CHAR)) {
		let group = groups.get(meta.group);
		if (!group) {
			group = {
				name: meta.group,
				slug: meta.group.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
				emojis: [],
			};
			groups.set(meta.group, group);
			order.push(meta.group);
		}
		group.emojis.push({ emoji: char, ...meta });
	}
	return order.map((name) => groups.get(name) as PickerGroup);
})();

export type EmojiSuggestion = { name: string; emoji: string };

export const EMOJI_SUGGESTIONS: EmojiSuggestion[] = [
	...Object.entries(EMOJI_BY_CHAR).map(([char, meta]) => ({
		name: meta.slug,
		emoji: char,
	})),
	...Object.entries(EMOJI_ALIASES).flatMap(([alias, slug]) => {
		const char = EMOJI_BY_SLUG.get(slug);
		return char ? [{ name: alias, emoji: char }] : [];
	}),
];

export const TIPTAP_EMOJIS: EmojiItem[] = Object.entries(EMOJI_BY_CHAR).map(
	([char, meta]) => ({
		emoji: char,
		name: meta.slug,
		shortcodes: [meta.slug, ...(ALIASES_BY_SLUG.get(meta.slug) ?? [])],
		tags: meta.name.split(/\s+/),
		group: meta.group,
		emoticons: [],
		version: Number.parseFloat(meta.unicode_version) || 0,
	}),
);
