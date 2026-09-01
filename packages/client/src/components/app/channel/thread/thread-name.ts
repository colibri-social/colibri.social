export const FALLBACK_THREAD_NAME = "Untitled thread";

export const suggestThreadName = (text: string | undefined): string => {
	const trimmed = (text ?? "").replace(/\s+/g, " ").trim();
	if (!trimmed) return FALLBACK_THREAD_NAME;
	return trimmed.length > 60 ? `${trimmed.slice(0, 59)}...` : trimmed;
};
