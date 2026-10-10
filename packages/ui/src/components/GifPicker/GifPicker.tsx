import { StarIcon } from "@solar-icons/solid/bold/star";
import { StarIcon as StarOutlineIcon } from "@solar-icons/solid/linear/star";
import {
	createEffect,
	createMemo,
	createSignal,
	For,
	type JSX,
	Match,
	on,
	onCleanup,
	Show,
	Switch,
} from "solid-js";
import { cx } from "../../utils/cx";
import { createLongPress } from "../../utils/gestures/long-press";
import { useHaptics } from "../../utils/haptics";
import { createSlot } from "../../utils/slot";
import { AnimatedImage } from "../AnimatedImage/AnimatedImage";
import { Button } from "../Button/Button";
import { SegmentedControl } from "../SegmentedControl/SegmentedControl";
import { Loadable, Skeleton } from "../Skeleton/Skeleton";
import { SearchField } from "../TextField/TextField";

export type Gif = {
	id: string;
	url: string;
	previewUrl: string;
	width: number;
	height: number;
	title?: string;
};

export type GifCategory = {
	name: string;
	previewUrl?: string;
};

export type GifPage = {
	gifs: Gif[];
	cursor?: string;
};

export type GifSource = {
	trending: (cursor?: string) => Promise<GifPage>;
	search: (query: string, cursor?: string) => Promise<GifPage>;
	categories: () => Promise<GifCategory[]>;
};

export type GifPickerPlatform = "mobile" | "desktop";

export type GifPickerProps = {
	source: GifSource;
	onPick: (gif: Gif, event: MouseEvent) => void;
	favorites?: Gif[];
	onToggleFavorite?: (gif: Gif, favorite: boolean) => void;
	recents?: Gif[];
	platform?: GifPickerPlatform;
	attribution?: JSX.Element;
	searchPlaceholder?: string;
	autofocus?: boolean;
	debounce?: number;
	class?: string;
};

type GifTab = "trending" | "favorites" | "categories";

const COLUMNS = 2;
const COLUMN_INDEXES = Array.from({ length: COLUMNS }, (_, index) => index);
const PREFETCH_MARGIN = "320px";
const SKELETON_RATIOS = [0.75, 1.1, 0.6, 0.9, 1.25, 0.7];

const tabOptions = [
	{ value: "trending", label: "Trending" },
	{ value: "favorites", label: "Favorites" },
	{ value: "categories", label: "Categories" },
];

const ratioOf = (gif: Gif) =>
	gif.width > 0 && gif.height > 0 ? gif.height / gif.width : 1;

export type MasonryPlacement<T> = {
	item: T;
	column: number;
	offset: number;
	before: number;
};

export const masonryLayout = <T,>(
	items: T[],
	ratio: (item: T) => number,
	count = COLUMNS,
) => {
	const heights = new Array<number>(count).fill(0);
	const counts = new Array<number>(count).fill(0);
	const placements: MasonryPlacement<T>[] = items.map((item) => {
		let shortest = 0;
		for (let index = 1; index < count; index++)
			if (heights[index] < heights[shortest] - 0.001) shortest = index;
		const placement = {
			item,
			column: shortest,
			offset: heights[shortest],
			before: counts[shortest],
		};
		heights[shortest] += ratio(item);
		counts[shortest] += 1;
		return placement;
	});
	return { placements, heights, counts };
};

export const masonryColumns = <T,>(
	items: T[],
	ratio: (item: T) => number,
	count = COLUMNS,
) => {
	const columns: T[][] = Array.from({ length: count }, () => []);
	for (const placement of masonryLayout(items, ratio, count).placements)
		columns[placement.column].push(placement.item);
	return columns;
};

const MASONRY_GAP_PX = 8;
const COLUMN_WIDTH = `((100cqw - ${(COLUMNS - 1) * MASONRY_GAP_PX}px) / ${COLUMNS})`;

