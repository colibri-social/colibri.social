import {
	Drawer,
	DrawerContent,
	type EmojiPack,
	type EmojiPick,
	EmojiPicker,
} from "@colibri-social/ui";
import { type Component, createSignal } from "solid-js";
import { mediaSession } from "./session";

export type ReactionPicker = {
	open: (onPick: (emoji: string) => void) => void;
	close: () => void;
	Sheet: Component;
};

export const createReactionPicker = (
	options: { packs?: () => EmojiPack[] } = {},
): ReactionPicker => {
	const session = mediaSession();
	const [open, setOpen] = createSignal(false);
	let handler: ((emoji: string) => void) | undefined;

	const pick = (value: EmojiPick) => {
		if (value.kind === "unicode") session.recordEmoji(value.emoji);
		setOpen(false);
		handler?.(value.kind === "unicode" ? value.emoji : `:${value.emoji.name}:`);
	};

	const Sheet: Component = () => (
		<Drawer open={open()} onOpenChange={setOpen} initialFocus="content">
			<DrawerContent aria-label="Add a reaction">
				<EmojiPicker
					platform="mobile"
					usage={session.usage()}
					skinTone={session.skinTone()}
					onSkinToneChange={session.setSkinTone}
					packs={options.packs?.()}
					onPick={pick}
					searchPlaceholder="Search reactions"
				/>
			</DrawerContent>
		</Drawer>
	);

	return {
		open: (onPick) => {
			handler = onPick;
			setOpen(true);
		},
		close: () => setOpen(false),
		Sheet,
	};
};
