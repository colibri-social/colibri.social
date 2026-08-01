import type { ActorData } from "@colibri-social/lib";
import { parseEmojiText } from "../../utils/emoji";

export type Speaker = {
	actor: ActorData;
	avatar: string;
	color: string;
};

export type MessageParent = {
	speaker: Speaker;
	text: string;
};

export type ScriptedMessage = {
	id: string;
	speaker: Speaker;
	text: string;
	html: string;
	parent?: MessageParent;
	createdAt: string;
	reactions: Array<{ emoji: string; count: number }>;
};

const CAST: Array<{ name: string; handle: string; color: string }> = [
	{ name: "Lou", handle: "lou.colibri.social", color: "#8b5cf6" },
	{ name: "Reuben", handle: "reuben.bsky.social", color: "#0ea5e9" },
	{ name: "Matthew", handle: "matthew.bsky.social", color: "#10b981" },
	{ name: "Felix", handle: "felix.bsky.social", color: "#f59e0b" },
	{ name: "Jose", handle: "jose.colibri.social", color: "#ef4444" },
	{ name: "Roman", handle: "roman.bsky.social", color: "#14b8a6" },
	{ name: "You", handle: "you.bsky.social", color: "#a855f7" },
	{ name: "Kira", handle: "kira.colibri.social", color: "#ec4899" },
];

