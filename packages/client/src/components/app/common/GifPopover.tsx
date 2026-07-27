import {
	type Accessor,
	type Component,
	createEffect,
	createSignal,
	For,
	Match,
	onCleanup,
	type ParentComponent,
	Show,
	Switch,
} from "solid-js";
import StarIcon from "~icons/ph/star";
import StarFillIcon from "~icons/ph/star-fill";
import type {
	GifCategory,
	GifItem,
} from "../../../atproto/xrpc/social/colibri/embed/gifTypes";
import { useGifFavorites } from "../../../contexts/GifFavorites";
import { useUserContext } from "../../../contexts/User";
import { useUserPreferences } from "../../../contexts/UserPreferences";
import { createScrollFade } from "../../../hooks/createScrollFade";
import { cx } from "../../../utils/cva";
import { useIsMobile } from "../../../utils/mobile-pane";
import { BottomSheet } from "../../ui/MenuDrawer";
import {
	Popover,
	PopoverContent,
	PopoverPortal,
	PopoverTrigger,
} from "../../ui/Popover";
import { TextField, TextFieldInput } from "../../ui/TextField";

type Placement =
	| "bottom"
	| "bottom-end"
	| "bottom-start"
	| "left"
	| "left-end"
	| "left-start"
	| "right"
	| "right-end"
	| "right-start"
	| "top"
	| "top-end"
	| "top-start";

type GifTab = "trending" | "favorites" | "categories";

/** Debounce window for the search box, in ms. */
const SEARCH_DEBOUNCE = 300;
/** Distance from the bottom (px) at which we prefetch the next page. */
const INFINITE_SCROLL_THRESHOLD = 250;

const TABS: Array<{ id: GifTab; label: string }> = [
	{ id: "trending", label: "Trending" },
	{ id: "favorites", label: "Favorites" },
	{ id: "categories", label: "Categories" },
];

/**
 * The actual picker UI, kept in a child component so it mounts (and starts
 * fetching) only when the popover opens, and tears down when it closes.
 */
