import type { Agent } from "@atproto/api";
import { getAppViewDid, getPreferredAppViewUrl } from "../utils/appview";
import { getRecord, putRecord } from "./pds";

const PROFILE_COLLECTION = "social.colibri.actor.profile";

export const syncPresenceService = async (
	agent: Agent,
	did: string,
	share: boolean,
	appViewUrl: string = getPreferredAppViewUrl(),
): Promise<void> => {
	let record: Record<string, unknown>;
	try {
		record = await getRecord(agent, did, PROFILE_COLLECTION, "self");
	} catch {
		return;
	}

	delete record.$type;

	if (share) {
		record.presenceService = getAppViewDid(appViewUrl);
	} else {
		delete record.presenceService;
	}

	await putRecord(agent, did, PROFILE_COLLECTION, "self", record);
};
