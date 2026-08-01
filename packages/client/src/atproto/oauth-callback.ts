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

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
	access_denied: "You declined the sign-in request.",
	login_required: "Your provider needs you to sign in again.",
	temporarily_unavailable:
		"Your provider is temporarily unavailable. Try again shortly.",
};

export const describeOAuthError = (params: URLSearchParams): string => {
	const code = params.get("error") ?? "";
	return (
		params.get("error_description") ??
		OAUTH_ERROR_MESSAGES[code] ??
		(code ? `Your provider returned "${code}".` : "Please try again.")
	);
};
