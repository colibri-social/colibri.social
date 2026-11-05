import { AltArrowDownIcon } from "@solar-icons/solid/bold/alt-arrow-down";
import { AltArrowUpIcon } from "@solar-icons/solid/bold/alt-arrow-up";
import { ScreenShareIcon } from "@solar-icons/solid/bold/screen-share";
import {
	createEffect,
	createMemo,
	createSignal,
	type JSX,
	mergeProps,
	onCleanup,
	onMount,
	Show,
	untrack,
} from "solid-js";
import { cx } from "../../utils/cx";
import { createMenuTrigger } from "../../utils/gestures";
import { KeyedFor } from "../../utils/keyed";
import type { AvatarSize } from "../Avatar/Avatar";
import { IconButton } from "../IconButton/IconButton";
import { clampPaneWidth, PaneResizer } from "../Shell/PaneResizer";
import {
	createTileFill,
	hasVoiceStateIcons,
	SpeakingAvatar,
	speakingRingClass,
	VideoSurface,
	type VoiceParticipant,
	VoiceStateIcons,
} from "./shared";

export type VoiceTileData = VoiceParticipant & {
	key?: string;
	kind?: "participant" | "screen";
	stream?: MediaStream;
	video?: JSX.Element;
	mirror?: boolean;
};

export const voiceTileKey = (tile: VoiceTileData) =>
	tile.key ?? `${tile.kind === "screen" ? "s" : "p"}:${tile.id}`;

export type VoiceTileSlot = "grid" | "focused" | "strip";

export type VoiceTileProps = {
	tile: VoiceTileData;
	compact?: boolean;
	portrait?: boolean;
	focused?: boolean;
	slot?: VoiceTileSlot;
	ref?: (element: HTMLElement) => void;
	onSelect?: () => void;
	onMenu?: () => void;
	class?: string;
	style?: JSX.CSSProperties;
};

const MAX_TILE_AVATAR = 88;
const MAX_PORTRAIT_AVATAR = 92;
const PORTRAIT_FILL =
	"linear-gradient(to bottom, var(--primary-highlight), var(--primary))";
const MIN_TILE_AVATAR = 12;
const LABEL_SMALL_BELOW = 140;

export type VoiceTileLayout = {
	padding: number;
	labelSmall: boolean;
	labelBottom: number;
	labelHeight: number;
	avatar: number;
	areaBottom: number;
};

export const voiceTileLayout = (
	width: number,
	height: number,
	compact = false,
	maxAvatar = MAX_TILE_AVATAR,
): VoiceTileLayout => {
	const padding = compact ? 8 : 12;
	const labelSmall = compact || height < LABEL_SMALL_BELOW;
	const labelBottom = labelSmall ? 6 : 12;
	const labelHeight = labelSmall ? 20 : 28;
	const areaBottom = labelBottom + labelHeight + 4;
	const fit = Math.min(
		maxAvatar,
		height * 0.45,
		width * 0.35,
		height - padding - areaBottom,
		width - padding * 2,
	);
	const avatar = Math.floor(
		Math.max(
			MIN_TILE_AVATAR,
			Math.min(fit, height - padding * 2, width - padding * 2),
		),
	);
	return { padding, labelSmall, labelBottom, labelHeight, avatar, areaBottom };
};

const avatarSizeFor = (pixels: number): AvatarSize =>
	pixels <= 20
		? "xs"
		: pixels <= 24
			? "sm"
			: pixels <= 32
				? "base"
				: pixels <= 40
					? "md"
					: pixels <= 56
						? "lg"
						: "xl";

const MENU_FOCUS_FRAMES = 30;

const focusMenuSlider = (frames = MENU_FOCUS_FRAMES) => {
	const menu = document.activeElement?.closest<HTMLElement>('[role="menu"]');
	const slider = menu?.querySelector<HTMLElement>(
		'[data-menu-slider] [role="slider"]',
	);
	if (slider) {
		slider.focus();
		return;
	}
	if (!menu && frames > 0)
		requestAnimationFrame(() => focusMenuSlider(frames - 1));
};

const focusSliderOnPointerMenu = (element: HTMLElement) => {
	let pointer = false;
	element.addEventListener("pointerdown", (event) => {
		pointer = event.pointerType === "mouse";
	});
	element.addEventListener("keydown", () => {
		pointer = false;
	});
	element.addEventListener("contextmenu", (event) => {
		const fromPointer = pointer || event.button === 2;
		pointer = false;
		if (fromPointer) requestAnimationFrame(() => focusMenuSlider());
	});
};

