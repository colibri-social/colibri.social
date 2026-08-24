import type { Agent } from "@atproto/api";
import { COLLECTIONS } from "./lexicons";
import { getRecord, putRecord } from "./pds";

const PROFILE_COLLECTION = COLLECTIONS.profile;

export const syncPreferredBadge = async (
	agent: Agent,
	did: string,
	badge?: string,
): Promise<void> => {
	let record: Record<string, unknown>;
	try {
		record = await getRecord(agent, did, PROFILE_COLLECTION, "self");
	} catch {
		return;
	}

	delete record.$type;

	if (badge) {
		record.preferredBadge = badge;
	} else {
		delete record.preferredBadge;
	}

	await putRecord(agent, did, PROFILE_COLLECTION, "self", record);
};
