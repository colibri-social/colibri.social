import MiniSearch from "minisearch";
import type { Member } from "../atproto/xrpc/social/colibri/community/listMembers";
import { displayableNameFn } from "./displayable-name";
import { foldText } from "./fold-text";
import type { SpeakerRanks } from "./recent-speakers";

const RECENCY_BOOST = 0.25;

const MIN_FUZZY_LENGTH = 3;

export type MemberIndex = {
	sync: (members: ReadonlyArray<Member>) => void;
	search: (query: string, limit: number, ranks?: SpeakerRanks) => Array<string>;
};

type MemberDocument = {
	did: string;
	displayName: string;
	handle: string;
};

const handleOf = (member: Member) => member.handle.replaceAll("at://", "");

const toDocument = (member: Member): MemberDocument => ({
	did: member.did,
	displayName: displayableNameFn(member),
	handle: handleOf(member),
});

const signatureOf = (document: MemberDocument) =>
	`${document.displayName} ${document.handle}`;

const recencyBoost = (did: string, ranks?: SpeakerRanks) => {
	const rank = ranks?.rank(did);
	if (rank === undefined) return 1;
	return 1 + RECENCY_BOOST / (1 + rank);
};

export const createMemberIndex = (): MemberIndex => {
	const index = new MiniSearch<MemberDocument>({
		idField: "did",
		fields: ["displayName", "handle"],
		storeFields: [],
		processTerm: (term) => foldText(term) || null,
	});

	const indexed = new Map<string, string>();

	const sync = (members: ReadonlyArray<Member>) => {
		const seen = new Set<string>();

		for (const member of members) {
			seen.add(member.did);

			const document = toDocument(member);
			const signature = signatureOf(document);
			const known = indexed.get(member.did);

			if (known === signature) continue;

			if (known === undefined) index.add(document);
			else index.replace(document);

			indexed.set(member.did, signature);
		}

		for (const did of [...indexed.keys()]) {
			if (seen.has(did)) continue;
			index.discard(did);
			indexed.delete(did);
		}
	};

	const search = (query: string, limit: number, ranks?: SpeakerRanks) => {
		if (limit <= 0) return [];
		if (!foldText(query.trim())) return [];

		return index
			.search(query, {
				prefix: true,
				fuzzy: query.length >= MIN_FUZZY_LENGTH ? 0.2 : false,
				boost: { displayName: 2 },
				weights: { prefix: 0.9, fuzzy: 0.2 },
				boostDocument: (did) => recencyBoost(String(did), ranks),
			})
			.slice(0, limit)
			.map((result) => String(result.id));
	};

	return { sync, search };
};
