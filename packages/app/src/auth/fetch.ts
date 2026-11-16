import { ColibriError } from "@colibri-social/lib";
import {
	progressCallbackFor,
	UPLOAD_ID_HEADER,
	xhrFetch,
} from "./upload-progress";

const READ_TIMEOUT_MS = 12_000;
const XRPC_TIMEOUT_MS = 30_000;
const WRITE_TIMEOUT_MS = 60_000;
const UPLOAD_STALL_TIMEOUT_MS = 30_000;
const ATTEMPTS = 2;
const RETRY_BASE_DELAY_MS = 750;
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const TOKEN_GRANT = /(^|&)grant_type=/;
const FORM_CONTENT_TYPE = "application/x-www-form-urlencoded";

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

const methodOf = (input: FetchInput, init?: RequestInit): string =>
	(
		init?.method ??
		(typeof Request !== "undefined" && input instanceof Request
			? input.method
			: "GET")
	).toUpperCase();

const isRepeatable = (input: FetchInput, init?: RequestInit): boolean =>
	(typeof input === "string" || input instanceof URL) &&
	init?.body == null &&
	SAFE_METHODS.has(methodOf(input, init));

const budgetFor = (input: FetchInput, init?: RequestInit): number => {
	if (!SAFE_METHODS.has(methodOf(input, init))) return WRITE_TIMEOUT_MS;
	return urlOf(input).includes("/xrpc/") ? XRPC_TIMEOUT_MS : READ_TIMEOUT_MS;
};

const formBodyOf = async (
	input: FetchInput,
	init?: RequestInit,
): Promise<string | undefined> => {
	if (init?.body != null) {
		if (typeof init.body === "string") return init.body;
		if (init.body instanceof URLSearchParams) return init.body.toString();
		return undefined;
	}
	if (typeof Request === "undefined" || !(input instanceof Request)) {
		return undefined;
	}
	if (!input.headers.get("content-type")?.startsWith(FORM_CONTENT_TYPE)) {
		return undefined;
	}
	try {
		return await input.clone().text();
	} catch {
		return undefined;
	}
};

const isTokenRequest = async (
	input: FetchInput,
	init?: RequestInit,
): Promise<boolean> => {
	if (methodOf(input, init) !== "POST") return false;

	const body = await formBodyOf(input, init);

	return body !== undefined && TOKEN_GRANT.test(body);
};

const isConnectivityError = (err: unknown): boolean =>
	err instanceof TypeError ||
	(err instanceof DOMException && err.name === "TimeoutError");

const wait = (ms: number) =>
	new Promise<void>((resolve) => setTimeout(resolve, ms));

const signalOf = (input: FetchInput, init?: RequestInit) => {
	if (init?.signal) return init.signal;
	if (typeof Request !== "undefined" && input instanceof Request) {
		return input.signal;
	}

	return undefined;
};

const uploadIdOf = (input: FetchInput, init?: RequestInit) => {
	if (init?.headers) return new Headers(init.headers).get(UPLOAD_ID_HEADER);
	if (typeof Request !== "undefined" && input instanceof Request) {
		return input.headers.get(UPLOAD_ID_HEADER);
	}

	return null;
};

const unreachable = (cause: unknown, input: FetchInput) => {
	return new ColibriError({
		code: "Unreachable",
		cause,
		context: { host: hostOf(input) },
	});
};

const sendTracked = async (
	request: Request,
	onProgress: (fraction: number) => void,
	external: AbortSignal | undefined,
): Promise<Response> => {
	const controller = new AbortController();
	let timedOut = false;
	let timer: ReturnType<typeof setTimeout> | undefined;

	const arm = (ms: number) => {
		clearTimeout(timer);
		timer = setTimeout(() => {
			timedOut = true;
			controller.abort(new DOMException("Request timed out", "TimeoutError"));
		}, ms);
	};

	const forward = () => controller.abort(external?.reason);

	if (external?.aborted) controller.abort(external.reason);
	else external?.addEventListener("abort", forward, { once: true });

	arm(UPLOAD_STALL_TIMEOUT_MS);

	try {
		return await xhrFetch(request, controller.signal, (fraction) => {
			arm(fraction >= 1 ? WRITE_TIMEOUT_MS : UPLOAD_STALL_TIMEOUT_MS);
			onProgress(fraction);
		});
	} catch (err) {
		const error = timedOut
			? new DOMException("Request timed out", "TimeoutError")
			: err;

		if (external?.aborted !== true && isConnectivityError(error)) {
			throw unreachable(error, request);
		}

		throw error;
	} finally {
		clearTimeout(timer);
		external?.removeEventListener("abort", forward);
	}
};

export const createOAuthFetch =
	(base: typeof fetch = (...args) => fetch(...args)): typeof fetch =>
	async (rawInput, rawInit) => {
		const uploadId = uploadIdOf(rawInput, rawInit);
		let input = rawInput;
		let init = rawInit;

		if (uploadId) {
			const request = new Request(rawInput, rawInit);

			request.headers.delete(UPLOAD_ID_HEADER);

			const onProgress = progressCallbackFor(uploadId);

			if (onProgress) {
				return sendTracked(request, onProgress, signalOf(rawInput, rawInit));
			}

			input = request;
			init = undefined;
		}

		const repeatable = isRepeatable(input, init);
		const budget = (await isTokenRequest(input, init))
			? undefined
			: budgetFor(input, init);
		const external = signalOf(input, init);
		let lastError: unknown;

		for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
			const controller = new AbortController();
			let timedOut = false;
			const timer =
				budget === undefined
					? undefined
					: setTimeout(() => {
							timedOut = true;
							controller.abort(
								new DOMException("Request timed out", "TimeoutError"),
							);
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
						throw unreachable(lastError, input);
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
