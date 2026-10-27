import { CloseIcon } from "@solar-icons/solid/bold/close";
import { ArrowLeftIcon } from "@solar-icons/solid/linear/arrow-left";
import {
	createMemo,
	createSignal,
	type JSX,
	onCleanup,
	onMount,
	Show,
} from "solid-js";
import { Portal } from "solid-js/web";
import {
	AnimatedScreencastIcon,
	AnimatedVideocameraIcon,
} from "../../icons/animated/media";
import { cx } from "../../utils/cx";
import { keyboardFocusWithin } from "../../utils/keyboard-modality";
import { IconButton } from "../IconButton/IconButton";
import { CallControlButton, CallLeaveButton } from "./CallControls";
import { VoiceTile, type VoiceTileData } from "./VoiceGrid";

export type FloatingCorner = "tl" | "tr" | "bl" | "br";

export type FloatingInsets = {
	top?: number;
	right?: number;
	bottom?: number;
	left?: number;
};

export const FLOATING_MARGIN = 16;
export const FLOATING_MIN_WIDTH = 220;
export const FLOATING_MAX_WIDTH = 560;
export const FLOATING_DEFAULT_WIDTH = 320;
export const FLOATING_RESIZE_STEP = 16;
const DRAG_SLOP = 3;
const FLING_MS = 160;

export type VoiceFloatingWindowProps = {
	tile: VoiceTileData;
	channelName: string;
	corner?: FloatingCorner;
	defaultCorner?: FloatingCorner;
	onCornerChange?: (corner: FloatingCorner) => void;
	width?: number;
	defaultWidth?: number;
	onWidthChange?: (width: number) => void;
	insets?: FloatingInsets;
	cameraOn?: boolean;
	cameraPending?: boolean;
	onToggleCamera?: () => void;
	screenSharing?: boolean;
	onToggleScreenShare?: () => void;
	onReturn: () => void;
	onDismiss: () => void;
	onDisconnect: () => void;
	mount?: Node;
	class?: string;
};

const clamp = (value: number, min: number, max: number) =>
	Math.max(min, Math.min(max, value));

export const clampFloatingWidth = (width: number) =>
	clamp(width, FLOATING_MIN_WIDTH, FLOATING_MAX_WIDTH);

export const cornerFor = (
	centerX: number,
	centerY: number,
	viewport: { w: number; h: number },
): FloatingCorner =>
	`${centerY > viewport.h / 2 ? "b" : "t"}${centerX > viewport.w / 2 ? "r" : "l"}` as FloatingCorner;

const KEY_CORNERS: Record<string, (corner: FloatingCorner) => FloatingCorner> =
	{
		ArrowLeft: (corner) => `${corner[0]}l` as FloatingCorner,
		ArrowRight: (corner) => `${corner[0]}r` as FloatingCorner,
		ArrowUp: (corner) => `t${corner[1]}` as FloatingCorner,
		ArrowDown: (corner) => `b${corner[1]}` as FloatingCorner,
	};

const resizeHandleClass: Record<FloatingCorner, string> = {
	br: "top-0 left-0 cursor-nwse-resize",
	bl: "top-0 right-0 cursor-nesw-resize",
	tr: "bottom-0 left-0 cursor-nesw-resize",
	tl: "bottom-0 right-0 cursor-nwse-resize",
};

const stop = (event: Event) => event.stopPropagation();

const capture = (element: Element, pointerId: number) => {
	try {
		element.setPointerCapture(pointerId);
	} catch {}
};

