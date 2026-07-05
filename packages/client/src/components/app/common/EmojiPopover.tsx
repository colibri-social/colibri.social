import {
	type Emoji,
	type EmojiEventHandler,
	EmojiPicker,
} from "solid-emoji-picker";
import {
	type Accessor,
	type Component,
	createSignal,
	type ParentComponent,
	Show,
} from "solid-js";
import { useIsMobile } from "../../../utils/mobile-pane";
import { BottomSheet } from "../../ui/MenuDrawer";
import {
	Popover,
	PopoverContent,
	PopoverPortal,
	PopoverTrigger,
} from "../../ui/Popover";
import { TextField, TextFieldInput } from "../../ui/TextField";

type Placement =
	| "bottom"
	| "bottom-end"
	| "bottom-start"
	| "left"
	| "left-end"
	| "left-start"
	| "right"
	| "right-end"
	| "right-start"
	| "top"
	| "top-end"
	| "top-start";

// Some emojis in Unicode 15 are not supported by the picker font.
const UNICODE_BREAK_VERSION = 14.999;

/**
 * Converts a raw emoji string into a hyphenated hex code for the Twemoji CDN.
 */
const getEmojiHex = (emoji: string): string =>
	Array.from(emoji)
		.map((char) => char.codePointAt(0)?.toString(16))
		.join("-")
		.toLowerCase();

/**
 * The searchable emoji grid, decoupled from any popover/drawer chrome so it can
 * be embedded directly — e.g. inside the composer's mobile picker drawer
 * alongside the GIF picker. `onEmoji` receives the picked emoji plus the click
 * event (the latter is needed by reaction handlers).
 */
export const EmojiPickerBody: Component<{
	onEmoji: (emoji: Emoji, e: MouseEvent) => void;
}> = (props) => {
	const [filter, setFilter] = createSignal("");

	/**
	 * Renders emoji as text using the Twemoji font (much faster than <img>),
	 * falling back to the Twemoji SVG for unsupported Unicode versions.
	 */
	function renderEmoji(emoji: Emoji) {
		const isFontSupported =
			parseFloat(emoji.unicode_version) <= UNICODE_BREAK_VERSION;

		return (
			<button
				type="button"
				title={emoji.name}
				class="w-9 h-9 flex items-center justify-center rounded-md hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring border-none bg-transparent"
				onClick={(e) => props.onEmoji(emoji, e)}
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
		<>
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
		</>
	);
};

export const EmojiPopover: ParentComponent<{
	emojiPopoverOpen: Accessor<boolean>;
	setEmojiPopoverOpen: (state: boolean) => void;
	addReactionOptimistic?: (emoji: string) => void;
	onEmojiClick?: EmojiEventHandler<MouseEvent>;
	onEmojiSelect?: (emoji: string) => void;
	placement?: Placement;
}> = (props) => {
	const isMobile = useIsMobile();

	const handleEmoji = (emoji: Emoji, e: MouseEvent) => {
		props.setEmojiPopoverOpen(false);
		props.addReactionOptimistic?.(emoji.emoji);
		props.onEmojiSelect?.(emoji.emoji);

		props.onEmojiClick?.(emoji, {
			...e,
			currentTarget: e.target! as HTMLButtonElement,
			target: e.target! as HTMLElement,
		});
	};

	return (
		<Show
			when={isMobile()}
			fallback={
				<Popover
					open={props.emojiPopoverOpen()}
					onOpenChange={props.setEmojiPopoverOpen}
					placement={props.placement || "left-start"}
				>
					<PopoverTrigger as="div">{props.children}</PopoverTrigger>
					<PopoverPortal>
						<PopoverContent class="w-80 p-3 shadow-xl border bg-popover rounded-xl">
							<EmojiPickerBody onEmoji={handleEmoji} />
						</PopoverContent>
					</PopoverPortal>
				</Popover>
			}
		>
			<Show when={props.children}>
				<div
					style={{ display: "contents" }}
					onClick={() => props.setEmojiPopoverOpen(true)}
				>
					{props.children}
				</div>
			</Show>
			<BottomSheet
				open={props.emojiPopoverOpen()}
				onOpenChange={props.setEmojiPopoverOpen}
			>
				<div class="flex flex-col px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
					<EmojiPickerBody onEmoji={handleEmoji} />
				</div>
			</BottomSheet>
		</Show>
	);
};
