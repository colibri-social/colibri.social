type SenderMessage = {
	author: {
		did: string;
		bridge?: unknown;
	};
};

type RecentSenderOptions = {
	limit: number;
	include: (did: string) => boolean;
};

type RankFields<T> = {
	name: (candidate: T) => string;
	handle: (candidate: T) => string;
};

export const recentSenders = (
	messages: ReadonlyArray<SenderMessage>,
	options: RecentSenderOptions,
) => {
	const senders: string[] = [];

	for (let index = messages.length - 1; index >= 0; index--) {
		if (senders.length >= options.limit) break;

		const author = messages[index]?.author;

		if (!author || author.bridge || senders.includes(author.did)) continue;
		if (options.include(author.did)) senders.push(author.did);
	}

	return senders;
};

const matchScore = (name: string, handle: string, needle: string) => {
	if (name.startsWith(needle)) return 0;
	if (handle.startsWith(needle)) return 1;
	if (name.includes(needle)) return 2;
	if (handle.includes(needle)) return 3;

	return undefined;
};

export const rankMembers = <T>(
	candidates: Iterable<T>,
	query: string,
	fields: RankFields<T>,
) => {
	const needle = query.toLowerCase();
	const scored: { candidate: T; name: string; score: number }[] = [];

	for (const candidate of candidates) {
		const name = fields.name(candidate);
		const handle = fields.handle(candidate).toLowerCase();
		const score = matchScore(name.toLowerCase(), handle, needle);

		if (score !== undefined) scored.push({ candidate, name, score });
	}

	scored.sort(
		(left, right) =>
			left.score - right.score || left.name.localeCompare(right.name),
	);

	return scored.map((entry) => entry.candidate);
};
