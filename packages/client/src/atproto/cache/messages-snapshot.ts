import type { MessageView, RecordRef } from "../views";
import type { MessagesSnapshot, PendingMessage } from "./schema";

export const rkeyOf = (uri: string): string => uri.split("/").pop() ?? "";

export const refOf = (
	message: Pick<MessageView, "author" | "rkey">,
): RecordRef => ({
	did: message.author.did,
	rkey: message.rkey,
});

export const sameRecord = (
	message: Pick<MessageView, "author" | "rkey">,
	ref: RecordRef,
): boolean => message.author.did === ref.did && message.rkey === ref.rkey;

export const cursorFor = (
	messages: MessageView[],
	fallback?: string,
): string | undefined => {
	const oldest = messages[0];
	return oldest ? oldest.rkey : fallback;
};

export const buildMessagesSnapshot = (
	confirmed: MessageView[],
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

export const belongsToChannel = (
	message: { channel?: string },
	channelSpace: string,
): boolean => !message.channel || message.channel === channelSpace;

export const snapshotBelongsTo = (
	snapshot: MessagesSnapshot,
	channelSpace: string,
): boolean =>
	snapshot.messages.every((message) => belongsToChannel(message, channelSpace));

export const mergeSnapshotWindow = (
	existing: MessagesSnapshot | undefined,
	fetched: MessageView[],
	options: {
		readCursor: string | undefined;
		hasMore: boolean;
		limit: number;
		now: number;
	},
): MessagesSnapshot => {
	if (!existing) return buildMessagesSnapshot(fetched, options);

	const byUri = new Map<string, MessageView>();
	for (const message of existing.messages) byUri.set(message.uri, message);
	for (const message of fetched) byUri.set(message.uri, message);

	const union = [...byUri.values()].sort((left, right) => {
		if (left.rkey < right.rkey) return -1;
		return left.rkey > right.rkey ? 1 : 0;
	});

	return buildMessagesSnapshot(union, {
		...options,
		readCursor: options.readCursor ?? existing.readCursor,
	});
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
	local: (MessageView | PendingMessage)[],
	fetched: MessageView[],
	options: { pageSize: number; prunable: ReadonlySet<string> },
): (MessageView | PendingMessage)[] | undefined => {
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
