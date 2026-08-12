import { classifyThrown } from "../../errors/classify";
import { ColibriError } from "../../errors/error";
import { reportError } from "../../errors/report";
import { createLogger } from "../../utils/logger";
import {
	BSKY_MU_TRUSTED_LIST_KEY,
	bskyHandleKey,
	bskyMuVerificationKey,
	bskyPostKey,
	communityKey,
	labelerLabelsKey,
	messagesKey,
} from "./keys";
import type {
	BskyHandleSnapshot,
	BskyMuTrustedListSnapshot,
	BskyMuVerificationSnapshot,
	BskyPostSnapshot,
	CommunitySnapshot,
	LabelerLabelsSnapshot,
	MessagesSnapshot,
	UserSnapshot,
} from "./schema";
import { SCHEMA_VERSION } from "./schema";

const log = createLogger("cache");

const DB_NAME = "colibri-cache";
const DB_VERSION = 3;
const MAX_CHANNELS = 50;
const MAX_BSKY_ENTRIES = 1000;

/**
 * Permission-scoped stores: wiped on logout/account-switch and on
 * `SCHEMA_VERSION` bumps
 */
const USER_SCOPED_STORES = ["meta", "user", "community", "messages"] as const;
const STORES = [...USER_SCOPED_STORES, "bsky", "outbox"] as const;
type StoreName = (typeof STORES)[number];

export const cacheEnabled = (): boolean => {
	try {
		return typeof indexedDB !== "undefined";
	} catch {
		return false;
	}
};

let dbPromise: Promise<IDBDatabase> | undefined;
let brokenReported = false;

export const noteCacheFailure = (err: unknown): void => {
	if (brokenReported) return;
	brokenReported = true;
	log.warn("the offline cache is unusable, falling back to network reads", {
		code: classifyThrown(err).code,
	});
	reportError(new ColibriError({ code: "CacheUnavailable", cause: err }), {
		stage: "cache",
		severity: "warning",
	});
};

const openDb = (): Promise<IDBDatabase> => {
	if (dbPromise) return dbPromise;
	dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			for (const name of STORES) {
				if (db.objectStoreNames.contains(name)) continue;
				const store = db.createObjectStore(
					name,
					name === "outbox" ? { autoIncrement: true } : undefined,
				);
				if (name === "messages" || name === "bsky") {
					store.createIndex("ts", "ts");
				}
			}
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
	return dbPromise;
};

