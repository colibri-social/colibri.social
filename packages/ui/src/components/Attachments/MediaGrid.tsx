import { DangerTriangleIcon } from "@solar-icons/solid/bold/danger-triangle";
import { EyeIcon } from "@solar-icons/solid/bold/eye";
import { PauseIcon } from "@solar-icons/solid/bold/pause";
import { PlayIcon } from "@solar-icons/solid/bold/play";
import {
	createEffect,
	createMemo,
	createSignal,
	Index,
	type JSX,
	on,
	Show,
} from "solid-js";
import { AnimatedDownloadIcon } from "../../icons/animated/navigation";
import { cx } from "../../utils/cx";
import {
	appActive,
	isAnimatedSource,
	reducedMotionActive,
} from "../../utils/playback";
import { AnimatedImage } from "../AnimatedImage/AnimatedImage";
import { UploadProgress } from "../Composer/AttachmentTray";
import { VideoPlayer } from "../Media/VideoPlayer";
import { VideoSource } from "../Media/VideoSource";
import { Skeleton } from "../Skeleton/Skeleton";
import { createPressRipple, pressSurfaceInset } from "./shared";

export type MediaKind = "image" | "video" | "gif";

export type MediaItem = {
	src: string;
	width?: number;
	height?: number;
	alt?: string;
	name?: string;
	kind?: MediaKind;
	mimeType?: string;
	poster?: string;
	duration?: string;
	spoiler?: boolean;
	downloadHref?: string;
	progress?: number;
};

export const MEDIA_GRID_MAX_TILES = 10;
const FRAME_RATIO = "3 / 2";
const SINGLE_MAX_WIDTH = 416;
const SINGLE_MAX_HEIGHT = 320;
const SINGLE_MIN_ASPECT = 0.5;
const SINGLE_VIDEO_MIN_ASPECT = 0.6;
const SINGLE_MAX_ASPECT = 2.5;

const GROUPS: Record<number, number[]> = {
	1: [1],
	2: [2],
	3: [1, 2],
	4: [2, 2],
	5: [2, 3],
	6: [3, 3],
	7: [3, 4],
	8: [4, 4],
	9: [3, 3, 3],
	10: [4, 3, 3],
};

const clamp = (value: number, min: number, max: number) =>
	Math.min(max, Math.max(min, value));

const aspectOf = (item: Pick<MediaItem, "width" | "height">) =>
	item.width && item.height ? item.width / item.height : 4 / 3;

const groupInto = <T,>(items: T[], sizes: number[]) => {
	let taken = 0;
	return sizes.map((size) => {
		const group = items.slice(taken, taken + size);
		taken += size;
		return group;
	});
};

const kindLabel = (kind: MediaKind | undefined) =>
	kind === "video" ? "video" : kind === "gif" ? "GIF" : "image";

const MediaPill = (props: { children: JSX.Element; class?: string }) => (
	<span
		aria-hidden="true"
		class={cx(
			"pointer-events-none absolute rounded-badge bg-black/60 px-1.5 py-0.5 text-xs font-semibold text-white backdrop-blur-sm",
			props.class,
		)}
	>
		{props.children}
	</span>
);

export type MediaTileProps = {
	item: MediaItem;
	index: number;
	overflow?: number;
	loading?: boolean;
	onOpen?: (index: number) => void;
	onMediaError?: MediaErrorHandler;
	onRetry?: (index: number) => void;
	onNaturalSize?: (size: { width: number; height: number }) => void;
	class?: string;
	style?: JSX.CSSProperties;
};

export type MediaErrorHandler = (index: number) => unknown;

type MediaStatus = "ok" | "refreshing" | "broken";

