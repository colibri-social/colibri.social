import { ScreenShareIcon } from "@solar-icons/solid/bold/screen-share";
import {
	createMemo,
	createSignal,
	For,
	type JSX,
	onCleanup,
	onMount,
	Show,
} from "solid-js";
import { cx } from "../../utils/cx";
import type { AvatarSize } from "../Avatar/Avatar";
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

export type VoiceTileProps = {
	tile: VoiceTileData;
	compact?: boolean;
	focused?: boolean;
	onSelect?: () => void;
	class?: string;
	style?: JSX.CSSProperties;
};

const MAX_TILE_AVATAR = 88;
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
): VoiceTileLayout => {
	const padding = compact ? 8 : 12;
	const labelSmall = compact || height < LABEL_SMALL_BELOW;
	const labelBottom = labelSmall ? 6 : 12;
	const labelHeight = labelSmall ? 20 : 28;
	const areaBottom = labelBottom + labelHeight + 4;
	const fit = Math.min(
		MAX_TILE_AVATAR,
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

export const VoiceTile = (props: VoiceTileProps) => {
	const [box, setBox] = createSignal({ w: 0, h: 0 });
	let observer: ResizeObserver | undefined;
	onCleanup(() => observer?.disconnect());
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
			? voiceTileLayout(box().w, box().h, props.compact)
			: undefined,
	);
	const labelSmall = () => layout()?.labelSmall ?? !!props.compact;
	const fill = createTileFill(() => ({
		color: props.tile.color,
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
			"relative flex items-center justify-center overflow-hidden rounded-surface border border-border bg-secondary",
			speakingRingClass,
			speaking()
				? "border-primary shadow-[0_0_0_2px_var(--primary)]"
				: "shadow-[0_0_0_2px_transparent]",
			props.focused && "outline-2 outline-offset-2 outline-primary/40",
			props.class,
		);

	const shellStyle = (): JSX.CSSProperties => ({
		...(hasVideo() ? {} : fill() ? { background: fill() } : {}),
		...(props.style ?? {}),
	});

	return (
		<Show
			when={props.onSelect}
			fallback={
				<figure
					ref={observe}
					data-voice-tile=""
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
				ref={observe}
				type="button"
				data-voice-tile=""
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

export const voiceGridColumns = (count: number) =>
	count <= 1 ? 1 : count <= 6 ? 2 : 3;

export type VoiceGridProps = {
	tiles: VoiceTileData[];
	gap?: number;
	focusedKey?: string | null;
	onFocusChange?: (key: string | null) => void;
	class?: string;
};

const STRIP_HEIGHT = 88;

export const VoiceGrid = (props: VoiceGridProps) => {
	const gap = () => props.gap ?? 12;
	const [size, setSize] = createSignal({ w: 0, h: 0 });
	let area: HTMLDivElement | undefined;

	onMount(() => {
		if (!area) return;
		const observer = new ResizeObserver((entries) => {
			const rect = entries[0]?.contentRect;
			if (rect) setSize({ w: rect.width, h: rect.height });
		});
		observer.observe(area);
		onCleanup(() => observer.disconnect());
	});

	const focused = createMemo(() => {
		const key = props.focusedKey;
		if (!key) return undefined;
		return props.tiles.find((tile) => voiceTileKey(tile) === key);
	});

	const others = createMemo(() => {
		const key = focused() ? voiceTileKey(focused() as VoiceTileData) : null;
		return props.tiles.filter((tile) => voiceTileKey(tile) !== key);
	});

	const columns = () => voiceGridColumns(props.tiles.length);

	const rows = createMemo(() => {
		const cols = columns();
		const list: VoiceTileData[][] = [];
		for (let index = 0; index < props.tiles.length; index += cols) {
			list.push(props.tiles.slice(index, index + cols));
		}
		return list;
	});

	const tileSize = createMemo(() => {
		const { w, h } = size();
		const cols = columns();
		const count = rows().length;
		if (!w || !h || !cols || !count) return null;
		const availableW = w - gap() * (cols - 1);
		const availableH = h - gap() * (count - 1);
		const width = Math.min(availableW / cols, (availableH / count) * (16 / 9));
		return { w: width, h: width * (9 / 16) };
	});

	const focusedSize = createMemo(() => {
		const { w, h } = size();
		if (!w || !h) return null;
		const reserved = others().length ? STRIP_HEIGHT + gap() : 0;
		const width = Math.min(w, ((h - reserved) * 16) / 9);
		return { w: width, h: (width * 9) / 16 };
	});

	const toggle = (tile: VoiceTileData) => {
		if (!props.onFocusChange) return undefined;
		return () => {
			const key = voiceTileKey(tile);
			props.onFocusChange?.(props.focusedKey === key ? null : key);
		};
	};

	const px = (value: number | undefined) =>
		value === undefined ? undefined : `${Math.floor(value)}px`;

	return (
		<div
			ref={area}
			data-voice-grid=""
			data-columns={focused() ? undefined : columns()}
			data-focused={focused() ? "" : undefined}
			class={cx(
				"relative flex size-full min-h-0 flex-col items-center justify-center p-(--focus-ring-reach)",
				props.class,
			)}
			style={{ gap: `${gap()}px` }}
		>
			<Show
				when={focused()}
				fallback={
					<For each={rows()}>
						{(row) => (
							<div
								data-voice-row=""
								class="flex w-full justify-center"
								style={{ gap: `${gap()}px` }}
							>
								<For each={row}>
									{(tile) => (
										<VoiceTile
											tile={tile}
											onSelect={toggle(tile)}
											style={{
												width: px(tileSize()?.w),
												height: px(tileSize()?.h),
											}}
										/>
									)}
								</For>
							</div>
						)}
					</For>
				}
			>
				{(tile) => (
					<>
						<VoiceTile
							tile={tile()}
							focused
							onSelect={toggle(tile())}
							style={{
								width: px(focusedSize()?.w),
								height: px(focusedSize()?.h),
							}}
						/>
						<Show when={others().length}>
							<div
								data-voice-strip=""
								class="ring-room flex w-full shrink-0 justify-center-safe overflow-x-auto overscroll-x-contain"
								style={{
									gap: `${gap()}px`,
									height: `calc(${STRIP_HEIGHT}px + var(--focus-ring-reach) * 2)`,
								}}
							>
								<For each={others()}>
									{(other) => (
										<VoiceTile
											tile={other}
											compact
											onSelect={toggle(other)}
											class="shrink-0"
											style={{
												height: `${STRIP_HEIGHT}px`,
												width: `${Math.round((STRIP_HEIGHT * 16) / 9)}px`,
											}}
										/>
									)}
								</For>
							</div>
						</Show>
					</>
				)}
			</Show>
		</div>
	);
};
