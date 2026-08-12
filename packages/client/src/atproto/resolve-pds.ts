import { classifyThrown } from "../errors/classify";
import { createLogger } from "../utils/logger";

const log = createLogger("pds-lookup");

const PLC_DIRECTORY = "https://plc.directory";
const LOOKUP_TIMEOUT_MS = 6000;

type DidDocument = {
	service?: Array<{ id?: string; type?: string; serviceEndpoint?: string }>;
};

const didDocumentUrl = (did: string): string | null => {
	if (did.startsWith("did:plc:")) return `${PLC_DIRECTORY}/${did}`;
	if (did.startsWith("did:web:")) {
		const authority = did.slice("did:web:".length).replaceAll(":", "/");
		return `https://${decodeURIComponent(authority)}/.well-known/did.json`;
	}
	return null;
};

export const resolvePdsHost = async (did: string): Promise<string | null> => {
	const url = didDocumentUrl(did);
	if (!url) return null;

	try {
		const res = await fetch(url, {
			signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
		});
		if (!res.ok) return null;

		const doc = (await res.json()) as DidDocument;
		const service = doc.service?.find(
			(entry) =>
				entry.id === "#atproto_pds" ||
				entry.id?.endsWith("#atproto_pds") ||
				entry.type === "AtprotoPersonalDataServer",
		);
		if (!service?.serviceEndpoint) return null;

		return new URL(service.serviceEndpoint).host;
	} catch (err) {
		log.warn("resolving the PDS host failed", {
			code: classifyThrown(err).code,
			did,
		});
		return null;
	}
};

export const pdsFaviconUrl = (host: string): string =>
	`https://${host}/favicon.ico`;
