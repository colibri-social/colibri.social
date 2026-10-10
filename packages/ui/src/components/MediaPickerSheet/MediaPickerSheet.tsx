import { Show } from "solid-js";
import { Drawer, DrawerContent } from "../Drawer/Drawer";
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

type EmojiOptions = Omit<EmojiPickerProps, "platform" | "onPick" | "autofocus">;
type GifOptions = Omit<GifPickerProps, "platform" | "onPick" | "autofocus">;

export type MediaPickerSheetProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	tab: MediaPickerKind;
	onTabChange: (tab: MediaPickerKind) => void;
	emoji: EmojiOptions;
	gif: GifOptions;
	onEmoji: (pick: EmojiPick, event: MouseEvent) => void;
	onGif: (gif: Gif, event: MouseEvent) => void;
};

export const MediaPickerSheet = (props: MediaPickerSheetProps) => (
	<Drawer
		open={props.open}
		onOpenChange={props.onOpenChange}
		initialFocus="content"
	>
		<DrawerContent aria-label="Emoji and GIF picker">
			<Tabs
				value={props.tab}
				onChange={(value) => props.onTabChange(value as MediaPickerKind)}
				class="gap-3"
			>
				<TabsList aria-label="Picker">
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
						onPick={(pick, event) => {
							props.onEmoji(pick, event);
							props.onOpenChange(false);
						}}
					/>
				</TabsContent>
				<TabsContent value="gif">
					<GifPicker
						{...props.gif}
						platform="mobile"
						onPick={(gif, event) => {
							props.onGif(gif, event);
							props.onOpenChange(false);
						}}
					/>
				</TabsContent>
			</Tabs>
		</DrawerContent>
	</Drawer>
);

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
};

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
				<MediaPickerSheet
					open={props.open !== null}
					onOpenChange={(open) => {
						if (!open) props.onOpenChange(null);
					}}
					tab={tab()}
					onTabChange={(next) => props.onOpenChange(next)}
					emoji={props.emoji}
					gif={props.gif}
					onEmoji={props.onEmoji}
					onGif={props.onGif}
				/>
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
