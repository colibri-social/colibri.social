export const MESSAGE_WINDOW_LIMIT = 50;
export const MEMORY_WINDOW_COUNT = 8;
export const STORED_WINDOW_COUNT = 50;
export const MESSAGE_WINDOW_TTL_MS = 24 * 60 * 60 * 1000;
export const WINDOW_WRITE_DEBOUNCE_MS = 400;
export const WINDOW_WRITE_MAX_INTERVAL_MS = 5_000;

export type WindowMessage = { rkey: string };

export type MessageWindow<M extends WindowMessage> = {
	space: string;
	messages: M[];
	cursor?: string;
	hasMore: boolean;
	readCursor?: string;
	ts: number;
};

const byRkey = <M extends WindowMessage>(left: M, right: M) =>
	left.rkey < right.rkey ? -1 : left.rkey > right.rkey ? 1 : 0;

export const buildMessageWindow = <M extends WindowMessage>(
	messages: readonly M[],
	options: {
		space: string;
		cursor?: string;
		hasMore: boolean;
		readCursor?: string;
		now: number;
		limit?: number;
	},
): MessageWindow<M> => {
	const limit = options.limit ?? MESSAGE_WINDOW_LIMIT;
	const kept = messages.slice(-limit);
	const trimmed = kept.length < messages.length;
	const oldest = kept[0]?.rkey;
	return {
		space: options.space,
		messages: kept,
		cursor: trimmed
			? oldest
			: (options.cursor ?? (options.hasMore ? oldest : undefined)),
		hasMore: trimmed || options.hasMore,
		...(options.readCursor ? { readCursor: options.readCursor } : {}),
		ts: options.now,
	};
};

export const isWindowPaintable = (
	window: MessageWindow<WindowMessage>,
	now: number,
) => {
	const age = now - window.ts;
	return age >= 0 && age <= MESSAGE_WINDOW_TTL_MS && window.messages.length > 0;
};

export type WindowRefresh<M extends WindowMessage> = {
	messages: M[];
	cursor?: string;
	replaced: boolean;
};

export const refreshMessageWindow = <M extends WindowMessage>(
	cached: readonly M[],
	newest: { items: readonly M[]; cursor?: string },
	options: { pageSize: number; cachedCursor?: string },
): WindowRefresh<M> => {
	const page = [...newest.items].sort(byRkey);
	const oldestFetched = page[0]?.rkey;
	const newestCached = cached.at(-1)?.rkey;
	const complete = !newest.cursor && page.length < options.pageSize;
	const gap =
		!complete &&
		!!oldestFetched &&
		!!newestCached &&
		oldestFetched > newestCached;
	if (gap || cached.length === 0) {
		return { messages: page, cursor: newest.cursor, replaced: true };
	}
	const fetched = new Map(page.map((message) => [message.rkey, message]));
	const newestFetched = page.at(-1)?.rkey;
	const kept = cached.filter((message) => {
		if (fetched.has(message.rkey)) return false;
		if (newestFetched && message.rkey > newestFetched) return true;
		if (complete) return false;
		return !!oldestFetched && message.rkey < oldestFetched;
	});
	const merged = [...kept, ...page].sort(byRkey);
	return {
		messages: merged,
		cursor: complete
			? undefined
			: kept.some((message) => !!oldestFetched && message.rkey < oldestFetched)
				? options.cachedCursor
				: newest.cursor,
		replaced: false,
	};
};
