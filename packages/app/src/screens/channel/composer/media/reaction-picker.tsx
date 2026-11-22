import {
	type CustomEmoji,
	Drawer,
	DrawerContent,
	type EmojiPack,
	type EmojiPick,
	EmojiPicker,
} from "@colibri-social/ui";
import { type Component, createSignal } from "solid-js";
import { mediaSession } from "./session";

export type ReactionPicker = {
	open: (onPick: (emoji: string, uri?: string) => void) => void;
	close: () => void;
	Sheet: Component;
};

export const createReactionPicker = (
	options: {
		packs?: () => EmojiPack[];
		customEmoji?: (uri: string) => CustomEmoji | undefined;
	} = {},
): ReactionPicker => {
	const session = mediaSession();
	const [open, setOpen] = createSignal(false);
	let handler: ((emoji: string, uri?: string) => void) | undefined;

	const pick = (value: EmojiPick) => {
		session.recordEmoji(
			value.kind === "unicode" ? value.emoji : value.emoji.id,
		);
		setOpen(false);
		if (value.kind === "unicode") {
			handler?.(value.emoji);
			return;
		}
		handler?.(`:${value.emoji.name}:`, value.emoji.id);
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
					customEmoji={options.customEmoji}
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
