import { classifyResponse, classifyThrown } from "../errors/classify";
import { createLogger } from "../utils/logger";
import { perfNow, recordRequest } from "../utils/perf";
import { resolvePdsForDid } from "./identity";

const log = createLogger("activity-source");

const METHOD = "com.atproto.repo.listRecords";

export type ActivityProvider = "teal.fm" | "rocksky.app" | "atradio.fm";

const PROVIDERS: ReadonlyArray<{
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

const PRESENT_TTL_MS = 6 * 60 * 60 * 1000;

const ABSENT_TTL_MS = 60_000;

const FAILURE_TTL_MS = 30_000;

const REQUEST_TIMEOUT_MS = 8000;

const storageKey = (did: string) => `colibri:activity-source:v3:${did}`;

type Entry = { provider: ActivityProvider | null; expiresAt: number };

const cache = new Map<string, Entry>();

const inflight = new Map<string, Promise<ActivityProvider | null>>();

const isProvider = (value: unknown): value is ActivityProvider =>
	PROVIDERS.some((provider) => provider.id === value);

const readStored = (did: string): Entry | undefined => {
	try {
		const raw = localStorage.getItem(storageKey(did));
		if (!raw) return undefined;

		const parsed = JSON.parse(raw) as Partial<Entry>;
		if (typeof parsed.expiresAt !== "number") return undefined;
		if (parsed.provider !== null && !isProvider(parsed.provider))
			return undefined;

		return { provider: parsed.provider ?? null, expiresAt: parsed.expiresAt };
	} catch {
		return undefined;
	}
};

const writeStored = (did: string, entry: Entry): void => {
	if (!entry.provider) return;
	try {
		localStorage.setItem(storageKey(did), JSON.stringify(entry));
	} catch {}
};

const fresh = (entry: Entry | undefined): Entry | undefined =>
	entry && entry.expiresAt > Date.now() ? entry : undefined;

export const peekActivitySource = (
	did: string,
): ActivityProvider | null | undefined => {
	const entry = fresh(cache.get(did)) ?? fresh(readStored(did));
	if (!entry) return undefined;

	cache.set(did, entry);
	return entry.provider;
};

const hasAnyRecord = async (
	host: string,
	did: string,
	collection: string,
): Promise<boolean> => {
	const params = new URLSearchParams({
		repo: did,
		collection,
		limit: "1",
	});

	const start = perfNow();
	const res = await fetch(`https://${host}/xrpc/${METHOD}?${params}`, {
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
	});
	recordRequest(METHOD, start, perfNow() - start, res.ok);

	if (!res.ok) {
		throw classifyResponse({
			status: res.status,
			body: await res.text().catch(() => ""),
			method: METHOD,
			retryAfter: res.headers.get("retry-after"),
		});
	}

	const body = (await res.json()) as { records?: Array<unknown> };
	return (body.records?.length ?? 0) > 0;
};

const lookup = async (did: string): Promise<ActivityProvider | null> => {
	const host = await resolvePdsForDid(did);
	if (!host) return null;

	for (const provider of PROVIDERS) {
		for (const collection of provider.collections) {
			if (await hasAnyRecord(host, did, collection)) return provider.id;
		}
	}
	return null;
};

export const detectActivitySource = async (
	did: string,
): Promise<ActivityProvider | null> => {
	const cached = peekActivitySource(did);
	if (cached !== undefined) return cached;

	const pending = inflight.get(did);
	if (pending) return pending;

	const request = lookup(did)
		.then((provider) => {
			const entry = {
				provider,
				expiresAt: Date.now() + (provider ? PRESENT_TTL_MS : ABSENT_TTL_MS),
			};
			cache.set(did, entry);
			writeStored(did, entry);
			return provider;
		})
		.catch((err: unknown) => {
			log.warn("checking for listening records failed", {
				code: classifyThrown(err, { method: METHOD }).code,
			});
			cache.set(did, {
				provider: null,
				expiresAt: Date.now() + FAILURE_TTL_MS,
			});
			return null;
		})
		.finally(() => {
			inflight.delete(did);
		});

	inflight.set(did, request);
	return request;
};

export const invalidateActivitySource = (did: string): void => {
	cache.delete(did);
	try {
		localStorage.removeItem(storageKey(did));
	} catch {}
};
