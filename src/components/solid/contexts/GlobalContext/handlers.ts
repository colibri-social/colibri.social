import stringify from "json-stable-stringify";
import { generateHash } from "@/utils/generate-hash";
import type { MessagePostEvent, MessageDeletionEvent } from "./events";
import type { GlobalContextUtility } from "./types";

/**
 * Handles a new or updated message received via the WebSocket subscription.
 * Matches the incoming message against any optimistic pending message
 * (by hashing the canonical fields) and removes the pending entry,
 * then adds the real message to the store.
 *
 * @param context The global context utility. Needed for UI update trigger functions.
 * @param data The data of the new message
 */
export const handleNewMessage = async (
	context: GlobalContextUtility,
	data: MessagePostEvent,
): Promise<void> => {
	const string = stringify({
		text: data.text,
		facets: [],
		channel: data.channel,
		createdAt: data.created_at,
		parent: data.parent || undefined,
	})!;

	const hash = await generateHash(string);

	context.removePendingMessage(hash);

	context.addAdditionalMessage({
		rkey: data.rkey,
		author_did: data.author_did,
		text: data.text,
		channel: data.channel,
		created_at: data.created_at,
		display_name: data.display_name,
		avatar_url: data.avatar_url,
		facets: [],
		reactions: [],
		parent_message: data.parent ?? null,
	});
};

/**
 * Handles a message deletion event by recording the deletion
 * in the store so the UI can remove the message.
 *
 * @param context The global context utility. Needed for UI update trigger functions.
 * @param data The data of the deleted message
 */
export const handleMessageDeletion = (
	context: GlobalContextUtility,
	data: MessageDeletionEvent,
): void => {
	context.addDeletedMessage(data);
};
