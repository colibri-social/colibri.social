import {
	type Accessor,
	type Component,
	type ParentComponent,
	Show,
} from "solid-js";
import { useUserPreferences } from "../../../contexts/UserPreferences";
import type { PickerEmoji } from "../../../utils/emoji-data";
import { useIsMobile } from "../../../utils/mobile-pane";
import { BottomSheet } from "../../ui/MenuDrawer";
import {
	Popover,
	PopoverContent,
	PopoverPortal,
	PopoverTrigger,
} from "../../ui/Popover";
import { EmojiGrid } from "./emoji-picker/EmojiGrid";

export type { PickerEmoji };

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

/**
 * The searchable emoji grid, decoupled from any popover/drawer chrome so it can
 * be embedded directly, for example inside the composer's mobile picker drawer
 * alongside the GIF picker. `onEmoji` receives the picked emoji plus the click
 * event (the latter is needed by reaction handlers).
 */
export const EmojiPickerBody: Component<{
	onEmoji: (emoji: PickerEmoji, e: MouseEvent) => void;
	edgeFade?: boolean;
	heightClass?: string;
}> = (props) => {
	const { emojiUsage } = useUserPreferences();

	return (
		<EmojiGrid
			onEmoji={props.onEmoji}
			usage={emojiUsage()}
			edgeFade={props.edgeFade}
			heightClass={props.heightClass}
		/>
	);
};

export const EmojiPopover: ParentComponent<{
	emojiPopoverOpen: Accessor<boolean>;
	setEmojiPopoverOpen: (state: boolean) => void;
	addReactionOptimistic?: (emoji: string) => void;
	onEmojiClick?: (emoji: PickerEmoji) => void;
	onEmojiSelect?: (emoji: string) => void;
	placement?: Placement;
	asSheet?: boolean;
}> = (props) => {
	const isMobile = useIsMobile();
	const { recordEmojiUse } = useUserPreferences();

	const handleEmoji = (emoji: PickerEmoji) => {
		props.setEmojiPopoverOpen(false);

		if (props.addReactionOptimistic) props.addReactionOptimistic(emoji.emoji);
		else recordEmojiUse(emoji.emoji);

		props.onEmojiSelect?.(emoji.emoji);
		props.onEmojiClick?.(emoji);
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
