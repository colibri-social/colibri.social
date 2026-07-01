import { communityKey, messagesKey } from "./keys";
import type {
	CommunitySnapshot,
	MessagesSnapshot,
	UserSnapshot,
} from "./schema";
import { SCHEMA_VERSION } from "./schema";

const DB_NAME = "colibri-cache";
const DB_VERSION = 1;
const MAX_CHANNELS = 50;
const STORES = ["meta", "user", "community", "messages"] as const;
type StoreName = (typeof STORES)[number];

export const cacheEnabled = (): boolean => {
	try {
		return (
			typeof indexedDB !== "undefined" &&
			localStorage.getItem("colibri:cache") === "on"
		);
	} catch {
		return false;
	}
};

let dbPromise: Promise<IDBDatabase> | undefined;

const openDb = (): Promise<IDBDatabase> => {
	if (dbPromise) return dbPromise;
	dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			for (const name of STORES) {
				if (db.objectStoreNames.contains(name)) continue;
				const store = db.createObjectStore(name);
				if (name === "messages") store.createIndex("ts", "ts");
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
		.catch(() => undefined);

const evictMessages = (): Promise<void> =>
	openDb()
		.then(
			(db) =>
				new Promise<void>((resolve, reject) => {
					const store = db
						.transaction("messages", "readwrite")
						.objectStore("messages");
					const countReq = store.count();
					countReq.onsuccess = () => {
						let excess = countReq.result - MAX_CHANNELS;
						if (excess <= 0) {
							resolve();
							return;
						}
						const cursorReq = store.index("ts").openCursor();
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
		.catch(() => undefined);

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

export const readMessages = (
	ns: string,
	channelUri: string,
): Promise<MessagesSnapshot | undefined> =>
	read<MessagesSnapshot>("messages", messagesKey(ns, channelUri));

export const writeMessages = (
	ns: string,
	channelUri: string,
	snap: MessagesSnapshot,
): Promise<void> =>
	write("messages", messagesKey(ns, channelUri), snap).then(evictMessages);

export const clearAll = (): Promise<void> =>
	openDb()
		.then(
			(db) =>
				new Promise<void>((resolve, reject) => {
					const t = db.transaction(STORES, "readwrite");
					for (const name of STORES) t.objectStore(name).clear();
					t.oncomplete = () => resolve();
					t.onerror = () => reject(t.error);
				}),
		)
		.catch(() => undefined);

export const ensureFresh = async (ns: string): Promise<void> => {
	const meta = await read<{ version: number; owner: string }>("meta", "meta");
	if (meta?.version === SCHEMA_VERSION && meta.owner === ns) return;
	await clearAll();
	await write("meta", "meta", { version: SCHEMA_VERSION, owner: ns });
};
