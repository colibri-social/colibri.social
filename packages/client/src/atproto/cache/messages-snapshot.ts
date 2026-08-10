import type {
	Message,
	PendingMessage,
} from "../xrpc/social/colibri/channel/listMessages";
import type { MessagesSnapshot } from "./schema";

export const rkeyOf = (uri: string): string => uri.split("/").pop() ?? "";

export const cursorFor = (
	messages: Message[],
	fallback?: string,
): string | undefined => {
	const oldest = messages[0];
	return oldest ? rkeyOf(oldest.uri) : fallback;
};

export const buildMessagesSnapshot = (
	confirmed: Message[],
	options: {
		readCursor: string | undefined;
		hasMore: boolean;
		limit: number;
		now: number;
	},
): MessagesSnapshot => {
	const kept = confirmed.slice(-options.limit);
	return {
		messages: kept,
		readCursor: options.readCursor,
		cursor: cursorFor(kept),
		hasMore: kept.length < confirmed.length ? true : options.hasMore,
		ts: options.now,
	};
};

export const MESSAGES_HARD_TTL_MS = 24 * 60 * 60 * 1000;

export const MESSAGES_STALE_HINT_MS = 60_000;

export const snapshotAgeMs = (
	snapshot: MessagesSnapshot,
	now: number,
): number => now - snapshot.ts;

export const isSnapshotPaintable = (ageMs: number): boolean =>
	ageMs >= 0 && ageMs <= MESSAGES_HARD_TTL_MS;

export const isSnapshotStale = (ageMs: number | undefined): boolean =>
	ageMs !== undefined && ageMs > MESSAGES_STALE_HINT_MS;

export const shouldWriteSnapshot = (input: {
	cacheEnabled: boolean;
	channelUri: string;
	hydratedFromNetwork: boolean;
	appliedRemoval: boolean;
}): boolean =>
	input.cacheEnabled &&
	input.channelUri.length > 0 &&
	(input.hydratedFromNetwork || input.appliedRemoval);

export const reconcileFetchedWindow = (
	local: (Message | PendingMessage)[],
	fetched: Message[],
	options: { pageSize: number; prunable: ReadonlySet<string> },
): (Message | PendingMessage)[] | undefined => {
	const returned = new Set(fetched.map((m) => m.uri));
	const oldest = fetched[0];
	const spansWholeHistory = fetched.length < options.pageSize;

	const kept = local.filter((message) => {
		if ("hash" in message) return true;
		if (!options.prunable.has(message.uri)) return true;
		if (returned.has(message.uri)) return true;
		if (spansWholeHistory || !oldest) return false;
		return rkeyOf(message.uri) < rkeyOf(oldest.uri);
	});

	return kept.length === local.length ? undefined : kept;
};

export const restoreMessagesSnapshot = (
	snapshot: MessagesSnapshot,
): { cursor: string | undefined; hasMore: boolean | undefined } => ({
	cursor: snapshot.cursor ?? cursorFor(snapshot.messages),
	hasMore: snapshot.hasMore,
});
