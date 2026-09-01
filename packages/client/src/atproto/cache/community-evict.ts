import { forgetCommunity } from "./community-memory";
import { communityKey } from "./keys";
import { cacheEnabled, deleteCommunity, deleteThreads } from "./store";

export const evictCommunity = (ns: string, communityDid: string): void => {
	forgetCommunity(communityKey(ns, communityDid));
	if (!cacheEnabled()) return;
	void deleteCommunity(ns, communityDid);
	void deleteThreads(ns, communityDid);
};