const MediaBroken = (props: {
	kind: MediaKind | undefined;
	onRetry: () => void;
}) => (
	<div
		data-media-error=""
		class="@container absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 bg-muted p-2 text-center text-muted-foreground"
	>
		<span aria-hidden="true" class="[&>svg]:size-5">
			<DangerTriangleIcon />
		</span>
		<span class="sr-only @min-[140px]:not-sr-only @min-[140px]:text-xs @min-[140px]:font-medium">
			{`Couldn't load this ${kindLabel(props.kind)}`}
		</span>
		<button
			type="button"
			data-media-retry=""
			class="cursor-pointer rounded-control-xs border-0 bg-transparent px-1 py-0.5 text-xs font-semibold text-foreground underline-offset-2 outline-none hover:underline focus-ring"
			onClick={() => props.onRetry()}
		>
			Try again
		</button>
	</div>
);

const VideoFrame = (props: {
	src: string;
	mimeType?: string;
	class?: string;
	onLoad: () => void;
	onError: () => void;
}) => (
	<video
		tabindex={-1}
		muted
		playsinline
		preload="metadata"
		class={props.class}
		onLoadedData={() => props.onLoad()}
		onError={() => props.onError()}
	>
		<VideoSource
			src={props.src}
			mimeType={props.mimeType}
			onError={props.onError}
		/>
	</video>
);

const LoopingVideo = (props: {
	src: string;
	mimeType?: string;
	poster?: string;
	paused: boolean;
	class?: string;
	onLoad: () => void;
	onError: () => void;
}) => {
	const [element, setElement] = createSignal<HTMLVideoElement>();
	createEffect(() => {
		const video = element();
		if (!video) return;
		if (props.paused) video.pause();
		else void video.play().catch(() => undefined);
	});
	return (
		<video
			ref={setElement}
			tabindex={-1}
			muted
			loop
			playsinline
			autoplay={!props.paused}
			preload="auto"
			poster={props.poster}
			class={props.class}
			onLoadedData={() => props.onLoad()}
			onError={() => props.onError()}
		>
			<VideoSource
				src={props.src}
				mimeType={props.mimeType}
				onError={props.onError}
			/>
		</video>
	);
};

const isVideoMime = (mimeType: string | undefined) =>
	!!mimeType?.startsWith("video/");

