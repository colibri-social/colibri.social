import { rkeyOf } from "../atproto/cache/messages-snapshot";

type Orderable = { uri: string; createdAt: string };

export type Placement =
	| { kind: "append" }
	| { kind: "insert"; index: number }
	| { kind: "drop" };

export const sameDay = (a: string, b: string): boolean =>
	new Date(a).toDateString() === new Date(b).toDateString();

export const compareMessages = (a: Orderable, b: Orderable): number => {
	const byTime =
		new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
	if (byTime !== 0) return byTime;
	return rkeyOf(a.uri).localeCompare(rkeyOf(b.uri));
};

export const placeMessage = (
	existing: readonly Orderable[],
	incoming: Orderable,
	options: { hasMore: boolean },
): Placement => {
	const last = existing.at(-1);
	if (!last) return { kind: "append" };
	if (compareMessages(incoming, last) >= 0) return { kind: "append" };

	const first = existing[0];
	if (first && compareMessages(incoming, first) < 0) {
		return options.hasMore ? { kind: "drop" } : { kind: "insert", index: 0 };
	}

	const index = existing.findIndex((m) => compareMessages(incoming, m) < 0);
	return { kind: "insert", index };
};

export const insertAt = <T>(
	list: readonly T[],
	item: T,
	index: number,
): T[] => [...list.slice(0, index), item, ...list.slice(index)];
