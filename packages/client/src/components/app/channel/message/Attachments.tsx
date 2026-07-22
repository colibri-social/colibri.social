import type { AttachmentObj } from "@colibri-social/lib";
import {
	type Component,
	createEffect,
	createSignal,
	For,
	onCleanup,
	onMount,
	Show,
} from "solid-js";
import { Portal } from "solid-js/web";
import "vidstack/player";
import "vidstack/player/ui";
import "./media-attachments.css";

import CaretLeftIcon from "~icons/ph/caret-left";
import CaretRightIcon from "~icons/ph/caret-right";
import CornersInIcon from "~icons/ph/corners-in";
import CornersOutIcon from "~icons/ph/corners-out";
import DownloadIcon from "~icons/ph/download-simple";
import FileIcon from "~icons/ph/file";
import FileAudioIcon from "~icons/ph/file-audio-fill";
import PauseIcon from "~icons/ph/pause-fill";
import PlayIcon from "~icons/ph/play-fill";
import SpeakerHighIcon from "~icons/ph/speaker-high-fill";
import SpeakerLowIcon from "~icons/ph/speaker-low-fill";
import SpeakerMutedIcon from "~icons/ph/speaker-x-fill";
import SpinnerIcon from "~icons/ph/spinner-gap";
import XIcon from "~icons/ph/x";
import { resolveBlob } from "../../../../atproto/resolve-blob";
import type { Message } from "../../../../atproto/xrpc/social/colibri/channel/listMessages";
import { useStableMedia } from "../../../../contexts/ScrollAnchor";
import { isTauriRuntime } from "../../../../notifications/environment";
import { openExternalLink } from "../../../../utils/open-external-link";
import { Button } from "../../../ui/Button";

type AttachmentComponent = Component<{ item: AttachmentObj; did: string }>;

/** Shared base for the small square icon buttons used in the control bars. */
const CONTROL_BTN =
	"inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors";
const audioBtnClass = `${CONTROL_BTN} text-muted-foreground hover:bg-foreground/10 hover:text-foreground`;
const videoBtnClass = `${CONTROL_BTN} text-white/90 hover:bg-white/20 hover:text-white`;

/** Human-readable byte size, e.g. `1.4 MB`. */
const formatBytes = (bytes: number): string => {
	if (bytes < 1024) return `${bytes} B`;

	const units = ["KB", "MB", "GB", "TB"];
	let value = bytes / 1024;
	let unit = 0;

	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit++;
	}

	return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
};

/**
 * Visual track/fill/thumb for a Vidstack slider. Vidstack handles all the
 * interaction and exposes the filled amount via the inherited `--slider-fill`
 * CSS variable, which the fill width and thumb position read directly.
 */
const SliderVisual: Component<{ tone: "brand" | "light" }> = (props) => (
	<>
		<div
			class="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full"
			classList={{
				"bg-foreground/25": props.tone === "brand",
				"bg-white/30": props.tone === "light",
			}}
		/>
		<div
			class="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full"
			classList={{
				"bg-primary": props.tone === "brand",
				"bg-white": props.tone === "light",
			}}
			style={{ width: "var(--slider-fill)" }}
		/>
		<div
			class="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0 shadow transition-opacity group-hover/slider:opacity-100"
			classList={{
				"bg-primary": props.tone === "brand",
				"bg-white": props.tone === "light",
			}}
			style={{ left: "var(--slider-fill)" }}
		/>
	</>
);

/**
 * Combined `current / duration` readout. Shows `--:-- / --:--` until the player
 * reports it can play (toggled via CSS on the player's `data-can-play`), so
 * media whose metadata hasn't loaded yet never flashes a wrong or shifting
 * timestamp.
 */
const TimeDisplay: Component<{ tone: "muted" | "light" }> = (props) => (
	<div
		class="flex shrink-0 items-center gap-1 text-xs tabular-nums select-none"
		classList={{
			"text-muted-foreground": props.tone === "muted",
			"text-white/90": props.tone === "light",
		}}
	>
		<span data-time-placeholder>--:-- / --:--</span>
		<span data-time-real class="flex items-center gap-1">
			<media-time type="current" />
			<span>/</span>
			<media-time type="duration" />
		</span>
	</div>
);