export const MediaTile = (props: MediaTileProps) => {
	const [revealed, setRevealed] = createSignal(false);
	const [loaded, setLoaded] = createSignal(false);
	const [started, setStarted] = createSignal(false);
	const [playing, setPlaying] = createSignal(false);
	const [status, setStatus] = createSignal<MediaStatus>("ok");
	const [attempt, setAttempt] = createSignal(1);
	const displayedSrc = createMemo(() =>
		props.item.kind === "video"
			? (props.item.poster ?? props.item.src)
			: props.item.src,
	);
	createEffect(
		on(
			displayedSrc,
			() => {
				setStatus("ok");
				setLoaded(false);
			},
			{ defer: true },
		),
	);
	const failMedia = async () => {
		if (props.loading || status() !== "ok") return;
		const failedSrc = props.item.src;
		const failedAttempt = attempt();
		setStatus("refreshing");
		await Promise.resolve(props.onMediaError?.(props.index)).catch(
			() => undefined,
		);
		if (
			props.item.src === failedSrc &&
			attempt() === failedAttempt &&
			status() === "refreshing"
		)
			setStatus("broken");
	};
	const retry = () => {
		props.onRetry?.(props.index);
		setLoaded(false);
		setStatus("ok");
		setAttempt((value) => value + 1);
	};
	createEffect(
		on(
			appActive,
			(active, wasActive) => {
				if (active && wasActive === false && status() === "refreshing") retry();
			},
			{ defer: true },
		),
	);
	const working = () => status() === "ok";
	const animates = () =>
		props.item.kind === "gif" ||
		(props.item.kind !== "video" && isAnimatedSource(props.item.src));
	const showPlayToggle = () =>
		!props.loading &&
		working() &&
		animates() &&
		reducedMotionActive() &&
		appActive() &&
		!hidden() &&
		!props.overflow;
	const press = createPressRipple();
	const hidden = () => !!props.item.spoiler && !revealed();
	const inlineVideo = () =>
		props.item.kind === "video" && !hidden() && !props.overflow;
	const posterlessVideo = () =>
		props.item.kind === "video" && !props.item.poster;
	const loopingGif = () =>
		props.item.kind === "gif" && isVideoMime(props.item.mimeType);
	const previewClass = () =>
		cx(
			"size-full object-cover transition-opacity duration-[calc(150ms*var(--motion-scale))] motion-reduce:transition-none reduced-motion:transition-none",
			loaded() ? "opacity-100" : "opacity-0",
			hidden() && "scale-110 blur-xl",
		);
	const label = () => {
		if (hidden()) return `Reveal spoiler ${kindLabel(props.item.kind)}`;
		if (props.overflow) return `Show ${props.overflow} more`;
		return `Open ${kindLabel(props.item.kind)}${props.item.alt ? `: ${props.item.alt}` : ""}`;
	};

	return (
		<div
			data-media-tile=""
			data-index={props.index}
			data-media-status={status()}
			data-image-src={
				props.item.kind === "video" || props.loading || !working()
					? undefined
					: (props.item.downloadHref ?? props.item.src)
			}
			data-image-name={
				props.item.kind === "video" ? undefined : props.item.name
			}
			class={cx(
				"group/tile relative min-h-0 min-w-0 overflow-hidden bg-muted",
				props.class,
			)}
			style={props.style}
		>
			<Show when={props.loading || (!loaded() && status() !== "broken")}>
				<Skeleton class="absolute inset-0 size-full rounded-none" />
			</Show>
			<Show when={props.item.progress !== undefined && props.item.progress < 1}>
				<span data-media-uploading="" class="absolute inset-0 z-10">
					<UploadProgress
						progress={props.item.progress ?? 0}
						label={`Uploading ${props.item.name ?? kindLabel(props.item.kind)}`}
					/>
				</span>
			</Show>
			<Show when={status() === "broken"}>
				<MediaBroken kind={props.item.kind} onRetry={retry} />
			</Show>
			<Show
				when={!props.loading && inlineVideo() && working() && attempt()}
				keyed
			>
				<VideoPlayer
					src={props.item.src}
					mimeType={props.item.mimeType}
					poster={props.item.poster}
					label={props.item.alt ?? props.item.name ?? "Video"}
					fit="cover"
					handoff="inline"
					class="absolute inset-0 size-full"
					onReady={() => setLoaded(true)}
					onError={() => void failMedia()}
					onStartedChange={setStarted}
					onExpand={
						props.onOpen ? () => props.onOpen?.(props.index) : undefined
					}
				/>
				<Show when={!started()}>
					<Show when={props.item.duration}>
						<MediaPill class="top-2 left-2 tabular-nums">
							{props.item.duration}
						</MediaPill>
					</Show>
				</Show>
			</Show>
			<Show
				when={!props.loading && !inlineVideo() && working() && attempt()}
				keyed
			>
				<button
					ref={press}
					type="button"
					class={cx(
						"absolute inset-0 block size-full border-0 bg-transparent p-0",
						pressSurfaceInset,
					)}
					onClick={() => {
						if (hidden()) {
							setRevealed(true);
							return;
						}
						props.onOpen?.(props.index);
					}}
				>
					<span class="sr-only">{label()}</span>
					<Show
						when={!loopingGif()}
						fallback={
							<LoopingVideo
								src={props.item.src}
								mimeType={props.item.mimeType}
								poster={props.item.poster}
								paused={
									hidden() ||
									!appActive() ||
									(reducedMotionActive() && !playing())
								}
								onLoad={() => setLoaded(true)}
								onError={() => void failMedia()}
								class={previewClass()}
							/>
						}
					>
						<Show
							when={!posterlessVideo()}
							fallback={
								<VideoFrame
									src={props.item.src}
									mimeType={props.item.mimeType}
									onLoad={() => setLoaded(true)}
									onError={() => void failMedia()}
									class={previewClass()}
								/>
							}
						>
							<AnimatedImage
								animated={props.item.kind === "gif" ? true : undefined}
								playOnDemand="none"
								play={playing()}
								src={
									props.item.kind === "video"
										? props.item.poster
										: props.item.src
								}
								alt=""
								draggable={false}
								onLoad={(event) => {
									setLoaded(true);
									const image = event.currentTarget;
									if (image.naturalWidth && image.naturalHeight)
										props.onNaturalSize?.({
											width: image.naturalWidth,
											height: image.naturalHeight,
										});
								}}
								onError={() => void failMedia()}
								class={previewClass()}
							/>
						</Show>
					</Show>
					<span
						aria-hidden="true"
						class="pointer-events-none absolute inset-0 hidden bg-white/6 group-hover/tile:block"
					/>
					<Show when={props.item.kind === "video" && !hidden()}>
						<span
							aria-hidden="true"
							class="pointer-events-none absolute inset-0 flex items-center justify-center"
						>
							<span class="flex size-12 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm [&>svg]:size-6">
								<PlayIcon />
							</span>
						</span>
					</Show>
					<Show
						when={props.item.kind === "gif" && !hidden() && !showPlayToggle()}
					>
						<MediaPill class="bottom-2 left-2">GIF</MediaPill>
					</Show>
					<Show when={props.item.alt && !hidden() && !props.overflow}>
						<MediaPill class="right-2 bottom-2">ALT</MediaPill>
					</Show>
					<Show when={hidden()}>
						<span
							aria-hidden="true"
							class="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25"
						>
							<span class="flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur-sm [&>svg]:size-4">
								<EyeIcon />
								Spoiler
							</span>
						</span>
					</Show>
					<Show when={props.overflow}>
						<span
							aria-hidden="true"
							data-media-overflow=""
							class="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/55 text-2xl font-bold text-white"
						>
							+{props.overflow}
						</span>
					</Show>
				</button>
			</Show>
			<Show when={showPlayToggle()}>
				<button
					type="button"
					data-gif-toggle=""
					aria-pressed={playing()}
					aria-label={`${playing() ? "Pause" : "Play"} ${props.item.kind === "gif" ? "GIF" : "animation"}`}
					onClick={() => setPlaying((value) => !value)}
					class="absolute bottom-1.5 left-1.5 flex h-7 cursor-pointer items-center gap-1 rounded-control-sm border-0 bg-black/60 px-2 text-xs font-semibold text-white backdrop-blur-sm outline-none select-none hover:bg-black/75 focus-ring [&>svg]:size-3.5"
				>
					{playing() ? <PauseIcon /> : <PlayIcon />}
					<Show when={props.item.kind === "gif"}>
						<span aria-hidden="true">GIF</span>
					</Show>
				</button>
			</Show>
			<Show
				when={
					!props.loading &&
					working() &&
					props.item.downloadHref &&
					!hidden() &&
					!props.overflow
				}
			>
				<a
					href={props.item.downloadHref}
					download={props.item.name ?? ""}
					aria-label={`Download ${props.item.name ?? kindLabel(props.item.kind)}`}
					data-icon-host=""
					class="absolute top-1.5 right-1.5 flex size-7 items-center justify-center rounded-control-sm bg-black/60 text-white opacity-0 outline-none backdrop-blur-sm group-hover/tile:opacity-100 hover:bg-black/75 focus-visible:opacity-100 focus-ring [&>svg]:size-4"
				>
					<AnimatedDownloadIcon />
				</a>
			</Show>
		</div>
	);
};

