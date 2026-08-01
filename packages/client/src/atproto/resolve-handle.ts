import { getAppViewHost } from "../utils/appview";
import { asSignInError, preflightFetch, reportSignInFailure } from "./auth";

export const HANDLE_NOT_FOUND =
	"We couldn't find that handle. Double-check it and try again.";

export const normalizeHandle = (input: string): string =>
	input.trim().replace(/^@/, "").toLowerCase();

export const resolveHandleToDid = async (input: string): Promise<string> => {
	if (input.startsWith("did:")) return input;

	let res: Response;
	try {
		res = await preflightFetch(
			`${getAppViewHost("http")}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(input)}`,
		);
	} catch (err) {
		await reportSignInFailure(err, input, "resolve-handle");
		throw asSignInError(err);
	}

	if (!res.ok) {
		if (res.status === 400 || res.status === 404) {
			throw new Error(HANDLE_NOT_FOUND);
		}
		await reportSignInFailure(
			new Error(`resolveHandle returned ${res.status}`),
			input,
			"resolve-handle",
		);
		throw new Error(
			`${new URL(getAppViewHost("http")).host} isn't responding right now. Try again shortly.`,
		);
	}

	const data = (await res.json()) as { did?: string };
	if (!data.did) throw new Error(HANDLE_NOT_FOUND);

	return data.did;
};

export const describeThrownError = (err: unknown): string => {
	if (
		err instanceof DOMException &&
		(err.name === "TimeoutError" || err.name === "AbortError")
	) {
		return "Sign-in timed out. Check your connection and try again.";
	}
	if (err instanceof Error && err.message) return err.message;
	if (typeof err === "string" && err) return err;
	return "Something went wrong. Please try again.";
};
