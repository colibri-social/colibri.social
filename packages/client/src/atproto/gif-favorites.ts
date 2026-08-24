import type { Agent } from "@atproto/api";
import {
	getPreferences,
	type PreferencesOutput,
	writeActorSettings,
} from "./notificationPreference";
import type { GifView } from "./views";
import type { ColibriClient } from "./xrpc";
import type { XrpcResult } from "./xrpc/result";

export const readGifFavorites = async (
	xrpc: ColibriClient,
): Promise<ReadonlyArray<GifView>> => {
	const res = await getPreferences(xrpc);
	return res.ok ? res.data.preferences.gifFavorites : [];
};

export const writeGifFavorites = (
	agent: Agent,
	xrpc: ColibriClient,
	actorDid: string,
	items: ReadonlyArray<GifView>,
): Promise<XrpcResult<PreferencesOutput>> =>
	writeActorSettings(agent, xrpc, actorDid, { gifFavorites: [...items] });
