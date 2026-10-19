import {
	type CustomEmoji,
	type EmojiPack,
	type EmojiPick,
	type Gif,
	type MediaPickerKind,
	MediaPickers,
} from "@colibri-social/ui";
import { type Component, createSignal } from "solid-js";
import type { GifView } from "../../../../data/types";
import { createGifSource, type GifData } from "./gif-source";
import { mediaSession } from "./session";

export type ComposerMediaOptions = {
	gifs: GifData;
	onInsertEmoji: (emoji: string) => void;
	onInsertCustomEmoji?: (emoji: CustomEmoji) => void;
	packs?: () => EmojiPack[];
	onSendGif: (gif: GifView) => void;
	platform?: "mobile" | "desktop";
	anchor?: () => HTMLElement | undefined;
	focusComposer?: () => void;
};

export type ComposerMedia = {
	openEmoji: () => void;
	openGif: () => void;
	close: () => void;
	open: () => MediaPickerKind | null;
	favorites: () => Gif[];
	setFavorite: (gif: GifView, favorite: boolean) => void;
	Sheet: Component;
};

export const gifAttachment = (gif: GifView) => ({
	url: gif.url,
	mimeType: "image/gif",
	name: `${gif.title ?? "gif"}.gif`,
	width: gif.width,
	height: gif.height,
});

const OVERLAY_SELECTOR = '[role="dialog"]';
const CLOSE_TIMEOUT_MS = 1200;

export const afterOverlaysClose = (run: () => void) => {
	const started = performance.now();
	const check = () => {
		const open = document.querySelector(OVERLAY_SELECTOR);
		if (!open || performance.now() - started > CLOSE_TIMEOUT_MS) {
			requestAnimationFrame(run);
			return;
		}
		requestAnimationFrame(check);
	};
	requestAnimationFrame(check);
};

export const createComposerMedia = (
	options: ComposerMediaOptions,
): ComposerMedia => {
	const session = mediaSession();
	const source = createGifSource(options.gifs);
	const [open, setOpen] = createSignal<MediaPickerKind | null>(null);
	const [favorites, setFavorites] = createSignal<Gif[]>(
		options.gifs.gifFavorites(),
	);

	const toggleFavorite = (gif: Gif, favorite: boolean) => {
		options.gifs.setGifFavorite(gif as GifView, favorite);
		setFavorites(options.gifs.gifFavorites());
	};

	const pickEmoji = (pick: EmojiPick) => {
		setOpen(null);
		if (options.platform !== "desktop")
			queueMicrotask(() => options.focusComposer?.());
		if (pick.kind === "unicode") {
			afterOverlaysClose(() => {
				session.recordEmoji(pick.emoji);
				options.onInsertEmoji(pick.emoji);
			});
			return;
		}
		const custom = pick.emoji;
		afterOverlaysClose(() => {
			session.recordEmoji(custom.id);
			if (options.onInsertCustomEmoji) options.onInsertCustomEmoji(custom);
			else options.onInsertEmoji(`:${custom.name}:`);
		});
	};

	const pickGif = (gif: Gif) => {
		session.recordGif(gif);
		options.onSendGif(gif as GifView);
	};

	const Sheet: Component = () => (
		<MediaPickers
			platform={options.platform ?? "mobile"}
			open={open()}
			onOpenChange={setOpen}
			anchorElement={options.anchor?.()}
			emoji={{
				get usage() {
					return session.usage();
				},
				get skinTone() {
					return session.skinTone();
				},
				onSkinToneChange: session.setSkinTone,
				get packs() {
					return options.packs?.() ?? [];
				},
			}}
			gif={{
				source,
				get favorites() {
					return favorites();
				},
				onToggleFavorite: toggleFavorite,
				get recents() {
					return session.recentGifs();
				},
			}}
			onEmoji={pickEmoji}
			onGif={pickGif}
		/>
	);

	return {
		openEmoji: () => setOpen("emoji"),
		openGif: () => setOpen("gif"),
		close: () => setOpen(null),
		open,
		favorites,
		setFavorite: (gif, favorite) => toggleFavorite(gif, favorite),
		Sheet,
	};
};
