import {
	classifyResponse,
	classifyThrown,
	createLogger,
} from "@colibri-social/lib";
import { resolvePdsHost } from "../auth/identity";
import { readStoredJSON, writeStored, writeStoredJSON } from "./persist";

const log = createLogger("activity-source");

const METHOD = "com.atproto.repo.listRecords";

export type ActivityProvider = "teal.fm" | "rocksky.app" | "atradio.fm";

export const ACTIVITY_PROVIDERS: ReadonlyArray<{
	id: ActivityProvider;
	collections: readonly string[];
}> = [
	{
		id: "teal.fm",
		collections: [
			"fm.teal.actor.status",
			"fm.teal.alpha.actor.status",
			"fm.teal.feed.play",
			"fm.teal.alpha.feed.play",
		],
	},
	{
		id: "rocksky.app",
		collections: ["app.rocksky.actor.status", "app.rocksky.scrobble"],
	},
	{
		id: "atradio.fm",
		collections: ["fm.atradio.actor.status", "fm.atradio.favorite"],
	},
];

export const PRESENT_TTL_MS = 6 * 60 * 60 * 1000;
export const ABSENT_TTL_MS = 60_000;
export const FAILURE_TTL_MS = 30_000;
const REQUEST_TIMEOUT_MS = 8000;

const storageKey = (did: string) => `colibri:activity-source:v1:${did}`;

type Entry = { provider: ActivityProvider | null; expiresAt: number };

const isProvider = (value: unknown): value is ActivityProvider =>
	ACTIVITY_PROVIDERS.some((provider) => provider.id === value);

const isEntry = (value: unknown): value is Entry =>
	typeof value === "object" &&
	value !== null &&
	typeof (value as Entry).expiresAt === "number" &&
	((value as Entry).provider === null || isProvider((value as Entry).provider));

export type ActivitySourceOptions = {
	resolvePds?: (did: string) => Promise<string | undefined>;
	fetcher?: typeof fetch;
	now?: () => number;
};

export const createActivitySourceDetector = (
	options: ActivitySourceOptions = {},
) => {
	const resolvePds = options.resolvePds ?? resolvePdsHost;
	const fetcher = options.fetcher ?? ((...args) => fetch(...args));
	const now = options.now ?? Date.now;
	const cache = new Map<string, Entry>();
	const inflight = new Map<string, Promise<ActivityProvider | null>>();

	const fresh = (entry: Entry | undefined) =>
		entry && entry.expiresAt > now() ? entry : undefined;

	const peek = (did: string): ActivityProvider | null | undefined => {
		const entry =
			fresh(cache.get(did)) ?? fresh(readStoredJSON(storageKey(did), isEntry));
		if (!entry) return undefined;
		cache.set(did, entry);
		return entry.provider;
	};

	const hasAnyRecord = async (
		host: string,
		did: string,
		collection: string,
	) => {
		const params = new URLSearchParams({ repo: did, collection, limit: "1" });
		const res = await fetcher(`https://${host}/xrpc/${METHOD}?${params}`, {
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		});
		if (!res.ok) {
			throw classifyResponse({
				status: res.status,
				body: await res.text().catch(() => ""),
				method: METHOD,
				retryAfter: res.headers.get("retry-after"),
			});
		}
		const body = (await res.json()) as { records?: unknown[] };
		return (body.records?.length ?? 0) > 0;
	};

	const lookup = async (did: string): Promise<ActivityProvider | null> => {
		const host = await resolvePds(did);
		if (!host) return null;
		for (const provider of ACTIVITY_PROVIDERS) {
			for (const collection of provider.collections) {
				if (await hasAnyRecord(host, did, collection)) return provider.id;
			}
		}
		return null;
	};

	const detect = (did: string): Promise<ActivityProvider | null> => {
		const cached = peek(did);
		if (cached !== undefined) return Promise.resolve(cached);
		const pending = inflight.get(did);
		if (pending) return pending;
		const request = lookup(did)
			.then((provider) => {
				const entry: Entry = {
					provider,
					expiresAt: now() + (provider ? PRESENT_TTL_MS : ABSENT_TTL_MS),
				};
				cache.set(did, entry);
				if (provider) writeStoredJSON(storageKey(did), entry);
				return provider;
			})
			.catch((error: unknown) => {
				log.warn("could not check for listening records", {
					code: classifyThrown(error, { method: METHOD }).code,
				});
				cache.set(did, { provider: null, expiresAt: now() + FAILURE_TTL_MS });
				return null;
			})
			.finally(() => inflight.delete(did));
		inflight.set(did, request);
		return request;
	};

	const invalidate = (did: string) => {
		cache.delete(did);
		writeStored(storageKey(did), undefined);
	};

	return { detect, peek, invalidate };
};

export type ActivitySourceDetector = ReturnType<
	typeof createActivitySourceDetector
>;
