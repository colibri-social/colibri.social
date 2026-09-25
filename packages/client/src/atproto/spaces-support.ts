import { createLogger } from "../utils/logger";

const log = createLogger("spaces-support");

const DESCRIBE_METHOD = "community.lexicon.service.describe";
const PROBE_METHOD = "com.atproto.space.getDelegationToken";
const CONTROL_METHOD = "com.atproto.space.colibriProbeControl";
const PROBE_SPACE = "colibri-spaces-probe";
const PROBE_TIMEOUT_MS = 8_000;

type ProbeAnswer = {
	status: number;
	error: string | undefined;
	message: string | undefined;
};

const cache = new Map<string, boolean>();

const isLoopback = (host: string): boolean => {
	const name = host.split(":")[0]?.toLowerCase() ?? "";
	return name === "localhost" || name === "127.0.0.1" || name === "[::1]";
};

const xrpcUrl = (host: string, method: string, query = ""): string =>
	`${isLoopback(host) ? "http" : "https"}://${host}/xrpc/${method}${query}`;

const probeQuery = `?space=${PROBE_SPACE}`;

const request = (url: string): Promise<Response> =>
	fetch(url, {
		method: "GET",
		signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
	});

const readJson = async (res: Response): Promise<unknown> => {
	try {
		return await res.json();
	} catch {
		return undefined;
	}
};

const readString = (value: unknown): string | undefined =>
	typeof value === "string" ? value : undefined;

const describedMethods = async (
	host: string,
): Promise<string[] | undefined> => {
	let res: Response;
	try {
		res = await request(xrpcUrl(host, DESCRIBE_METHOD));
	} catch {
		return undefined;
	}
	if (!res.ok) return undefined;

	const methods = ((await readJson(res)) as { methods?: unknown } | null)
		?.methods;
	if (!Array.isArray(methods)) return undefined;

	return methods.flatMap((entry) => {
		const value = readString((entry as { value?: unknown } | null)?.value);
		return value === undefined ? [] : [value];
	});
};

const probe = async (url: string): Promise<ProbeAnswer> => {
	const res = await request(url);
	const body = (await readJson(res)) as {
		error?: unknown;
		message?: unknown;
	} | null;
	return {
		status: res.status,
		error: readString(body?.error),
		message: readString(body?.message),
	};
};

const isServerFailure = (status: number): boolean =>
	status >= 500 && status !== 501;

export const clearSpacesSupportCache = (): void => {
	cache.clear();
};

export const supportsSpaces = async (
	host: string,
): Promise<boolean | undefined> => {
	const cached = cache.get(host);
	if (cached !== undefined) return cached;

	const methods = await describedMethods(host);
	if (methods !== undefined) {
		const supported = methods.includes(PROBE_METHOD);
		cache.set(host, supported);
		return supported;
	}

	let real: ProbeAnswer;
	let control: ProbeAnswer;
	try {
		[real, control] = await Promise.all([
			probe(xrpcUrl(host, PROBE_METHOD, probeQuery)),
			probe(xrpcUrl(host, CONTROL_METHOD, probeQuery)),
		]);
	} catch {
		log.warn("could not reach the pds to check for spaces support", { host });
		return undefined;
	}

	if (isServerFailure(real.status) || isServerFailure(control.status)) {
		log.warn("the pds errored while being checked for spaces support", {
			host,
			status: real.status,
			controlStatus: control.status,
		});
		return undefined;
	}

	const supported =
		real.error === "InvalidSpaceRef" ||
		real.message?.includes(`${PROBE_METHOD} params`) === true ||
		real.status !== control.status ||
		real.error !== control.error;

	cache.set(host, supported);
	return supported;
};
