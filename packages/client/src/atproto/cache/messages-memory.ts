import type { MessagesSnapshot } from "./schema";

const MAX_ENTRIES = 8;

const byKey = new Map<string, MessagesSnapshot>();

export const rememberMessages = (
	key: string,
	snapshot: MessagesSnapshot,
): void => {
	byKey.delete(key);
	byKey.set(key, snapshot);

	while (byKey.size > MAX_ENTRIES) {
		const oldest = byKey.keys().next();
		if (oldest.done) break;
		byKey.delete(oldest.value);
	}
};

export const recallMessages = (key: string): MessagesSnapshot | undefined => {
	const snapshot = byKey.get(key);
	if (snapshot === undefined) return undefined;

	byKey.delete(key);
	byKey.set(key, snapshot);
	return snapshot;
};

export const forgetMessages = (key: string): void => {
	byKey.delete(key);
};

export const clearMessagesMemory = (): void => {
	byKey.clear();
};