export const VoiceTile = (props: VoiceTileProps) => {
	const [box, setBox] = createSignal({ w: 0, h: 0 });
	let observer: ResizeObserver | undefined;
	onCleanup(() => observer?.disconnect());
	const bind = (element: HTMLElement) => {
		props.ref?.(element);
		observe(element);
		focusSliderOnPointerMenu(element);
		createMenuTrigger(element, {
			enabled: () => !!props.onMenu,
			onMenu: () => props.onMenu?.(),
		});
	};
	const observe = (element: HTMLElement) => {
		observer?.disconnect();
		const read = () =>
			setBox({ w: element.clientWidth, h: element.clientHeight });
		observer = new ResizeObserver(read);
		observer.observe(element);
		queueMicrotask(read);
	};
	const layout = createMemo(() =>
		box().w && box().h
			? voiceTileLayout(
					box().w,
					box().h,
					props.compact,
					props.portrait ? MAX_PORTRAIT_AVATAR : MAX_TILE_AVATAR,
				)
			: undefined,
	);
	const labelSmall = () => layout()?.labelSmall ?? !!props.compact;
	const fill = createTileFill(() => ({
		color: props.tile.bannerFill ?? props.tile.color,
		tintFrom: props.tile.avatarSrc,
	}));
	const hasVideo = () => !!(props.tile.stream || props.tile.video);
	const isScreen = () => props.tile.kind === "screen";
	const speaking = () => !!props.tile.speaking && !isScreen();
	const label = () =>
		isScreen() ? `${props.tile.name}'s screen` : props.tile.name;
	const accessibleLabel = () => (speaking() ? `${label()}, speaking` : label());

	const content = () => (
		<>
			<Show
				when={hasVideo()}
				fallback={
					<span
						data-tile-avatar-area=""
						class="absolute flex items-center justify-center"
						style={{
							top: `${layout()?.padding ?? 12}px`,
							left: `${layout()?.padding ?? 12}px`,
							right: `${layout()?.padding ?? 12}px`,
							bottom: `${layout()?.areaBottom ?? 44}px`,
						}}
					>
						<SpeakingAvatar
							name={props.tile.name}
							seed={props.tile.id}
							src={props.tile.avatarSrc}
							size={avatarSizeFor(layout()?.avatar ?? 40)}
							pixels={layout()?.avatar ?? (props.compact ? 40 : 88)}
						/>
					</span>
				}
			>
				<Show
					when={props.tile.video}
					fallback={
						<VideoSurface
							stream={props.tile.stream}
							mirror={props.tile.mirror}
							fit={isScreen() ? "contain" : "cover"}
						/>
					}
				>
					{props.tile.video}
				</Show>
			</Show>
			<span
				data-tile-label=""
				class={cx(
					"absolute left-1/2 z-10 flex max-w-[calc(100%-16px)] -translate-x-1/2 items-center gap-1.5 bg-black/75 font-semibold text-white",
					labelSmall()
						? "bottom-1.5 h-5 rounded-control-xs px-1.5 text-xs"
						: "bottom-3 h-7 rounded-control-sm px-2 text-base",
				)}
			>
				<Show when={isScreen()}>
					<ScreenShareIcon
						aria-hidden="true"
						class={cx("shrink-0", labelSmall() ? "size-3" : "size-4")}
					/>
				</Show>
				<span class="truncate">{label()}</span>
				<Show when={speaking()}>
					<span class="sr-only">, speaking</span>
				</Show>
				<Show when={props.focused}>
					<span class="sr-only">, focused</span>
				</Show>
				<Show when={!isScreen() && hasVoiceStateIcons(props.tile)}>
					<VoiceStateIcons
						muted={props.tile.muted}
						deafened={props.tile.deafened}
						serverMuted={props.tile.serverMuted}
						serverDeafened={props.tile.serverDeafened}
						size={labelSmall() ? 12 : 16}
					/>
				</Show>
			</span>
		</>
	);

	const shellClass = () =>
		cx(
			"relative flex items-center justify-center overflow-hidden rounded-surface border bg-secondary",
			props.portrait ? "border-transparent" : "border-border",
			speakingRingClass,
			speaking()
				? "border-primary shadow-[0_0_0_2px_var(--primary)]"
				: "shadow-[0_0_0_2px_transparent]",
			props.focused && "outline-2 outline-offset-2 outline-primary/40",
			props.class,
		);

	const shellStyle = (): JSX.CSSProperties => ({
		...(hasVideo()
			? {}
			: fill()
				? { background: fill() }
				: props.portrait
					? { background: PORTRAIT_FILL }
					: {}),
		...(props.style ?? {}),
	});

	return (
		<Show
			when={props.onSelect}
			fallback={
				<figure
					ref={bind}
					data-voice-tile=""
					data-voice-slot={props.slot}
					data-speaking={speaking() ? "" : undefined}
					data-kind={props.tile.kind ?? "participant"}
					aria-label={accessibleLabel()}
					class={cx(shellClass(), "m-0")}
					style={shellStyle()}
				>
					{content()}
				</figure>
			}
		>
			<button
				ref={bind}
				type="button"
				data-voice-tile=""
				data-voice-slot={props.slot}
				data-speaking={speaking() ? "" : undefined}
				data-kind={props.tile.kind ?? "participant"}
				aria-pressed={!!props.focused}
				onClick={() => props.onSelect?.()}
				class={cx(shellClass(), "cursor-pointer p-0 outline-none focus-ring")}
				style={shellStyle()}
			>
				{content()}
			</button>
		</Show>
	);
};

