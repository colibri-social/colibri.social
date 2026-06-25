/**
 * Writes and removes the user's mute records on their PDS.
 *
 * A mute is a `social.colibri.actor.mute` record holding the AT-URI of a muted
 * channel or community in its `subject`. We use a deterministic rkey so each
 * subject maps to exactly one record we can `putRecord`/`deleteRecord` without
 * a prior lookup:
 *   - a channel subject → the channel's own rkey (a TID, globally unique);
 *   - a community subject → the community DID (`:` is a legal record-key char).
 * DIDs and channel TIDs never collide, so both live in one collection safely.
 *
 * The AppView indexes these records from the firehose; `actor.listMutes` reads
 * them back, and a per-user `mute_event` keeps other devices in sync.
 */
import type { Agent } from "@atproto/api";
import { AtURI } from "../utils/at-uri";
import { deleteRecord, putRecord } from "./pds";

const MUTE_COLLECTION = "social.colibri.actor.mute";
const COMMUNITY_COLLECTION = "social.colibri.community";

/** Deterministic rkey for a muted subject — community DID or channel rkey. */
export const muteRkey = (subject: string): string => {
	const { did, collection, identifier } = AtURI.parseAtURI(subject);
	return collection === COMMUNITY_COLLECTION ? did : identifier;
};

export const writeMute = async (
	agent: Agent,
	userDid: string,
	subject: string,
): Promise<void> => {
	await putRecord(agent, userDid, MUTE_COLLECTION, muteRkey(subject), {
		subject,
	});
};

export const removeMute = async (
	agent: Agent,
	userDid: string,
	subject: string,
): Promise<void> => {
	await deleteRecord(agent, userDid, MUTE_COLLECTION, muteRkey(subject));
};
