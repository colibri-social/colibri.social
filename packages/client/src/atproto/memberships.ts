import type { Agent } from "@atproto/api";
import { createRecord } from "./pds";

const MEMBERSHIP_COLLECTION = "social.colibri.membership";

export const joinCommunity = async (
	agent: Agent,
	userDid: string,
	communityUri: string,
): Promise<{ uri: string; cid: string }> => {
	return createRecord(agent, userDid, MEMBERSHIP_COLLECTION, {
		community: communityUri,
		createdAt: new Date().toISOString(),
	});
};
