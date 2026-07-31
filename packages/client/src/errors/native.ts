import type { ColibriErrorCode } from "./codes";
import { ColibriError } from "./error";

type NativeErrorCode =
	| "Cancelled"
	| "Unsupported"
	| "InvalidRequest"
	| "Failed";

interface NativeErrorEnvelope {
	code: NativeErrorCode;
	message: string;
}

const CODE_MAP: Record<NativeErrorCode, ColibriErrorCode> = {
	Cancelled: "NativeCancelled",
	Unsupported: "NativeUnavailable",
	InvalidRequest: "InvalidRequest",
	Failed: "NativeFailed",
};

export const isNativeErrorEnvelope = (
	value: unknown,
): value is NativeErrorEnvelope => {
	if (!value || typeof value !== "object") return false;
	const record = value as { code?: unknown; message?: unknown };
	return (
		typeof record.code === "string" &&
		record.code in CODE_MAP &&
		typeof record.message === "string"
	);
};

export const classifyNativeError = (
	err: unknown,
	command: string,
): ColibriError => {
	if (isNativeErrorEnvelope(err)) {
		return new ColibriError({
			code: CODE_MAP[err.code],
			method: command,
			serverMessage: err.message,
			context: { nativeCode: err.code },
			cause: err,
		});
	}

	return new ColibriError({
		code: "NativeFailed",
		method: command,
		message: err instanceof Error ? err.message : String(err),
		cause: err,
	});
};

export const wasCancelled = (err: unknown): boolean =>
	isNativeErrorEnvelope(err) && err.code === "Cancelled";
