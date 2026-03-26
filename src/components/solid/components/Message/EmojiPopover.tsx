import {
	type Emoji,
	type EmojiComponents,
	type EmojiData,
	type EmojiEventHandler,
	EmojiPicker,
	type EmojiSkinTone,
} from "solid-emoji-picker";
import { createSignal, type Accessor, type ParentComponent } from "solid-js";
import {
	Popover,
	PopoverContent,
	PopoverPortal,
	PopoverTrigger,
} from "../../shadcn-solid/Popover";
import { getTwemoji } from "./util";
import { TextField, TextFieldInput } from "../../shadcn-solid/text-field";

/**
 * An emoji popover picker used for reacting to messages.
 */
export const EmojiPopover: ParentComponent<{
	emojiPopoverOpen: Accessor<boolean>;
	setEmojiPopoverOpen: (state: boolean) => void;
	addReactionOptimistic?: (emoji: string) => void;
	onEmojiClick?: EmojiEventHandler<MouseEvent>;
}> = (props) => {
	const [filter, setFilter] = createSignal("");

	/**
	 * Renders a given emoji with the a specified skin tone.
	 * @param emojis The emoji data to base the emoji on.
	 * @param emoji The emoji to render.
	 * @param components The components to construct the emoji from.
	 * @param tone The skintone of the emoji.
	 * @returns The rendered emoji.
	 */
	function renderTwemoji(
		emojis: EmojiData,
		emoji: Emoji,
		components: EmojiComponents,
		tone?: EmojiSkinTone,
	) {
		const addReaction = () => {
			props.setEmojiPopoverOpen(false);
			props.addReactionOptimistic?.(emoji.emoji);
		};

		const twemoji = getTwemoji(emojis, emoji, components, tone);

		if (!twemoji) return null;

		return (
			<div
				class="w-8 h-8 p-1 rounded-xs hover:bg-muted cursor-pointer"
				innerHTML={twemoji}
				onClick={addReaction}
			/>
		);
	}

	return (
		<Popover
			open={props.emojiPopoverOpen()}
			onOpenChange={props.setEmojiPopoverOpen}
			placement="left-start"
			hideWhenDetached
		>
			<PopoverTrigger as="div">{props.children}</PopoverTrigger>
			<PopoverPortal>
				<PopoverContent class="w-74 overflow-auto h-80 rounded-xl!">
					<TextField class="mb-4" value={filter()} onChange={setFilter}>
						<TextFieldInput type="text" placeholder="joy" />
					</TextField>
					<EmojiPicker
						filter={(emoji) => {
							const trimmedFilter = filter().trim();
							if (trimmedFilter.length === 0) return true;

							return emoji.name
								.toLowerCase()
								.includes(trimmedFilter.toLowerCase());
						}}
						onEmojiClick={props.onEmojiClick}
						renderEmoji={renderTwemoji}
					/>
				</PopoverContent>
			</PopoverPortal>
		</Popover>
	);
};
