import type { AppBskyActorDefs } from "@atproto/api";
import { createLogger } from "../../../../../utils/logger";
import { readJson } from "../../../read-json";

const log = createLogger("bsky");

type Response = {
	profiles: Array<AppBskyActorDefs.ProfileViewDetailed>;
};

const PUBLIC_APPVIEW = "https://public.api.bsky.app";

/**
 * Fetches hydrated Bluesky profiles by DID/handle from the public Bluesky
 * AppView
 */
export const getProfiles = async (
	actors: Array<string>,
): Promise<Array<AppBskyActorDefs.ProfileViewDetailed>> => {
	if (actors.length === 0) return [];

	const query = actors
		.map((actor) => `actors=${encodeURIComponent(actor)}`)
		.join("&");
	const url = `${PUBLIC_APPVIEW}/xrpc/app.bsky.actor.getProfiles?${query}`;

	try {
		const res = await fetch(url);
		const body = await readJson<Response>(res);
		return body?.profiles ?? [];
	} catch (err) {
		log.warn("fetching Bluesky profiles failed", { error: err });
		return [];
	}
};
