export const SPACE_SNAPSHOT_LIMIT = 20;
export const SPACE_MEMBER_LIMIT = 500;
export const SPACE_THREAD_CHANNEL_LIMIT = 40;
export const SPACE_SNAPSHOT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type SnapshotEntry = { ts: number };

export const isSnapshotUsable = (ts: number, now: number) =>
	Number.isFinite(ts) && now - ts <= SPACE_SNAPSHOT_TTL_MS;

export const pruneSnapshotEntries = <T extends SnapshotEntry>(
	entries: Readonly<Record<string, T>>,
	keep: ReadonlySet<string> | undefined,
	limit: number,
): Record<string, T> => {
	const kept = Object.entries(entries).filter(
		([key]) => !keep || keep.has(key),
	);
	kept.sort((a, b) => b[1].ts - a[1].ts);
	return Object.fromEntries(kept.slice(0, limit));
};

export const capList = <T>(list: readonly T[], limit: number): T[] =>
	list.length > limit ? list.slice(0, limit) : [...list];
