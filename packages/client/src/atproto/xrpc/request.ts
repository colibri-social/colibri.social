import type { Client, InferMethodOutputBody } from "@atproto/lex-client";
import {
	type Procedure,
	type Query,
	XrpcInvalidResponseError,
	XrpcResponseError,
} from "@atproto/lex-client";
import { classifyEnvelope, classifyThrown } from "../../errors/classify";
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

const DPOP_ENVELOPE_CODES = new Set([
	"invalid_dpop_proof",
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

	const deadline =
		options?.timeoutMs !== undefined
			? AbortSignal.timeout(options.timeoutMs)
			: undefined;

	const signal =
		deadline && options?.signal
			? AbortSignal.any([options.signal, deadline])
			: (deadline ?? options?.signal);

	const result = await client
		.xrpcSafe(
			method as never,
			{
				...(input ?? {}),
				...(signal ? { signal } : {}),
			} as never,
		)
		.catch((cause: unknown) => cause as Error);

	const aborted =
		options?.signal?.aborted === true || deadline?.aborted === true;

	if (result instanceof Error) {
		return fail(toColibriError(lxm, result), lxm, options, aborted);
	}

	if (aborted) {
		return xrpcFail(new ColibriError({ code: "Timeout", method: lxm }));
	}

	return xrpcOk(
		result.body as Output<M>,
		result.headers.get(QUEUED_HEADER) === "1",
	);
};

export { QUEUED_HEADER };
