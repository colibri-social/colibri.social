import { classifyResponse } from "../errors/classify";
import { ColibriError } from "../errors/error";
import { getAppViewHost } from "../utils/appview";
import { preflightFetch, reportSignInFailure } from "./auth";

export const normalizeHandle = (input: string): string =>
	input.trim().replace(/^@/, "").toLowerCase();

const handleNotFound = (input: string): ColibriError =>
	new ColibriError({
		code: "HandleNotFound",
		method: "com.atproto.identity.resolveHandle",
		context: { handle: input },
	});

export const resolveHandleToDid = async (input: string): Promise<string> => {
	if (input.startsWith("did:")) return input;

	let res: Response;
	try {
		res = await preflightFetch(
			`${getAppViewHost("http")}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(input)}`,
		);
	} catch (err) {
		throw await reportSignInFailure(err, input, "resolve-handle");
	}

	if (!res.ok) {
		if (res.status === 400 || res.status === 404) throw handleNotFound(input);

		throw await reportSignInFailure(
			classifyResponse({
				status: res.status,
				body: await res.text().catch(() => ""),
				method: "com.atproto.identity.resolveHandle",
				retryAfter: res.headers.get("retry-after"),
			}),
			input,
			"resolve-handle",
		);
	}

	const data = (await res.json().catch(() => ({}))) as { did?: string };
	if (!data.did) throw handleNotFound(input);

	return data.did;
};
