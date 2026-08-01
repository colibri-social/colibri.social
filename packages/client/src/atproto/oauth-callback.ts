export type CallbackState = "in-progress" | "failed" | null;

export const readCallbackParams = (): URLSearchParams | null => {
	if (typeof window === "undefined") return null;
	const raw = window.location.hash.startsWith("#")
		? window.location.hash.slice(1)
		: window.location.search.slice(1);
	return new URLSearchParams(raw);
};

export const classifyCallback = (
	params: URLSearchParams | null,
): CallbackState => {
	if (!params) return null;
	if (params.has("error")) return "failed";
	if (params.has("state") && params.has("code")) return "in-progress";
	return null;
};
