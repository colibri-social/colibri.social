import {
	type Emoji,
	type EmojiEventHandler,
	EmojiPicker,
} from "solid-emoji-picker";
import { type Accessor, createSignal, type ParentComponent } from "solid-js";
import {
	Popover,
	PopoverContent,
	PopoverPortal,
	PopoverTrigger,
} from "../../shadcn-solid/Popover";
import { TextField, TextFieldInput } from "../../shadcn-solid/text-field";

export const EmojiPopover: ParentComponent<{
	emojiPopoverOpen: Accessor<boolean>;
	setEmojiPopoverOpen: (state: boolean) => void;
	addReactionOptimistic?: (emoji: string) => void;
	onEmojiClick?: EmojiEventHandler<MouseEvent>;
}> = (props) => {
	const [filter, setFilter] = createSignal("");

	// Some emojis in Unicode 15 are not supported
	const UNICODE_BREAK_VERSION = 14.999;

	/**
	 * Converts a raw emoji string into a hyphenated hex code for the Twemoji CDN.
	 */
	const getEmojiHex = (emoji: string): string => {
		return (
			Array.from(emoji)
				.map((char) => char.codePointAt(0)?.toString(16))
				// .filter((hex) => hex !== "fe0f")
				.join("-")
				.toLowerCase()
		);
	};

	/**
	 * Renders emoji as text using the Twemoji font.
	 * This is significantly more performant than <img> tags.
	 */
	function renderEmoji(emoji: Emoji) {
		const handleSelect = (e: MouseEvent) => {
			props.setEmojiPopoverOpen(false);
			props.addReactionOptimistic?.(emoji.emoji);

			props.onEmojiClick?.(emoji, {
				...e,
				currentTarget: e.target! as HTMLButtonElement,
				target: e.target! as HTMLElement,
			});
		};

		const isFontSupported =
			parseFloat(emoji.unicode_version) <= UNICODE_BREAK_VERSION;

		if (isFontSupported && emoji.emoji === "🫨") {
			console.log(emoji);
		}

		return (
			<button
				type="button"
				title={emoji.name}
				class="w-9 h-9 flex items-center justify-center rounded-md hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring border-none bg-transparent"
				onClick={handleSelect}
			>
				{isFontSupported ? (
					<span class="picker-font emoji-render text-2xl">{emoji.emoji}</span>
				) : (
					<img
						src={`https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/svg/${getEmojiHex(emoji.emoji)}.svg`}
						alt={emoji.name}
						class="w-6 h-6"
						loading="lazy"
					/>
				)}
			</button>
		);
	}

	return (
		<Popover
			open={props.emojiPopoverOpen()}
			onOpenChange={props.setEmojiPopoverOpen}
			placement="left-start"
		>
			<PopoverTrigger as="div">{props.children}</PopoverTrigger>
			<PopoverPortal>
				<PopoverContent class="w-80 p-3 shadow-xl border bg-popover rounded-xl">
					<TextField class="mb-2" value={filter()} onChange={setFilter}>
						<TextFieldInput
							type="text"
							placeholder="Search emojis..."
							class="h-9"
						/>
					</TextField>

					<div class="h-72 overflow-y-auto custom-scrollbar">
						<EmojiPicker
							filter={(emoji) => {
								const query = filter().trim().toLowerCase();
								if (!query) return true;

								return emoji.name.toLowerCase().includes(query);
							}}
							renderEmoji={(_data, emoji) => renderEmoji(emoji)}
						/>
					</div>
				</PopoverContent>
			</PopoverPortal>
		</Popover>
	);
};
