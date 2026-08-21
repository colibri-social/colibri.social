const SPEAKERS_PER_COMMUNITY = 500;

export type SpeakerRanks = {
	rank: (did: string) => number | undefined;
	size: number;
	top: (limit: number) => Array<string>;
};

type Spoken = { author: { did: string }; createdAt: string };

const byCommunity = new Map<string, Map<string, number>>();

const timestampOf = (createdAt: string): number => {
	const parsed = new Date(createdAt).getTime();
	return Number.isNaN(parsed) ? 0 : parsed;
};

const trim = (speakers: Map<string, number>) => {
	if (speakers.size <= SPEAKERS_PER_COMMUNITY) return;

	const dropping = [...speakers.entries()]
		.sort((a, b) => a[1] - b[1])
		.slice(0, speakers.size - SPEAKERS_PER_COMMUNITY);

	for (const [did] of dropping) speakers.delete(did);
};

const speakersFor = (communityUri: string): Map<string, number> => {
	const existing = byCommunity.get(communityUri);
	if (existing) return existing;

	const created = new Map<string, number>();
	byCommunity.set(communityUri, created);
	return created;
};

export const recordSpeaker = (
	communityUri: string,
	did: string,
	createdAt: string,
): void => {
	if (!communityUri || !did) return;

	const speakers = speakersFor(communityUri);
	const at = timestampOf(createdAt);
	const known = speakers.get(did);

	if (known !== undefined && known >= at) return;

	speakers.set(did, at);
	trim(speakers);
};

export const recordSpeakers = (
	communityUri: string,
	messages: ReadonlyArray<Spoken>,
): void => {
	if (!communityUri || messages.length === 0) return;

	const speakers = speakersFor(communityUri);

	for (const message of messages) {
		const did = message.author?.did;
		if (!did) continue;

		const at = timestampOf(message.createdAt);
		const known = speakers.get(did);
		if (known === undefined || known < at) speakers.set(did, at);
	}

	trim(speakers);
};

export const speakerRanks = (communityUri: string): SpeakerRanks => {
	const speakers = byCommunity.get(communityUri);

	if (!speakers || speakers.size === 0) {
		return { rank: () => undefined, size: 0, top: () => [] };
	}

	const ordered = [...speakers.entries()].sort((a, b) => b[1] - a[1]);
	const ranks = new Map<string, number>();
	for (let i = 0; i < ordered.length; i++) ranks.set(ordered[i][0], i);

	return {
		rank: (did) => ranks.get(did),
		size: ordered.length,
		top: (limit) => ordered.slice(0, limit).map(([did]) => did),
	};
};

export const forgetSpeakers = (communityUri: string): void => {
	byCommunity.delete(communityUri);
};