const request = <T>(
	store: StoreName,
	mode: IDBTransactionMode,
	run: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> =>
	openDb().then(
		(db) =>
			new Promise<T>((resolve, reject) => {
				const req = run(db.transaction(store, mode).objectStore(store));
				req.onsuccess = () => resolve(req.result);
				req.onerror = () => reject(req.error);
			}),
	);

const read = <T>(store: StoreName, key: string): Promise<T | undefined> =>
	request<T | undefined>(store, "readonly", (s) => s.get(key)).catch(
		() => undefined,
	);

const write = (store: StoreName, key: string, value: unknown): Promise<void> =>
	request(store, "readwrite", (s) => s.put(value, key))
		.then(() => undefined)
		.catch((err) => {
			noteCacheFailure(err);
			return undefined;
		});

const readMany = <T>(
	store: StoreName,
	keys: ReadonlyArray<string>,
): Promise<Map<string, T>> => {
	if (keys.length === 0) return Promise.resolve(new Map<string, T>());
	return openDb()
		.then(
			(db) =>
				new Promise<Map<string, T>>((resolve, reject) => {
					const out = new Map<string, T>();
					const transaction = db.transaction(store, "readonly");
					const objectStore = transaction.objectStore(store);
					for (const key of keys) {
						const req = objectStore.get(key);
						req.onsuccess = () => {
							if (req.result !== undefined) out.set(key, req.result as T);
						};
					}
					transaction.oncomplete = () => resolve(out);
					transaction.onerror = () => reject(transaction.error);
					transaction.onabort = () => reject(transaction.error);
				}),
		)
		.catch(() => new Map<string, T>());
};

const writeMany = (
	store: StoreName,
	entries: ReadonlyArray<readonly [string, unknown]>,
): Promise<void> => {
	if (entries.length === 0) return Promise.resolve();
	return openDb()
		.then(
			(db) =>
				new Promise<void>((resolve, reject) => {
					const transaction = db.transaction(store, "readwrite");
					const objectStore = transaction.objectStore(store);
					for (const [key, value] of entries) objectStore.put(value, key);
					transaction.oncomplete = () => resolve();
					transaction.onerror = () => reject(transaction.error);
					transaction.onabort = () => reject(transaction.error);
				}),
		)
		.catch((err) => {
			noteCacheFailure(err);
			return undefined;
		});
};

const evictOldest = (store: StoreName, maxCount: number): Promise<void> =>
	openDb()
		.then(
			(db) =>
				new Promise<void>((resolve, reject) => {
					const objectStore = db
						.transaction(store, "readwrite")
						.objectStore(store);
					const countReq = objectStore.count();
					countReq.onsuccess = () => {
						let excess = countReq.result - maxCount;
						if (excess <= 0) {
							resolve();
							return;
						}
						const cursorReq = objectStore.index("ts").openCursor();
						cursorReq.onsuccess = () => {
							const cursor = cursorReq.result;
							if (!cursor || excess <= 0) {
								resolve();
								return;
							}
							cursor.delete();
							excess--;
							cursor.continue();
						};
						cursorReq.onerror = () => reject(cursorReq.error);
					};
					countReq.onerror = () => reject(countReq.error);
				}),
		)
		.catch((err) => {
			noteCacheFailure(err);
			return undefined;
		});

export const readUser = (ns: string): Promise<UserSnapshot | undefined> =>
	read<UserSnapshot>("user", ns);

export const writeUser = (ns: string, snap: UserSnapshot): Promise<void> =>
	write("user", ns, snap);

export const readCommunity = (
	ns: string,
	uri: string,
): Promise<CommunitySnapshot | undefined> =>
	read<CommunitySnapshot>("community", communityKey(ns, uri));

export const writeCommunity = (
	ns: string,
	uri: string,
	snap: CommunitySnapshot,
): Promise<void> => write("community", communityKey(ns, uri), snap);

const EVICT_EVERY_N_WRITES = 10;
const writeCounts = new Map<StoreName, number>();

const writeAndMaybeEvict = (
	store: StoreName,
	key: string,
	value: unknown,
	maxCount: number,
): Promise<void> => {
	return write(store, key, value).then(() => {
		const seen = writeCounts.get(store) ?? 0;
		writeCounts.set(store, seen + 1);
		if (seen % EVICT_EVERY_N_WRITES !== 0) return undefined;
		return evictOldest(store, maxCount);
	});
};

export const readMessages = (
	ns: string,
	channelUri: string,
): Promise<MessagesSnapshot | undefined> =>
	read<MessagesSnapshot>("messages", messagesKey(ns, channelUri));

export const writeMessages = (
	ns: string,
	channelUri: string,
	snap: MessagesSnapshot,
): Promise<void> => {
	return writeAndMaybeEvict(
		"messages",
		messagesKey(ns, channelUri),
		snap,
		MAX_CHANNELS,
	);
};

export const deleteMessages = (ns: string, channelUri: string): Promise<void> =>
	request("messages", "readwrite", (s) => s.delete(messagesKey(ns, channelUri)))
		.then(() => undefined)
		.catch((err) => {
			noteCacheFailure(err);
			return undefined;
		});

export const readBskyPost = (
	atUri: string,
): Promise<BskyPostSnapshot | undefined> =>
	read<BskyPostSnapshot>("bsky", bskyPostKey(atUri));

export const writeBskyPost = (
	atUri: string,
	snap: BskyPostSnapshot,
): Promise<void> =>
	writeAndMaybeEvict("bsky", bskyPostKey(atUri), snap, MAX_BSKY_ENTRIES);

export const readBskyHandle = (
	handle: string,
): Promise<BskyHandleSnapshot | undefined> =>
	read<BskyHandleSnapshot>("bsky", bskyHandleKey(handle));

export const writeBskyHandle = (
	handle: string,
	snap: BskyHandleSnapshot,
): Promise<void> =>
	writeAndMaybeEvict("bsky", bskyHandleKey(handle), snap, MAX_BSKY_ENTRIES);

export const readBskyMuVerification = (
	did: string,
): Promise<BskyMuVerificationSnapshot | undefined> =>
	read<BskyMuVerificationSnapshot>("bsky", bskyMuVerificationKey(did));

export const writeBskyMuVerification = (
	did: string,
	snap: BskyMuVerificationSnapshot,
): Promise<void> =>
	write("bsky", bskyMuVerificationKey(did), snap).then(() =>
		evictOldest("bsky", MAX_BSKY_ENTRIES),
	);

export const readManyLabelerLabels = (
	dids: ReadonlyArray<string>,
): Promise<Map<string, LabelerLabelsSnapshot>> =>
	readMany<LabelerLabelsSnapshot>("bsky", dids.map(labelerLabelsKey)).then(
		(byKey) => {
			const out = new Map<string, LabelerLabelsSnapshot>();
			for (const did of dids) {
				const snap = byKey.get(labelerLabelsKey(did));
				if (snap) out.set(did, snap);
			}
			return out;
		},
	);

export const writeManyLabelerLabels = (
	entries: ReadonlyArray<readonly [string, LabelerLabelsSnapshot]>,
): Promise<void> =>
	writeMany(
		"bsky",
		entries.map(([did, snap]) => [labelerLabelsKey(did), snap] as const),
	).then(() => evictOldest("bsky", MAX_BSKY_ENTRIES));

export const readBskyMuTrustedList = (): Promise<
	BskyMuTrustedListSnapshot | undefined
> => read<BskyMuTrustedListSnapshot>("bsky", BSKY_MU_TRUSTED_LIST_KEY);

export const writeBskyMuTrustedList = (
	snap: BskyMuTrustedListSnapshot,
): Promise<void> => write("bsky", BSKY_MU_TRUSTED_LIST_KEY, snap);

/**
 * Clears every permission-scoped store (not `"bsky"`, which is
 * viewer-independent and survives logout/account-switch)
 */
export const clearUserScoped = (): Promise<void> =>
	openDb()
		.then(
			(db) =>
				new Promise<void>((resolve, reject) => {
					const t = db.transaction(USER_SCOPED_STORES, "readwrite");
					for (const name of USER_SCOPED_STORES) t.objectStore(name).clear();
					t.oncomplete = () => resolve();
					t.onerror = () => reject(t.error);
				}),
		)
		.catch((err) => {
			noteCacheFailure(err);
			return undefined;
		});

export const ensureFresh = async (ns: string): Promise<void> => {
	const meta = await read<{ version: number; owner: string }>("meta", "meta");
	if (meta?.version === SCHEMA_VERSION && meta.owner === ns) return;
	await clearUserScoped();
	await write("meta", "meta", { version: SCHEMA_VERSION, owner: ns });
};

export const outboxAppend = (entry: unknown): Promise<number> =>
	request<IDBValidKey>("outbox", "readwrite", (s) => s.add(entry)).then(
		(key) => key as number,
	);

export const outboxAll = <T>(): Promise<Array<{ seq: number; entry: T }>> =>
	openDb()
		.then(
			(db) =>
				new Promise<Array<{ seq: number; entry: T }>>((resolve, reject) => {
					const out: Array<{ seq: number; entry: T }> = [];
					const cursorReq = db
						.transaction("outbox", "readonly")
						.objectStore("outbox")
						.openCursor();
					cursorReq.onsuccess = () => {
						const cursor = cursorReq.result;
						if (!cursor) {
							resolve(out);
							return;
						}
						out.push({ seq: cursor.key as number, entry: cursor.value as T });
						cursor.continue();
					};
					cursorReq.onerror = () => reject(cursorReq.error);
				}),
		)
		.catch((err) => {
			noteCacheFailure(err);
			return [];
		});

export const outboxDelete = (seq: number): Promise<void> =>
	request("outbox", "readwrite", (s) => s.delete(seq))
		.then(() => undefined)
		.catch((err) => {
			noteCacheFailure(err);
			return undefined;
		});

export const outboxUpdate = (seq: number, entry: unknown): Promise<void> =>
	request("outbox", "readwrite", (s) => s.put(entry, seq))
		.then(() => undefined)
		.catch((err) => {
			noteCacheFailure(err);
			return undefined;
		});