const moveFocusInMasonry = (event: KeyboardEvent) => {
	const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
	if (!keys.includes(event.key)) return;
	const current = (event.target as HTMLElement).closest<HTMLElement>(
		"[data-gif-pick]",
	);
	const root = event.currentTarget as HTMLElement;
	if (!current) return;
	const tiles = Array.from(
		root.querySelectorAll<HTMLElement>("[data-gif-pick]"),
	);
	const from = current.getBoundingClientRect();
	const centerX = from.left + from.width / 2;
	const centerY = from.top + from.height / 2;
	let best: HTMLElement | undefined;
	let bestScore = Number.POSITIVE_INFINITY;
	for (const tile of tiles) {
		if (tile === current) continue;
		const box = tile.getBoundingClientRect();
		const x = box.left + box.width / 2;
		const y = box.top + box.height / 2;
		const sameColumn = Math.abs(x - centerX) < from.width / 2;
		let score = Number.POSITIVE_INFINITY;
		if (event.key === "ArrowDown" && sameColumn && y > centerY)
			score = y - centerY;
		if (event.key === "ArrowUp" && sameColumn && y < centerY)
			score = centerY - y;
		if (event.key === "ArrowRight" && x > centerX + from.width / 2)
			score = Math.abs(y - centerY) + (x - centerX) * 0.01;
		if (event.key === "ArrowLeft" && x < centerX - from.width / 2)
			score = Math.abs(y - centerY) + (centerX - x) * 0.01;
		if (score < bestScore) {
			bestScore = score;
			best = tile;
		}
	}
	if (!best) return;
	event.preventDefault();
	best.focus();
	best.scrollIntoView({ block: "nearest" });
};

type Feed = {
	gifs: Gif[];
	cursor?: string;
	loading: boolean;
	failed: boolean;
	started: boolean;
};

const emptyFeed = (): Feed => ({
	gifs: [],
	loading: false,
	failed: false,
	started: false,
});

