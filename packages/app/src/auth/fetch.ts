import { ColibriError } from "@colibri-social/lib";

const READ_TIMEOUT_MS = 12_000;
const XRPC_TIMEOUT_MS = 30_000;
const WRITE_TIMEOUT_MS = 60_000;
const ATTEMPTS = 2;
const RETRY_BASE_DELAY_MS = 750;
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

type FetchInput = Parameters<typeof fetch>[0];

const urlOf = (input: FetchInput): string =>
	typeof input === "string"
		? input
		: input instanceof URL
			? input.href
			: input.url;

const hostOf = (input: FetchInput): string => {
	try {
		return new URL(urlOf(input), globalThis.location?.href).host;
	} catch {
		return "";
	}
};

export const methodOf = (input: FetchInput, init?: RequestInit): string =>
	(
		init?.method ??
		(typeof Request !== "undefined" && input instanceof Request
			? input.method
			: "GET")
	).toUpperCase();

export const isRepeatable = (input: FetchInput, init?: RequestInit): boolean =>
	(typeof input === "string" || input instanceof URL) &&
	init?.body == null &&
	SAFE_METHODS.has(methodOf(input, init));

const budgetFor = (input: FetchInput, init?: RequestInit): number => {
	if (!SAFE_METHODS.has(methodOf(input, init))) return WRITE_TIMEOUT_MS;
	return urlOf(input).includes("/xrpc/") ? XRPC_TIMEOUT_MS : READ_TIMEOUT_MS;
};

const isConnectivityError = (err: unknown): boolean =>
	err instanceof TypeError ||
	(err instanceof DOMException && err.name === "TimeoutError");

const wait = (ms: number) =>
	new Promise<void>((resolve) => setTimeout(resolve, ms));

export const createOAuthFetch =
	(base: typeof fetch = (...args) => fetch(...args)): typeof fetch =>
	async (input, init) => {
		const repeatable = isRepeatable(input, init);
		const budget = budgetFor(input, init);
		const external = init?.signal ?? undefined;
		let lastError: unknown;

		for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
			const controller = new AbortController();
			let timedOut = false;
			const timer = setTimeout(() => {
				timedOut = true;
				controller.abort(new DOMException("Request timed out", "TimeoutError"));
			}, budget);
			const forward = () => controller.abort(external?.reason);
			if (external?.aborted) controller.abort(external.reason);
			else external?.addEventListener("abort", forward, { once: true });

			try {
				return await base(input, { ...init, signal: controller.signal });
			} catch (err) {
				lastError = timedOut
					? new DOMException("Request timed out", "TimeoutError")
					: err;
				const givingUp =
					external?.aborted === true ||
					!repeatable ||
					!isConnectivityError(lastError) ||
					attempt === ATTEMPTS;
				if (givingUp) {
					if (isConnectivityError(lastError)) {
						throw new ColibriError({
							code: "Unreachable",
							cause: lastError,
							context: { host: hostOf(input) },
						});
					}
					throw lastError;
				}
			} finally {
				clearTimeout(timer);
				external?.removeEventListener("abort", forward);
			}
			await wait(RETRY_BASE_DELAY_MS * attempt);
		}
		throw lastError;
	};
