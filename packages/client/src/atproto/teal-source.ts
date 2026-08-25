import { classifyResponse, classifyThrown } from "../errors/classify";
import { createLogger } from "../utils/logger";
import { perfNow, recordRequest } from "../utils/perf";
import { resolvePdsForDid } from "./identity";

const log = createLogger("activity-source");

const METHOD = "com.atproto.repo.listRecords";

const COLLECTIONS = ["fm.teal.actor.status", "fm.teal.feed.play"];

const SUCCESS_TTL_MS = 6 * 60 * 60 * 1000;

const FAILURE_TTL_MS = 30_000;

const REQUEST_TIMEOUT_MS = 8000;

const storageKey = (did: string) => `colibri:activity-source:${did}`;

type Entry = { present: boolean; expiresAt: number };

const cache = new Map<string, Entry>();

const inflight = new Map<string, Promise<boolean>>();

const readStored = (did: string): Entry | undefined => {
	try {
		const raw = localStorage.getItem(storageKey(did));
		if (!raw) return undefined;
		const parsed = JSON.parse(raw) as Partial<Entry>;
		if (typeof parsed.present !== "boolean") return undefined;
		if (typeof parsed.expiresAt !== "number") return undefined;
		return { present: parsed.present, expiresAt: parsed.expiresAt };
	} catch {
		return undefined;
	}
};

const writeStored = (did: string, entry: Entry): void => {
	try {
		localStorage.setItem(storageKey(did), JSON.stringify(entry));
	} catch {}
};

const fresh = (entry: Entry | undefined): Entry | undefined =>
	entry && entry.expiresAt > Date.now() ? entry : undefined;

export const peekActivitySource = (did: string): boolean | undefined => {
	const entry = fresh(cache.get(did)) ?? fresh(readStored(did));
	if (!entry) return undefined;

	cache.set(did, entry);
	return entry.present;
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

const lookup = async (did: string): Promise<boolean> => {
	const host = await resolvePdsForDid(did);
	if (!host) return false;

	for (const collection of COLLECTIONS) {
		if (await hasAnyRecord(host, did, collection)) return true;
	}
	return false;
};

export const hasActivitySource = async (did: string): Promise<boolean> => {
	const cached = peekActivitySource(did);
	if (cached !== undefined) return cached;

	const pending = inflight.get(did);
	if (pending) return pending;

	const request = lookup(did)
		.then((present) => {
			const entry = { present, expiresAt: Date.now() + SUCCESS_TTL_MS };
			cache.set(did, entry);
			writeStored(did, entry);
			return present;
		})
		.catch((err: unknown) => {
			log.warn("checking for teal.fm records failed", {
				code: classifyThrown(err, { method: METHOD }).code,
			});
			cache.set(did, {
				present: false,
				expiresAt: Date.now() + FAILURE_TTL_MS,
			});
			return false;
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
