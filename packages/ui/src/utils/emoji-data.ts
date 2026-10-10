import type { EmojiItem } from "@tiptap/extension-emoji";
import keywordData from "emojilib";
import MiniSearch from "minisearch";
import byEmoji from "unicode-emoji-json/data-by-emoji.json";
import type { EmojiUsage } from "./emoji-usage";
import { foldText } from "./fold-text";

export type EmojiMeta = {
	name: string;
	slug: string;
	group: string;
	emoji_version: string;
	unicode_version: string;
	skin_tone_support: boolean;
};

const EMOJI_BY_CHAR = byEmoji as Record<string, EmojiMeta>;

const MANUAL_ALIASES: Record<string, string> = {
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
	salute: "saluting_face",
	shrug: "person_shrugging",
	facepalm: "person_facepalming",
	upside_down: "upside_down_face",
	slight_smile: "slightly_smiling_face",
	melting: "melting_face",
	anger: "anger_symbol",
	apple: "red_apple",
	arrow_down: "down_arrow",
	arrow_left: "left_arrow",
	arrow_right: "right_arrow",
	arrow_up: "up_arrow",
	art: "artist_palette",
	bangbang: "double_exclamation_mark",
	bee: "honeybee",
	beer: "beer_mug",
	beers: "clinking_beer_mugs",
	birthday: "birthday_cake",
	bow: "person_bowing",
	bulb: "light_bulb",
	cake: "shortcake",
	car: "automobile",
	cat2: "cat",
	cd: "optical_disk",
	clapper: "clapper_board",
	clown: "clown_face",
	coffee: "hot_beverage",
	cold_sweat: "anxious_face_with_sweat",
	computer: "laptop",
	cool: "cool_button",
	cowboy: "cowboy_hat_face",
	dancer: "woman_dancing",
	email: "envelope",
	fax: "fax_machine",
	fearful: "fearful_face",
	fist: "raised_fist",
	football: "american_football",
	fries: "french_fries",
	gem: "gem_stone",
	gift: "wrapped_gift",
	grinning: "grinning_face",
	gun: "water_pistol",
	hear_no_evil: "hear_no_evil_monkey",
	heavy_check_mark: "check_mark",
	heavy_minus_sign: "minus",
	heavy_plus_sign: "plus",
	hourglass: "hourglass_done",
	hugs: "smiling_face_with_open_hands",
	information_desk_person: "person_tipping_hand",
	innocent: "smiling_face_with_halo",
	interrobang: "exclamation_question_mark",
	iphone: "mobile_phone",
	kissing_heart: "face_blowing_a_kiss",
	knife: "kitchen_knife",
	lips: "mouth",
	lock: "locked",
	mag: "magnifying_glass_tilted_left",
	mask: "face_with_medical_mask",
	mega: "megaphone",
	money_mouth: "money_mouth_face",
	moneybag: "money_bag",
	moyai: "moai",
	nerd: "nerd_face",
	no_bell: "bell_with_slash",
	no_entry_sign: "prohibited",
	notes: "musical_notes",
	ocean: "water_wave",
	ok_woman: "woman_gesturing_ok",
	open_mouth: "face_with_open_mouth",
	partying: "partying_face",
	pensive: "pensive_face",
	persevere: "persevering_face",
	pleading: "pleading_face",
	point_down: "backhand_index_pointing_down",
	point_left: "backhand_index_pointing_left",
	point_right: "backhand_index_pointing_right",
	punch: "oncoming_fist",
	recycle: "recycling_symbol",
	relieved: "relieved_face",
	see_no_evil: "see_no_evil_monkey",
	skull_crossbones: "skull_and_crossbones",
	sleepy: "sleepy_face",
	smoking: "cigarette",
	soccer: "soccer_ball",
	speak_no_evil: "speak_no_evil_monkey",
	speech_left: "left_speech_bubble",
	star2: "glowing_star",
	stuck_out_tongue_winking_eye: "winking_face_with_tongue",
	sunglasses2: "sunglasses",
	sunny: "sun",
	sweat: "downcast_face_with_sweat",
	sweat_drops: "sweat_droplets",
	tea: "teacup_without_handle",
	triumph: "face_with_steam_from_nose",
	tv: "television",
	unlock: "unlocked",
	weary: "weary_face",
	woozy: "woozy_face",
	worried: "worried_face",
	yawn: "yawning_face",
	yum: "face_savoring_food",
	zap: "high_voltage",
	zipper_mouth: "zipper_mouth_face",
};

