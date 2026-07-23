import { type Component, Show } from "solid-js";
import { EMOJI_IMG_CLASS, twemojiImageSrc } from "../../../../utils/emoji";
import { aliasesForSlug } from "../../../../utils/emoji-data";
import { useIsMobile } from "../../../../utils/mobile-pane";
import { BottomSheet } from "../../../ui/MenuDrawer";
import { Popover, PopoverContent, PopoverPortal } from "../../../ui/Popover";

export type EmojiInfoTarget = { char: string; slug: string; rect: DOMRect };

const shortcodeFor = (slug: string): string => aliasesForSlug(slug)[0] ?? slug;

const EmojiInfoBody: Component<{ target: EmojiInfoTarget }> = (props) => (
	<div class="flex flex-row items-center gap-3">
		<img
			src={twemojiImageSrc(props.target.char)}
			alt={props.target.char}
			class="w-6 h-6 shrink-0"
		/>
		<span class="text-sm font-medium break-all">
			:{shortcodeFor(props.target.slug)}:
		</span>
	</div>
);

export const EmojiInfo: Component<{
	target: EmojiInfoTarget;
	onClose: () => void;
}> = (props) => {
	const isMobile = useIsMobile();

	return (
		<Show
			when={isMobile()}
			fallback={
				<Popover
					open
					onOpenChange={(open) => !open && props.onClose()}
					getAnchorRect={() => props.target.rect}
					placement="top"
				>
					<PopoverPortal>
						<PopoverContent
							class="w-fit max-w-64 p-3 shadow-xl border bg-popover rounded-xl"
							onInteractOutside={(event) => {
								const node = event.detail.originalEvent.target;
								if (
									node instanceof HTMLImageElement &&
									node.classList.contains(EMOJI_IMG_CLASS)
								) {
									event.preventDefault();
								}
							}}
						>
							<EmojiInfoBody target={props.target} />
						</PopoverContent>
					</PopoverPortal>
				</Popover>
			}
		>
			<BottomSheet open onOpenChange={(open) => !open && props.onClose()}>
				<div class="flex flex-col px-4 pb-[calc(1rem+var(--safe-area-bottom))] pt-2">
					<EmojiInfoBody target={props.target} />
				</div>
			</BottomSheet>
		</Show>
	);
};
