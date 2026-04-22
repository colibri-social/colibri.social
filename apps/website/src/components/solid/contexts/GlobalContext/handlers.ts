import stringify from "json-stable-stringify";
import { generateHash } from "@/utils/generate-hash";
import type {
	MessageDeletionEvent,
	MessagePostEvent,
	UserProfileUpdatedEvent,
	UserStatusChangedEvent,
} from "./events";
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
		facets: data.facets ?? [],
		channel: data.channel,
		createdAt: data.created_at,
		parent: data.parent || undefined,
		attachments: data.attachments,
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
		banner_url: data.banner_url || undefined,
		description: data.description || undefined,
		emoji: data.emoji || undefined,
		handle: data.handle || undefined,
		parent: data.parent || undefined,
		status: data.status_text || undefined,
		facets: data.facets ?? [],
		reactions: [],
		parent_message: data.parent_message ?? null,
		edited: data.edited,
		attachments: data.attachments ?? [],
		state: data.state || "offline",
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

/**
 * Handles a status update by a given user.
 * @param context The global context utility. Needed for UI update trigger functions.
 * @param data The status data of the user
 */
export const handleUserStatusChanged = (
	context: GlobalContextUtility,
	data: UserStatusChangedEvent,
): void => {
	context.updateUserOnlineState({
		state: data.state,
		did: data.did,
	});
	context.addMemberStatusOverride(data);
};

/**
 * Handles a profile update by a given user.
 * @param context The global context utility. Needed for UI update trigger functions.
 * @param data The profile data of the user
 */
export const handleUserProfileUpdated = (
	context: GlobalContextUtility,
	data: UserProfileUpdatedEvent,
): void => {
	context.addMemberProfileOverride(data);
};
