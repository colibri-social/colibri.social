import { classifyThrown } from "../errors/classify.js";
import { ColibriError } from "../errors/error.js";

export const STORAGE_TIMEOUT_MS = 3_000;

export type KvStoreOptions = {
	name: string;
	version: number;
	stores: readonly string[];
	indexed?: readonly string[];
	timeoutMs?: number;
	onFailure?: (error: ColibriError) => void;
	factory?: () => IDBFactory | undefined;
};

export type KvStore = {
	enabled: () => boolean;
	get: <T>(store: string, key: string) => Promise<T | undefined>;
	put: (store: string, key: string, value: unknown) => Promise<void>;
	remove: (store: string, key: string) => Promise<void>;
	removeWhere: (
		store: string,
		match: (key: string) => boolean,
	) => Promise<void>;
	clear: (stores: readonly string[]) => Promise<void>;
	evictOldest: (store: string, keep: number) => Promise<void>;
	close: () => void;
};

const defaultFactory = () => {
	try {
		return typeof indexedDB === "undefined" ? undefined : indexedDB;
	} catch {
		return undefined;
	}
};

export const createKvStore = (options: KvStoreOptions): KvStore => {
	const timeoutMs = options.timeoutMs ?? STORAGE_TIMEOUT_MS;
	let disabled = !(options.factory ?? defaultFactory)();
	let opened: Promise<IDBDatabase> | undefined;
	let reported = false;

	const fail = (thrown: unknown) => {
		disabled = true;
		opened = undefined;
		if (reported) return;
		reported = true;
		const classified = classifyThrown(thrown, { method: "cache" });
		options.onFailure?.(
			classified.code === "StorageStalled"
				? classified
				: new ColibriError({ code: "CacheUnavailable", cause: thrown }),
		);
	};

	const withTimeout = <T>(work: Promise<T>) =>
		new Promise<T>((resolve, reject) => {
			const timer = setTimeout(
				() =>
					reject(new ColibriError({ code: "StorageStalled", method: "cache" })),
				timeoutMs,
			);
			work.then(
				(value) => {
					clearTimeout(timer);
					resolve(value);
				},
				(error: unknown) => {
					clearTimeout(timer);
					reject(error);
				},
			);
		});

	const open = () => {
		if (opened) return opened;
		const factory = (options.factory ?? defaultFactory)();
		if (!factory) return Promise.reject(new Error("IndexedDB is unavailable"));
		opened = withTimeout(
			new Promise<IDBDatabase>((resolve, reject) => {
				const request = factory.open(options.name, options.version);
				request.onupgradeneeded = () => {
					const db = request.result;
					for (const name of options.stores) {
						if (db.objectStoreNames.contains(name)) continue;
						const store = db.createObjectStore(name);
						if (options.indexed?.includes(name)) store.createIndex("ts", "ts");
					}
				};
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
				request.onblocked = () => reject(new Error("IndexedDB open blocked"));
			}),
		);
		return opened;
	};

	const run = async <T>(
		store: string | readonly string[],
		mode: IDBTransactionMode,
		work: (transaction: IDBTransaction) => IDBRequest<T> | undefined,
	): Promise<T | undefined> => {
		if (disabled) return undefined;
		try {
			const db = await open();
			return await withTimeout(
				new Promise<T | undefined>((resolve, reject) => {
					const transaction = db.transaction(store as string[], mode);
					const request = work(transaction);
					transaction.oncomplete = () => resolve(request?.result);
					transaction.onerror = () => reject(transaction.error);
					transaction.onabort = () => reject(transaction.error);
				}),
			);
		} catch (thrown) {
			fail(thrown);
			return undefined;
		}
	};

	return {
		enabled: () => !disabled,
		get: <T>(store: string, key: string) =>
			run<T>(store, "readonly", (transaction) =>
				transaction.objectStore(store).get(key),
			),
		put: async (store, key, value) => {
			await run(store, "readwrite", (transaction) =>
				transaction.objectStore(store).put(value, key),
			);
		},
		remove: async (store, key) => {
			await run(store, "readwrite", (transaction) =>
				transaction.objectStore(store).delete(key),
			);
		},
		removeWhere: async (store, match) => {
			await run(store, "readwrite", (transaction) => {
				const request = transaction.objectStore(store).openKeyCursor();
				request.onsuccess = () => {
					const cursor = request.result;
					if (!cursor) return;
					if (match(String(cursor.key))) {
						transaction.objectStore(store).delete(cursor.key);
					}
					cursor.continue();
				};
				return undefined;
			});
		},
		clear: async (stores) => {
			if (stores.length === 0) return;
			await run(stores, "readwrite", (transaction) => {
				for (const name of stores) transaction.objectStore(name).clear();
				return undefined;
			});
		},
		evictOldest: async (store, keep) => {
			await run(store, "readwrite", (transaction) => {
				const objectStore = transaction.objectStore(store);
				const count = objectStore.count();
				count.onsuccess = () => {
					let excess = count.result - keep;
					if (excess <= 0) return;
					const cursorRequest = objectStore.index("ts").openCursor();
					cursorRequest.onsuccess = () => {
						const cursor = cursorRequest.result;
						if (!cursor || excess <= 0) return;
						cursor.delete();
						excess -= 1;
						cursor.continue();
					};
				};
				return undefined;
			});
		},
		close: () => {
			void opened?.then((db) => db.close()).catch(() => undefined);
			opened = undefined;
		},
	};
};
