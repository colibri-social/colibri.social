import {
	asAtprotoDid,
	type HandleResolver,
	isAtprotoDid,
	type ResolvedHandle,
	type ResolveHandleOptions,
} from "@atproto/oauth-client-browser";
import { classifyThrown, readEnvelope } from "../errors/classify";
import { ColibriError } from "../errors/error";
import { getAppViewHost } from "../utils/appview";
import { createLogger } from "../utils/logger";

const log = createLogger("identity");

const WELL_KNOWN_TIMEOUT_MS = 4000;
const PDS_RESOLVE_TIMEOUT_MS = 6000;
const DID_DOC_TIMEOUT_MS = 6000;
const PLC_DIRECTORY = "https://plc.directory";
const PDS_HOST_CACHE_PREFIX = "colibri:pds:";

export const normalizeHandle = (input: string): string =>
	input.trim().replace(/^@/, "").toLowerCase();

export type ResolveSource = "well-known" | "appview";

export type ResolveOutcome = "hit" | "miss" | "error";

export type ResolveAttempt = {
	source: ResolveSource;
	outcome: ResolveOutcome;
};

export type ResolveTrail = Array<ResolveAttempt>;

export const describeResolveTrail = (trail: ResolveTrail): string =>
	trail.map((attempt) => `${attempt.source}:${attempt.outcome}`).join(" ");

const handleNotFound = (input: string, trail: ResolveTrail): ColibriError =>
	new ColibriError({
		code: "HandleNotFound",
		method: "com.atproto.identity.resolveHandle",
		context: { handle: input, resolveTrail: describeResolveTrail(trail) },
	});

const wellKnownDid = async (handle: string): Promise<string | undefined> => {
	try {
		const res = await fetch(`https://${handle}/.well-known/atproto-did`, {
			signal: AbortSignal.timeout(WELL_KNOWN_TIMEOUT_MS),
		});
		if (!res.ok) return undefined;

		const body = (await res.text()).trim();
		return isAtprotoDid(body) ? body : undefined;
	} catch {
		return undefined;
	}
};

const resolveHandleOnAppView = async (
	handle: string,
): Promise<string | undefined> => {
	let res: Response;
	try {
		res = await fetch(
			`${getAppViewHost("http")}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`,
			{ signal: AbortSignal.timeout(PDS_RESOLVE_TIMEOUT_MS) },
		);
	} catch (err) {
		throw classifyThrown(err, { method: "com.atproto.identity.resolveHandle" });
	}

	if (!res.ok) {
		const body = await res.text().catch(() => "");
		const envelope = readEnvelope(body);
		if (res.status === 400 && envelope.code === "InvalidRequest") {
			return undefined;
		}

		const failure = new ColibriError({
			code: res.status >= 500 ? "UpstreamFailure" : "InvalidRequest",
			status: res.status,
			method: "com.atproto.identity.resolveHandle",
			serverMessage: envelope.message,
		});
		throw failure;
	}

	const data = (await res.json().catch(() => ({}))) as { did?: string };
	return data.did || undefined;
};

type ResolveResult = {
	did?: string;
	trail: ResolveTrail;
};

const resolveHandleCore = async (handle: string): Promise<ResolveResult> => {
	const wellKnown = wellKnownDid(handle);
	const appView = resolveHandleOnAppView(handle).then(
		(did) => ({ did }),
		(err: unknown) => ({ err }),
	);

	const fromAppView = await appView;
	const trail: ResolveTrail = [];

	if ("did" in fromAppView && fromAppView.did) {
		trail.push({ source: "appview", outcome: "hit" });
		return { did: fromAppView.did, trail };
	}

	trail.push({
		source: "appview",
		outcome: "err" in fromAppView ? "error" : "miss",
	});

	const fromWellKnown = await wellKnown;
	trail.push({
		source: "well-known",
		outcome: fromWellKnown ? "hit" : "miss",
	});

	if (fromWellKnown) return { did: fromWellKnown, trail };
	if ("err" in fromAppView) throw fromAppView.err;

	return { trail };
};

export const resolveHandleToDid = async (input: string): Promise<string> => {
	if (input.startsWith("did:")) return input;

	const { did, trail } = await resolveHandleCore(input);
	if (!did) throw handleNotFound(input, trail);

	return did;
};

export const handleResolver: HandleResolver = {
	async resolve(
		handle: string,
		_options?: ResolveHandleOptions,
	): Promise<ResolvedHandle> {
		const { did } = await resolveHandleCore(handle);
		return did ? asAtprotoDid(did) : null;
	},
};

export type AtprotoDidDocument = {
	service?: Array<{ id?: string; type?: string; serviceEndpoint?: string }>;
};

const didDocumentUrl = (did: string): string | undefined => {
	if (did.startsWith("did:plc:")) return `${PLC_DIRECTORY}/${did}`;
	if (did.startsWith("did:web:")) {
		const authority = did.slice("did:web:".length).replaceAll(":", "/");
		return `https://${decodeURIComponent(authority)}/.well-known/did.json`;
	}
	return undefined;
};

export const resolveDidDocument = async (
	did: string,
): Promise<AtprotoDidDocument | undefined> => {
	const url = didDocumentUrl(did);
	if (!url) return undefined;

	try {
		const res = await fetch(url, {
			signal: AbortSignal.timeout(DID_DOC_TIMEOUT_MS),
		});
		if (!res.ok) return undefined;

		return (await res.json()) as AtprotoDidDocument;
	} catch (err) {
		log.warn("resolving the did document failed", {
			code: classifyThrown(err).code,
			did,
		});
		return undefined;
	}
};

const pdsHostCacheKey = (did: string) => `${PDS_HOST_CACHE_PREFIX}${did}`;

export const peekCachedPdsForDid = (did: string): string | undefined => {
	try {
		return localStorage.getItem(pdsHostCacheKey(did)) ?? undefined;
	} catch {
		return undefined;
	}
};

const extractPdsHost = (doc: AtprotoDidDocument): string | undefined => {
	const service = doc.service?.find(
		(entry) =>
			entry.id === "#atproto_pds" ||
			entry.id?.endsWith("#atproto_pds") ||
			entry.type === "AtprotoPersonalDataServer",
	);
	if (!service?.serviceEndpoint) return undefined;

	try {
		return new URL(service.serviceEndpoint).host;
	} catch {
		return undefined;
	}
};

export const resolvePdsForDid = async (
	did: string,
): Promise<string | undefined> => {
	const doc = await resolveDidDocument(did);
	if (!doc) return undefined;

	const host = extractPdsHost(doc);
	if (!host) return undefined;

	try {
		localStorage.setItem(pdsHostCacheKey(did), host);
	} catch {}

	return host;
};

export const pdsFaviconUrl = (host: string): string =>
	`https://${host}/favicon.ico`;
