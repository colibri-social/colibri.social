import { classifyResponse } from "@colibri-social/lib";
import { resolvePdsHost } from "../../auth/identity";
import { LABELER_DID } from "../supporter-link";
import { type BadgeDefinition, parseDefinitions, type RawLabel } from "./parse";

export const LABELER_URL = "https://labeler.colibri.social";

export const QUERY_LABELS_METHOD = "com.atproto.label.queryLabels";
export const DEFINITIONS_METHOD = "com.atproto.repo.getRecord";
const DEFINITIONS_COLLECTION = "social.colibri.labeler.service";

export const MAX_DIDS_PER_QUERY = 50;
const QUERY_LIMIT = 250;
const MAX_PAGES = 5;
const REQUEST_TIMEOUT_MS = 8000;

export type LabelPage = { labels: RawLabel[]; truncated: boolean };

export type LabelerTransport = {
	queryLabels: (dids: readonly string[]) => Promise<LabelPage>;
	definitions: () => Promise<BadgeDefinition[]>;
};

export type NetworkLabelerOptions = {
	url?: string;
	did?: string;
	fetcher?: typeof fetch;
	resolvePds?: (did: string) => Promise<string | undefined>;
};

const failure = async (res: Response, method: string) =>
	classifyResponse({
		status: res.status,
		body: await res.text().catch(() => ""),
		method,
		retryAfter: res.headers.get("retry-after"),
	});

export const createNetworkLabeler = (
	options: NetworkLabelerOptions = {},
): LabelerTransport => {
	const url = options.url ?? LABELER_URL;
	const did = options.did ?? LABELER_DID;
	const fetcher = options.fetcher ?? ((...args) => fetch(...args));
	const resolvePds = options.resolvePds ?? resolvePdsHost;

	const page = async (dids: readonly string[], cursor: string | undefined) => {
		const params = new URLSearchParams({
			sources: did,
			limit: String(QUERY_LIMIT),
		});
		for (const entry of dids) params.append("uriPatterns", entry);
		if (cursor) params.set("cursor", cursor);
		const res = await fetcher(`${url}/xrpc/${QUERY_LABELS_METHOD}?${params}`, {
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		});
		if (!res.ok) throw await failure(res, QUERY_LABELS_METHOD);
		return (await res.json()) as { labels?: RawLabel[]; cursor?: string };
	};

	return {
		queryLabels: async (dids) => {
			const labels: RawLabel[] = [];
			let cursor: string | undefined;
			for (let index = 0; index < MAX_PAGES; index++) {
				const body = await page(dids, cursor);
				const rows = body.labels ?? [];
				labels.push(...rows);
				if (rows.length < QUERY_LIMIT) return { labels, truncated: false };
				if (!body.cursor || body.cursor === cursor) {
					return { labels, truncated: false };
				}
				cursor = body.cursor;
			}
			return { labels, truncated: true };
		},
		definitions: async () => {
			const host = await resolvePds(did);
			if (!host) return [];
			const params = new URLSearchParams({
				repo: did,
				collection: DEFINITIONS_COLLECTION,
				rkey: "self",
			});
			const res = await fetcher(
				`https://${host}/xrpc/${DEFINITIONS_METHOD}?${params}`,
				{ signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
			);
			if (!res.ok) throw await failure(res, DEFINITIONS_METHOD);
			const body = (await res.json()) as { value?: unknown };
			return parseDefinitions(body.value);
		},
	};
};

export const emptyLabeler: LabelerTransport = {
	queryLabels: async () => ({ labels: [], truncated: false }),
	definitions: async () => [],
};
