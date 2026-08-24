import type { AppBskyActorDefs, AppBskyFeedDefs } from "@atproto/api";
import { classifyThrown } from "../errors/classify";
import { createLogger } from "../utils/logger";

const log = createLogger("bsky");

const PUBLIC_APPVIEW = "https://public.api.bsky.app";

export type ActorTypeaheadResult = {
	did: string;
	handle: string;
	displayName?: string;
	avatar?: string;
};

const readJson = async <T>(res: Response): Promise<T | undefined> => {
	if (!res.ok) return undefined;

	const body = await res.text();
	if (!body) return undefined;

	try {
		return JSON.parse(body) as T;
	} catch {
		return undefined;
	}
};

export const searchActorsTypeahead = async (
	q: string,
	signal?: AbortSignal,
): Promise<Array<ActorTypeaheadResult>> => {
	const trimmed = q.trim();
	if (trimmed.length === 0) return [];

	const url = `${PUBLIC_APPVIEW}/xrpc/app.bsky.actor.searchActorsTypeahead?q=${encodeURIComponent(trimmed)}&limit=8`;

	try {
		const res = await fetch(url, { signal });
		const body = await readJson<{ actors: Array<ActorTypeaheadResult> }>(res);
		return body?.actors ?? [];
	} catch (err) {
		if ((err as DOMException)?.name === "AbortError") return [];
		log.warn("Bluesky actor search failed", { code: classifyThrown(err).code });
		return [];
	}
};

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
		const body = await readJson<{
			profiles: Array<AppBskyActorDefs.ProfileViewDetailed>;
		}>(res);
		return body?.profiles ?? [];
	} catch (err) {
		log.warn("fetching Bluesky profiles failed", {
			code: classifyThrown(err).code,
		});
		return [];
	}
};

export const getPosts = async (
	uris: Array<string>,
): Promise<Array<AppBskyFeedDefs.PostView>> => {
	if (uris.length === 0) return [];

	const query = uris.map((uri) => `uris=${encodeURIComponent(uri)}`).join("&");
	const url = `${PUBLIC_APPVIEW}/xrpc/app.bsky.feed.getPosts?${query}`;

	try {
		const res = await fetch(url);
		const body = await readJson<{ posts: Array<AppBskyFeedDefs.PostView> }>(
			res,
		);
		return body?.posts ?? [];
	} catch (err) {
		log.warn("fetching Bluesky posts failed", {
			code: classifyThrown(err).code,
		});
		return [];
	}
};
