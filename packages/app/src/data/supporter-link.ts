import {
	ColibriError,
	classifyResponse,
	classifyThrown,
	createLogger,
} from "@colibri-social/lib";
import { createSignal } from "solid-js";
import { resolvePdsHost } from "../auth/identity";

const log = createLogger("badges");

export const LABELER_DID = "did:plc:hgxdb52zedcotcvqstj6eob4";
export const LABELER_URL = "https://labeler.colibri.social";

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

export const LINK_METHOD = "social.colibri.labeler.linkExternalAccount";
export const UNLINK_METHOD = "social.colibri.labeler.unlinkExternalAccount";
export const OPEN_COLLECTIVE_PLATFORM = "opencollective";

const TOKEN_LIFETIME_S = 60;
const LINK_TIMEOUT_MS = 15_000;

export type ServiceAuthRequest = { aud: string; lxm: string; exp: number };

export type UnlinkResult = {
	unlinked: boolean;
	negatedLabelVals: string[];
};

export type SupporterLinkTransport = {
	start: () => Promise<string>;
	unlink: () => Promise<UnlinkResult>;
};

export const createSupporterLinkTransport = (options: {
	serviceAuth: (request: ServiceAuthRequest) => Promise<string>;
	native: () => boolean;
	url?: string;
	labeler?: string;
	fetcher?: typeof fetch;
	now?: () => number;
}): SupporterLinkTransport => {
	const url = options.url ?? LABELER_URL;
	const labeler = options.labeler ?? LABELER_DID;
	const fetcher = options.fetcher ?? ((...args) => fetch(...args));
	const now = options.now ?? Date.now;

	const call = async <T>(method: string, input: Record<string, unknown>) => {
		try {
			const token = await options.serviceAuth({
				aud: `${labeler}#atproto_labeler`,
				lxm: method,
				exp: Math.floor(now() / 1000) + TOKEN_LIFETIME_S,
			});
			const res = await fetcher(`${url}/xrpc/${method}`, {
				method: "POST",
				headers: {
					authorization: `Bearer ${token}`,
					"content-type": "application/json",
				},
				body: JSON.stringify(input),
				signal: AbortSignal.timeout(LINK_TIMEOUT_MS),
			});
			if (!res.ok)
				throw classifyResponse({
					status: res.status,
					body: await res.text().catch(() => ""),
					method,
					retryAfter: res.headers.get("retry-after"),
				});
			return (await res.json()) as T;
		} catch (error) {
			const classified = classifyThrown(error, { method });
			log.warn("the labeler rejected the Open Collective request", {
				code: classified.code,
			});
			throw classified;
		}
	};

	return {
		start: async () => {
			const { authorizeUrl } = await call<{ authorizeUrl?: unknown }>(
				LINK_METHOD,
				{ platform: OPEN_COLLECTIVE_PLATFORM, native: options.native() },
			);
			if (typeof authorizeUrl !== "string" || !authorizeUrl)
				throw new ColibriError({
					code: "MalformedResponse",
					method: LINK_METHOD,
				});
			return authorizeUrl;
		},
		unlink: async () => {
			const result = await call<{
				unlinked?: boolean;
				negatedLabelVals?: string[];
			}>(UNLINK_METHOD, { platform: OPEN_COLLECTIVE_PLATFORM });
			return {
				unlinked: result.unlinked === true,
				negatedLabelVals: result.negatedLabelVals ?? [],
			};
		},
	};
};

export type LinkOutcome =
	| { status: "linked"; account?: string }
	| { status: "error"; reason: string };

const LINK_OUTCOME_PARAMS = ["oc", "account", "reason"] as const;

export const readLinkOutcome = (
	params: URLSearchParams,
): LinkOutcome | undefined => {
	const status = params.get("oc");
	if (status === "linked") {
		log.info("returned from a completed Open Collective link");
		return { status: "linked", account: params.get("account") || undefined };
	}
	if (status !== "error") return undefined;
	const reason = params.get("reason") || "LinkFailed";
	log.warn("returned from a failed Open Collective link", { code: reason });
	return { status: "error", reason };
};

export const linkSuccessMessage = (outcome: { account?: string }) =>
	outcome.account
		? `Linked @${outcome.account}. Your badge is on its way.`
		: "Open Collective linked. Your badge is on its way.";

export const linkErrorMessage = (reason: string): string => {
	switch (reason) {
		case "GuestAccount":
			return "That Open Collective profile is still a guest profile. Sign in to Open Collective with the email you contributed with to claim it, then try again.";
		case "InvalidState":
		case "MissingState":
			return "That link attempt expired. Start again from here.";
		case "MissingCode":
			return "Open Collective didn't confirm the link. Try again.";
		case "Unreachable":
			return "Open Collective can't be reached right now. Try again in a few minutes.";
		default:
			return "Linking your Open Collective account didn't work. Try again.";
	}
};

const outcomeHandlers = new Set<(outcome: LinkOutcome) => void>();
let pendingOutcome: LinkOutcome | undefined;

export const deliverLinkOutcome = (outcome: LinkOutcome) => {
	if (outcomeHandlers.size === 0) {
		pendingOutcome = outcome;
		return;
	}
	for (const handler of [...outcomeHandlers]) handler(outcome);
};

export const listenForLinkOutcomes = (
	handler: (outcome: LinkOutcome) => void,
) => {
	outcomeHandlers.add(handler);
	const pending = pendingOutcome;
	pendingOutcome = undefined;
	if (pending) handler(pending);
	return () => {
		outcomeHandlers.delete(handler);
	};
};

export const captureWebLinkOutcome = (
	location: Pick<Location, "href"> = window.location,
	history: Pick<History, "state" | "replaceState"> = window.history,
) => {
	const url = new URL(location.href);
	const outcome = readLinkOutcome(url.searchParams);
	if (!outcome) return;
	for (const param of LINK_OUTCOME_PARAMS) url.searchParams.delete(param);
	history.replaceState(history.state, "", url);
	deliverLinkOutcome(outcome);
};

const [linkVersion, setLinkVersion] = createSignal(0);

export const supporterLinkVersion = linkVersion;

export const bumpSupporterLink = () => setLinkVersion((value) => value + 1);
