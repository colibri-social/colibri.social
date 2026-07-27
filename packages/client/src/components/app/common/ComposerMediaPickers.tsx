import { type Component, createSignal, Show } from "solid-js";
import GifIcon from "~icons/ph/gif";
import SmileyIcon from "~icons/ph/smiley";
import type { GifItem } from "../../../atproto/xrpc/social/colibri/embed/gifTypes";
import { useIsMobile } from "../../../utils/mobile-pane";
import { BottomSheet } from "../../ui/MenuDrawer";
import {
	Tabs,
	TabsContent,
	TabsIndicator,
	TabsList,
	TabsTrigger,
} from "../../ui/Tabs";
import { EmojiPickerBody, EmojiPopover } from "./EmojiPopover";
import { GifPickerBody, GifPopover } from "./GifPopover";

/** Shared styling for the inline trigger buttons (matches the emoji button). */
const TRIGGER_CLASS =
	"mt-1 shrink-0 w-6 h-[1lh] min-h-6 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-none";

type MediaTab = "emoji" | "gif";

/**
 * The composer's emoji + GIF pickers, rendered inline next to each other (GIF
 * left of emoji). On desktop each opens its own popover. On mobile both buttons
 * open a single bottom sheet with `Tabs` switching between the emoji grid and
 * the GIF picker (whose own KLIPY tabs keep their own style).
 */
export const ComposerMediaPickers: Component<{
	onEmojiSelect: (emoji: string) => void;
	onGifSelect: (gif: GifItem) => void;
}> = (props) => {
	const isMobile = useIsMobile();

	// Desktop: independent popovers.
	const [emojiOpen, setEmojiOpen] = createSignal(false);
	const [gifOpen, setGifOpen] = createSignal(false);

	// Mobile: one drawer, tab-switched.
	const [drawerOpen, setDrawerOpen] = createSignal(false);
	const [tab, setTab] = createSignal<MediaTab>("emoji");

	const openMobile = (which: MediaTab) => {
		setTab(which);
		setDrawerOpen(true);
	};

	return (
		<Show
			when={isMobile()}
			fallback={
				<>
					{/* GIF sits to the left of the emoji button. */}
					<GifPopover
						open={gifOpen}
						setOpen={setGifOpen}
						onGifSelect={props.onGifSelect}
						placement="top-end"
					>
						<button type="button" aria-label="Insert GIF" class={TRIGGER_CLASS}>
							<GifIcon width={20} height={20} />
						</button>
					</GifPopover>
					<EmojiPopover
						emojiPopoverOpen={emojiOpen}
						setEmojiPopoverOpen={setEmojiOpen}
						onEmojiSelect={props.onEmojiSelect}
						placement="top-end"
					>
						<button
							type="button"
							aria-label="Insert emoji"
							class={TRIGGER_CLASS}
						>
							<SmileyIcon width={20} height={20} />
						</button>
					</EmojiPopover>
				</>
			}
		>
			{/* On mobile only the emoji button is shown; it opens the merged
			    drawer where the GIF picker lives behind a tab. */}
			<button
				type="button"
				aria-label="Emoji & GIF picker"
				class={TRIGGER_CLASS}
				onClick={() => openMobile("emoji")}
			>
				<SmileyIcon width={20} height={20} />
			</button>
			<BottomSheet open={drawerOpen()} onOpenChange={setDrawerOpen}>
				<div class="flex min-h-0 flex-col px-3 pb-[calc(0.75rem+var(--safe-area-bottom))] pt-2">
					<Show when={drawerOpen()}>
						<Tabs
							value={tab()}
							onChange={(value) => setTab(value as MediaTab)}
							class="w-full flex min-h-0 flex-col"
						>
							<TabsList class="w-full mb-2 shrink-0">
								<TabsTrigger value="emoji">Emoji</TabsTrigger>
								<TabsTrigger value="gif">GIF</TabsTrigger>
								<TabsIndicator />
							</TabsList>
							<TabsContent value="emoji" class="flex min-h-0 flex-col">
								<EmojiPickerBody
									onEmoji={(emoji) => {
										props.onEmojiSelect(emoji.emoji);
										setDrawerOpen(false);
									}}
									edgeFade
									heightClass="h-[70dvh] min-h-0 shrink"
								/>
							</TabsContent>
							<TabsContent value="gif" class="flex min-h-0 flex-col">
								<GifPickerBody
									onSelect={(gif) => {
										props.onGifSelect(gif);
										setDrawerOpen(false);
									}}
									edgeFade
									heightClass="h-[70dvh] min-h-0 shrink"
								/>
							</TabsContent>
						</Tabs>
					</Show>
				</div>
			</BottomSheet>
		</Show>
	);
};