const REGIONAL_INDICATOR_A = 0x1f1e6;
const REGIONAL_INDICATOR_Z = 0x1f1ff;

const countryCodeFor = (char: string): string | undefined => {
	const points = [...char].map((part) => part.codePointAt(0) ?? 0);
	if (points.length !== 2) return undefined;
	if (
		points.some(
			(point) => point < REGIONAL_INDICATOR_A || point > REGIONAL_INDICATOR_Z,
		)
	) {
		return undefined;
	}
	return points
		.map((point) => String.fromCharCode(97 + point - REGIONAL_INDICATOR_A))
		.join("");
};

const buildAliases = (): Record<string, string> => {
	const slugs = new Set<string>();
	for (const meta of Object.values(EMOJI_BY_CHAR)) slugs.add(meta.slug);

	const aliases: Record<string, string> = {};
	for (const [alias, slug] of Object.entries(MANUAL_ALIASES)) {
		if (slugs.has(alias)) continue;
		if (!slugs.has(slug)) continue;
		aliases[alias] = slug;
	}
	for (const [char, meta] of Object.entries(EMOJI_BY_CHAR)) {
		const code = countryCodeFor(char);
		if (!code) continue;
		const alias = `flag_${code}`;
		if (slugs.has(alias) || aliases[alias] !== undefined) continue;
		aliases[alias] = meta.slug;
	}
	return aliases;
};

export const EMOJI_ALIASES: Record<string, string> = buildAliases();

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

export type PickerEmoji = EmojiMeta & { emoji: string };
export type PickerGroup = { name: string; slug: string; emojis: PickerEmoji[] };

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

function keywordsFor(char: string): string[] {
	const direct = keywordData[char];
	if (direct) return direct;
	const toggled = char.endsWith("\uFE0F") ? char.slice(0, -1) : `${char}\uFE0F`;
	return keywordData[toggled] ?? [];
}

export function keywordsForEmoji(char: string): string[] {
	return keywordsFor(char).map((keyword) => keyword.toLowerCase());
}

const TOKEN_SPLIT = /[^a-z0-9+]+/;

const tokenize = (value: string): string[] =>
	foldText(value).split(TOKEN_SPLIT).filter(Boolean);

const TIER_SHORTCODE_EXACT = 0;
const TIER_SHORTCODE_PREFIX = 1;
const TIER_WORD_PREFIX = 2;
const TIER_KEYWORD_EXACT = 3;
const TIER_KEYWORD_WORD_PREFIX = 4;
const TIER_SHORTCODE_SUBSTRING = 5;
const TIER_KEYWORD_SUBSTRING = 6;
const NO_MATCH = 7;

type EmojiSearchEntry = {
	emoji: string;
	slug: string;
	shortcodes: string[];
	words: string[];
	keywords: string[];
	keywordWords: string[];
};

const EMOJI_SEARCH_INDEX: EmojiSearchEntry[] = Object.entries(
	EMOJI_BY_CHAR,
).map(([char, meta]) => {
	const shortcodes = [meta.slug, ...(ALIASES_BY_SLUG.get(meta.slug) ?? [])].map(
		foldText,
	);
	const keywords = keywordsForEmoji(char)
		.map(foldText)
		.filter((keyword) => keyword !== meta.slug);

	const words = new Set<string>();
	for (const shortcode of shortcodes) {
		for (const word of tokenize(shortcode)) words.add(word);
	}
	for (const word of tokenize(meta.name)) words.add(word);

	const keywordWords = new Set<string>();
	for (const keyword of keywords) {
		for (const word of tokenize(keyword)) keywordWords.add(word);
	}

	return {
		emoji: char,
		slug: meta.slug,
		shortcodes,
		words: [...words],
		keywords,
		keywordWords: [...keywordWords],
	};
});

function tierForToken(entry: EmojiSearchEntry, token: string): number {
	let best = NO_MATCH;
	for (const shortcode of entry.shortcodes) {
		if (shortcode === token) return TIER_SHORTCODE_EXACT;
		if (shortcode.startsWith(token)) best = TIER_SHORTCODE_PREFIX;
	}
	if (best <= TIER_SHORTCODE_PREFIX) return best;

	for (const word of entry.words) {
		if (word.startsWith(token)) return TIER_WORD_PREFIX;
	}
	for (const keyword of entry.keywords) {
		if (keyword === token) return TIER_KEYWORD_EXACT;
	}
	for (const word of entry.keywordWords) {
		if (word.startsWith(token)) return TIER_KEYWORD_WORD_PREFIX;
	}
	for (const shortcode of entry.shortcodes) {
		if (shortcode.includes(token)) return TIER_SHORTCODE_SUBSTRING;
	}
	for (const keyword of entry.keywords) {
		if (keyword.includes(token)) return TIER_KEYWORD_SUBSTRING;
	}
	return NO_MATCH;
}

