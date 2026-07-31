import { isAppViewErrorCode } from "./appview-codes";
import type { ColibriErrorCode } from "./codes";
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

export const isConnectivityError = (err: unknown): boolean => {
	if (err instanceof TypeError) return true;
	if (typeof DOMException !== "undefined" && err instanceof DOMException) {
		return err.name === "TimeoutError" || err.name === "AbortError";
	}
	return false;
};

export const isStorageFailure = (err: unknown): boolean =>
	err instanceof Error &&
	(err.name === "DBUnavailableError" ||
		err.name === "StorageStallError" ||
		err.message.includes("IndexedDB unavailable"));

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

export const classifyResponse = (
	input: ClassifyResponseInput,
): ColibriError => {
	const { code, message } = readEnvelope(input.body);
	const resolved: ColibriErrorCode =
		code && isAppViewErrorCode(code) ? code : codeForStatus(input.status);

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
		context:
			code && !isAppViewErrorCode(code) ? { unknownCode: code } : undefined,
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
	if (typeof DOMException !== "undefined" && err instanceof DOMException) {
		if (err.name === "TimeoutError" || err.name === "AbortError") {
			return new ColibriError({ ...shared, code: "Timeout" });
		}
		if (err.name === "NotAllowedError" || err.name === "SecurityError") {
			return new ColibriError({ ...shared, code: "DevicePermissionDenied" });
		}
		if (err.name === "NotFoundError" || err.name === "NotReadableError") {
			return new ColibriError({ ...shared, code: "DeviceUnavailable" });
		}
	}
	if (err instanceof TypeError) {
		return new ColibriError({ ...shared, code: "NetworkFailed" });
	}

	const status = statusOf(err);
	if (status !== undefined) {
		return new ColibriError({
			...shared,
			code: codeForStatus(status),
			status,
			serverMessage: err instanceof Error ? err.message : undefined,
		});
	}

	return new ColibriError({
		...shared,
		code: "Unexpected",
		message: err instanceof Error ? err.message : String(err),
	});
};

export type Retryability = "terminal" | "retry";

export const retryability = (err: unknown): Retryability => {
	if (isOffline()) return "retry";
	const classified = isColibriError(err) ? err : classifyThrown(err);
	return classified.retryable ? "retry" : "terminal";
};
