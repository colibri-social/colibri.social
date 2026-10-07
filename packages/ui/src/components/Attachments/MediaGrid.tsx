import { EyeIcon } from "@solar-icons/solid/bold/eye";
import { PlayIcon } from "@solar-icons/solid/bold/play";
import { createSignal, For, type JSX, Show } from "solid-js";
import { AnimatedDownloadIcon } from "../../icons/animated/navigation";
import { cx } from "../../utils/cx";
import { VideoPlayer } from "../Media/VideoPlayer";
import { Skeleton } from "../Skeleton/Skeleton";
import { createPressRipple, pressSurface } from "./shared";

export type MediaKind = "image" | "video" | "gif";

export type MediaItem = {
	src: string;
	width?: number;
	height?: number;
	alt?: string;
	name?: string;
	kind?: MediaKind;
	poster?: string;
	duration?: string;
	spoiler?: boolean;
	downloadHref?: string;
};

export const MEDIA_GRID_MAX_TILES = 10;
const FRAME_RATIO = "3 / 2";
const SINGLE_MAX_WIDTH = 416;
const SINGLE_MAX_HEIGHT = 320;
const SINGLE_MIN_ASPECT = 0.5;
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
	class?: string;
	style?: JSX.CSSProperties;
};

export const MediaTile = (props: MediaTileProps) => {
	const [revealed, setRevealed] = createSignal(false);
	const [loaded, setLoaded] = createSignal(false);
	const [started, setStarted] = createSignal(false);
	const press = createPressRipple();
	const hidden = () => !!props.item.spoiler && !revealed();
	const inlineVideo = () =>
		props.item.kind === "video" && !hidden() && !props.overflow;
	const label = () => {
		if (hidden()) return `Reveal spoiler ${kindLabel(props.item.kind)}`;
		if (props.overflow) return `Show ${props.overflow} more`;
		return `Open ${kindLabel(props.item.kind)}${props.item.alt ? `: ${props.item.alt}` : ""}`;
	};

	return (
		<div
			data-media-tile=""
			data-index={props.index}
			class={cx(
				"group/tile relative min-h-0 min-w-0 overflow-hidden bg-muted",
				props.class,
			)}
			style={props.style}
		>
			<Show when={props.loading || !loaded()}>
				<Skeleton class="absolute inset-0 size-full rounded-none" />
			</Show>
			<Show when={!props.loading && inlineVideo()}>
				<VideoPlayer
					src={props.item.src}
					poster={props.item.poster}
					label={props.item.alt ?? props.item.name ?? "Video"}
					fit="cover"
					handoff="inline"
					class="absolute inset-0 size-full"
					onReady={() => setLoaded(true)}
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
			<Show when={!props.loading && !inlineVideo()}>
				<button
					ref={press}
					type="button"
					class={cx(
						"absolute inset-0 block size-full border-0 bg-transparent p-0",
						pressSurface,
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
					<img
						src={
							props.item.kind === "video"
								? (props.item.poster ?? "")
								: props.item.src
						}
						alt=""
						draggable={false}
						onLoad={() => setLoaded(true)}
						class={cx(
							"size-full object-cover transition-opacity duration-[calc(150ms*var(--motion-scale))] motion-reduce:transition-none reduced-motion:transition-none",
							loaded() ? "opacity-100" : "opacity-0",
							hidden() && "scale-110 blur-xl",
						)}
					/>
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
					<Show when={props.item.kind === "gif" && !hidden()}>
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
			<Show
				when={
					!props.loading &&
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
					class="absolute top-1.5 right-1.5 flex size-7 items-center justify-center rounded-control-sm bg-black/60 text-white opacity-0 outline-none backdrop-blur-sm group-hover/tile:opacity-100 hover:bg-black/75 focus-visible:opacity-100 focus-visible:shadow-[0_0_0_2px_var(--primary)] [&>svg]:size-4"
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
						const aspect = () =>
							clamp(aspectOf(item()), SINGLE_MIN_ASPECT, SINGLE_MAX_ASPECT);
						return (
							<div
								data-media-grid=""
								class={cx("w-full", props.class)}
								style={{
									"max-width": `min(${SINGLE_MAX_WIDTH}px, ${SINGLE_MAX_HEIGHT * aspect()}px)`,
								}}
							>
								<MediaTile
									item={item()}
									index={0}
									loading={props.loading}
									onOpen={props.onOpen}
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
				<For each={groups()}>
					{(group) => (
						<div
							class={cx(
								"flex min-h-0 min-w-0 flex-1 gap-0.5",
								columns() ? "flex-col" : "flex-row",
							)}
						>
							<For each={group}>
								{(tile) => (
									<MediaTile
										item={tile.item}
										index={tile.index}
										loading={props.loading}
										onOpen={props.onOpen}
										class="flex-1"
										overflow={
											overflow() > 0 && tile.index === max() - 1
												? overflow() + 1
												: undefined
										}
									/>
								)}
							</For>
						</div>
					)}
				</For>
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
				width: 4,
				height: 3,
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
