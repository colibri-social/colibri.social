import type { Agent } from "@atproto/api";
import { AtURI } from "../utils/at-uri";
import { createRecord, deleteRecord } from "./pds";

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

const findMembershipRkeys = async (
	agent: Agent,
	userDid: string,
	communityUri: string,
): Promise<Array<string>> => {
	const rkeys: Array<string> = [];
	let cursor: string | undefined;

	do {
		const res = await agent.com.atproto.repo.listRecords({
			repo: userDid,
			collection: MEMBERSHIP_COLLECTION,
			limit: 100,
			cursor,
		});

		for (const record of res.data.records) {
			const value = record.value as Record<string, unknown>;
			if (value.community === communityUri) {
				rkeys.push(AtURI.parseAtURI(record.uri).identifier);
			}
		}

		cursor = res.data.cursor;
	} while (cursor);

	return rkeys;
};

export const deleteMembership = async (
	agent: Agent,
	userDid: string,
	communityUri: string,
): Promise<void> => {
	const rkeys = await findMembershipRkeys(agent, userDid, communityUri);

	for (const rkey of rkeys) {
		await deleteRecord(agent, userDid, MEMBERSHIP_COLLECTION, rkey);
	}
};