function scoreEntry(
	entry: EmojiSearchEntry,
	tokens: string[],
	joined: string,
): number {
	let best = NO_MATCH;
	for (const shortcode of entry.shortcodes) {
		if (shortcode === joined) return TIER_SHORTCODE_EXACT;
		if (shortcode.startsWith(joined)) {
			best = Math.min(best, TIER_SHORTCODE_PREFIX);
		} else if (shortcode.includes(joined)) {
			best = Math.min(best, TIER_SHORTCODE_SUBSTRING);
		}
	}

	let worst = TIER_SHORTCODE_EXACT;
	for (const token of tokens) {
		const tier = tierForToken(entry, token);
		if (tier === NO_MATCH) {
			worst = NO_MATCH;
			break;
		}
		if (tier > worst) worst = tier;
	}

	return Math.min(best, worst);
}

function labelFor(entry: EmojiSearchEntry, joined: string): string {
	for (const shortcode of entry.shortcodes) {
		if (shortcode === joined) return shortcode;
	}
	return entry.slug;
}

const MIN_FUZZY_LENGTH = 4;

type FuzzyDocument = {
	id: number;
	shortcode: string;
	name: string;
};

let fuzzyIndex: MiniSearch<FuzzyDocument> | undefined;

function getFuzzyIndex(): MiniSearch<FuzzyDocument> {
	if (fuzzyIndex) return fuzzyIndex;

	const index = new MiniSearch<FuzzyDocument>({
		idField: "id",
		fields: ["shortcode", "name"],
		storeFields: [],
		processTerm: (term) => foldText(term) || null,
	});

	index.addAll(
		EMOJI_SEARCH_INDEX.map((entry, id) => ({
			id,
			shortcode: entry.shortcodes.join(" ").replaceAll("_", " "),
			name: entry.words.join(" "),
		})),
	);

	fuzzyIndex = index;
	return index;
}

function fuzzyMatches(query: string, limit: number): number[] {
	if (query.length < MIN_FUZZY_LENGTH) return [];

	return getFuzzyIndex()
		.search(query, {
			prefix: true,
			fuzzy: 0.3,
			maxFuzzy: 2,
			boost: { shortcode: 3, name: 2 },
			weights: { prefix: 0.9, fuzzy: 0.4 },
		})
		.slice(0, limit)
		.map((result) => Number(result.id));
}

export function searchEmojis(
	query: string,
	limit = 10,
	usage?: Record<string, EmojiUsage>,
): EmojiSuggestion[] {
	if (limit <= 0) return [];

	const tokens = tokenize(query);
	if (tokens.length === 0) return [];
	const joined = tokens.join("_");

	const scored: {
		score: number;
		used: number;
		length: number;
		index: number;
		item: EmojiSuggestion;
	}[] = [];

	for (let i = 0; i < EMOJI_SEARCH_INDEX.length; i++) {
		const entry = EMOJI_SEARCH_INDEX[i];
		const score = scoreEntry(entry, tokens, joined);
		if (score === NO_MATCH) continue;

		const label = labelFor(entry, joined);
		scored.push({
			score,
			used: -(usage?.[entry.emoji]?.count ?? 0),
			length: label.length,
			index: i,
			item: { name: label, emoji: entry.emoji },
		});
	}

	const results = scored
		.sort(
			(a, b) =>
				a.score - b.score ||
				a.used - b.used ||
				a.length - b.length ||
				a.index - b.index,
		)
		.slice(0, limit)
		.map((entry) => entry.item);

	if (results.length >= limit) return results;

	const seen = new Set(results.map((result) => result.emoji));
	for (const index of fuzzyMatches(joined, limit)) {
		if (results.length >= limit) break;
		const entry = EMOJI_SEARCH_INDEX[index];
		if (seen.has(entry.emoji)) continue;
		seen.add(entry.emoji);
		results.push({ name: entry.slug, emoji: entry.emoji });
	}

	return results;
}

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
