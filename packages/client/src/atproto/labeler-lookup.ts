import type { LabelerLabel } from "./cache/schema";
import {
	cacheEnabled,
	readLabelerLabels,
	writeLabelerLabels,
} from "./cache/store";

export type { LabelerLabel } from "./cache/schema";

const LABELER_SERVICE = "https://labeler.colibri.social";
const LABELER_DID = "did:plc:hgxdb52zedcotcvqstj6eob4";

const LABELS_TTL_MS = 15 * 60 * 1000;

const labelsCache = new Map<
	string,
	{ labels: Array<LabelerLabel>; expiresAt: number }
>();
const inflightLabels = new Map<string, Promise<Array<LabelerLabel>>>();

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

const fetchLabels = async (did: string): Promise<Array<LabelerLabel>> => {
	const params = new URLSearchParams({ sources: LABELER_DID, limit: "250" });
	params.append("uriPatterns", did);

	const res = await fetch(
		`${LABELER_SERVICE}/xrpc/com.atproto.label.queryLabels?${params}`,
	);
	if (!res.ok) throw new Error(`queryLabels failed: ${res.status}`);

	const body = (await res.json()) as {
		labels: Array<{ val: string; neg?: boolean; exp?: string; cts: string }>;
	};
	return resolveActiveLabels(body.labels);
};

export const getLabelerBadges = (did: string): Promise<Array<LabelerLabel>> => {
	const cached = labelsCache.get(did);
	if (cached && cached.expiresAt > Date.now()) {
		return Promise.resolve(cached.labels);
	}

	const existing = inflightLabels.get(did);
	if (existing) return existing;

	const promise = (async () => {
		if (cacheEnabled()) {
			const cached = await readLabelerLabels(did);
			if (cached && Date.now() - cached.ts < LABELS_TTL_MS) {
				labelsCache.set(did, {
					labels: cached.labels,
					expiresAt: cached.ts + LABELS_TTL_MS,
				});
				return cached.labels;
			}
		}

		let labels: Array<LabelerLabel>;
		try {
			labels = await fetchLabels(did);
		} catch (err) {
			console.error(err);
			labels = [];
		}

		labelsCache.set(did, { labels, expiresAt: Date.now() + LABELS_TTL_MS });
		void writeLabelerLabels(did, { labels, ts: Date.now() });
		return labels;
	})().finally(() => {
		inflightLabels.delete(did);
	});

	inflightLabels.set(did, promise);
	return promise;
};