export const GifPicker = (props: GifPickerProps) => {
	const haptics = useHaptics();
	const attribution = createSlot(() => props.attribution);
	const platform = () => props.platform ?? "desktop";
	const [tab, setTab] = createSignal<GifTab>("trending");
	const [rawQuery, setRawQuery] = createSignal("");
	const [query, setQuery] = createSignal("");
	const [feed, setFeed] = createSignal<Feed>(emptyFeed());
	const [categories, setCategories] = createSignal<GifCategory[]>();
	const [categoriesFailed, setCategoriesFailed] = createSignal(false);
	let generation = 0;
	let scroller: HTMLDivElement | undefined;

	createEffect(
		on(rawQuery, (raw) => {
			const next = raw.trim();
			if (!next) {
				setQuery("");
				return;
			}
			const timer = setTimeout(() => setQuery(next), props.debounce ?? 300);
			onCleanup(() => clearTimeout(timer));
		}),
	);

	const mode = createMemo<"search" | GifTab>(() =>
		query() ? "search" : tab(),
	);

	const fetchPage = (cursor?: string) => {
		const search = query();
		return search
			? props.source.search(search, cursor)
			: props.source.trending(cursor);
	};

	const loadFirst = () => {
		const token = ++generation;
		setFeed({ ...emptyFeed(), loading: true, started: true });
		if (scroller) scroller.scrollTop = 0;
		fetchPage().then(
			(page) => {
				if (token !== generation) return;
				setFeed({
					gifs: page.gifs,
					cursor: page.cursor,
					loading: false,
					failed: false,
					started: true,
				});
			},
			() => {
				if (token !== generation) return;
				setFeed({ ...emptyFeed(), failed: true, started: true });
			},
		);
	};

	const loadMore = () => {
		const current = feed();
		if (current.loading || current.failed || !current.cursor) return;
		const token = generation;
		setFeed({ ...current, loading: true });
		fetchPage(current.cursor).then(
			(page) => {
				if (token !== generation) return;
				const seen = new Set(feed().gifs.map((gif) => gif.id));
				setFeed((previous) => ({
					...previous,
					gifs: [
						...previous.gifs,
						...page.gifs.filter((gif) => !seen.has(gif.id)),
					],
					cursor: page.cursor,
					loading: false,
				}));
			},
			() => {
				if (token !== generation) return;
				setFeed((previous) => ({ ...previous, loading: false, failed: true }));
			},
		);
	};

	const loadCategories = () => {
		setCategoriesFailed(false);
		props.source.categories().then(
			(list) => setCategories(list),
			() => setCategoriesFailed(true),
		);
	};

	createEffect(
		on([mode, query], ([current]) => {
			if (current === "search" || current === "trending") {
				loadFirst();
				return;
			}
			generation++;
			if (current === "categories" && !categories()) loadCategories();
		}),
	);

	const isFavorite = (gif: Gif) =>
		(props.favorites ?? []).some((favorite) => favorite.id === gif.id);

	const toggleFavorite = (gif: Gif) => {
		const next = !isFavorite(gif);
		props.onToggleFavorite?.(gif, next);
	};

	const selectTab = (next: string) => {
		setRawQuery("");
		setQuery("");
		setTab(next as GifTab);
	};

	const runSearch = (term: string) => {
		setRawQuery(term);
		setQuery(term);
	};

	const sentinel = (element: HTMLDivElement) => {
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) loadMore();
			},
			{ root: scroller, rootMargin: `0px 0px ${PREFETCH_MARGIN} 0px` },
		);
		observer.observe(element);
		onCleanup(() => observer.disconnect());
	};

	const Tile = (tile: {
		gif: Gif;
		class?: string;
		style?: JSX.CSSProperties;
	}) => {
		const [loaded, setLoaded] = createSignal(false);
		const favorite = () => isFavorite(tile.gif);
		const touch = () => platform() === "mobile";
		return (
			<div
				data-gif-tile={tile.gif.id}
				class={cx("group/tile relative", tile.class)}
				style={tile.style}
				ref={(element) =>
					createLongPress(element, {
						enabled: () => !!props.onToggleFavorite,
						onLongPress: () => {
							haptics.impact("medium");
							toggleFavorite(tile.gif);
						},
					})
				}
			>
				<button
					type="button"
					data-gif-pick=""
					aria-label={tile.gif.title || "GIF"}
					onClick={(event) => props.onPick(tile.gif, event)}
					class="block size-full cursor-pointer overflow-hidden rounded-control-sm bg-secondary outline-none focus-ring"
				>
					<AnimatedImage
						src={tile.gif.previewUrl}
						alt=""
						loading="lazy"
						decoding="async"
						draggable={false}
						onLoad={() => setLoaded(true)}
						class={cx(
							"size-full object-cover transition-opacity duration-[calc(160ms*var(--motion-scale))] ease-(--ease-out-quick)",
							!loaded() && "opacity-0",
						)}
					/>
				</button>
				<Show when={props.onToggleFavorite}>
					<button
						type="button"
						aria-label="Favorite"
						aria-pressed={favorite()}
						onClick={(event) => {
							event.stopPropagation();
							toggleFavorite(tile.gif);
						}}
						class={cx(
							"absolute top-1 right-1 flex cursor-pointer items-center justify-center rounded-full bg-black/55 text-white outline-none",
							"hover:bg-black/75 focus-visible:opacity-100 focus-ring",
							touch() ? "size-9 [&_svg]:size-5" : "size-7 [&_svg]:size-4",
							favorite()
								? "opacity-100"
								: touch()
									? "opacity-70"
									: "opacity-0 group-hover/tile:opacity-100",
						)}
					>
						<Show when={favorite()} fallback={<StarOutlineIcon />}>
							<StarIcon class="text-warning" />
						</Show>
					</button>
				</Show>
			</div>
		);
	};

	const Masonry = (masonry: { gifs: Gif[] }) => {
		const layout = createMemo(() => masonryLayout(masonry.gifs, ratioOf));
		const height = () => {
			const { heights, counts } = layout();
			const columns = heights.map(
				(ratio, column) =>
					`calc(${COLUMN_WIDTH} * ${ratio} + ${Math.max(0, counts[column] - 1) * MASONRY_GAP_PX}px)`,
			);
			return `max(${columns.join(", ")})`;
		};
		return (
			<div data-gif-masonry="" class="[container-type:inline-size]">
				<div
					class="relative"
					style={{ height: height() }}
					onKeyDown={moveFocusInMasonry}
				>
					<For each={layout().placements}>
						{(placement) => (
							<Tile
								gif={placement.item}
								class="absolute"
								style={{
									width: `calc${COLUMN_WIDTH}`,
									left: `calc((${COLUMN_WIDTH} + ${MASONRY_GAP_PX}px) * ${placement.column})`,
									top: `calc(${COLUMN_WIDTH} * ${placement.offset} + ${placement.before * MASONRY_GAP_PX}px)`,
									"aspect-ratio": `${placement.item.width} / ${placement.item.height}`,
								}}
							/>
						)}
					</For>
				</div>
			</div>
		);
	};

	const MasonrySkeleton = (skeleton: { count?: number }) => (
		<div class="flex gap-2" data-gif-skeleton="">
			<For each={COLUMN_INDEXES}>
				{(column) => (
					<div class="flex min-w-0 flex-1 flex-col gap-2">
						<For
							each={Array.from(
								{ length: Math.ceil((skeleton.count ?? 6) / COLUMNS) },
								(_, row) =>
									SKELETON_RATIOS[
										(row * COLUMNS + column) % SKELETON_RATIOS.length
									],
							)}
						>
							{(ratio) => (
								<Skeleton
									class="w-full rounded-control-sm"
									style={{ "aspect-ratio": `1 / ${ratio}` }}
								/>
							)}
						</For>
					</div>
				)}
			</For>
		</div>
	);

	const Empty = (empty: { children: JSX.Element }) => (
		<p class="px-6 py-10 text-center text-sm text-pretty text-muted-foreground">
			{empty.children}
		</p>
	);

	const Failed = (failed: { onRetry: () => void }) => (
		<div class="flex flex-col items-center gap-3 px-6 py-10 text-center">
			<p class="text-sm text-muted-foreground">Couldn’t load GIFs.</p>
			<Button variant="secondary" onClick={failed.onRetry}>
				Try again
			</Button>
		</div>
	);

	const FeedView = (view: { empty: string; header?: JSX.Element }) => (
		<Show
			when={!(feed().failed && feed().gifs.length === 0)}
			fallback={<Failed onRetry={loadFirst} />}
		>
			<Loadable
				loading={feed().loading && feed().gifs.length === 0}
				skeleton={<MasonrySkeleton />}
				label="Loading GIFs"
			>
				<div class="flex flex-col gap-2">
					{view.header}
					<Show
						when={feed().gifs.length > 0}
						fallback={
							<Show when={feed().started && !feed().loading}>
								<Empty>{view.empty}</Empty>
							</Show>
						}
					>
						<Masonry gifs={feed().gifs} />
					</Show>
				</div>
			</Loadable>
			<Show when={feed().cursor && !feed().failed}>
				<div ref={sentinel} class="h-px" aria-hidden="true" />
			</Show>
			<Show when={feed().loading && feed().gifs.length > 0}>
				<div class="pt-2">
					<MasonrySkeleton count={2} />
				</div>
			</Show>
			<Show when={feed().failed && feed().gifs.length > 0}>
				<div class="flex justify-center py-3">
					<Button
						variant="secondary"
						onClick={() => {
							setFeed((previous) => ({ ...previous, failed: false }));
							loadMore();
						}}
					>
						Load more
					</Button>
				</div>
			</Show>
		</Show>
	);

	const Recents = () => (
		<Show when={(props.recents ?? []).length > 0}>
			<div class="flex flex-col gap-1.5 pb-1">
				<span class="px-1 text-xs font-semibold text-muted-foreground">
					Recent
				</span>
				<div class="ring-room flex gap-2 overflow-x-auto [scrollbar-width:none]">
					<For each={props.recents}>
						{(gif) => (
							<Tile
								gif={gif}
								class="h-20 shrink-0"
								style={{
									"aspect-ratio": `${gif.width} / ${gif.height}`,
								}}
							/>
						)}
					</For>
				</div>
				<span class="px-1 pt-1 text-xs font-semibold text-muted-foreground">
					Trending
				</span>
			</div>
		</Show>
	);

	return (
		<div
			data-gif-picker=""
			data-platform={platform()}
			class={cx(
				"flex min-h-0 w-full flex-col gap-2",
				platform() === "desktop"
					? "h-[min(420px,calc(var(--anchored-max-height,9999px)-18px))]"
					: "h-[min(60dvh,520px)]",
				props.class,
			)}
		>
			<SearchField
				aria-label="Search GIFs"
				placeholder={props.searchPlaceholder ?? "Search GIFs"}
				value={rawQuery()}
				onChange={setRawQuery}
				ref={(element) => {
					if (props.autofocus && platform() === "desktop")
						requestAnimationFrame(() => element.focus());
				}}
				class="shrink-0"
			/>
			<Show when={!rawQuery().trim()}>
				<SegmentedControl
					aria-label="GIF sections"
					size="sm"
					options={tabOptions}
					value={tab()}
					onChange={selectTab}
				/>
			</Show>
			<div
				ref={scroller}
				data-gif-scroller=""
				class="ring-room min-h-0 flex-1 overflow-y-auto overscroll-contain"
			>
				<Switch>
					<Match when={mode() === "search"}>
						<FeedView empty={`No GIFs found for “${query()}”`} />
					</Match>
					<Match when={mode() === "trending"}>
						<FeedView
							empty="Nothing trending right now."
							header={<Recents />}
						/>
					</Match>
					<Match when={mode() === "favorites"}>
						<Show
							when={(props.favorites ?? []).length > 0}
							fallback={
								<Empty>
									{platform() === "mobile"
										? "No favorites yet. Press and hold a GIF to save it."
										: "No favorites yet. Select the star on a GIF to save it."}
								</Empty>
							}
						>
							<Masonry gifs={props.favorites ?? []} />
						</Show>
					</Match>
					<Match when={mode() === "categories"}>
						<Show
							when={!categoriesFailed()}
							fallback={
								<div class="flex flex-col items-center gap-3 px-6 py-10 text-center">
									<p class="text-sm text-muted-foreground">
										Couldn’t load categories.
									</p>
									<Button variant="secondary" onClick={loadCategories}>
										Try again
									</Button>
								</div>
							}
						>
							<Loadable
								loading={!categories()}
								label="Loading categories"
								skeleton={
									<div class="grid grid-cols-2 gap-2">
										<For each={Array.from({ length: 8 }, (_, index) => index)}>
											{() => (
												<Skeleton class="h-20 w-full rounded-control-sm" />
											)}
										</For>
									</div>
								}
							>
								<Show
									when={(categories() ?? []).length > 0}
									fallback={<Empty>No categories available.</Empty>}
								>
									<div class="grid grid-cols-2 gap-2">
										<For each={categories()}>
											{(category) => (
												<button
													type="button"
													onClick={() => runSearch(category.name)}
													class="relative flex h-20 cursor-pointer items-center justify-center overflow-hidden rounded-control-sm bg-secondary outline-none focus-ring"
												>
													<Show when={category.previewUrl}>
														{(src) => (
															<AnimatedImage
																src={src()}
																alt=""
																loading="lazy"
																decoding="async"
																class="absolute inset-0 size-full object-cover opacity-50"
															/>
														)}
													</Show>
													<span class="relative px-2 text-sm font-semibold text-white capitalize [text-shadow:0_1px_3px_rgb(0_0_0/0.6)]">
														{category.name}
													</span>
												</button>
											)}
										</For>
									</div>
								</Show>
							</Loadable>
						</Show>
					</Match>
				</Switch>
			</div>
			<Show when={attribution.has()}>
				<p class="shrink-0 text-right text-[10px] text-muted-foreground">
					{attribution()}
				</p>
			</Show>
		</div>
	);
};