export const AudioAttachment: AttachmentComponent = (props) => {
	const stableMedia = useStableMedia();
	const src = () => resolveBlob(props.did, props.item.blob);
	const size = "size" in props.item.blob ? props.item.blob.size : undefined;

	return (
		<media-player
			ref={stableMedia}
			class="colibri-media-audio w-full max-w-104 overflow-hidden rounded-lg border border-border bg-card"
			title={props.item.name ?? "Audio"}
			viewType="audio"
			streamType="on-demand"
			load="play"
		>
			<media-provider>
				<Show when={src()}>
					{(url) => <source src={url()} type={props.item.blob.mimeType} />}
				</Show>
			</media-provider>

			{/* File header: icon + name + size, mirroring the generic file card. */}
			<a
				class="group/file flex flex-row items-center gap-3 p-3"
				href={src()}
				target="_blank"
				rel="noreferrer"
				onClick={(e) => openExternalLink(src(), e)}
				title={props.item.name ?? "Audio"}
			>
				<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-primary">
					<FileAudioIcon class="h-5 w-5" />
				</div>
				<div class="flex min-w-0 flex-col h-10">
					<span class="truncate font-medium text-sm text-primary group-hover/file:underline">
						{props.item.name ?? "Audio"}
					</span>
					<Show when={size !== undefined}>
						<span class="text-sm text-muted-foreground">
							{formatBytes(size as number)}
						</span>
					</Show>
				</div>
			</a>

			{/* Player bar: play · current/duration · scrubber · volume. */}
			<div class="flex items-center gap-3 border-t border-border bg-background/40 px-3 py-2.5">
				<media-play-button class={audioBtnClass} aria-label="Play">
					<span data-icon="play">
						<PlayIcon class="h-5 w-5" />
					</span>
					<span data-icon="pause">
						<PauseIcon class="h-5 w-5" />
					</span>
				</media-play-button>

				<TimeDisplay tone="muted" />

				<media-time-slider
					class="group/slider relative flex h-8 flex-1 items-center"
					step={0.01}
				>
					<SliderVisual tone="brand" />
				</media-time-slider>

				{/* Mute button with a volume slider that expands on hover. */}
				<div class="group/vol flex items-center">
					<media-mute-button class={audioBtnClass} aria-label="Mute">
						<span data-icon="high">
							<SpeakerHighIcon class="h-5 w-5" />
						</span>
						<span data-icon="low">
							<SpeakerLowIcon class="h-5 w-5" />
						</span>
						<span data-icon="muted">
							<SpeakerMutedIcon class="h-5 w-5" />
						</span>
					</media-mute-button>

					<media-volume-slider class="group/slider relative flex h-8 w-0 items-center overflow-visible opacity-0 transition-all duration-200 group-hover/vol:ml-1 group-hover/vol:w-16 group-hover/vol:opacity-100">
						<SliderVisual tone="brand" />
					</media-volume-slider>
				</div>
			</div>
		</media-player>
	);
};

/** Grid column layout for a set of image thumbnails. */
const imageGridClass = (count: number, sizeClass: string): string => {
	if (count <= 4) return `grid grid-cols-2 gap-1 w-full ${sizeClass}`;
	return `grid grid-cols-3 gap-1 w-full ${sizeClass}`;
};

export type GalleryImage = { url?: string; name?: string };

