const encoder = new TextEncoder();

export const FALLBACK_THREAD_NAME = "Untitled thread";

export const THREAD_NAME_MAX_BYTES = 128;

export const suggestThreadName = (text: string | undefined): string => {
	const trimmed = (text ?? "").replace(/\s+/g, " ").trim();
	if (!trimmed) return FALLBACK_THREAD_NAME;
	return trimmed.length > 60 ? `${trimmed.slice(0, 59)}...` : trimmed;
};

export const chooseThreadName = (typed: string, suggested: string) =>
	typed.trim() || suggested || FALLBACK_THREAD_NAME;

export const threadNameTooLong = (name: string) =>
	encoder.encode(name).length > THREAD_NAME_MAX_BYTES;
