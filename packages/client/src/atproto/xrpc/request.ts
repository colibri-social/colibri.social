import { classifyResponse, classifyThrown } from "../../errors/classify";
import type { ColibriErrorCode } from "../../errors/codes";
import { ColibriError } from "../../errors/error";
import { reportError } from "../../errors/report";
import {
	noteScopesRejected,
	sessionDead,
	sessionDeadCode,
} from "../session-health";
import { type XrpcResult, xrpcFail, xrpcOk } from "./result";

type ProxiedFetchFn = (
	xrpcRoute: `/xrpc/${string}`,
	init?: RequestInit,
) => Promise<Response>;

export interface RequestOptions {
	lxm: string;
	route: `/xrpc/${string}`;
	init?: RequestInit;
	empty?: boolean;
	expected?: ReadonlyArray<ColibriErrorCode>;
}

const QUEUED_HEADER = "x-colibri-queued";

const isExpected = (
	code: ColibriErrorCode,
	expected: ReadonlyArray<ColibriErrorCode> | undefined,
): boolean => expected?.includes(code) ?? false;

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

const fail = (
	error: ColibriError,
	options: RequestOptions,
): XrpcResult<never> => {
	if (error.code === "ScopesMissing") {
		noteScopesRejected({ method: options.lxm });
	}
	if (!isExpected(error.code, options.expected)) {
		const dpop = isDpopFailure(error) ? dpopDiagnostics?.() : undefined;
		reportError(error, {
			method: options.lxm,
			stage: "xrpc",
			tags: dpop ? { "dpop.failure": "true" } : undefined,
			contexts: dpop ? { dpop } : undefined,
		});
	}
	return xrpcFail(error);
};

export const request = async <T>(
	fetch: ProxiedFetchFn,
	options: RequestOptions,
): Promise<XrpcResult<T>> => {
	if (sessionDead()) {
		return xrpcFail(
			new ColibriError({
				code: sessionDeadCode() ?? "InvalidToken",
				method: options.lxm,
			}),
		);
	}

	let res: Response;
	try {
		res = await fetch(options.route, options.init);
	} catch (err) {
		return fail(classifyThrown(err, { method: options.lxm }), options);
	}

	if (!res.ok) {
		const body = await res.text().catch(() => "");
		return fail(
			classifyResponse({
				status: res.status,
				body,
				method: options.lxm,
				retryAfter: res.headers.get("retry-after"),
			}),
			options,
		);
	}

	const queued = res.headers.get(QUEUED_HEADER) === "1";

	if (options.empty) return xrpcOk(undefined as T, queued);

	const body = await res.text().catch(() => "");
	if (body === "") return xrpcOk(undefined as T, queued);

	try {
		return xrpcOk(JSON.parse(body) as T, queued);
	} catch (err) {
		return fail(
			new ColibriError({
				code: "MalformedResponse",
				method: options.lxm,
				status: res.status,
				cause: err,
			}),
			options,
		);
	}
};

export { QUEUED_HEADER };
