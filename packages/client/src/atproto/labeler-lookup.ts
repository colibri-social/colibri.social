import { classifyResponse, classifyThrown } from "../errors/classify";
import { getLabelerDid, getLabelerUrl } from "../utils/labeler";
import { createLogger } from "../utils/logger";
import { perfNow, recordRequest } from "../utils/perf";
import type { LabelerLabel, LabelerLabelsSnapshot } from "./cache/schema";
import {
	cacheEnabled,
	deleteLabelerLabels,
	readManyLabelerLabels,
	writeManyLabelerLabels,
} from "./cache/store";

const log = createLogger("labels");

export type { LabelerLabel } from "./cache/schema";

const METHOD = "com.atproto.label.queryLabels";

const LABELS_TTL_MS = 15 * 60 * 1000;
const FAILURE_TTL_MS = 30_000;
const TRUNCATED_TTL_MS = 60_000;
const MAX_DIDS_PER_QUERY = 50;
const QUERY_LIMIT = 250;
const MAX_PAGES = 5;
const FLUSH_WINDOW_MS = 48;
const MAX_FLUSH_DELAY_MS = 150;
const REQUEST_TIMEOUT_MS = 8000;

interface RawLabel {
	uri: string;
	val: string;
	neg?: boolean;
	exp?: string;
	cts: string;
}

const labelsCache = new Map<
	string,
	{ labels: Array<LabelerLabel>; expiresAt: number }
>();
const inflightLabels = new Map<string, Promise<Array<LabelerLabel>>>();

let pendingDids: Array<string> = [];
let pendingResolvers = new Map<
	string,
	Array<(labels: Array<LabelerLabel>) => void>
>();
let flushTimer: ReturnType<typeof setTimeout> | undefined;
let firstPendingAt: number | undefined;

const isExpired = (label: LabelerLabel): boolean =>
	label.exp !== undefined && new Date(label.exp).getTime() <= Date.now();

const resolveActiveLabels = (
	raw: Array<{ val: string; neg?: boolean; exp?: string; cts: string }>,
): Array<LabelerLabel> => {
	const byVal = new Map<string, LabelerLabel & { cts: string }>();
	for (const label of raw) {
		const existing = byVal.get(label.val);
		if (existing && existing.cts > label.cts) continue;
		byVal.set(label.val, {
			val: label.val,
			neg: label.neg ?? false,
			exp: label.exp,
			cts: label.cts,
		});
	}
	return Array.from(byVal.values())
		.filter((label) => !label.neg)
		.filter((label) => !isExpired(label));
};

const fetchPage = async (
	dids: ReadonlyArray<string>,
	cursor: string | undefined,
): Promise<{ labels?: Array<RawLabel>; cursor?: string }> => {
	const params = new URLSearchParams({
		sources: getLabelerDid(),
		limit: String(QUERY_LIMIT),
	});
	for (const did of dids) params.append("uriPatterns", did);
	if (cursor) params.set("cursor", cursor);

	const start = perfNow();
	const res = await fetch(`${getLabelerUrl()}/xrpc/${METHOD}?${params}`, {
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
	});
	recordRequest(METHOD, start, perfNow() - start, res.ok);

	if (!res.ok) {
		const body = await res.text().catch(() => "");
		throw classifyResponse({
			status: res.status,
			body,
			method: METHOD,
			retryAfter: res.headers.get("retry-after"),
		});
	}

	return (await res.json()) as { labels?: Array<RawLabel>; cursor?: string };
};

const fetchLabelsForDids = async (
	dids: ReadonlyArray<string>,
): Promise<{ rows: Array<RawLabel>; truncated: boolean }> => {
	const rows: Array<RawLabel> = [];
	let cursor: string | undefined;

	for (let page = 0; page < MAX_PAGES; page++) {
		const body = await fetchPage(dids, cursor);
		const labels = body.labels ?? [];
		rows.push(...labels);

		if (labels.length < QUERY_LIMIT) return { rows, truncated: false };

		const next = body.cursor;
		if (!next || next === cursor) return { rows, truncated: false };
		cursor = next;
	}

	return { rows, truncated: true };
};

