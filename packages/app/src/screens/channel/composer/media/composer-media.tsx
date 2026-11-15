import {
	type CustomEmoji,
	type EmojiPack,
	type EmojiPick,
	type Gif,
	MEDIA_PANEL_SEARCH_STRIP,
	type MediaPickerKind,
	MediaPickers,
} from "@colibri-social/ui";
import { type Component, createSignal, onCleanup } from "solid-js";
import { linkMessage } from "../../../../data/adapters/facets";
import type { GifView } from "../../../../data/types";
import {
	type KeyboardReservation,
	keyboardPanelHeight,
	reserveKeyboardSpace,
} from "../../../../shell/keyboard-inset";
import { createGifSource, type GifData } from "./gif-source";
import { mediaSession } from "./session";

const KEYBOARD_SWAP_MS = 350;

export type ComposerMediaOptions = {
	gifs: GifData;
	onInsertEmoji: (emoji: string) => void;
	onInsertCustomEmoji?: (emoji: CustomEmoji) => void;
	packs?: () => EmojiPack[];
	onSendGif: (gif: GifView) => void;
	platform?: "mobile" | "desktop";
	anchor?: () => HTMLElement | undefined;
	focusComposer?: () => void;
	blurComposer?: () => void;
	guardBack?: (onBack: () => void) => () => void;
};

export type ComposerMedia = {
	openEmoji: () => void;
	openGif: () => void;
	toggleEmoji: () => void;
	close: () => void;
	open: () => MediaPickerKind | null;
	panelOpen: () => boolean;
	favorites: () => Gif[];
	setFavorite: (gif: GifView, favorite: boolean) => void;
	Sheet: Component;
};

export const gifMessage = (gif: GifView) => linkMessage(gif.url);

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

	const [panelMounted, setPanelMounted] = createSignal(false);
	const [panelHeight, setPanelHeight] = createSignal(keyboardPanelHeight());
	const mobile = () => {
		return options.platform !== "desktop";
	};
	let reservation: KeyboardReservation | undefined;
	let releaseGuard: (() => void) | undefined;
	let lastToggle = Number.NEGATIVE_INFINITY;

	const toggleFavorite = (gif: Gif, favorite: boolean) => {
		options.gifs.setGifFavorite(gif as GifView, favorite);
		setFavorites(options.gifs.gifFavorites());
	};

	const hidePanel = (untilKeyboard: boolean) => {
		if (open() === null) return;
		setOpen(null);
		releaseGuard?.();
		releaseGuard = undefined;
		reservation?.release({ untilKeyboard });
	};

	const showPanel = (kind: MediaPickerKind) => {
		if (open() !== null) {
			setOpen(kind);
			return;
		}
		const height = keyboardPanelHeight();
		setPanelHeight(height);
		setPanelMounted(true);
		setOpen(kind);
		const next = reserveKeyboardSpace(height, () => {
			if (reservation !== next) return;
			reservation = undefined;
			if (open() === null) setPanelMounted(false);
		});
		reservation = next;
		releaseGuard = options.guardBack?.(() => hidePanel(false));
		options.blurComposer?.();
	};

	const show = (kind: MediaPickerKind) => {
		if (mobile()) showPanel(kind);
		else setOpen(kind);
	};

	const close = () => {
		if (mobile()) hidePanel(false);
		else setOpen(null);
	};

	const toggleEmoji = () => {
		if (mobile()) {
			const now = performance.now();
			if (now - lastToggle < KEYBOARD_SWAP_MS) return;
			lastToggle = now;
		}
		if (!mobile() || open() === null) {
			show("emoji");
			return;
		}
		options.focusComposer?.();
		hidePanel(true);
	};

	onCleanup(() => {
		hidePanel(false);
		reservation = undefined;
	});

	const insertEmoji = (pick: EmojiPick) => {
		if (pick.kind === "unicode") {
			session.recordEmoji(pick.emoji);
			options.onInsertEmoji(pick.emoji);
			return;
		}
		session.recordEmoji(pick.emoji.id);
		if (options.onInsertCustomEmoji) options.onInsertCustomEmoji(pick.emoji);
		else options.onInsertEmoji(`:${pick.emoji.name}:`);
	};

	const pickEmoji = (pick: EmojiPick) => {
		if (mobile()) {
			insertEmoji(pick);
			return;
		}
		setOpen(null);
		afterOverlaysClose(() => insertEmoji(pick));
	};

	const pickGif = (gif: Gif) => {
		session.recordGif(gif);
		options.onSendGif(gif as GifView);
	};

	const Sheet: Component = () => (
		<MediaPickers
			platform={options.platform ?? "mobile"}
			open={open()}
			onOpenChange={(next) => {
				if (next) show(next);
				else close();
			}}
			anchorElement={options.anchor?.()}
			panelHeight={panelHeight()}
			panelMounted={panelMounted()}
			onPanelClose={close}
			onOutsideFocus={() => hidePanel(true)}
			onSearchingChange={(searching) =>
				reservation?.setStacked(searching ? MEDIA_PANEL_SEARCH_STRIP : 0)
			}
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
		openEmoji: () => show("emoji"),
		openGif: () => show("gif"),
		toggleEmoji,
		close,
		open,
		panelOpen: () => mobile() && open() !== null,
		favorites,
		setFavorite: (gif, favorite) => toggleFavorite(gif, favorite),
		Sheet,
	};
};
