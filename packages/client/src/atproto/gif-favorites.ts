/**
 * Per-user GIF favorites, stored as a single `social.colibri.actor.gifFavorites`
 * record on the user's own PDS (deterministic rkey `self`, like the read-cursor
 * record). This is purely client-owned data: we write it with `putRecord` and
 * read it straight back from the user's repo with `getRecord` — the AppView
 * neither indexes nor serves it, so favorites sync across devices for free via
 * the PDS.
 */
import type { Agent } from "@atproto/api";
import { putRecord } from "./pds";
import type { GifItem } from "./xrpc/social/colibri/embed/gifTypes";

const FAVORITES_COLLECTION = "social.colibri.actor.gifFavorites";
const FAVORITES_RKEY = "self";

type GifFavoritesRecord = {
	items?: Array<GifItem>;
};

/**
 * Reads the user's favorite GIFs from their PDS. Returns `[]` when the record
 * doesn't exist yet (first use) or on any read error.
 */
export const readGifFavorites = async (
	agent: Agent,
	userDid: string,
): Promise<Array<GifItem>> => {
	try {
		const res = await agent.com.atproto.repo.getRecord({
			repo: userDid,
			collection: FAVORITES_COLLECTION,
			rkey: FAVORITES_RKEY,
		});
		const value = res.data.value as GifFavoritesRecord;
		return value.items ?? [];
	} catch {
		// Record-not-found (or any other read error) → no favorites yet.
		return [];
	}
};

/**
 * Overwrites the user's favorites record with `items`. Callers manage the array
 * (add/remove + ordering) and persist the whole list, mirroring how the
 * community-order record is written.
 */
export const writeGifFavorites = async (
	agent: Agent,
	userDid: string,
	items: Array<GifItem>,
): Promise<void> => {
	await putRecord(agent, userDid, FAVORITES_COLLECTION, FAVORITES_RKEY, {
		items,
	});
};