const groupByUri = (rows: Array<RawLabel>): Map<string, Array<RawLabel>> => {
	const byUri = new Map<string, Array<RawLabel>>();
	for (const row of rows) {
		const bucket = byUri.get(row.uri);
		if (bucket) bucket.push(row);
		else byUri.set(row.uri, [row]);
	}
	return byUri;
};

const flushBatch = async (): Promise<void> => {
	const dids = pendingDids;
	const resolvers = pendingResolvers;
	pendingDids = [];
	pendingResolvers = new Map();
	flushTimer = undefined;
	firstPendingAt = undefined;

	const persist: Array<readonly [string, LabelerLabelsSnapshot]> = [];

	const settle = (
		did: string,
		labels: Array<LabelerLabel>,
		ttlMs: number,
		persistable: boolean,
	): void => {
		labelsCache.set(did, { labels, expiresAt: Date.now() + ttlMs });
		if (persistable) persist.push([did, { labels, ts: Date.now() }] as const);
		for (const resolve of resolvers.get(did) ?? []) resolve(labels);
	};

	let misses: Array<string> = dids;

	if (cacheEnabled()) {
		const snapshots = await readManyLabelerLabels(dids);
		misses = [];
		for (const did of dids) {
			const snap = snapshots.get(did);
			const age = snap ? Date.now() - snap.ts : Number.POSITIVE_INFINITY;
			if (snap && age < LABELS_TTL_MS) {
				settle(did, snap.labels, LABELS_TTL_MS - age, false);
			} else {
				misses.push(did);
			}
		}
	}

	for (let i = 0; i < misses.length; i += MAX_DIDS_PER_QUERY) {
		const chunk = misses.slice(i, i + MAX_DIDS_PER_QUERY);
		try {
			const { rows, truncated } = await fetchLabelsForDids(chunk);
			const byUri = groupByUri(rows);
			for (const did of chunk) {
				settle(
					did,
					resolveActiveLabels(byUri.get(did) ?? []),
					truncated ? TRUNCATED_TTL_MS : LABELS_TTL_MS,
					!truncated,
				);
			}
			if (truncated) {
				log.warn("labeler badge query hit the page limit", {
					size: chunk.length,
				});
			}
		} catch (err) {
			const failure = classifyThrown(err, { method: METHOD });
			log.warn("fetching labeler badges failed", {
				size: chunk.length,
				code: failure.code,
			});
			for (const did of chunk) settle(did, [], FAILURE_TTL_MS, false);
		}
	}

	if (persist.length > 0) void writeManyLabelerLabels(persist);
};

const schedule = (): void => {
	if (pendingDids.length >= MAX_DIDS_PER_QUERY) {
		if (flushTimer !== undefined) clearTimeout(flushTimer);
		flushTimer = undefined;
		void flushBatch();
		return;
	}

	const now = Date.now();
	firstPendingAt ??= now;
	const budget = Math.max(0, firstPendingAt + MAX_FLUSH_DELAY_MS - now);

	if (flushTimer !== undefined) clearTimeout(flushTimer);
	flushTimer = setTimeout(
		() => void flushBatch(),
		Math.min(FLUSH_WINDOW_MS, budget),
	);
};

export const invalidateLabelerBadges = (did: string): void => {
	labelsCache.delete(did);
	inflightLabels.delete(did);
	if (cacheEnabled()) void deleteLabelerLabels(did);
};

export const getLabelerBadges = (did: string): Promise<Array<LabelerLabel>> => {
	const cached = labelsCache.get(did);
	if (cached && cached.expiresAt > Date.now()) {
		return Promise.resolve(cached.labels);
	}

	const existing = inflightLabels.get(did);
	if (existing) return existing;

	const promise = new Promise<Array<LabelerLabel>>((resolve) => {
		const resolvers = pendingResolvers.get(did);
		if (resolvers) {
			resolvers.push(resolve);
		} else {
			pendingDids.push(did);
			pendingResolvers.set(did, [resolve]);
		}
		schedule();
	}).finally(() => {
		inflightLabels.delete(did);
	});

	inflightLabels.set(did, promise);
	return promise;
};
