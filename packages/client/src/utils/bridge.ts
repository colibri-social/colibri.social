import { foldText } from "./fold-text";

export const platformName = (platform: string): string =>
	platform.length === 0
		? "another service"
		: `${platform[0]?.toUpperCase()}${platform.slice(1)}`;

export const authorKey = (author: {
	did: string;
	bridge?: { registration: string; remoteId: string };
}): string =>
	author.bridge
		? `${author.did} ${author.bridge.registration} ${author.bridge.remoteId}`
		: author.did;

export type BridgedPerson = {
	registration: string;
	platform: string;
	remoteId: string;
	name: string;
	avatar?: string;
};

type BridgedAuthor = {
	did: string;
	displayName?: string;
	avatar?: string;
	bridge?: { registration: string; platform: string; remoteId: string };
};

export const bridgedPeople = (
	authorsNewestFirst: Iterable<BridgedAuthor>,
	query: string,
	limit: number,
): BridgedPerson[] => {
	const wanted = foldText(query);
	const seen = new Set<string>();
	const people: BridgedPerson[] = [];
	for (const author of authorsNewestFirst) {
		if (people.length >= limit) break;
		const bridge = author.bridge;
		if (!bridge) continue;
		const key = authorKey(author);
		if (seen.has(key)) continue;
		seen.add(key);
		const name = author.displayName ?? bridge.remoteId;
		if (!foldText(name).startsWith(wanted)) continue;
		people.push({
			registration: bridge.registration,
			platform: bridge.platform,
			remoteId: bridge.remoteId,
			name,
			...(author.avatar ? { avatar: author.avatar } : {}),
		});
	}
	return people;
};

export type HistoryDepth = "none" | "day" | "week" | "month" | "all";

export const HISTORY_DEPTHS: ReadonlyArray<{
	id: HistoryDepth;
	label: string;
}> = [
	{ id: "none", label: "Don't import" },
	{ id: "day", label: "Last day" },
	{ id: "week", label: "Last 7 days" },
	{ id: "month", label: "Last 30 days" },
	{ id: "all", label: "All history" },
];

const DEPTH_DAYS: Record<Exclude<HistoryDepth, "none" | "all">, number> = {
	day: 1,
	week: 7,
	month: 30,
};

const DAY_MS = 24 * 60 * 60 * 1000;

export const historyRequest = (
	depth: Exclude<HistoryDepth, "none">,
	now: Date,
): { since?: string; requestedAt: string } => ({
	...(depth === "all"
		? {}
		: {
				since: new Date(
					now.getTime() - DEPTH_DAYS[depth] * DAY_MS,
				).toISOString(),
			}),
	requestedAt: now.toISOString(),
});

export const historyPercent = (status: {
	state: string;
	from: string;
	until: string;
	reached?: string;
}): number => {
	if (status.state === "done") return 100;
	const from = Date.parse(status.from);
	const until = Date.parse(status.until);
	if (!(until > from)) return 100;
	if (!status.reached) return 0;
	const share = (Date.parse(status.reached) - from) / (until - from);
	return Math.round(Math.min(1, Math.max(0, share)) * 100);
};