export const MediaLightboxGallery: Component<{
	images: GalleryImage[];
	ref?: (el: HTMLDivElement) => void;
	sizeClass?: string;
	onImageError?: (index: number) => void;
}> = (props) => {
	const sizeClass = () => props.sizeClass ?? "max-w-104";
	const count = () => props.images.length;
	const [openIndex, setOpenIndex] = createSignal<number | null>(null);
	let lightboxRef: HTMLDivElement | undefined;

	// Open the lightbox and push a history entry so the browser/Android back
	// button (and the mobile back-swipe) closes it instead of leaving the view.
	const open = (i: number) => {
		setOpenIndex(i);
		try {
			history.pushState({ ...history.state, colibriLightbox: true }, "");
		} catch {
			// history unavailable
		}
	};

	const close = () => {
		if (openIndex() === null) return;
		if (history.state?.colibriLightbox) history.back();
		else setOpenIndex(null);
	};

	onMount(() => {
		const onPop = () => {
			if (openIndex() !== null) setOpenIndex(null);
		};
		window.addEventListener("popstate", onPop);
		onCleanup(() => window.removeEventListener("popstate", onPop));
	});

	const next = () => setOpenIndex((i) => (i === null ? i : (i + 1) % count()));
	const prev = () =>
		setOpenIndex((i) => (i === null ? i : (i - 1 + count()) % count()));

	// Keyboard controls only while the carousel is open.
	createEffect(() => {
		if (openIndex() === null) return;

		// Move focus into the lightbox for accessibility. Deferred to a microtask
		// since the Portal hasn't mounted `lightboxRef` into the DOM yet at the
		// point this effect runs.
		queueMicrotask(() => lightboxRef?.focus());

		// An ancestor in the message list stops keydown propagation
		// (ChannelLayout's `onKeyDown`), so a bubble-phase listener would only
		// fire if focus successfully landed inside the portaled lightbox — which
		// is racy. Listening in the capture phase runs before that ancestor can
		// swallow the event, so arrow/Escape keys work regardless of focus.
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") close();
			else if (e.key === "ArrowRight") {
				e.preventDefault();
				next();
			} else if (e.key === "ArrowLeft") {
				e.preventDefault();
				prev();
			}
		};
		window.addEventListener("keydown", onKey, true);
		onCleanup(() => window.removeEventListener("keydown", onKey, true));
	});

	return (
		<>
			<Show
				when={count() > 1}
				fallback={
					<div
						ref={props.ref}
						class={`group/image relative max-h-96 w-full ${sizeClass()}`}
					>
						<img
							src={props.images[0]?.url}
							class="max-h-96 w-full cursor-zoom-in rounded-lg border border-border object-cover transition-opacity hover:opacity-90"
							alt={props.images[0]?.name ?? ""}
							loading="lazy"
							onClick={() => open(0)}
							onError={() => props.onImageError?.(0)}
						/>
						<a
							class="absolute z-20 top-1 right-1 hidden aspect-square -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-sm border border-border bg-card p-1 hover:bg-muted group-hover/image:flex"
							href={props.images[0]?.url}
							target="_blank"
							rel="noreferrer"
							onClick={(e) => openExternalLink(props.images[0]?.url, e)}
							title={props.images[0]?.name ?? "Image"}
						>
							<DownloadIcon class="h-5 w-5 shrink-0 text-muted-foreground" />
						</a>
					</div>
				}
			>
				<div ref={props.ref} class={imageGridClass(count(), sizeClass())}>
					<For each={props.images}>
						{(image, i) => (
							<button
								type="button"
								class="aspect-square cursor-zoom-in overflow-hidden rounded-lg border border-border"
								onClick={() => open(i())}
							>
								<img
									src={image.url}
									class="h-full w-full object-cover transition-opacity hover:opacity-90"
									alt={image.name ?? ""}
									loading="lazy"
									onError={() => props.onImageError?.(i())}
								/>
							</button>
						)}
					</For>
				</div>
			</Show>

			<Show when={openIndex() !== null}>
				<Portal>
					<div
						id="lightbox"
						ref={lightboxRef}
						tabIndex={-1}
						class="fixed inset-0 z-50 flex items-center justify-center bg-background/95 outline-none"
						onClick={close}
					>
						<img
							src={props.images[openIndex()!]?.url}
							alt={props.images[openIndex()!]?.name ?? ""}
							class="max-h-[calc(100vh-8rem)] max-w-[calc(100vw-4rem)] rounded-sm"
							onClick={(e) => e.stopPropagation()}
						/>

						<Button
							variant="outline"
							class="absolute top-[calc(var(--safe-area-top)+2rem)] right-[calc(env(safe-area-inset-right)+2rem)] z-50 h-10 w-10 bg-card!"
							onClick={(e) => {
								e.stopPropagation();
								close();
							}}
						>
							<XIcon />
						</Button>

						<Show when={count() > 1}>
							<div
								class="absolute bottom-8 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card p-1"
								onClick={(e) => e.stopPropagation()}
							>
								<button
									type="button"
									class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-foreground hover:bg-muted"
									onClick={prev}
									aria-label="Previous image"
								>
									<CaretLeftIcon class="h-5 w-5" />
								</button>
								<span class="min-w-12 text-center text-sm tabular-nums text-muted-foreground select-none">
									{openIndex()! + 1} / {count()}
								</span>
								<button
									type="button"
									class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-foreground hover:bg-muted"
									onClick={next}
									aria-label="Next image"
								>
									<CaretRightIcon class="h-5 w-5" />
								</button>
							</div>
						</Show>
					</div>
				</Portal>
			</Show>
		</>
	);
};