export const voiceGridColumns = (count: number, portrait = false) =>
	portrait
		? count <= 2
			? 1
			: count <= 8
				? 2
				: 3
		: count <= 1
			? 1
			: count <= 6
				? 2
				: 3;

export const MIN_VOICE_STRIP_HEIGHT = 64;
export const MAX_VOICE_STRIP_HEIGHT = 240;
export const DEFAULT_VOICE_STRIP_HEIGHT = 88;

export const clampStripHeight = (value: number) => {
	return clampPaneWidth(value, MIN_VOICE_STRIP_HEIGHT, MAX_VOICE_STRIP_HEIGHT);
};

export type VoiceTileView = { height: number; visible: boolean };

export type VoiceGridProps = {
	tiles: VoiceTileData[];
	gap?: number;
	focusedKey?: string | null;
	onFocusChange?: (key: string | null) => void;
	portrait?: boolean;
	tileMenu?: (tile: VoiceTileData, element: JSX.Element) => JSX.Element;
	onTileMenu?: (tile: VoiceTileData) => void;
	stripHeight?: number;
	onStripHeightChange?: (height: number) => void;
	onStripHeightCommit?: (height: number) => void;
	stripHidden?: boolean;
	onStripHiddenChange?: (hidden: boolean) => void;
	onVideoSize?: (key: string, view: VoiceTileView) => void;
	class?: string;
};

export const VOICE_STRIP_COPY = {
	resize: "Resize the row of people",
	hide: "Hide the row of people",
	show: "Show the row of people",
} as const;

const STRIP_RATIO = 16 / 9;

type FocusLayout = {
	left: number;
	top: number;
	width: number;
	height: number;
	stripLeft: number;
	column: number;
};

