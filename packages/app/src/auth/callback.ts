export const SIGN_IN_PATH = "/app/login";

export type CallbackKind = "success" | "failure";

export const callbackParamsFrom = (
	url: Pick<URL, "hash" | "search">,
): URLSearchParams | undefined => {
	const raw = url.hash.length > 1 ? url.hash.slice(1) : url.search.slice(1);
	if (!raw) return undefined;
	const params = new URLSearchParams(raw);
	return classifyCallback(params) ? params : undefined;
};

export const classifyCallback = (
	params: URLSearchParams,
): CallbackKind | undefined => {
	if (!params.has("state")) return undefined;
	if (params.has("error")) return "failure";
	if (params.has("code")) return "success";
	return undefined;
};

export const nativeCallbackParams = (
	callbackUrl: string,
): URLSearchParams | undefined => {
	try {
		return callbackParamsFrom(new URL(callbackUrl));
	} catch {
		return undefined;
	}
};
