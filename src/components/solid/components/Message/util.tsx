import { actions } from "astro:actions";
import { toast } from "somoto";
import twemoji from "@twemoji/api";
import {
	convertSkinToneToComponent,
	type Emoji,
	type EmojiComponents,
	type EmojiData,
	type EmojiSkinTone,
	getEmojiWithSkinTone,
} from "solid-emoji-picker";
import type { Component, JSX, Setter } from "solid-js";
import type { IndexedMessageData } from "@/utils/sdk";
import type { GlobalContextUtility } from "../../contexts/GlobalContext";
import { Button } from "../../shadcn-solid/Button";
import { DialogCloseButton } from "../../shadcn-solid/Dialog";

/**
 * A utility function to delete a message, then close the modal.
 * @param message The message to delete
 * @param addDeletedMessage The function to add a deleted message to the global context.
 * @param setOpen The function to set the open state of the modal.
 */
export const deleteMessage = (
	message: IndexedMessageData,
	addDeletedMessage: GlobalContextUtility["addDeletedMessage"],
	setOpen?: (open: boolean) => void,
) => {
	// Optimistically remove the message and close the modal immediately,
	// then revert and surface an error if the server rejects the deletion.
	addDeletedMessage({
		author_did: message.author_did,
		channel: message.channel,
		rkey: message.rkey,
		type: "message_deleted",
	});

	setOpen?.(false);

	actions.deleteMessage({ rkey: message.rkey }).then(({ error }) => {
		if (error) {
			toast.error("Failed to delete message", { description: error.message });
		}
	});
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

/**
 * The header content used in both the mobile and desktop deletion dialog.
 */
export const DialogTitleContent: Component = () => "Delete this message?";

/**
 * The description content used in both the mobile and desktop deletion dialog.
 */
export const DialogDescriptionContent: Component = () =>
	"This action cannot be undone.";

/**
 * The dialog tip used in both the mobile and desktop deletion dialog.
 */
export const DialogTip: Component = () => (
	<p class="text-sm text-muted-foreground my-1">
		Tip: You can shift-click the delete button to skip this pop-up!
	</p>
);

/**
 * The confirmation button used in both the mobile and desktop deletion dialog.
 */
export const DialogConfirmButton: Component<{
	onClick: JSX.EventHandlerUnion<
		HTMLButtonElement,
		MouseEvent,
		JSX.EventHandler<HTMLButtonElement, MouseEvent>
	>;
}> = (props) => (
	<Button variant="destructive" class="cursor-pointer" onClick={props.onClick}>
		Delete message
	</Button>
);

/**
 * The cancellation button used in both the mobile and desktop deletion dialog.
 */
export const DialogCancelButton: Component<{ setOpen: Setter<boolean> }> = (
	props,
) => (
	<DialogCloseButton>
		<Button
			variant="secondary"
			class="cursor-pointer"
			onClick={() => props.setOpen(false)}
		>
			Cancel
		</Button>
	</DialogCloseButton>
);
