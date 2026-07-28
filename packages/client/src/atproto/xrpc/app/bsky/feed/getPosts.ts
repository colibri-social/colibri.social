import type { AppBskyFeedDefs } from "@atproto/api";
import { readJson } from "../../../read-json";

type Response = {
	posts: Array<AppBskyFeedDefs.PostView>;
};

const PUBLIC_APPVIEW = "https://public.api.bsky.app";

/**
 * Fetches hydrated Bluesky posts by AT URI from the public Bluesky AppView.
 * Mirrors {@link searchActorsTypeahead}: unauthenticated, CORS-enabled, and
 * independent of the user's session.
 */
export const getPosts = async (
	uris: Array<string>,
): Promise<Array<AppBskyFeedDefs.PostView>> => {
	if (uris.length === 0) return [];

	const query = uris.map((uri) => `uris=${encodeURIComponent(uri)}`).join("&");
	const url = `${PUBLIC_APPVIEW}/xrpc/app.bsky.feed.getPosts?${query}`;

	try {
		const res = await fetch(url);
		const body = await readJson<Response>(res);
		return body?.posts ?? [];
	} catch (err) {
		console.error(err);
		return [];
	}
};