export const GifPickerBody: Component<{
	onSelect: (gif: GifItem) => void;
	edgeFade?: boolean;
	heightClass?: string;
}> = (props) => {
	const user = useUserContext();
	const { preferences } = useUserPreferences();
	const { favorites, isFavorited, toggleFavorite } = useGifFavorites();
	const { ref: gridRef, canScrollDown } = createScrollFade();

	const [tab, setTab] = createSignal<GifTab>("trending");
	const [rawQuery, setRawQuery] = createSignal("");
	const [query, setQuery] = createSignal("");

	// Paginated grid state (trending + search).
	const [items, setItems] = createSignal<Array<GifItem>>([]);
	const [page, setPage] = createSignal(1);
	const [hasNext, setHasNext] = createSignal(false);
	const [loading, setLoading] = createSignal(false);
	const [errored, setErrored] = createSignal(false);

	const [categories, setCategories] = createSignal<Array<GifCategory>>([]);
	const [categoriesLoaded, setCategoriesLoaded] = createSignal(false);

	// Debounce the search box into `query`.
	createEffect(() => {
		const raw = rawQuery().trim();
		const handle = setTimeout(() => setQuery(raw), SEARCH_DEBOUNCE);
		onCleanup(() => clearTimeout(handle));
	});

	// A non-empty query always overrides the active tab with search results.
	const mode = (): "search" | GifTab => (query() ? "search" : tab());

	const fetchPage = (p: number) => {
		const q = query();
		return q
			? user.xrpc.social.colibri.embed.searchGifs(q, p)
			: user.xrpc.social.colibri.embed.trendingGifs(p);
	};

	const loadFirstPage = async () => {
		setLoading(true);
		setErrored(false);
		setItems([]);
		const res = await fetchPage(1);
		if (!res) {
			setErrored(true);
		} else {
			setItems(res.items);
			setPage(res.page);
			setHasNext(res.hasNext);
		}
		setLoading(false);
	};

	const loadMore = async () => {
		if (loading() || !hasNext()) return;
		setLoading(true);
		const res = await fetchPage(page() + 1);
		if (res) {
			setItems((prev) => [...prev, ...res.items]);
			setPage(res.page);
			setHasNext(res.hasNext);
		}
		setLoading(false);
	};

	const loadCategories = async () => {
		const cats = await user.xrpc.social.colibri.embed.gifCategories();
		if (cats) setCategories(cats);
		// Mark loaded regardless of result so an empty list doesn't re-fetch
		// every time the effect re-runs.
		setCategoriesLoaded(true);
	};

	// (Re)load the grid whenever the effective mode or query changes.
	createEffect(() => {
		const m = mode();
		query(); // track so a new search term re-runs
		if (m === "search" || m === "trending") {
			void loadFirstPage();
		} else if (m === "categories" && !categoriesLoaded()) {
			void loadCategories();
		}
	});

	const selectTab = (next: GifTab) => {
		setRawQuery("");
		setQuery("");
		setTab(next);
	};

	const runSearch = (term: string) => {
		setRawQuery(term);
		setQuery(term);
	};

	const onScroll = (e: Event) => {
		const el = e.currentTarget as HTMLDivElement;
		if (
			el.scrollTop + el.clientHeight >=
			el.scrollHeight - INFINITE_SCROLL_THRESHOLD
		) {
			void loadMore();
		}
	};

	const GifTile: Component<{ gif: GifItem }> = (tile) => (
		<div class="group/tile relative mb-2 break-inside-avoid">
			<button
				type="button"
				class="block w-full rounded-md overflow-hidden bg-muted cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring border-none p-0"
				onClick={() => props.onSelect(tile.gif)}
			>
				<img
					src={tile.gif.previewUrl}
					alt=""
					loading="lazy"
					class="w-full h-auto block"
				/>
			</button>
			<button
				type="button"
				title={isFavorited(tile.gif) ? "Remove favorite" : "Add favorite"}
				class="absolute top-1 right-1 w-7 h-7 flex items-center justify-center rounded-full bg-black/50 text-white border-none cursor-pointer opacity-0 group-hover/tile:opacity-100 focus-visible:opacity-100 hover:bg-black/70 transition-opacity"
				classList={{ "opacity-100": isFavorited(tile.gif) }}
				onClick={(e) => {
					e.stopPropagation();
					void toggleFavorite(tile.gif);
				}}
			>
				<Show
					when={isFavorited(tile.gif)}
					fallback={<StarIcon class="w-4 h-4" />}
				>
					<StarFillIcon class="w-4 h-4 text-yellow-400" />
				</Show>
			</button>
		</div>
	);

	const Grid: Component<{ gifs: Array<GifItem>; empty: string }> = (g) => (
		<Show
			when={g.gifs.length > 0}
			fallback={
				<Show when={!loading()}>
					<p class="text-sm text-muted-foreground text-center py-8">
						{g.empty}
					</p>
				</Show>
			}
		>
			<div class="columns-2 gap-2">
				<For each={g.gifs}>{(gif) => <GifTile gif={gif} />}</For>
			</div>
		</Show>
	);

	const recents = () => preferences().recentGifs;

	return (
		<div class="flex min-h-0 flex-col">
			<TextField
				class="mb-2 shrink-0"
				value={rawQuery()}
				onChange={setRawQuery}
			>
				<TextFieldInput type="text" placeholder="Search KLIPY" class="h-9" />
			</TextField>

			<div class="flex flex-row gap-1 mb-2 shrink-0">
				<For each={TABS}>
					{(t) => (
						<button
							type="button"
							class="flex-1 h-8 text-sm rounded-md border-none cursor-pointer transition-colors"
							classList={{
								"bg-muted text-foreground": tab() === t.id && !query(),
								"bg-transparent text-muted-foreground hover:bg-muted/50":
									tab() !== t.id || !!query(),
							}}
							onClick={() => selectTab(t.id)}
						>
							{t.label}
						</button>
					)}
				</For>
			</div>

			<div class={cx("relative", props.heightClass ?? "h-72")}>
				<div ref={gridRef} class="h-full overflow-y-auto" onScroll={onScroll}>
					<Switch>
						{/* Searching overrides the tab. */}
						<Match when={mode() === "search"}>
							<Show
								when={!errored()}
								fallback={
									<p class="text-sm text-muted-foreground text-center py-8">
										Couldn't load GIFs. Try again.
									</p>
								}
							>
								<Grid gifs={items()} empty="No GIFs found." />
							</Show>
						</Match>

						<Match when={mode() === "trending"}>
							<Show
								when={!errored()}
								fallback={
									<p class="text-sm text-muted-foreground text-center py-8">
										Couldn't load GIFs. Try again.
									</p>
								}
							>
								<Show when={recents().length > 0}>
									<p class="text-xs font-semibold text-muted-foreground mb-1 mt-0">
										Recent
									</p>
									<div class="columns-2 gap-2 mb-3">
										<For each={recents()}>{(gif) => <GifTile gif={gif} />}</For>
									</div>
									<p class="text-xs font-semibold text-muted-foreground my-1">
										Trending
									</p>
								</Show>
								<Grid gifs={items()} empty="Nothing trending right now." />
							</Show>
						</Match>

						<Match when={mode() === "favorites"}>
							<Grid
								gifs={favorites()}
								empty="No favorites yet. Tap the star on a GIF to save it."
							/>
						</Match>

						<Match when={mode() === "categories"}>
							<Show
								when={categories().length > 0}
								fallback={
									<p class="text-sm text-muted-foreground text-center py-8">
										{categoriesLoaded()
											? "No categories available."
											: "Loading categories..."}
									</p>
								}
							>
								<div class="grid grid-cols-2 gap-2">
									<For each={categories()}>
										{(cat) => (
											<button
												type="button"
												class="relative h-20 rounded-md overflow-hidden bg-muted cursor-pointer border-none p-0 outline-none focus-visible:ring-2 focus-visible:ring-ring"
												onClick={() => runSearch(cat.query ?? cat.name)}
											>
												<Show when={cat.previewUrl}>
													<img
														src={cat.previewUrl}
														alt=""
														loading="lazy"
														class="absolute inset-0 w-full h-full object-cover opacity-60"
													/>
												</Show>
												<span class="absolute inset-0 flex items-center justify-center font-semibold text-white drop-shadow">
													{cat.name}
												</span>
											</button>
										)}
									</For>
								</div>
							</Show>
						</Match>
					</Switch>

					<Show when={loading()}>
						<p class="text-sm text-muted-foreground text-center py-3">
							Loading...
						</p>
					</Show>
				</div>
				<Show when={props.edgeFade}>
					<div
						class="scroll-edge-fade pointer-events-none absolute inset-x-0 bottom-0 h-4 transition-opacity duration-150"
						classList={{ "opacity-0": !canScrollDown() }}
						aria-hidden="true"
					/>
				</Show>
			</div>

			<p class="text-[10px] text-muted-foreground text-right mt-2 mb-0 shrink-0">
				Powered by KLIPY
			</p>
		</div>
	);
};