const avatarFor = (color: string): string => {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" rx="40" fill="${color}"/></svg>`;
	return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

export const SPEAKERS: Array<Speaker> = CAST.map((member) => ({
	color: member.color,
	avatar: avatarFor(member.color),
	actor: {
		did: `did:plc:showcase-${member.handle}`,
		handle: member.handle,
		data: {
			displayName: member.name,
			isBot: false,
			onlineState: "online",
		},
	} as ActorData,
}));

type Turn = { role: number; text: string; reply?: boolean };

const EXCHANGES: Array<Array<Turn>> = [
	[
		{ role: 0, text: "there is a hummingbird at the feeder again" },
		{ role: 1, text: "Same one as yesterday?" },
		{
			role: 0,
			text: "I think so, it has a bent tail feather so it is easy to spot",
		},
		{ role: 1, text: "You have a regular then, they remember good feeders." },
	],
	[
		{
			role: 0,
			text: "The owl was calling again, around three in the morning this time...",
		},
		{ role: 1, text: "tawny or barn?" },
		{
			role: 0,
			text: "Tawny, the long wobbly one, not the screech. Still woke me up.",
		},
		{ role: 2, text: "that is my favourite sound in the world, honestly" },
	],
	[
		{ role: 0, text: "How often should I be changing the sugar water?" },
		{ role: 1, text: "Every two days in this heat, otherwise it ferments." },
		{ role: 0, text: "That explains a lot, thank you!" },
	],
	[
		{ role: 0, text: "first swallows are back over the field 👀" },
		{ role: 1, text: "Oh, that is a week earlier than last year." },
		{ role: 2, text: "Mine turned up on saturday, same nest under the eaves." },
		{ role: 2, text: "Glad to have her back 😁" },
	],
	[
		{
			role: 0,
			text: "Anyone know what has been stripping the sunflower heads???",
		},
		{ role: 1, text: "Goldfinches, almost certainly" },
		{ role: 0, text: "Should i be stopping them?" },
		{
			role: 1,
			text: "No, leave the heads up over winter, they are better than any feeder!",
		},
	],
	[
		{ role: 0, text: "Guys! I saw a kingfisher on the canal this morning!" },
		{ role: 1, text: "No way, on the stretch by the bridge?" },
		{ role: 0, text: "Just past it, sat on the rail for a good minute :)" },
		{
			role: 1,
			text: "I have walked that path for years and never once have I seen one. Lucky you!",
		},
	],
	[
		{ role: 0, text: "The crows have started following me on my run now" },
		{ role: 1, text: "Did you feed them once?" },
		{
			role: 0,
			text: "I may have shared a sandwich in feb, now that I think about it.",
		},
		{ role: 1, text: "Then that is your life now, they do not forget faces." },
		{ role: 2, text: "Crow whisperer." },
	],
	[
		{
			role: 0,
			text: "{@1} planted the hedge with hawthorn and dogwood like you said!",
		},
		{
			role: 1,
			text: "give it two winters and it will be full of nests",
			reply: true,
		},
		{ role: 0, text: "That is the plan, the garden was far too tidy." },
	],
	[
		{ role: 0, text: "What is the tiny brown one that never sits still again" },
		{
			role: 1,
			text: "Wren, probably, does it sound far too loud for its size?",
		},
		{ role: 0, text: "Deafening, absolutely" },
		{ role: 1, text: "Wren 🙂" },
		{ role: 2, text: "Wren!" },
		{ role: 3, text: "Wren?" },
		{ role: 4, text: "Wren." },
		{ role: 5, text: "Gang..." },
	],
	[
		{ role: 0, text: "Heron on the roof of the bus stop again" },
		{ role: 1, text: "He has completely given up on the river." },
		{ role: 2, text: "Why fish when the chip shop is right there?" },
	],
	[
		{ role: 0, text: "Moth trap was worth it, forty species in one night!" },
		{ role: 1, text: "Any hawk moths?" },
		{ role: 0, text: "Two elephant hawk moths, they are absurdly pink." },
		{ role: 1, text: "They really do look invented. Willy Wonka's Moths" },
	],
	[
		{
			role: 0,
			text: "The nest box camera is up, nothing has moved in yet tho",
		},
		{ role: 0, text: "so i just sit" },
		{ role: 0, text: "and watch an empty box" },
		{ role: 1, text: "that is the hobby, yes" },
	],
	[
		{ role: 0, text: "Frost this morning and the feeders were mobbed" },
		{
			role: 1,
			text: "Put out fat balls if you have them, they need the calories",
			reply: true,
		},
		{ role: 0, text: "on it 🫡" },
	],
	[
		{ role: 0, text: "Geese went over about an hour ago, proper skein" },
		{ role: 1, text: "Which way?" },
		{ role: 0, text: "South west, low enough that you could hear the wings." },
		{ role: 2, text: "That sound gets me every autumn.", reply: true },
	],
	[
		{ role: 0, text: "Does anyone else keep a list, or is that just me?" },
		{ role: 1, text: "Spreadsheet. Three tabs. Do not judge me." },
		{
			role: 0,
			text: "I feel much better about my notebook now 😂",
			reply: true,
		},
		{ role: 2, text: "{@1} three!?" },
		{ role: 1, text: "One of them is just gulls 🤫" },
	],
	[
		{ role: 0, text: "The woodpecker is on the metal gutter again" },
		{ role: 1, text: "He has found the loudest thing in the garden." },
		{ role: 0, text: "And he is very pleased with himself about it." },
	],
	[
		{ role: 0, text: "We left a corner of the lawn unmown all summer." },
		{ role: 1, text: "And?" },
		{
			role: 0,
			text: "Grasshoppers, two kinds of bee, and a hedgehog in September.",
		},
		{ role: 1, text: "Least work for the most life, every time.", reply: true },
		{ role: 2, text: "{@0} doing that next year, thanks for the push" },
	],
	[
		{ role: 0, text: "A robin came into the shed while I was sweeping" },
		{ role: 1, text: "They follow anything that turns over soil." },
		{ role: 0, text: "It sat on the handle waiting for me to keep going." },
		{ role: 1, text: "You work for him now 💜", reply: true },
	],
];

const FILLER_CORPUS = [
	"the light through the trees this morning was unreal",
	"someone is singing from the top of the ash tree again",
	"quiet out there today, barely a sparrow",
	"the feeder needs topping up before the weekend",
	"long tailed tits came through in a whole gang",
	"one blackbird has decided my chimney is a stage",
	"a buzzard has been circling the field all afternoon",
	"i keep missing the woodpecker by about ten seconds",
	"the pond is full of tadpoles again",
	"swifts are screaming over the rooftops",
	"fox cubs on the lawn at dusk yesterday",
	"the hedge is absolutely full of sparrows",
	"first frost on the grass this morning",
	"nothing at the feeder all day and then twenty at once",
	"a wagtail has been walking the car park like it owns it",
	"the reeds are full of something i cannot identify",
	"heard the owl again, further off this time",
	"bees all over the lavender in the afternoon sun",
	"put the fat balls out before the cold snap",
	"a jay took the whole handful of peanuts in one go",
];

const REACTION_POOL = ["💜", "🙌", "👀", "🕊️", "😂", "🔥"];

const pick = <T>(items: Array<T>): T =>
	items[Math.floor(Math.random() * items.length)];

type Chain = Map<string, Array<string>>;

const START = "";
const END = "";
const HARD_WORD_CAP = 24;

const buildChain = (): Chain => {
	const chain: Chain = new Map();

	const add = (key: string, word: string) => {
		const existing = chain.get(key);
		if (existing) existing.push(word);
		else chain.set(key, [word]);
	};

	for (const line of FILLER_CORPUS) {
		const words = line.split(/\s+/).filter(Boolean);
		let previous = START;
		let beforePrevious = START;

		for (const word of words) {
			add(`${beforePrevious} ${previous}`, word);
			beforePrevious = previous;
			previous = word;
		}
		add(`${beforePrevious} ${previous}`, END);
	}

	return chain;
};

const chain = buildChain();

/**
 * Filler between the written exchanges: a second order Markov chain over the
 * corpus above, so the room keeps murmuring without repeating itself.
 */
export const generateFiller = (): string => {
	const words: Array<string> = [];
	let beforePrevious = START;
	let previous = START;

	while (words.length < HARD_WORD_CAP) {
		const options = chain.get(`${beforePrevious} ${previous}`);
		if (!options || options.length === 0) break;

		const next = pick(options);
		if (next === END) break;

		words.push(next);
		beforePrevious = previous;
		previous = next;
	}

	const line = words.join(" ").replace(/[,\s]+$/, "");
	return line.split(" ").length < 3 ? pick(FILLER_CORPUS) : line;
};

export const randomReaction = (existing: Array<{ emoji: string }>): string => {
	const taken = new Set(existing.map((reaction) => reaction.emoji));
	const available = REACTION_POOL.filter((emoji) => !taken.has(emoji));
	return pick(available.length > 0 ? available : REACTION_POOL);
};

export type ScriptedTurn = {
	speaker: Speaker;
	text: string;
	html: string;
	parent?: MessageParent;
};

const MENTION_CLASS = "bg-primary/25 px-1 rounded-xs inline";

const MENTION_PATTERN = /\{@(\d+)\}/g;

const escapeHtml = (value: string) =>
	value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const nameForRole = (cast: Array<Speaker>, role: string) =>
	cast[Number(role) % cast.length].actor.data.displayName;

const toPlainText = (text: string, cast: Array<Speaker>) =>
	text.replace(MENTION_PATTERN, (_, role) => `@${nameForRole(cast, role)}`);

const toHtml = (text: string, cast: Array<Speaker>) =>
	parseEmojiText(escapeHtml(text)).replace(
		MENTION_PATTERN,
		(_, role) =>
			`<span data-facet-type="mention" class="${MENTION_CLASS}">@${nameForRole(cast, role)}</span>`,
	);

const shuffled = <T>(items: Array<T>): Array<T> => {
	const result = [...items];
	for (let index = result.length - 1; index > 0; index--) {
		const swap = Math.floor(Math.random() * (index + 1));
		[result[index], result[swap]] = [result[swap], result[index]];
	}
	return result;
};

export const createConversation = () => {
	let queue = shuffled(EXCHANGES);
	let turns: Array<ScriptedTurn> = [];

	const loadNext = () => {
		if (queue.length === 0) queue = shuffled(EXCHANGES);

		const exchange = queue.pop();
		if (!exchange) return;

		const roles = Math.max(...exchange.map((turn) => turn.role)) + 1;
		const cast = shuffled(SPEAKERS).slice(0, Math.max(roles, 1));

		turns = [];

		for (const turn of exchange) {
			const previous = turns.at(-1);

			turns.push({
				speaker: cast[turn.role % cast.length],
				text: toPlainText(turn.text, cast),
				html: toHtml(turn.text, cast),
				parent:
					turn.reply && previous
						? { speaker: previous.speaker, text: previous.text }
						: undefined,
			});
		}

		if (Math.random() < 0.55) {
			const filler = generateFiller();
			turns.push({
				speaker: pick(SPEAKERS),
				text: filler,
				html: toHtml(filler, SPEAKERS),
			});
		}
	};

	return {
		next(): ScriptedTurn {
			if (turns.length === 0) loadNext();
			const turn = turns.shift();
			if (turn) return turn;

			const filler = generateFiller();
			return {
				speaker: pick(SPEAKERS),
				text: filler,
				html: toHtml(filler, SPEAKERS),
			};
		},
	};
};

let counter = 0;

export const toMessage = (
	turn: ScriptedTurn,
	createdAt: Date,
): ScriptedMessage => {
	counter += 1;

	return {
		id: `showcase-${counter}`,
		speaker: turn.speaker,
		text: turn.text,
		html: turn.html,
		parent: turn.parent,
		createdAt: createdAt.toISOString(),
		reactions: [],
	};
};
