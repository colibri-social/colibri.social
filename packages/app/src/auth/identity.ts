import {
	asAtprotoDid,
	type HandleResolver,
	isAtprotoDid,
	type ResolvedHandle,
} from "@atproto/oauth-client-browser";
import {
	ColibriError,
	classifyThrown,
	createLogger,
	readEnvelope,
} from "@colibri-social/lib";
import { appViewHost } from "./appview";

const log = createLogger("identity");

const WELL_KNOWN_TIMEOUT_MS = 4_000;
const APPVIEW_RESOLVE_TIMEOUT_MS = 6_000;
const TYPEAHEAD_SERVICE = "https://typeahead.waow.tech";
const TYPEAHEAD_LIMIT = 8;
const PLC_DIRECTORY = "https://plc.directory";
const DID_DOC_TIMEOUT_MS = 6_000;

export type AccountSuggestion = {
	did: string;
	handle: string;
	displayName?: string;
	avatar?: string;
};

type Outcome = "hit" | "miss" | "error";

type ResolveTrail = Array<{
	source: "appview" | "well-known";
	outcome: Outcome;
}>;

export const normalizeHandle = (input: string): string =>
	input.trim().replace(/^@/, "").toLowerCase();

const describeTrail = (trail: ResolveTrail) =>
	trail.map((step) => `${step.source}:${step.outcome}`).join(" ");

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

const appViewDidFor = async (handle: string): Promise<string | undefined> => {
	let res: Response;
	try {
		res = await fetch(
			`${appViewHost("http")}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`,
			{ signal: AbortSignal.timeout(APPVIEW_RESOLVE_TIMEOUT_MS) },
		);
	} catch (err) {
		throw classifyThrown(err, { method: "com.atproto.identity.resolveHandle" });
	}
	if (!res.ok) {
		const envelope = readEnvelope(await res.text().catch(() => ""));
		if (res.status === 400 && envelope.code === "InvalidRequest") {
			return undefined;
		}
		throw new ColibriError({
			code: res.status >= 500 ? "UpstreamFailure" : "InvalidRequest",
			status: res.status,
			method: "com.atproto.identity.resolveHandle",
			serverMessage: envelope.message,
		});
	}
	const data = (await res.json().catch(() => ({}))) as { did?: string };
	return data.did || undefined;
};

const resolve = async (
	handle: string,
): Promise<{ did?: string; trail: ResolveTrail }> => {
	const wellKnown = wellKnownDid(handle);
	const fromAppView = await appViewDidFor(handle).then(
		(did) => ({ did }),
		(err: unknown) => ({ err }),
	);
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
	trail.push({ source: "well-known", outcome: fromWellKnown ? "hit" : "miss" });
	if (fromWellKnown) return { did: fromWellKnown, trail };
	if ("err" in fromAppView) throw fromAppView.err;
	return { trail };
};

export const resolveHandleToDid = async (input: string): Promise<string> => {
	const handle = normalizeHandle(input);
	if (handle.startsWith("did:")) return handle;
	const { did, trail } = await resolve(handle);
	if (did) return did;
	throw new ColibriError({
		code: "HandleNotFound",
		method: "com.atproto.identity.resolveHandle",
		context: { handle, resolveTrail: describeTrail(trail) },
	});
};

export const handleResolver: HandleResolver = {
	async resolve(handle: string): Promise<ResolvedHandle> {
		const { did } = await resolve(handle);
		return did ? asAtprotoDid(did) : null;
	},
};

const accountCache = new Map<string, AccountSuggestion[]>();

export const clearAccountSearchCache = () => accountCache.clear();

export const cachedAccounts = (
	query: string,
): AccountSuggestion[] | undefined => accountCache.get(normalizeHandle(query));

export const cachedPrefixAccounts = (
	query: string,
): AccountSuggestion[] | undefined => {
	const trimmed = normalizeHandle(query);
	for (let length = trimmed.length - 1; length > 0; length--) {
		const cached = accountCache.get(trimmed.slice(0, length));
		if (!cached) continue;
		return cached.filter(
			(account) =>
				account.handle.toLowerCase().includes(trimmed) ||
				account.displayName?.toLowerCase().includes(trimmed) === true,
		);
	}
	return undefined;
};

export const searchAccounts = async (
	query: string,
	signal?: AbortSignal,
): Promise<AccountSuggestion[]> => {
	const trimmed = normalizeHandle(query);
	if (!trimmed) return [];
	const cached = accountCache.get(trimmed);
	if (cached) return cached;
	try {
		const res = await fetch(
			`${TYPEAHEAD_SERVICE}/xrpc/app.bsky.actor.searchActorsTypeahead?q=${encodeURIComponent(trimmed)}&limit=${TYPEAHEAD_LIMIT}`,
			{ signal },
		);
		if (!res.ok) return [];
		const body = (await res.json()) as { actors?: AccountSuggestion[] };
		const accounts = (body.actors ?? []).map((actor) => ({
			did: actor.did,
			handle: actor.handle,
			displayName: actor.displayName || undefined,
			avatar: actor.avatar || undefined,
		}));
		accountCache.set(trimmed, accounts);
		return accounts;
	} catch (err) {
		if (err instanceof DOMException && err.name === "AbortError") return [];
		log.warn("account search failed", { code: classifyThrown(err).code });
		return [];
	}
};

type DidDocument = {
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

export const resolvePdsHost = async (
	did: string,
): Promise<string | undefined> => {
	const url = didDocumentUrl(did);
	if (!url) return undefined;
	try {
		const res = await fetch(url, {
			signal: AbortSignal.timeout(DID_DOC_TIMEOUT_MS),
		});
		if (!res.ok) return undefined;
		const doc = (await res.json()) as DidDocument;
		const service = doc.service?.find(
			(entry) =>
				entry.id === "#atproto_pds" ||
				entry.id?.endsWith("#atproto_pds") ||
				entry.type === "AtprotoPersonalDataServer",
		);
		return service?.serviceEndpoint
			? new URL(service.serviceEndpoint).host
			: undefined;
	} catch (err) {
		log.warn("resolving the account's server failed", {
			code: classifyThrown(err).code,
		});
		return undefined;
	}
};