export const VoiceFloatingWindow = (props: VoiceFloatingWindowProps) => {
	const [innerCorner, setInnerCorner] = createSignal<FloatingCorner>(
		props.defaultCorner ?? "br",
	);
	const [innerWidth, setInnerWidth] = createSignal(
		clampFloatingWidth(props.defaultWidth ?? FLOATING_DEFAULT_WIDTH),
	);
	const [viewport, setViewport] = createSignal({
		w: window.innerWidth,
		h: window.innerHeight,
	});
	const [drag, setDrag] = createSignal<{ x: number; y: number }>();
	const [resizing, setResizing] = createSignal(false);

	const corner = () => props.corner ?? innerCorner();
	const width = () => clampFloatingWidth(props.width ?? innerWidth());
	const height = () => Math.round((width() * 9) / 16);
	const setCorner = (next: FloatingCorner) => {
		setInnerCorner(next);
		props.onCornerChange?.(next);
	};
	const setWidth = (next: number) => {
		const value = clampFloatingWidth(next);
		setInnerWidth(value);
		props.onWidthChange?.(value);
	};

	const inset = (side: keyof FloatingInsets) =>
		FLOATING_MARGIN + (props.insets?.[side] ?? 0);

	const rest = createMemo(() => {
		const { w, h } = viewport();
		const current = corner();
		return {
			x: current[1] === "l" ? inset("left") : w - inset("right") - width(),
			y: current[0] === "t" ? inset("top") : h - inset("bottom") - height(),
		};
	});

	onMount(() => {
		const onResize = () =>
			setViewport({ w: window.innerWidth, h: window.innerHeight });
		window.addEventListener("resize", onResize);
		onCleanup(() => window.removeEventListener("resize", onResize));
	});

	let box: HTMLElement | undefined;
	let start: { px: number; py: number; x: number; y: number } | undefined;
	let moved = false;
	let velocity = { x: 0, y: 0 };
	let last = { x: 0, y: 0, t: 0 };

	const onPointerMove = (event: PointerEvent) => {
		if (!start) return;
		const dx = event.clientX - start.px;
		const dy = event.clientY - start.py;
		if (!moved && Math.hypot(dx, dy) <= DRAG_SLOP) return;
		moved = true;
		const now = event.timeStamp;
		const elapsed = Math.max(1, now - last.t);
		velocity = {
			x: (event.clientX - last.x) / elapsed,
			y: (event.clientY - last.y) / elapsed,
		};
		last = { x: event.clientX, y: event.clientY, t: now };
		const { w, h } = viewport();
		setDrag({
			x: clamp(start.x + dx, 0, w - width()),
			y: clamp(start.y + dy, 0, h - height()),
		});
	};

	const endDrag = () => {
		const position = drag();
		if (position && moved) {
			const centerX = position.x + width() / 2 + velocity.x * FLING_MS;
			const centerY = position.y + height() / 2 + velocity.y * FLING_MS;
			setCorner(cornerFor(centerX, centerY, viewport()));
		}
		start = undefined;
		setDrag(undefined);
	};

	const onPointerDown = (event: PointerEvent) => {
		if (event.button !== 0 || !box) return;
		if (
			(event.target as Element).closest("button:not([data-floating-surface])")
		)
			return;
		const rect = box.getBoundingClientRect();
		start = { px: event.clientX, py: event.clientY, x: rect.left, y: rect.top };
		moved = false;
		velocity = { x: 0, y: 0 };
		last = { x: event.clientX, y: event.clientY, t: event.timeStamp };
		capture(box, event.pointerId);
	};

	const onDoubleClick = (event: MouseEvent) => {
		if (moved) return;
		const target = event.target as Element;
		if (
			target.closest("button:not([data-floating-surface])") ||
			target.closest("[data-floating-resize]")
		)
			return;
		props.onReturn();
	};

	const onResizeDown = (event: PointerEvent) => {
		event.stopPropagation();
		if (event.button !== 0) return;
		capture(event.currentTarget as HTMLElement, event.pointerId);
		setResizing(true);
	};

	const onResizeMove = (event: PointerEvent) => {
		if (!resizing()) return;
		const { w } = viewport();
		const right = corner()[1] === "r";
		const raw = right
			? w - inset("right") - event.clientX
			: event.clientX - inset("left");
		setWidth(Math.min(raw, maxWidth()));
	};

	const maxWidth = () => {
		const { w, h } = viewport();
		return Math.min(
			w - inset("left") - inset("right"),
			((h - inset("top") - inset("bottom")) * 16) / 9,
		);
	};

	const onKeyDown = (event: KeyboardEvent) => {
		if (event.shiftKey && event.key in KEY_CORNERS) {
			event.preventDefault();
			const grow = event.key === "ArrowUp" || event.key === "ArrowRight";
			const next =
				width() + (grow ? FLOATING_RESIZE_STEP : -FLOATING_RESIZE_STEP);
			setWidth(Math.min(next, Math.max(FLOATING_MIN_WIDTH, maxWidth())));
			return;
		}
		const move = KEY_CORNERS[event.key];
		if (move) {
			event.preventDefault();
			setCorner(move(corner()));
			return;
		}
	};

	const position = () => drag() ?? rest();

	const style = (): JSX.CSSProperties => ({
		width: `${width()}px`,
		height: `${height()}px`,
		transform: `translate3d(${Math.round(position().x)}px, ${Math.round(position().y)}px, 0)`,
	});

	const keyboardFocus = keyboardFocusWithin();

	return (
		<Portal mount={props.mount}>
			<section
				ref={box}
				aria-label={`Floating call, ${props.channelName}`}
				data-voice-floating=""
				data-corner={corner()}
				data-dragging={drag() ? "" : undefined}
				onPointerDown={(event) => {
					keyboardFocus.onPointerDown(event);
					onPointerDown(event);
				}}
				onFocusIn={keyboardFocus.onFocusIn}
				onFocusOut={keyboardFocus.onFocusOut}
				onPointerMove={onPointerMove}
				onPointerUp={endDrag}
				onPointerCancel={endDrag}
				onLostPointerCapture={() => start && endDrag()}
				onDblClick={onDoubleClick}
				onDragStart={(event) => event.preventDefault()}
				class={cx(
					"group/floating fixed top-0 left-0 z-40 cursor-grab touch-none overflow-hidden rounded-surface border border-border bg-card shadow-overlay select-none data-dragging:cursor-grabbing",
					!drag() &&
						!resizing() &&
						"transition-transform duration-[calc(500ms*var(--motion-scale,1))] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
					props.class,
				)}
				style={style()}
			>
				<VoiceTile
					tile={props.tile}
					class="pointer-events-none absolute inset-0 size-full rounded-none border-0"
				/>
				<button
					type="button"
					data-floating-surface=""
					aria-label={`Move floating call, ${props.channelName}`}
					aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Shift+ArrowUp Shift+ArrowDown Shift+ArrowLeft Shift+ArrowRight Enter"
					aria-description="Arrow keys move it to another corner. Shift with Up or Right makes it larger, Shift with Down or Left makes it smaller. Enter or a double click returns to the call."
					onKeyDown={onKeyDown}
					onClick={(event) => {
						if (event.detail === 0) props.onReturn();
					}}
					class="absolute inset-0 z-10 cursor-[inherit] rounded-surface border-0 bg-transparent p-0 outline-none focus-ring-inset"
				/>
				<div
					data-floating-chrome=""
					class="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between opacity-0 transition-opacity duration-150 group-data-keyboard-focus/floating:opacity-100 group-hover/floating:opacity-100 motion-reduce:transition-none"
				>
					<div class="flex items-start justify-between gap-2 bg-linear-to-b from-black/70 to-transparent p-2 pb-6">
						<button
							type="button"
							data-floating-return=""
							onPointerDown={stop}
							onClick={() => props.onReturn()}
							class="pointer-events-auto flex min-w-0 cursor-pointer items-center gap-1.5 rounded-control-sm border-0 bg-transparent px-1 py-0.5 text-sm font-semibold text-white outline-none hover:underline focus-ring [&_svg]:size-4 [&_svg]:shrink-0"
						>
							<ArrowLeftIcon aria-hidden="true" />
							<span class="truncate">{props.channelName}</span>
							<span class="sr-only">, back to call</span>
						</button>
						<IconButton
							variant="ghost"
							size="sm"
							label="Hide floating window"
							icon={<CloseIcon />}
							onPointerDown={stop}
							onClick={() => props.onDismiss()}
							class="pointer-events-auto text-white hover:bg-white/15"
						/>
					</div>
					<div class="flex items-center justify-end gap-2 bg-linear-to-t from-black/70 to-transparent p-2 pt-6">
						<Show when={props.cameraOn && props.onToggleCamera}>
							<CallControlButton
								label="Turn off camera"
								pressed
								tone="active"
								size="md"
								loading={props.cameraPending}
								icon={<AnimatedVideocameraIcon off={false} />}
								onClick={props.onToggleCamera}
								class="pointer-events-auto"
							/>
						</Show>
						<Show when={props.screenSharing && props.onToggleScreenShare}>
							<CallControlButton
								label="Stop sharing"
								pressed
								tone="active"
								size="md"
								icon={<AnimatedScreencastIcon trigger="press" />}
								onClick={props.onToggleScreenShare}
								class="pointer-events-auto"
							/>
						</Show>
						<CallLeaveButton
							label="Disconnect"
							size="md"
							onClick={() => props.onDisconnect()}
							class="pointer-events-auto"
						/>
					</div>
				</div>
				<div
					aria-hidden="true"
					data-floating-resize=""
					onPointerDown={onResizeDown}
					onPointerMove={onResizeMove}
					onPointerUp={() => setResizing(false)}
					onPointerCancel={() => setResizing(false)}
					class={cx(
						"absolute z-30 size-4 opacity-0 transition-opacity group-hover/floating:opacity-100",
						resizeHandleClass[corner()],
					)}
				>
					<div class="m-1 size-2 rounded-xs bg-white/50" />
				</div>
			</section>
		</Portal>
	);
};
