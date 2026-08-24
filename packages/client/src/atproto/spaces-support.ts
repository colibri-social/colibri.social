import { createLogger } from "../utils/logger";

const log = createLogger("spaces-support");

const PROBE_METHOD = "com.atproto.space.getDelegationToken";
const PROBE_SPACE = "colibri-spaces-probe";
const PROBE_TIMEOUT_MS = 8_000;

const SUPPORTED_ERRORS = new Set(["InvalidRequest", "InvalidSpaceRef"]);

const UNSUPPORTED_ERRORS = new Set([
	"AuthMissing",
	"AuthenticationRequired",
	"MethodNotImplemented",
	"XRPCNotSupported",
	"InvalidLexicon",
	"LexiconNotFound",
]);

const cache = new Map<string, boolean>();

const isLoopback = (host: string): boolean => {
	const name = host.split(":")[0]?.toLowerCase() ?? "";
	return name === "localhost" || name === "127.0.0.1" || name === "[::1]";
};

const probeUrl = (host: string): string =>
	`${isLoopback(host) ? "http" : "https"}://${host}/xrpc/${PROBE_METHOD}?space=${PROBE_SPACE}`;

const readErrorName = async (res: Response): Promise<string | undefined> => {
	try {
		const body: unknown = await res.json();
		const name = (body as { error?: unknown } | null)?.error;
		return typeof name === "string" ? name : undefined;
	} catch {
		return undefined;
	}
};

export const clearSpacesSupportCache = (): void => {
	cache.clear();
};

export const supportsSpaces = async (
	host: string,
): Promise<boolean | undefined> => {
	const cached = cache.get(host);
	if (cached !== undefined) return cached;

	let res: Response;
	try {
		res = await fetch(probeUrl(host), {
			method: "GET",
			signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
		});
	} catch {
		log.warn("could not reach the pds to check for spaces support", { host });
		return undefined;
	}

	if (res.status === 404 || res.status === 501) {
		cache.set(host, false);
		return false;
	}

	if (res.status >= 500) {
		log.warn("the pds errored while being checked for spaces support", {
			host,
			status: res.status,
		});
		return undefined;
	}

	const error = await readErrorName(res);

	if (error === undefined) {
		if (res.ok) {
			cache.set(host, true);
			return true;
		}
		log.warn("the pds answered the spaces probe with no error name", {
			host,
			status: res.status,
		});
		return undefined;
	}

	if (SUPPORTED_ERRORS.has(error)) {
		cache.set(host, true);
		return true;
	}

	if (UNSUPPORTED_ERRORS.has(error)) {
		cache.set(host, false);
		return false;
	}

	log.warn("the pds answered the spaces probe with an unfamiliar error", {
		host,
		error,
	});
	return undefined;
};
