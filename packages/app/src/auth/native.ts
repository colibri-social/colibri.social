import { ColibriError, type ColibriErrorCode } from "@colibri-social/lib";

type NativeErrorCode =
	| "Cancelled"
	| "Unsupported"
	| "InvalidRequest"
	| "Failed";

type NativeErrorEnvelope = { code: NativeErrorCode; message: string };

const CODE_MAP: Record<NativeErrorCode, ColibriErrorCode> = {
	Cancelled: "NativeCancelled",
	Unsupported: "NativeUnavailable",
	InvalidRequest: "InvalidRequest",
	Failed: "NativeFailed",
};

export const DEEP_LINK_EVENT = "deep-link://new-url";

export const isNativeShell = (): boolean =>
	typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

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

export const startWebAuth = async (url: string, scheme: string) => {
	const { invoke } = await import("@tauri-apps/api/core");
	return invoke<string>("start_web_auth", { url, scheme });
};

export const currentDeepLinks = async (): Promise<string[]> => {
	const { invoke } = await import("@tauri-apps/api/core");
	try {
		return (
			(await invoke<string[] | null>("plugin:deep-link|get_current")) ?? []
		);
	} catch {
		return [];
	}
};

export const listenForDeepLinks = async (
	handler: (urls: string[]) => void,
): Promise<() => void> => {
	const { listen } = await import("@tauri-apps/api/event");
	return listen<string[]>(DEEP_LINK_EVENT, (event) => handler(event.payload));
};
