import type { Agent } from "@atproto/api";
import { putRecord } from "./pds";
import type { NotificationLevel } from "./xrpc/social/colibri/actor";

const NOTIFICATION_PREFERENCE_COLLECTION =
	"social.colibri.actor.notificationPreference";
const NOTIFICATION_PREFERENCE_RKEY = "self";

export const writeNotificationPreference = async (
	agent: Agent,
	userDid: string,
	level: NotificationLevel,
): Promise<void> => {
	await putRecord(
		agent,
		userDid,
		NOTIFICATION_PREFERENCE_COLLECTION,
		NOTIFICATION_PREFERENCE_RKEY,
		{ level },
	);
};
