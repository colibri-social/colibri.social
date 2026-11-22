const CACHE_TTL_MS = 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 3000;

type DidDocument = { alsoKnownAs?: string[] };

const cache = new Map<string, { handle: string | null; fetchedAt: number }>();

const documentUrl = (did: string): string | null => {
	if (did.startsWith("did:plc:")) {
		return `https://plc.directory/${encodeURIComponent(did)}`;
	}
	if (did.startsWith("did:web:")) {
		const host = decodeURIComponent(did.slice("did:web:".length));
		if (host.includes("/") || host.includes(":")) return null;
		return `https://${host}/.well-known/did.json`;
	}
	return null;
};

const fetchHandle = async (did: string): Promise<string | null> => {
	const url = documentUrl(did);
	if (!url) return null;
	try {
		const res = await fetch(url, {
			headers: { accept: "application/json" },
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		});
		if (!res.ok) return null;
		const doc = (await res.json()) as DidDocument;
		const aka = doc.alsoKnownAs?.find((entry) => entry.startsWith("at://"));
		return aka ? aka.slice("at://".length) : null;
	} catch {
		return null;
	}
};

export const resolveHandle = async (did: string): Promise<string | null> => {
	const cached = cache.get(did);
	if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
		return cached.handle;
	}
	const handle = await fetchHandle(did);
	cache.set(did, { handle, fetchedAt: Date.now() });
	return handle;
};
