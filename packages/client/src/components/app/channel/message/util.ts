import twemoji from "@twemoji/api";
import {
	convertSkinToneToComponent,
	type Emoji,
	type EmojiComponents,
	type EmojiData,
	type EmojiSkinTone,
	getEmojiWithSkinTone,
} from "solid-emoji-picker";
import type { IndexedMessageData } from "@/utils/sdk";
import type { Community } from "../../../../atproto/xrpc/social/colibri/community/getData";

/**
 * A utility function to delete a message, then close the modal.
 * @param message The message to delete
 * @param addDeletedMessage The function to add a deleted message to the global context.
 * @param setOpen The function to set the open state of the modal.
 */
export const deleteMessage = (
	_message: IndexedMessageData,
	_setOpen?: (open: boolean) => void,
) => {
	// TODO: Deletion
	// addDeletedMessage({
	// 	author_did: message.author_did,
	// 	channel: message.channel,
	// 	rkey: message.rkey,
	// 	type: "message_deleted",
	// });
	// setOpen?.(false);
	// actions.deleteMessage({ rkey: message.rkey }).then(({ error }) => {
	// 	if (error) {
	// 		toast.error("Failed to delete message", {
	// 			description: parseZodToErrorOrDisplay(error.message),
	// 		});
	// 	}
	// });
};

/**
 * A utility function to block a message, then close the modal.
 * @param message The message to block
 * @param addDeletedMessage The function to add a deleted message to the global context.
 * @param community The community to block the message in.
 * @param setOpen The function to set the open state of the modal.
 */
export const blockMessage = (
	_message: IndexedMessageData,
	_community: Community,
	_setOpen?: (open: boolean) => void,
) => {
	// TODO: Block logic
	// addDeletedMessage({
	// 	author_did: message.author_did,
	// 	channel: message.channel,
	// 	rkey: message.rkey,
	// 	type: "message_deleted",
	// });
	// setOpen?.(false);
	// actions
	// 	.blockMessage({ rkey: message.rkey, author: message.author_did, community })
	// 	.then(({ error }) => {
	// 		if (error) {
	// 			toast.error("Failed to delete message", {
	// 				description: parseZodToErrorOrDisplay(error.message),
	// 			});
	// 		}
	// 	});
};

/**
 * A function to render an emoji as a twemoji image. Will return false if an emoji consists of two
 * images and is not supported by twemoji yet.
 * @param emojis The emoji list to use as a reference.
 * @param emoji The emoji to render.
 * @param components The components of the emoji.
 * @param tone The skintone of the emoji.
 * @returns The parsed emoji.
 */
export function getTwemoji(
	emojis: EmojiData,
	emoji: Emoji,
	components: EmojiComponents,
	tone?: EmojiSkinTone,
) {
	const skinTone = convertSkinToneToComponent(components, tone);
	const tonedEmoji = getEmojiWithSkinTone(emojis, emoji, skinTone);
	const parsed = twemoji.parse(tonedEmoji);

	const multipleImageTags = /<img[\w\W]+<img/g.test(parsed);
	if (multipleImageTags) return false;

	return parsed;
}
