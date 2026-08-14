import { classifyResponse, classifyThrown } from "../errors/classify";
import { getLabelerDid } from "../utils/labeler";
import { createLogger } from "../utils/logger";
import { perfNow, recordRequest } from "../utils/perf";
import type { ExternalAccountLink } from "./cache/schema";
import {
	cacheEnabled,
	deleteExternalAccountLink,
	readExternalAccountLink,
	writeExternalAccountLink,
} from "./cache/store";
import { resolvePdsHost } from "./resolve-pds";

const log = createLogger("badges");

export type { ExternalAccountLink } from "./cache/schema";

const METHOD = "com.atproto.repo.getRecord";
const COLLECTION = "social.colibri.labeler.attestation";

const LINK_TTL_MS = 5 * 60 * 1000;
const FAILURE_TTL_MS = 30_000;
const REQUEST_TIMEOUT_MS = 8000;

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
	typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;

const parseLink = (value: unknown): ExternalAccountLink | null => {
	const raw = asRecord(value);
	if (!raw) return null;

	const { platform, accountId, accountSlug, verifiedAt } = raw;
	if (typeof platform !== "string" || platform.length === 0) return null;
	if (typeof accountId !== "string" || accountId.length === 0) return null;

	return {
		platform,
		accountId,
		...(typeof accountSlug === "string" && accountSlug.length > 0
			? { accountSlug }
			: {}),
		verifiedAt: typeof verifiedAt === "string" ? verifiedAt : "",
	};
};

const fetchLink = async (
	labelerDid: string,
	subject: string,
): Promise<ExternalAccountLink | null> => {
	const host = await resolvePdsHost(labelerDid);
	if (!host) {
		log.warn("the labeler has no resolvable PDS, cannot read the link", {
			did: labelerDid,
		});
		return null;
	}

	const params = new URLSearchParams({
		repo: labelerDid,
		collection: COLLECTION,
		rkey: subject,
	});

	const start = perfNow();
	const res = await fetch(`https://${host}/xrpc/${METHOD}?${params}`, {
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
	});
	recordRequest(METHOD, start, perfNow() - start, res.ok);

	if (res.status === 400 || res.status === 404) return null;

	if (!res.ok) {
		const body = await res.text().catch(() => "");
		throw classifyResponse({
			status: res.status,
			body,
			method: METHOD,
			retryAfter: res.headers.get("retry-after"),
		});
	}

	const body = (await res.json()) as { value?: unknown };
	return parseLink(body.value);
};

const memory = new Map<
	string,
	{ link: ExternalAccountLink | null; expiresAt: number }
>();
const inflight = new Map<string, Promise<ExternalAccountLink | null>>();

const cacheKey = (labelerDid: string, subject: string): string =>
	`${labelerDid}:${subject}`;

export const getExternalAccountLink = (
	subject: string,
): Promise<ExternalAccountLink | null> => {
	const labelerDid = getLabelerDid();
	const key = cacheKey(labelerDid, subject);

	const cached = memory.get(key);
	if (cached && cached.expiresAt > Date.now()) {
		return Promise.resolve(cached.link);
	}

	const existing = inflight.get(key);
	if (existing) return existing;

	const promise = (async () => {
		if (cacheEnabled()) {
			const snap = await readExternalAccountLink(labelerDid, subject);
			if (snap && Date.now() - snap.ts < LINK_TTL_MS) {
				memory.set(key, {
					link: snap.link,
					expiresAt: snap.ts + LINK_TTL_MS,
				});
				return snap.link;
			}
		}

		let link: ExternalAccountLink | null;
		try {
			link = await fetchLink(labelerDid, subject);
		} catch (err) {
			log.warn("reading the external account link failed", {
				code: classifyThrown(err, { method: METHOD }).code,
			});
			memory.set(key, { link: null, expiresAt: Date.now() + FAILURE_TTL_MS });
			return null;
		}

		memory.set(key, { link, expiresAt: Date.now() + LINK_TTL_MS });
		if (cacheEnabled()) {
			void writeExternalAccountLink(labelerDid, subject, {
				link,
				ts: Date.now(),
			});
		}
		return link;
	})().finally(() => {
		inflight.delete(key);
	});

	inflight.set(key, promise);
	return promise;
};

export const invalidateExternalAccountLink = (subject: string): void => {
	const labelerDid = getLabelerDid();
	const key = cacheKey(labelerDid, subject);
	memory.delete(key);
	inflight.delete(key);
	if (cacheEnabled()) void deleteExternalAccountLink(labelerDid, subject);
};