export type MediaGridProps = {
	items: MediaItem[];
	onOpen?: (index: number) => void;
	onMediaError?: MediaErrorHandler;
	onRetry?: (index: number) => void;
	loading?: boolean;
	maxTiles?: number;
	class?: string;
	radiusClass?: string;
};

export const MediaGrid = (props: MediaGridProps) => {
	const max = () =>
		Math.min(props.maxTiles ?? MEDIA_GRID_MAX_TILES, MEDIA_GRID_MAX_TILES);
	const shown = () => props.items.slice(0, max());
	const overflow = () => Math.max(0, props.items.length - max());
	const radius = () => props.radiusClass ?? "rounded-control-lg";
	const groups = () =>
		groupInto(
			shown().map((item, index) => ({ item, index })),
			GROUPS[shown().length] ?? [shown().length],
		);
	const columns = () => shown().length === 3;

	return (
		<Show
			when={shown().length > 1}
			fallback={
				<Show when={shown()[0]}>
					{(item) => {
						const [natural, setNatural] =
							createSignal<Pick<MediaItem, "width" | "height">>();
						const known = () => !!item().width && !!item().height;
						const size = () => (known() ? item() : (natural() ?? item()));
						const aspect = () =>
							clamp(
								aspectOf(size()),
								item().kind === "video"
									? SINGLE_VIDEO_MIN_ASPECT
									: SINGLE_MIN_ASPECT,
								SINGLE_MAX_ASPECT,
							);
						const maxWidth = () => {
							const { width, height } = size();
							const limits = [SINGLE_MAX_WIDTH, SINGLE_MAX_HEIGHT * aspect()];
							if (width && height) limits.push(width, height * aspect());
							return `${Math.min(...limits)}px`;
						};
						return (
							<div
								data-media-grid=""
								class={cx("w-full", props.class)}
								style={{ "max-width": maxWidth() }}
							>
								<MediaTile
									item={item()}
									index={0}
									loading={props.loading}
									onOpen={props.onOpen}
									onMediaError={props.onMediaError}
									onRetry={props.onRetry}
									onNaturalSize={known() ? undefined : setNatural}
									class={cx("w-full", radius())}
									style={{ "aspect-ratio": String(aspect()) }}
								/>
							</div>
						);
					}}
				</Show>
			}
		>
			<div
				data-media-grid=""
				class={cx(
					"flex w-full gap-0.5 overflow-hidden",
					columns() ? "flex-row" : "flex-col",
					radius(),
					props.class,
				)}
				style={{
					"max-width": `${SINGLE_MAX_WIDTH}px`,
					"aspect-ratio": FRAME_RATIO,
				}}
			>
				<Index each={groups()}>
					{(group) => (
						<div
							class={cx(
								"flex min-h-0 min-w-0 flex-1 gap-0.5",
								columns() ? "flex-col" : "flex-row",
							)}
						>
							<Index each={group()}>
								{(tile) => (
									<MediaTile
										item={tile().item}
										index={tile().index}
										loading={props.loading}
										onOpen={props.onOpen}
										onMediaError={props.onMediaError}
										onRetry={props.onRetry}
										class="flex-1"
										overflow={
											overflow() > 0 && tile().index === max() - 1
												? overflow() + 1
												: undefined
										}
									/>
								)}
							</Index>
						</div>
					)}
				</Index>
			</div>
		</Show>
	);
};

export type MediaGridSkeletonProps = {
	items?: Pick<MediaItem, "width" | "height">[];
	count?: number;
	class?: string;
	radiusClass?: string;
};

export const MediaGridSkeleton = (props: MediaGridSkeletonProps) => {
	const items = (): MediaItem[] =>
		(
			props.items ??
			Array.from({ length: props.count ?? 1 }, () => ({
				width: SINGLE_MAX_WIDTH,
				height: (SINGLE_MAX_WIDTH * 3) / 4,
			}))
		).map((item) => ({ ...item, src: "" }));
	return (
		<MediaGrid
			items={items()}
			loading
			class={props.class}
			radiusClass={props.radiusClass}
		/>
	);
};
