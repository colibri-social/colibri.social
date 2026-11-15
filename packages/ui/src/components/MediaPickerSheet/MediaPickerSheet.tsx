import { createEffect, createSignal, on, onCleanup, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { cx } from "../../utils/cx";
import { isEditableElement } from "../../utils/keyboard-dismiss";
import {
	KEYBOARD_PANEL_ATTRIBUTE,
	SHELL_KEYBOARD_INSET_VAR,
} from "../../utils/safe-area";
import {
	type EmojiPick,
	EmojiPicker,
	type EmojiPickerProps,
} from "../EmojiPicker/EmojiPicker";
import { EmojiPickerPopover } from "../EmojiPicker/EmojiPickerPopover";
import {
	type Gif,
	GifPicker,
	type GifPickerProps,
} from "../GifPicker/GifPicker";
import { GifPickerPopover } from "../GifPicker/GifPickerPopover";
import type { PopoverPlacement } from "../Popover/Popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../Tabs/Tabs";

export type MediaPickerKind = "emoji" | "gif";

type EmojiOptions = Omit<
	EmojiPickerProps,
	"platform" | "onPick" | "autofocus" | "searchRef"
>;
type GifOptions = Omit<GifPickerProps, "platform" | "onPick" | "autofocus">;

export const MEDIA_PANEL_SEARCH_STRIP = 176;

export type MediaPickerPanelProps = {
	open: boolean;
	height: number;
	tab: MediaPickerKind;
	onTabChange: (tab: MediaPickerKind) => void;
	emoji: EmojiOptions;
	gif: GifOptions;
	onEmoji: (pick: EmojiPick, event: MouseEvent) => void;
	onGif: (gif: Gif, event: MouseEvent) => void;
	onClose?: () => void;
	onOutsideFocus?: () => void;
	onSearchingChange?: (searching: boolean) => void;
	class?: string;
};

export const MediaPickerPanel = (props: MediaPickerPanelProps) => {
	let panel: HTMLElement | undefined;
	const [searching, setSearching] = createSignal(false);
	const height = () => Math.round(props.height);

	createEffect(
		on(searching, (active) => props.onSearchingChange?.(active), {
			defer: true,
		}),
	);

	const onDocumentFocus = (event: FocusEvent) => {
		const target = event.target;
		if (!props.open || !isEditableElement(target)) return;
		if (panel?.contains(target)) return;
		props.onOutsideFocus?.();
	};

	document.addEventListener("focusin", onDocumentFocus);
	onCleanup(() => document.removeEventListener("focusin", onDocumentFocus));

	return (
		<Portal>
			<section
				ref={panel}
				data-media-picker-panel=""
				{...{ [KEYBOARD_PANEL_ATTRIBUTE]: "" }}
				data-open={props.open || undefined}
				data-searching={searching() || undefined}
				aria-label="Emoji and GIF picker"
				inert={!props.open || undefined}
				onFocusIn={(event) => {
					if (isEditableElement(event.target)) setSearching(true);
				}}
				onFocusOut={(event) => {
					if (!isEditableElement(event.target)) return;
					const next = event.relatedTarget;
					if (isEditableElement(next) && panel?.contains(next)) return;
					setSearching(false);
				}}
				onKeyDown={(event) => {
					if (event.key !== "Escape" || event.defaultPrevented) return;
					event.preventDefault();
					props.onClose?.();
				}}
				style={{
					height: `${height()}px`,
					translate: `0 calc(${height()}px - var(${SHELL_KEYBOARD_INSET_VAR}, ${height()}px))`,
				}}
				class={cx(
					"fixed inset-x-0 bottom-0 z-40 flex flex-col border-t border-border bg-popover",
					"px-safe-offset-3 pt-2 pb-[env(safe-area-inset-bottom,0px)]",
					props.class,
				)}
			>
				<Tabs
					value={props.tab}
					onChange={(value) => props.onTabChange(value as MediaPickerKind)}
					class="min-h-0 flex-1 gap-2"
				>
					<TabsList aria-label="Picker" class={cx(searching() && "hidden")}>
						<TabsTrigger value="emoji" class="flex-1 justify-center">
							Emoji
						</TabsTrigger>
						<TabsTrigger value="gif" class="flex-1 justify-center">
							GIFs
						</TabsTrigger>
					</TabsList>
					<TabsContent value="emoji">
						<EmojiPicker
							{...props.emoji}
							platform="mobile"
							class="h-auto min-h-0 flex-1"
							onPick={(pick, event) => props.onEmoji(pick, event)}
						/>
					</TabsContent>
					<TabsContent value="gif">
						<GifPicker
							{...props.gif}
							platform="mobile"
							class="h-auto min-h-0 flex-1"
							onPick={(gif, event) => props.onGif(gif, event)}
						/>
					</TabsContent>
				</Tabs>
			</section>
		</Portal>
	);
};

export type MediaPickersProps = {
	platform?: "mobile" | "desktop";
	open: MediaPickerKind | null;
	onOpenChange: (open: MediaPickerKind | null) => void;
	anchorElement?: HTMLElement;
	placement?: PopoverPlacement;
	emoji: EmojiOptions;
	gif: GifOptions;
	onEmoji: (pick: EmojiPick, event: MouseEvent) => void;
	onGif: (gif: Gif, event: MouseEvent) => void;
	panelHeight?: number;
	panelMounted?: boolean;
	onPanelClose?: () => void;
	onOutsideFocus?: () => void;
	onSearchingChange?: (searching: boolean) => void;
};

const DEFAULT_PANEL_HEIGHT = 320;

export const MediaPickers = (props: MediaPickersProps) => {
	let lastTab: MediaPickerKind = "emoji";
	const tab = () => {
		if (props.open) lastTab = props.open;
		return lastTab;
	};
	return (
		<Show
			when={(props.platform ?? "desktop") === "desktop"}
			fallback={
				<Show when={props.panelMounted ?? props.open !== null}>
					<MediaPickerPanel
						open={props.open !== null}
						height={props.panelHeight ?? DEFAULT_PANEL_HEIGHT}
						tab={tab()}
						onTabChange={(next) => props.onOpenChange(next)}
						emoji={props.emoji}
						gif={props.gif}
						onEmoji={props.onEmoji}
						onGif={props.onGif}
						onClose={() => {
							if (props.onPanelClose) props.onPanelClose();
							else props.onOpenChange(null);
						}}
						onOutsideFocus={() => {
							if (props.onOutsideFocus) props.onOutsideFocus();
							else props.onOpenChange(null);
						}}
						onSearchingChange={props.onSearchingChange}
					/>
				</Show>
			}
		>
			<EmojiPickerPopover
				{...props.emoji}
				open={props.open === "emoji"}
				onOpenChange={(open) => props.onOpenChange(open ? "emoji" : null)}
				anchorElement={props.anchorElement}
				placement={props.placement}
				onPick={props.onEmoji}
			/>
			<GifPickerPopover
				{...props.gif}
				open={props.open === "gif"}
				onOpenChange={(open) => props.onOpenChange(open ? "gif" : null)}
				anchorElement={props.anchorElement}
				placement={props.placement}
				onPick={props.onGif}
			/>
		</Show>
	);
};
