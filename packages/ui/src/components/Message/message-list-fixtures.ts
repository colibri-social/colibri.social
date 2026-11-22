import type { GroupableMessage } from "../../utils/message-groups";

export type ListFixtureMessage = GroupableMessage & {
	id: string;
	name: string;
	color: string;
	text: string;
	image?: { width: number; height: number; delay: number };
	reactions?: number;
	edited?: boolean;
};

const AUTHORS = [
	{ did: "did:plc:lou", name: "Lou", color: "#7c3aed" },
	{ did: "did:plc:kris", name: "Kris", color: "#b45309" },
	{ did: "did:plc:mara", name: "Mara", color: "#9f1239" },
	{ did: "did:plc:noor", name: "Noor", color: "#0f766e" },
	{ did: "did:plc:tim", name: "Tim", color: "#3f6212" },
	{ did: "did:plc:ola", name: "Ola", color: "#1d4ed8" },
];

const PHRASES = [
	"The crows have started following me on my run now.",
	"Did you feed them once?",
	"I may have shared a sandwich in February, now that I think about it.",
	"Then that's your life now, they do not forget faces.",
	"Saw a heron by the lock this morning, it looked deeply unimpressed with me.",
	"Anyone up for the canal walk on Saturday? We could start at the bakery and finish at the old boathouse if the weather holds.",
	"ok",
	"Ha!",
	"I'll bring the binoculars.",
	"Long one, sorry: I tried mapping every nest along the towpath and ended up with a spreadsheet that has more columns than birds. The kingfisher alone gets three tabs because it never sits still long enough to be counted properly, and the coots keep moving their nests between surveys.",
	"Pics or it didn't happen.",
	"That's the third time this week the swans have blocked the bridge.",
	"Sounds good to me.",
	"Who left the bird seed open in the shed?",
];

const mulberry32 = (seed: number) => {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let value = state;
		value = Math.imul(value ^ (value >>> 15), value | 1);
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
	};
};

export type CreateListMessagesOptions = {
	start?: Date;
	seed?: number;
	images?: boolean;
};

export const createListMessages = (
	count: number,
	options: CreateListMessagesOptions = {},
): ListFixtureMessage[] => {
	const random = mulberry32(options.seed ?? 7);
	let time = (options.start ?? new Date(2026, 6, 1, 8, 0)).getTime();
	let author = AUTHORS[0] as (typeof AUTHORS)[number];
	const messages: ListFixtureMessage[] = [];
	for (let index = 0; index < count; index++) {
		const roll = random();
		time +=
			roll < 0.6
				? 20_000 + random() * 120_000
				: roll < 0.95
					? 600_000 + random() * 3_600_000
					: 10 * 3_600_000 + random() * 20 * 3_600_000;
		if (random() > 0.55)
			author = AUTHORS[Math.floor(random() * AUTHORS.length)] ?? author;
		const text =
			PHRASES[Math.floor(random() * PHRASES.length)] ?? PHRASES[0] ?? "";
		const withImage = options.images !== false && random() < 0.06;
		messages.push({
			id: `m${index}`,
			author: author.did,
			name: author.name,
			color: author.color,
			timestamp: new Date(time),
			text,
			reply: random() < 0.05,
			image: withImage
				? {
						width: 320,
						height: 120 + Math.floor(random() * 120),
						delay: 80 + Math.floor(random() * 600),
					}
				: undefined,
			reactions: random() < 0.1 ? 1 + Math.floor(random() * 3) : undefined,
			edited: random() < 0.04,
		});
	}
	return messages;
};

export const createListMessage = (
	id: string,
	text: string,
	timestamp: Date,
	author = AUTHORS[0] as (typeof AUTHORS)[number],
): ListFixtureMessage => ({
	id,
	author: author.did,
	name: author.name,
	color: author.color,
	timestamp,
	text,
});

export const listFixtureAuthors = AUTHORS;