export const ImageGallery: Component<{
	images: AttachmentObj[];
	did: string;
}> = (props) => {
	const stableMedia = useStableMedia();
	const items = (): GalleryImage[] =>
		props.images.map((i) => ({
			url: resolveBlob(props.did, i.blob),
			name: i.name,
		}));

	return <MediaLightboxGallery images={items()} ref={stableMedia} />;
};

export const VideoAttachment: AttachmentComponent = (props) => {
	const stableMedia = useStableMedia();
	const src = () => resolveBlob(props.did, props.item.blob);

	const usePseudoFullscreen = isTauriRuntime();
	const [pseudoFullscreen, setPseudoFullscreen] = createSignal(false);

	const enterPseudoFullscreen = () => {
		setPseudoFullscreen(true);
		try {
			history.pushState({ ...history.state, colibriVideoFullscreen: true }, "");
		} catch {
			// history unavailable
		}
	};

	const exitPseudoFullscreen = () => {
		if (!pseudoFullscreen()) return;
		if (history.state?.colibriVideoFullscreen) history.back();
		else setPseudoFullscreen(false);
	};

	onMount(() => {
		if (!usePseudoFullscreen) return;

		const onPop = () => {
			if (pseudoFullscreen()) setPseudoFullscreen(false);
		};
		window.addEventListener("popstate", onPop);
		onCleanup(() => window.removeEventListener("popstate", onPop));
	});

	return (
		<media-player
			ref={stableMedia}
			class="colibri-media-video group relative w-full max-w-104 rounded-lg bg-black overflow-hidden"
			classList={{ "colibri-pseudo-fullscreen": pseudoFullscreen() }}
			title={props.item.name ?? "Video"}
			viewType="video"
			streamType="on-demand"
			load="play"
			playsInline
		>
			<a
				class="absolute z-20 top-4 aspect-square right-4 hidden group-hover:flex items-center justify-center bg-card p-1 rounded-sm hover:bg-muted border border-border"
				href={src()}
				target="_blank"
				rel="noreferrer"
				onClick={(e) => openExternalLink(src(), e)}
				title={props.item.name ?? "File"}
			>
				<DownloadIcon class="ml-auto h-5 w-5 shrink-0 text-muted-foreground" />
			</a>

			<media-provider>
				<Show when={src()}>
					{(url) => <source src={url()} type={props.item.blob.mimeType} />}
				</Show>
			</media-provider>

			{/* Tap anywhere on the video to toggle playback. */}
			<media-gesture
				class="absolute inset-0 z-0 block"
				event="pointerup"
				action="toggle:paused"
			/>

			{/* Buffering spinner, shown while the player waits for data. */}
			<div class="pointer-events-none absolute inset-0 hidden items-center justify-center group-[[data-buffering]]:flex">
				<SpinnerIcon class="h-8 w-8 animate-spin text-white/90" />
			</div>

			<media-controls class="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-1 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-3 pb-2 pt-10 opacity-0 transition-opacity pointer-events-none group-[[data-controls]]:pointer-events-auto group-[[data-controls]]:opacity-100 group-[[data-paused]]:pointer-events-auto group-[[data-paused]]:opacity-100 pointer-coarse:pointer-events-auto pointer-coarse:opacity-100">
				<media-controls-group class="flex items-center">
					<media-time-slider
						class="group/slider relative flex h-6 flex-1 items-center"
						step={0.01}
					>
						<SliderVisual tone="light" />
					</media-time-slider>
				</media-controls-group>

				<media-controls-group class="flex items-center gap-1 text-white">
					<media-play-button class={videoBtnClass} aria-label="Play">
						<span data-icon="play">
							<PlayIcon class="h-5 w-5" />
						</span>
						<span data-icon="pause">
							<PauseIcon class="h-5 w-5" />
						</span>
					</media-play-button>

					<media-mute-button class={videoBtnClass} aria-label="Mute">
						<span data-icon="high">
							<SpeakerHighIcon class="h-5 w-5" />
						</span>
						<span data-icon="low">
							<SpeakerLowIcon class="h-5 w-5" />
						</span>
						<span data-icon="muted">
							<SpeakerMutedIcon class="h-5 w-5" />
						</span>
					</media-mute-button>

					<media-volume-slider class="group/slider relative mr-1 flex h-6 w-16 items-center">
						<SliderVisual tone="light" />
					</media-volume-slider>

					<TimeDisplay tone="light" />

					<div class="flex-1" />

					<Show
						when={!usePseudoFullscreen}
						fallback={
							<button
								type="button"
								class={videoBtnClass}
								aria-label={
									pseudoFullscreen() ? "Exit fullscreen" : "Fullscreen"
								}
								onClick={() =>
									pseudoFullscreen()
										? exitPseudoFullscreen()
										: enterPseudoFullscreen()
								}
							>
								<Show
									when={pseudoFullscreen()}
									fallback={<CornersOutIcon class="h-5 w-5" />}
								>
									<CornersInIcon class="h-5 w-5" />
								</Show>
							</button>
						}
					>
						<media-fullscreen-button
							class={videoBtnClass}
							aria-label="Fullscreen"
						>
							<span data-icon="enter">
								<CornersOutIcon class="h-5 w-5" />
							</span>
							<span data-icon="exit">
								<CornersInIcon class="h-5 w-5" />
							</span>
						</media-fullscreen-button>
					</Show>
				</media-controls-group>
			</media-controls>
		</media-player>
	);
};

