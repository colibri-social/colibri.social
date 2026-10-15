import {
	classifyResponse,
	classifyThrown,
	createLogger,
} from "@colibri-social/lib";
import { resolvePdsHost } from "../auth/identity";

const log = createLogger("badges");

export const LABELER_DID = "did:plc:hgxdb52zedcotcvqstj6eob4";

const METHOD = "com.atproto.repo.getRecord";
const COLLECTION = "social.colibri.labeler.attestation";
const REQUEST_TIMEOUT_MS = 8000;

export type SupporterAccount = {
	account?: string;
	verifiedAt?: string;
};

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
	typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;

export const parseAttestation = (value: unknown): SupporterAccount | null => {
	const raw = asRecord(value);
	if (!raw) return null;
	if (typeof raw.platform !== "string" || !raw.platform) return null;
	if (typeof raw.accountId !== "string" || !raw.accountId) return null;
	return {
		account:
			typeof raw.accountSlug === "string" && raw.accountSlug
				? raw.accountSlug
				: undefined,
		verifiedAt:
			typeof raw.verifiedAt === "string" && raw.verifiedAt
				? raw.verifiedAt
				: undefined,
	};
};

export const formatVerifiedAt = (
	value: string | undefined,
	locale?: string,
) => {
	if (!value) return undefined;
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return undefined;
	return parsed.toLocaleDateString(locale, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
};

export const fetchSupporterAccount = async (
	subject: string,
	options: {
		labeler?: string;
		resolvePds?: (did: string) => Promise<string | undefined>;
		fetcher?: typeof fetch;
	} = {},
): Promise<SupporterAccount | null> => {
	const labeler = options.labeler ?? LABELER_DID;
	const fetcher = options.fetcher ?? fetch;
	try {
		const host = await (options.resolvePds ?? resolvePdsHost)(labeler);
		if (!host) {
			log.warn("the labeler has no server we can reach");
			return null;
		}
		const params = new URLSearchParams({
			repo: labeler,
			collection: COLLECTION,
			rkey: subject,
		});
		const res = await fetcher(`https://${host}/xrpc/${METHOD}?${params}`, {
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		});
		if (res.status === 400 || res.status === 404) return null;
		if (!res.ok)
			throw classifyResponse({
				status: res.status,
				body: await res.text().catch(() => ""),
				method: METHOD,
				retryAfter: res.headers.get("retry-after"),
			});
		const body = (await res.json()) as { value?: unknown };
		return parseAttestation(body.value);
	} catch (error) {
		log.warn("could not read the Open Collective link", {
			code: classifyThrown(error, { method: METHOD }).code,
		});
		throw error;
	}
};
