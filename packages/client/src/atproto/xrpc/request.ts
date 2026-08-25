import type { Client, InferMethodOutputBody } from "@atproto/lex-client";
import {
	type Procedure,
	type Query,
	XrpcInvalidResponseError,
	XrpcResponseError,
} from "@atproto/lex-client";
import {
	classifyEnvelope,
	classifyThrown,
	isConnectivityError,
	isOffline,
} from "../../errors/classify";
import type { ColibriErrorCode } from "../../errors/codes";
import { ColibriError } from "../../errors/error";
import { reportError } from "../../errors/report";
import {
	noteScopesRejected,
	sessionDead,
	sessionDeadCode,
} from "../session-health";
import { type XrpcResult, xrpcFail, xrpcOk } from "./result";

export type Method = Procedure | Query;

export type Output<M extends Method> = InferMethodOutputBody<M, Uint8Array>;

export interface CallOptions {
	expected?: ReadonlyArray<ColibriErrorCode>;
	signal?: AbortSignal;
	timeoutMs?: number;
}

const QUEUED_HEADER = "x-colibri-queued";

const DEFAULT_TIMEOUT_MS = 45_000;
const RETRY_ATTEMPTS = 3;
const RETRY_BASE_MS = 500;
const RETRY_MAX_MS = 4_000;

const RETRY_CODES = new Set<ColibriErrorCode>([
	"Timeout",
	"NetworkFailed",
	"Unreachable",
	"UpstreamFailure",
	"PdsUnavailable",
	"InternalError",
]);

const DPOP_REPLAY_CODE = "invalid_dpop_proof";
const DPOP_REPLAY_ATTEMPTS = 1;

const DPOP_ENVELOPE_CODES = new Set([
	DPOP_REPLAY_CODE,
	"use_dpop_nonce",
	"invalid_token",
]);

type DpopDiagnosticsProvider = () => Record<string, unknown>;

let dpopDiagnostics: DpopDiagnosticsProvider | undefined;

export const setDpopDiagnosticsProvider = (
	provider: DpopDiagnosticsProvider,
): void => {
	dpopDiagnostics = provider;
};

const isDpopFailure = (error: ColibriError): boolean => {
	const unknown = error.context.unknownCode;
	return typeof unknown === "string" && DPOP_ENVELOPE_CODES.has(unknown);
};

const isDpopReplay = (error: ColibriError): boolean =>
	error.context.unknownCode === DPOP_REPLAY_CODE;

const isExpected = (
	code: ColibriErrorCode,
	expected: ReadonlyArray<ColibriErrorCode> | undefined,
): boolean => expected?.includes(code) ?? false;

const toColibriError = (lxm: string, cause: unknown): ColibriError => {
	if (cause instanceof XrpcResponseError) {
		return classifyEnvelope({
			code: typeof cause.error === "string" ? cause.error : undefined,
			message: cause.message === "" ? undefined : cause.message,
			status: cause.status,
			method: lxm,
			retryAfter: cause.headers.get("retry-after"),
		});
	}

	if (cause instanceof XrpcInvalidResponseError) {
		if (isConnectivityError(cause))
			return classifyThrown(cause, { method: lxm });

		return new ColibriError({
			code: "MalformedResponse",
			method: lxm,
			cause,
		});
	}

	return classifyThrown(cause, { method: lxm });
};

const fail = (
	error: ColibriError,
	lxm: string,
	options: CallOptions | undefined,
	aborted: boolean,
): XrpcResult<never> => {
	if (error.code === "ScopesMissing") noteScopesRejected({ method: lxm });

	if (!aborted && !isExpected(error.code, options?.expected)) {
		const dpop = isDpopFailure(error) ? dpopDiagnostics?.() : undefined;
		reportError(error, {
			method: lxm,
			stage: "xrpc",
			tags: dpop ? { "dpop.failure": "true" } : undefined,
			contexts: dpop ? { dpop } : undefined,
		});
	}

	return xrpcFail(error);
};

const isQuery = (method: Method): boolean => !("input" in method);

const backoff = (attempt: number): number => {
	const capped = Math.min(RETRY_BASE_MS * 2 ** (attempt - 1), RETRY_MAX_MS);
	return capped * (0.8 + Math.random() * 0.4);
};

const sleep = (ms: number, signal: AbortSignal): Promise<void> =>
	new Promise((resolve) => {
		let timer: ReturnType<typeof setTimeout> | undefined;
		const done = () => {
			if (timer !== undefined) clearTimeout(timer);
			signal.removeEventListener("abort", done);
			resolve();
		};
		timer = setTimeout(done, ms);
		signal.addEventListener("abort", done, { once: true });
	});

export const call = async <M extends Method>(
	client: Client,
	method: M,
	input?: Record<string, unknown>,
	options?: CallOptions,
): Promise<XrpcResult<Output<M>>> => {
	const lxm = method.nsid;

	if (sessionDead()) {
		return xrpcFail(
			new ColibriError({
				code: sessionDeadCode() ?? "InvalidToken",
				method: lxm,
			}),
		);
	}

	const deadline = AbortSignal.timeout(
		options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
	);

	const signal = options?.signal
		? AbortSignal.any([options.signal, deadline])
		: deadline;

	const maxAttempts = isQuery(method) ? RETRY_ATTEMPTS : 1;

	let failure: ColibriError | undefined;
	let replayRetries = 0;

	for (let attempt = 1; attempt <= maxAttempts + replayRetries; attempt++) {
		const result = await client
			.xrpcSafe(
				method as never,
				{
					...(input ?? {}),
					signal,
				} as never,
			)
			.catch((cause: unknown) => cause as Error);

		if (!(result instanceof Error)) {
			if (signal.aborted) {
				return xrpcFail(new ColibriError({ code: "Timeout", method: lxm }));
			}
			return xrpcOk(
				result.body as Output<M>,
				result.headers.get(QUEUED_HEADER) === "1",
			);
		}

		failure = toColibriError(lxm, result);

		if (signal.aborted || sessionDead()) break;

		if (isDpopReplay(failure) && replayRetries < DPOP_REPLAY_ATTEMPTS) {
			replayRetries += 1;
			continue;
		}

		if (attempt >= maxAttempts + replayRetries) break;
		if (!RETRY_CODES.has(failure.code) || isOffline()) break;

		await sleep(backoff(attempt), signal);
		if (signal.aborted) break;
	}

	return fail(
		failure ?? new ColibriError({ code: "Unexpected", method: lxm }),
		lxm,
		options,
		signal.aborted,
	);
};

export { QUEUED_HEADER };