export const GenericFileAttachment: AttachmentComponent = (props) => {
	const stableMedia = useStableMedia();
	const src = () => resolveBlob(props.did, props.item.blob);
	const size = "size" in props.item.blob ? props.item.blob.size : undefined;

	return (
		<a
			ref={stableMedia}
			class="flex max-w-104 w-full flex-row items-center gap-3 rounded-lg border border-border bg-card p-2.5 transition-colors hover:bg-muted/75"
			href={src()}
			target="_blank"
			rel="noreferrer"
			onClick={(e) => openExternalLink(src(), e)}
			title={props.item.name ?? "File"}
		>
			<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
				<FileIcon class="h-5 w-5" />
			</div>
			<div class="flex min-w-0 flex-col">
				<span class="truncate font-medium text-foreground">
					{props.item.name ?? "File"}
				</span>
				<span class="text-sm text-muted-foreground">
					{props.item.blob.mimeType}
					<Show when={size !== undefined}>
						{" · "}
						{formatBytes(size as number)}
					</Show>
				</span>
			</div>
			<DownloadIcon class="ml-auto h-5 w-5 shrink-0 text-muted-foreground" />
		</a>
	);
};

export const MessageAttachments: Component<{
	did: string;
	attachments: Message["attachments"];
	disableHover?: boolean;
}> = (props) => {
	/**
	 * Returns all non-displayable files which should be rendered as a box.
	 */
	const nonDisplayableFiles = () =>
		props.attachments
			.filter(
				(x) =>
					!x.blob.mimeType.includes("image/") &&
					!x.blob.mimeType.includes("video/") &&
					!x.blob.mimeType.includes("audio/"),
			)
			.map((x) => ({ ...x, name: x.name ?? "file" }));

	/**
	 * Returns all audio files.
	 */
	const audioFiles = () =>
		props.attachments
			.filter((x) => x.blob.mimeType.includes("audio/"))
			.map((x) => ({ ...x, name: x.name ?? "audio" }));

	/**
	 * Returns all image files.
	 */
	const imageFiles = () =>
		props.attachments
			.filter((x) => x.blob.mimeType.includes("image/"))
			.map((x) => ({ ...x, name: x.name ?? "image" }));
	/**
	 * Returns all video files.
	 */
	const videoFiles = () =>
		props.attachments
			.filter((x) => x.blob.mimeType.includes("video/"))
			.map((x) => ({ ...x, name: x.name ?? "video" }));

	return (
		<div class="w-full flex flex-col gap-2">
			<Show when={imageFiles().length > 0}>
				<ImageGallery images={imageFiles()} did={props.did} />
			</Show>
			<Show when={videoFiles().length > 0}>
				<div class="w-full flex flex-row flex-wrap gap-2">
					<For each={videoFiles()}>
						{(item) => <VideoAttachment item={item} did={props.did} />}
					</For>
				</div>
			</Show>
			<Show when={audioFiles().length > 0}>
				<div class="w-full flex flex-col gap-2">
					<For each={audioFiles()}>
						{(item) => <AudioAttachment item={item} did={props.did} />}
					</For>
				</div>
			</Show>
			<Show when={nonDisplayableFiles().length > 0}>
				<div class="w-full flex flex-col gap-2">
					<For each={nonDisplayableFiles()}>
						{(item) => <GenericFileAttachment item={item} did={props.did} />}
					</For>
				</div>
			</Show>
		</div>
	);
};
