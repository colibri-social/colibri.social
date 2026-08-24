import { forgetCommunity } from "./community-memory";
import { communityKey } from "./keys";
import { cacheEnabled, deleteCommunity } from "./store";

export const evictCommunity = (ns: string, communityDid: string): void => {
	forgetCommunity(communityKey(ns, communityDid));
	if (cacheEnabled()) void deleteCommunity(ns, communityDid);
};
