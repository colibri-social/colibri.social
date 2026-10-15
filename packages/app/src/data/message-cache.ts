import {
	buildMessageWindow,
	createKvStore,
	createLogger,
	createLru,
	createSnapshotScheduler,
	isWindowPaintable,
	type KvStore,
	MEMORY_WINDOW_COUNT,
	type MessageWindow,
	realSnapshotClock,
	type SnapshotScheduler,
	STORED_WINDOW_COUNT,
	spaceAuthority,
	WINDOW_WRITE_DEBOUNCE_MS,
	WINDOW_WRITE_MAX_INTERVAL_MS,
} from "@colibri-social/lib";
import type { MessageView, SpaceRef } from "./types";

const log = createLogger("message-cache");

export const CACHE_DB_NAME = "colibri-app-cache";
export const CACHE_DB_VERSION = 2;
export const CACHE_SCHEMA_VERSION = 2;
const META = "meta";
const MESSAGES = "messages";
export const SPACES_STORE = "spaces";
const USER_SCOPED = [META, MESSAGES, SPACES_STORE] as const;

export type CachedWindow = MessageWindow<MessageView>;

export type MessageCache = {
	recall: (space: SpaceRef) => CachedWindow | undefined;
	read: (space: SpaceRef) => Promise<CachedWindow | undefined>;
	offer: (
		space: SpaceRef,
		messages: readonly MessageView[],
		options: { cursor?: string; hasMore: boolean; readCursor?: string },
	) => void;
	forget: (space: SpaceRef) => void;
	forgetCommunity: (community: string) => void;
	flush: () => Promise<void>;
	clear: () => Promise<void>;
};

export const cacheNamespace = (appViewDid: string, did: string) =>
	`${appViewDid}:${did}`;

export const windowKey = (namespace: string, space: string) =>
	`${namespace}:${space}`;

let shared: KvStore | undefined;
export const sharedStore = () => {
	shared ??= createKvStore({
		name: CACHE_DB_NAME,
		version: CACHE_DB_VERSION,
		stores: USER_SCOPED,
		indexed: [MESSAGES],
		onFailure: (error) =>
			log.warn("the device cache is unusable, using the network only", {
				code: error.code,
			}),
	});
	return shared;
};

const prepared = new WeakMap<KvStore, Map<string, Promise<void>>>();

export const prepareNamespace = (kv: KvStore, namespace: string) => {
	let byNamespace = prepared.get(kv);
	if (!byNamespace) {
		byNamespace = new Map();
		prepared.set(kv, byNamespace);
	}
	let ready = byNamespace.get(namespace);
	if (!ready) {
		ready = (async () => {
			const meta = await kv.get<{ version: number; owner: string }>(META, META);
			if (meta?.version === CACHE_SCHEMA_VERSION && meta.owner === namespace)
				return;
			await kv.clear(USER_SCOPED);
			await kv.put(META, META, {
				version: CACHE_SCHEMA_VERSION,
				owner: namespace,
			});
		})();
		byNamespace.set(namespace, ready);
	}
	return ready;
};

export const clearDeviceCache = async (kv: KvStore = sharedStore()) => {
	prepared.delete(kv);
	await kv.clear(USER_SCOPED);
};

export const createMessageCache = (options: {
	namespace: string;
	kv?: KvStore | null;
	now?: () => number;
}): MessageCache => {
	const kv = options.kv === undefined ? sharedStore() : options.kv;
	const now = options.now ?? Date.now;
	const memory = createLru<CachedWindow>(MEMORY_WINDOW_COUNT);
	const removed = new Set<string>();
	const schedulers = new Map<string, SnapshotScheduler<CachedWindow>>();
	const writes = new Set<Promise<void>>();
	let writesSinceEvict = 0;

	const ready = kv
		? prepareNamespace(kv, options.namespace)
		: Promise.resolve();

	const track = (work: Promise<void>) => {
		writes.add(work);
		void work.finally(() => writes.delete(work));
	};

	const persist = (window: CachedWindow) => {
		if (!kv) return;
		const key = windowKey(options.namespace, window.space);
		track(
			ready.then(async () => {
				if (removed.has(window.space)) return;
				await kv.put(MESSAGES, key, window);
				writesSinceEvict += 1;
				if (writesSinceEvict >= 10) {
					writesSinceEvict = 0;
					await kv.evictOldest(MESSAGES, STORED_WINDOW_COUNT);
				}
			}),
		);
	};

	const schedulerFor = (space: string) => {
		let scheduler = schedulers.get(space);
		if (!scheduler) {
			scheduler = createSnapshotScheduler<
				CachedWindow,
				ReturnType<typeof setTimeout>
			>({
				debounceMs: WINDOW_WRITE_DEBOUNCE_MS,
				maxIntervalMs: WINDOW_WRITE_MAX_INTERVAL_MS,
				clock: realSnapshotClock,
				write: persist,
			});
			schedulers.set(space, scheduler);
		}
		return scheduler;
	};

	const flushAll = () => {
		for (const scheduler of schedulers.values()) scheduler.flush();
	};
	if (typeof window !== "undefined") {
		window.addEventListener("pagehide", flushAll);
		document.addEventListener("visibilitychange", () => {
			if (document.visibilityState === "hidden") flushAll();
		});
	}

	const paintable = (window: CachedWindow | undefined) =>
		window && isWindowPaintable(window, now()) ? window : undefined;

	return {
		recall: (space) => paintable(memory.recall(space)),
		read: async (space) => {
			const remembered = paintable(memory.recall(space));
			if (remembered || !kv) return remembered;
			await ready;
			const stored = paintable(
				await kv.get<CachedWindow>(
					MESSAGES,
					windowKey(options.namespace, space),
				),
			);
			if (stored && !removed.has(space)) memory.remember(space, stored);
			return stored;
		},
		offer: (space, messages, offered) => {
			if (messages.length === 0 || removed.has(space)) return;
			const window = buildMessageWindow(messages, {
				space,
				cursor: offered.cursor,
				hasMore: offered.hasMore,
				readCursor: offered.readCursor,
				now: now(),
			});
			memory.remember(space, window);
			schedulerFor(space).schedule(window);
		},
		forget: (space) => {
			memory.forget(space);
			schedulers.delete(space);
			if (kv)
				track(
					ready.then(() =>
						kv.remove(MESSAGES, windowKey(options.namespace, space)),
					),
				);
		},
		forgetCommunity: (community) => {
			const matches = (space: string) => spaceAuthority(space) === community;
			memory.forgetWhere(matches);
			for (const space of [...schedulers.keys()]) {
				if (matches(space)) {
					schedulers.delete(space);
					removed.add(space);
				}
			}
			if (kv) {
				const prefix = `${options.namespace}:`;
				track(
					ready.then(() =>
						kv.removeWhere(
							MESSAGES,
							(key) =>
								key.startsWith(prefix) && matches(key.slice(prefix.length)),
						),
					),
				);
			}
		},
		flush: async () => {
			flushAll();
			await Promise.all([...writes]);
		},
		clear: async () => {
			memory.clear();
			schedulers.clear();
			await Promise.all([...writes]);
			if (kv) await clearDeviceCache(kv);
		},
	};
};