export const VoiceGrid = (props: VoiceGridProps) => {
	const gap = () => props.gap ?? 12;
	const [size, setSize] = createSignal({ w: 0, h: 0 });
	const [ownStripHeight, setOwnStripHeight] = createSignal(
		DEFAULT_VOICE_STRIP_HEIGHT,
	);
	const [ownStripHidden, setOwnStripHidden] = createSignal(false);
	let tilesArea: HTMLDivElement | undefined;

	onMount(() => {
		if (!tilesArea) return;
		const observer = new ResizeObserver((entries) => {
			const rect = entries[0]?.contentRect;
			if (rect) setSize({ w: rect.width, h: rect.height });
		});
		observer.observe(tilesArea);
		onCleanup(() => observer.disconnect());
	});

	const focused = createMemo(() => {
		const key = props.focusedKey;
		if (!key) return undefined;
		return props.tiles.find((tile) => voiceTileKey(tile) === key);
	});

	const focusedTileKey = createMemo(() => {
		const tile = focused();
		return tile ? voiceTileKey(tile) : undefined;
	});

	const stripOrder = createMemo(() => {
		const key = focusedTileKey();
		const order = new Map<string, number>();
		if (!key) return order;
		for (const tile of props.tiles) {
			const tileKey = voiceTileKey(tile);
			if (tileKey !== key) order.set(tileKey, order.size);
		}
		return order;
	});

	const stripCount = () => stripOrder().size;
	const stripHidden = () => props.stripHidden ?? ownStripHidden();
	const stripShown = () => stripCount() > 0 && !stripHidden();

	const stripLimit = () => {
		return Math.max(MIN_VOICE_STRIP_HEIGHT, Math.floor((size().h - gap()) / 2));
	};

	const stripHeight = () => {
		return clampPaneWidth(
			props.stripHeight ?? ownStripHeight(),
			MIN_VOICE_STRIP_HEIGHT,
			Math.min(MAX_VOICE_STRIP_HEIGHT, stripLimit()),
		);
	};

	const stripWidth = () => Math.round(stripHeight() * STRIP_RATIO);

	const changeStripHeight = (height: number) => {
		setOwnStripHeight(height);
		props.onStripHeightChange?.(height);
	};

	const toggleStrip = () => {
		const next = !stripHidden();
		setOwnStripHidden(next);
		props.onStripHiddenChange?.(next);
	};

	const columns = () => voiceGridColumns(props.tiles.length, props.portrait);
	const ratio = () => (props.portrait ? 1 : 16 / 9);

	const rowCount = () => Math.ceil(props.tiles.length / (columns() || 1));

	const tileSize = createMemo(() => {
		const { w, h } = size();
		const cols = columns();
		const count = rowCount();
		if (!w || !h || !cols || !count) return null;
		const availableW = w - gap() * (cols - 1);
		const availableH = h - gap() * (count - 1);
		const width = Math.min(availableW / cols, (availableH / count) * ratio());
		return { w: width, h: width / ratio() };
	});

	const focusLayout = createMemo<FocusLayout | null>(() => {
		const { w, h } = size();
		if (!focusedTileKey() || !w || !h) return null;
		const reserved = stripShown() ? stripHeight() + gap() : 0;
		const width = Math.floor(Math.min(w, (h - reserved) * ratio()));
		const height = Math.floor(width / ratio());
		const count = stripShown() ? stripCount() : 0;
		const stripContent = count * stripWidth() + Math.max(0, count - 1) * gap();
		return {
			left: Math.floor((w - width) / 2),
			top: Math.max(0, Math.floor((h - height - reserved) / 2)),
			width,
			height,
			stripLeft: Math.max(0, Math.floor((w - stripContent) / 2)),
			column: Math.max(Math.floor(w), stripContent),
		};
	});

	const toggle = (tile: () => VoiceTileData | undefined) => {
		if (!props.onFocusChange) return undefined;
		return () => {
			const current = tile();
			if (!current) return;
			const key = voiceTileKey(current);
			props.onFocusChange?.(props.focusedKey === key ? null : key);
		};
	};

	const menuFor = (tile: () => VoiceTileData | undefined) => {
		if (!props.onTileMenu) return undefined;
		return () => {
			const current = tile();
			if (current) props.onTileMenu?.(current);
		};
	};

	const wrap = (tile: () => VoiceTileData, element: JSX.Element) => {
		return untrack(() =>
			props.tileMenu
				? props.tileMenu(mergeProps(tile) as VoiceTileData, element)
				: element,
		);
	};

	const trackWidth = () => {
		const tile = tileSize();
		return tile ? `${(Math.floor(tile.w) - gap()) / 2}px` : "auto";
	};

	const gridColumn = (index: number) => {
		const cols = columns();
		const rowStart = index - (index % cols);
		const inRow = Math.min(cols, props.tiles.length - rowStart);
		const start = cols - inRow + 2 * (index - rowStart) + 1;
		return `${start} / span 2`;
	};

	const px = (value: number | undefined) =>
		value === undefined ? undefined : `${Math.floor(value)}px`;

	const slotOf = (key: string): VoiceTileSlot => {
		const focusKey = focusedTileKey();
		if (!focusKey) return "grid";
		return key === focusKey ? "focused" : "strip";
	};

	const tileStyle = (
		slot: VoiceTileSlot,
		key: string,
		index: number,
	): JSX.CSSProperties => {
		const layout = focusLayout();
		if (slot === "grid") {
			return {
				width: px(tileSize()?.w),
				height: px(tileSize()?.h),
				"grid-column": gridColumn(index),
			};
		}
		if (slot === "focused") {
			return {
				width: px(layout?.width),
				height: px(layout?.height),
				"grid-row": "1",
				"grid-column": "1",
				"justify-self": "start",
				position: "sticky",
				left: px(layout?.left),
				"margin-left": px(layout?.left),
				"margin-top": px(layout?.top),
				"z-index": "1",
			};
		}
		const order = stripOrder().get(key) ?? 0;
		return {
			display: stripHidden() ? "none" : undefined,
			width: `${stripWidth()}px`,
			height: `${stripHeight()}px`,
			"grid-row": "2",
			"grid-column": "1",
			"justify-self": "start",
			"margin-left": `${(layout?.stripLeft ?? 0) + order * (stripWidth() + gap())}px`,
		};
	};

	const areaStyle = (): JSX.CSSProperties => {
		const layout = focusLayout();
		if (!layout) {
			return {
				gap: `${gap()}px`,
				"grid-template-columns": `repeat(${columns() * 2}, ${trackWidth()})`,
			};
		}
		return {
			"row-gap": `${gap()}px`,
			"grid-template-columns": `${layout.column}px`,
			"grid-template-rows": stripShown() ? `auto ${stripHeight()}px` : "auto",
		};
	};

	const renderTile = (tile: () => VoiceTileData, index: () => number) => {
		const key = () => voiceTileKey(tile());
		const slot = () => slotOf(key());
		const [element, setElement] = createSignal<HTMLElement>();
		const [height, setHeight] = createSignal(0);
		const [intersecting, setIntersecting] = createSignal(false);
		const hasVideo = () => !!(tile().stream || tile().video);
		let reported: string | undefined;

		createEffect(() => {
			const target = element();
			if (!target || !props.onVideoSize) return;
			const resize = new ResizeObserver(() =>
				setHeight(Math.round(target.clientHeight)),
			);
			const intersection = new IntersectionObserver((entries) => {
				const entry = entries[entries.length - 1];
				if (entry) setIntersecting(entry.isIntersecting);
			});
			resize.observe(target);
			intersection.observe(target);
			onCleanup(() => {
				resize.disconnect();
				intersection.disconnect();
			});
		});

		createEffect(() => {
			const report = props.onVideoSize;
			if (!report || !hasVideo()) {
				reported = undefined;
				return;
			}
			const view = {
				height: height(),
				visible: intersecting() && height() > 0,
			};
			const signature = `${view.height}:${view.visible}`;
			if (signature === reported) return;
			reported = signature;
			untrack(() => report(key(), view));
		});

		onCleanup(() => {
			if (reported === undefined) return;
			props.onVideoSize?.(untrack(key), { height: 0, visible: false });
		});

		return wrap(
			tile,
			<VoiceTile
				ref={setElement}
				tile={tile()}
				portrait={props.portrait}
				slot={slot()}
				focused={slot() === "focused"}
				compact={slot() === "strip"}
				onSelect={toggle(tile)}
				onMenu={menuFor(tile)}
				class={slot() === "strip" ? "shrink-0" : undefined}
				style={tileStyle(slot(), key(), index())}
			/>,
		);
	};

	return (
		<div
			data-voice-grid=""
			data-columns={focused() ? undefined : columns()}
			data-focused={focused() ? "" : undefined}
			data-strip-hidden={focused() && stripHidden() ? "" : undefined}
			class={cx("relative size-full min-h-0", props.class)}
		>
			<div
				ref={tilesArea}
				data-voice-tiles=""
				data-layout={focusLayout() ? "focus" : "grid"}
				class={cx(
					"grid size-full p-(--focus-ring-reach)",
					focusLayout()
						? "content-start overflow-x-auto overflow-y-hidden overscroll-x-contain"
						: "content-center justify-center",
				)}
				style={areaStyle()}
			>
				<KeyedFor each={props.tiles} by={voiceTileKey}>
					{renderTile}
				</KeyedFor>
			</div>
			<Show when={stripCount() > 0 && focusLayout()}>
				{(layout) => (
					<>
						<Show when={stripShown()}>
							<div
								data-voice-strip-resizer=""
								class="absolute h-0"
								style={{
									left: `calc(var(--focus-ring-reach) + ${layout().left}px)`,
									top: `calc(var(--focus-ring-reach) + ${layout().top + layout().height}px)`,
									width: `${layout().width}px`,
								}}
							>
								<PaneResizer
									axis="y"
									edge="start"
									label={VOICE_STRIP_COPY.resize}
									width={stripHeight()}
									onWidthChange={changeStripHeight}
									onWidthCommit={(height) =>
										props.onStripHeightCommit?.(height)
									}
									min={MIN_VOICE_STRIP_HEIGHT}
									max={MAX_VOICE_STRIP_HEIGHT}
									defaultWidth={DEFAULT_VOICE_STRIP_HEIGHT}
									availableMax={() =>
										Math.min(MAX_VOICE_STRIP_HEIGHT, stripLimit())
									}
								/>
							</div>
						</Show>
						<IconButton
							data-voice-strip-toggle=""
							size="sm"
							variant="secondary"
							label={
								stripHidden() ? VOICE_STRIP_COPY.show : VOICE_STRIP_COPY.hide
							}
							icon={stripHidden() ? <AltArrowUpIcon /> : <AltArrowDownIcon />}
							onClick={toggleStrip}
							class="absolute z-10"
							style={{
								right: `calc(var(--focus-ring-reach) + ${size().w - layout().left - layout().width + 8}px)`,
								top: `calc(var(--focus-ring-reach) + ${layout().top + 8}px)`,
							}}
						/>
					</>
				)}
			</Show>
		</div>
	);
};