/**
 * GIF picker for the chat bar. Mirrors {@link EmojiPopover}: a Kobalte popover
 * on desktop, a bottom sheet on mobile. The trigger is passed as children.
 */
export const GifPopover: ParentComponent<{
	open: Accessor<boolean>;
	setOpen: (state: boolean) => void;
	onGifSelect: (gif: GifItem) => void;
	placement?: Placement;
}> = (props) => {
	const isMobile = useIsMobile();

	const handleSelect = (gif: GifItem) => {
		props.setOpen(false);
		props.onGifSelect(gif);
	};

	return (
		<Show
			when={isMobile()}
			fallback={
				<Popover
					open={props.open()}
					onOpenChange={props.setOpen}
					placement={props.placement || "left-start"}
				>
					<PopoverTrigger as="div">{props.children}</PopoverTrigger>
					<PopoverPortal>
						<PopoverContent class="w-80 p-3 shadow-xl border bg-popover rounded-xl">
							<Show when={props.open()}>
								<GifPickerBody onSelect={handleSelect} />
							</Show>
						</PopoverContent>
					</PopoverPortal>
				</Popover>
			}
		>
			<Show when={props.children}>
				<div
					style={{ display: "contents" }}
					onClick={() => props.setOpen(true)}
				>
					{props.children}
				</div>
			</Show>
			<BottomSheet open={props.open()} onOpenChange={props.setOpen}>
				<div class="flex min-h-0 flex-col px-3 pb-[calc(0.75rem+var(--safe-area-bottom))] pt-2">
					<Show when={props.open()}>
						<GifPickerBody
							onSelect={handleSelect}
							edgeFade
							heightClass="h-[70dvh] min-h-0 shrink"
						/>
					</Show>
				</div>
			</BottomSheet>
		</Show>
	);
};
