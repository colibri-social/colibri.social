import { isAppViewErrorCode } from "./appview-codes";
import { type ColibriErrorCode, isPdsSessionErrorCode } from "./codes";
import {
	ColibriError,
	type ColibriErrorOptions,
	type FieldProblem,
	isColibriError,
} from "./error";

export interface ErrorEnvelope {
	error?: unknown;
	message?: unknown;
}

const VALIDATION_PREFIX = "Failed to validate:";

export const parseFieldProblems = (
	message: string | undefined,
): Array<FieldProblem> => {
	if (!message?.includes(VALIDATION_PREFIX)) return [];

	const start = message.indexOf(VALIDATION_PREFIX) + VALIDATION_PREFIX.length;
	let parsed: unknown;
	try {
		parsed = JSON.parse(message.slice(start));
	} catch {
		return [];
	}
	if (!Array.isArray(parsed)) return [];

	const problems: Array<FieldProblem> = [];
	for (const entry of parsed) {
		if (!entry || typeof entry !== "object") continue;
		const record = entry as Record<string, unknown>;
		if (typeof record.message !== "string") continue;
		const path = record.path;
		const field = Array.isArray(path)
			? path
					.filter(
						(part) => typeof part === "string" || typeof part === "number",
					)
					.join(".")
			: typeof record.field === "string"
				? record.field
				: undefined;
		problems.push({ field: field || undefined, message: record.message });
	}
	return problems;
};

export const isOffline = (): boolean =>
	typeof navigator !== "undefined" && navigator.onLine === false;

const MAX_CAUSE_DEPTH = 5;

const nameOf = (err: unknown): string | undefined => {
	if (!err || typeof err !== "object") return undefined;
	const name = (err as { name?: unknown }).name;
	return typeof name === "string" ? name : undefined;
};

const causeChain = (err: unknown): Array<unknown> => {
	const chain: Array<unknown> = [];
	const seen = new Set<unknown>();
	let current: unknown = err;

	while (current !== null && current !== undefined && !seen.has(current)) {
		seen.add(current);
		chain.push(current);
		if (chain.length >= MAX_CAUSE_DEPTH) break;
		current =
			typeof current === "object" && "cause" in current
				? (current as { cause: unknown }).cause
				: undefined;
	}

	return chain;
};

const SESSION_ERROR_NAMES = new Map<string, ColibriErrorCode>([
	["TokenRefreshError", "ExpiredToken"],
	["TokenExpiredError", "ExpiredToken"],
	["TokenInvalidError", "InvalidToken"],
	["TokenRevokedError", "InvalidToken"],
	["AuthMethodUnsatisfiableError", "InvalidToken"],
]);

const codeForThrownShape = (err: unknown): ColibriErrorCode | undefined => {
	const name = nameOf(err);

	if (name === "TimeoutError" || name === "AbortError") return "Timeout";

	const sessionCode = name ? SESSION_ERROR_NAMES.get(name) : undefined;
	if (sessionCode) return sessionCode;

	if (typeof DOMException !== "undefined" && err instanceof DOMException) {
		if (name === "NotAllowedError" || name === "SecurityError") {
			return "DevicePermissionDenied";
		}
		if (name === "NotFoundError" || name === "NotReadableError") {
			return "DeviceUnavailable";
		}
	}

	if (err instanceof TypeError || name === "TypeError") return "NetworkFailed";

	return undefined;
};

export const isConnectivityError = (err: unknown): boolean =>
	causeChain(err).some((link) => {
		const code = codeForThrownShape(link);
		return code === "NetworkFailed" || code === "Timeout";
	});

const STORAGE_ERROR_NAMES = new Set([
	"DBUnavailableError",
	"StorageStallError",
	"QuotaExceededError",
	"UnknownError",
]);

const STORAGE_ERROR_MESSAGES = ["IndexedDB unavailable", "Database closed"];

const isStorageLink = (err: unknown): boolean => {
	if (!(err instanceof Error)) return false;
	if (STORAGE_ERROR_NAMES.has(err.name)) return true;
	return STORAGE_ERROR_MESSAGES.some((text) => err.message.includes(text));
};

export const isStorageFailure = (err: unknown): boolean =>
	causeChain(err).some(isStorageLink);

export const isRecordNotFound = (err: unknown): boolean => {
	if (!err || typeof err !== "object") return false;
	const record = err as {
		error?: unknown;
		status?: unknown;
		message?: unknown;
	};
	if (record.error === "RecordNotFound") return true;
	if (
		typeof record.message === "string" &&
		record.message.includes("Could not locate record")
	) {
		return true;
	}
	return record.status === 404;
};

