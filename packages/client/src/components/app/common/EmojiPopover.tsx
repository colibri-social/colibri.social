import {
	type Emoji,
	type EmojiEventHandler,
	EmojiPicker,
	setEmojiComponents,
	setEmojiData,
	setEmojiGroupURL,
} from "solid-emoji-picker";
import {
	type Accessor,
	type Component,
	createSignal,
	type ParentComponent,
	Show,
} from "solid-js";
import { createScrollFade } from "../../../hooks/createScrollFade";
import { cx } from "../../../utils/cva";
import { twemojiImageSrc } from "../../../utils/emoji";
import {
	aliasesForSlug,
	EMOJI_COMPONENTS,
	EMOJI_DATA_RECORD,
	EMOJI_GROUPS,
} from "../../../utils/emoji-data";
import { useIsMobile } from "../../../utils/mobile-pane";
import { BottomSheet } from "../../ui/MenuDrawer";
import {
	Popover,
	PopoverContent,
	PopoverPortal,
	PopoverTrigger,
} from "../../ui/Popover";
import { TextField, TextFieldInput } from "../../ui/TextField";

setEmojiData(EMOJI_DATA_RECORD);
setEmojiComponents(EMOJI_COMPONENTS);
setEmojiGroupURL(
	URL.createObjectURL(
		new Blob([JSON.stringify(EMOJI_GROUPS)], { type: "application/json" }),
	),
);

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

const PickerEmoji: Component<{ emoji: Emoji }> = (props) => {
	const [failed, setFailed] = createSignal(false);
	return (
		<Show
			when={!failed()}
			fallback={<span class="emoji-render text-2xl">{props.emoji.emoji}</span>}
		>
			<img
				src={twemojiImageSrc(props.emoji.emoji)}
				alt={props.emoji.name}
				class="w-6 h-6"
				loading="lazy"
				decoding="async"
				onError={() => setFailed(true)}
			/>
		</Show>
	);
};

/**
 * The searchable emoji grid, decoupled from any popover/drawer chrome so it can
 * be embedded directly — e.g. inside the composer's mobile picker drawer
 * alongside the GIF picker. `onEmoji` receives the picked emoji plus the click
 * event (the latter is needed by reaction handlers).
 */
export const EmojiPickerBody: Component<{
	onEmoji: (emoji: Emoji, e: MouseEvent) => void;
	edgeFade?: boolean;
	heightClass?: string;
}> = (props) => {
	const [filter, setFilter] = createSignal("");
	const { ref: gridRef, canScrollDown } = createScrollFade();

	function renderEmoji(emoji: Emoji) {
		return (
			<button
				type="button"
				title={emoji.name}
				class="w-9 h-9 flex items-center justify-center rounded-md hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring border-none bg-transparent"
				onClick={(e) => props.onEmoji(emoji, e)}
			>
				<PickerEmoji emoji={emoji} />
			</button>
		);
	}

	return (
		<>
			<TextField class="mb-2 shrink-0" value={filter()} onChange={setFilter}>
				<TextFieldInput
					type="text"
					placeholder="Search emojis..."
					class="h-9"
				/>
			</TextField>

			<div class={cx("relative", props.heightClass ?? "h-72")}>
				<div ref={gridRef} class="h-full overflow-y-auto">
					<EmojiPicker
						filter={(emoji) => {
							const query = filter().trim().toLowerCase();
							if (!query) return true;

							return (
								emoji.name.toLowerCase().includes(query) ||
								emoji.slug.toLowerCase().includes(query) ||
								aliasesForSlug(emoji.slug).some((alias) =>
									alias.includes(query),
								)
							);
						}}
						renderEmoji={(_data, emoji) => renderEmoji(emoji)}
					/>
				</div>
				<Show when={props.edgeFade}>
					<div
						class="scroll-edge-fade pointer-events-none absolute inset-x-0 bottom-0 h-4 transition-opacity duration-150"
						classList={{ "opacity-0": !canScrollDown() }}
						aria-hidden="true"
					/>
				</Show>
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
	asSheet?: boolean;
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
			when={isMobile() || props.asSheet}
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
				<div class="flex min-h-0 flex-col px-3 pb-[calc(0.75rem+var(--safe-area-bottom))] pt-2">
					<EmojiPickerBody
						onEmoji={handleEmoji}
						edgeFade
						heightClass="h-[70dvh] min-h-0 shrink"
					/>
				</div>
			</BottomSheet>
		</Show>
	);
};
