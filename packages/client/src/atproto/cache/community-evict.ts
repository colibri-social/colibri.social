import { forgetCommunity } from "./community-memory";
import { communityKey } from "./keys";
import { cacheEnabled, deleteCommunity } from "./store";

export const evictCommunity = (ns: string, uri: string): void => {
	forgetCommunity(communityKey(ns, uri));
	if (cacheEnabled()) void deleteCommunity(ns, uri);
};