const MIN_HTTP_STATUS = 100;

export const statusOf = (err: unknown): number | undefined => {
	if (isColibriError(err)) return err.status;
	if (err && typeof err === "object" && "status" in err) {
		const status = (err as { status: unknown }).status;
		if (typeof status === "number") return status;
	}
	return undefined;
};

const codeForStatus = (status: number): ColibriErrorCode => {
	if (status === 401) return "AuthRequired";
	if (status === 403) return "Forbidden";
	if (status === 404) return "NotFound";
	if (status === 429) return "RateLimited";
	if (status === 502 || status === 503 || status === 504)
		return "UpstreamFailure";
	if (status >= 500) return "InternalError";
	return "InvalidRequest";
};

export const parseRetryAfterMs = (
	header: string | null | undefined,
	nowMs: number,
): number | undefined => {
	if (!header) return undefined;
	const trimmed = header.trim();
	if (trimmed === "") return undefined;

	const seconds = Number(trimmed);
	if (Number.isFinite(seconds)) {
		return seconds <= 0 ? 0 : Math.round(seconds * 1000);
	}

	const at = Date.parse(trimmed);
	if (Number.isNaN(at)) return undefined;
	return Math.max(0, at - nowMs);
};

export const readEnvelope = (
	body: string,
): { code?: string; message?: string } => {
	const trimmed = body.trim();
	if (trimmed === "") return {};
	if (!trimmed.startsWith("{")) return { message: trimmed };

	let parsed: unknown;
	try {
		parsed = JSON.parse(trimmed);
	} catch {
		return { message: trimmed };
	}
	if (!parsed || typeof parsed !== "object") return { message: trimmed };

	const envelope = parsed as ErrorEnvelope;
	return {
		code: typeof envelope.error === "string" ? envelope.error : undefined,
		message:
			typeof envelope.message === "string" ? envelope.message : undefined,
	};
};

export interface ClassifyResponseInput {
	status: number;
	body: string;
	method?: string;
	retryAfter?: string | null;
	nowMs?: number;
}

const knownEnvelopeCode = (
	code: string | undefined,
): ColibriErrorCode | undefined => {
	if (!code) return undefined;
	if (isAppViewErrorCode(code)) return code;
	if (isPdsSessionErrorCode(code)) return code;
	return undefined;
};

export const classifyResponse = (
	input: ClassifyResponseInput,
): ColibriError => {
	const { code, message } = readEnvelope(input.body);
	const known = knownEnvelopeCode(code);
	const resolved: ColibriErrorCode = known ?? codeForStatus(input.status);

	const fields = parseFieldProblems(message);

	const options: ColibriErrorOptions = {
		code: resolved,
		status: input.status,
		method: input.method,
		serverMessage: message,
		fields,
		retryAfterMs: parseRetryAfterMs(
			input.retryAfter,
			input.nowMs ?? Date.now(),
		),
		context: code && !known ? { unknownCode: code } : undefined,
	};

	return new ColibriError(options);
};

export interface ClassifyThrownInput {
	method?: string;
	context?: Record<string, unknown>;
}

export const classifyThrown = (
	err: unknown,
	input: ClassifyThrownInput = {},
): ColibriError => {
	if (isColibriError(err)) {
		return input.context ? err.withContext(input.context) : err;
	}

	const shared = {
		method: input.method,
		context: input.context,
		cause: err,
	};

	if (isOffline()) {
		return new ColibriError({ ...shared, code: "Offline" });
	}
	if (isStorageFailure(err)) {
		return new ColibriError({ ...shared, code: "StorageStalled" });
	}
	const shapeCode = codeForThrownShape(err);
	if (shapeCode) {
		return new ColibriError({ ...shared, code: shapeCode });
	}

	const status = statusOf(err);
	if (status !== undefined && status >= MIN_HTTP_STATUS) {
		return new ColibriError({
			...shared,
			code: codeForStatus(status),
			status,
			serverMessage: err instanceof Error ? err.message : undefined,
		});
	}

	const message = err instanceof Error ? err.message : String(err);

	for (const link of causeChain(err).slice(1)) {
		const causeCode = codeForThrownShape(link);
		if (causeCode) {
			return new ColibriError({ ...shared, code: causeCode, message });
		}
	}

	return new ColibriError({ ...shared, code: "Unexpected", message });
};

export type Retryability = "terminal" | "retry";

export const retryability = (err: unknown): Retryability => {
	if (isOffline()) return "retry";
	const classified = isColibriError(err) ? err : classifyThrown(err);
	return classified.retryable ? "retry" : "terminal";
};
