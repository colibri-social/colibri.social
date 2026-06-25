/**
 * Writes the per-channel read cursor to the user's PDS.
 *
 * The cursor is a `social.colibri.channel.read` record holding the AT-URI of
 * the last message the user has read in a channel. We use a deterministic rkey
 * (the channel's own rkey) so each channel has exactly one cursor record that
 * we overwrite via `putRecord` as the user reads further. The AppView indexes
 * these records from the firehose; `channel.listUnreadStatus` and
 * `channel.getReadCursor` read them back.
 */
import type { Agent } from "@atproto/api";
import { AtURI } from "../utils/at-uri";
import { putRecord } from "./pds";

const READ_COLLECTION = "social.colibri.channel.read";

export const writeReadCursor = async (
	agent: Agent,
	userDid: string,
	channelUri: string,
	lastMessageUri: string,
): Promise<void> => {
	const channelRkey = AtURI.parseAtURI(channelUri).identifier;

	await putRecord(agent, userDid, READ_COLLECTION, channelRkey, {
		channel: channelUri,
		cursor: lastMessageUri,
	});
};
