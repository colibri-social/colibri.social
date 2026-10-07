import { createSignal, onCleanup } from "solid-js";
import { cx } from "../../utils/cx";

export const MIN_THREAD_PANE_WIDTH = 320;
export const MAX_THREAD_PANE_WIDTH = 720;
export const DEFAULT_THREAD_PANE_WIDTH = 416;

const HINT_DELAY_MS = 1000;
export const PANE_RESIZE_STEP = 16;

export const clampPaneWidth = (
	value: number,
	min = MIN_THREAD_PANE_WIDTH,
	max = MAX_THREAD_PANE_WIDTH,
) => Math.max(min, Math.min(max, Math.round(value)));

export type PaneResizerProps = {
	width: number;
	onWidthChange: (width: number) => void;
	onWidthCommit?: (width: number) => void;
	min?: number;
	max?: number;
	defaultWidth?: number;
	availableMax?: () => number;
	label?: string;
	class?: string;
};

export const PaneResizer = (props: PaneResizerProps) => {
	const [hovered, setHovered] = createSignal(false);
	const [hintReady, setHintReady] = createSignal(false);
	const [focused, setFocused] = createSignal(false);
	const [resizing, setResizing] = createSignal(false);
	let hintTimer: ReturnType<typeof setTimeout> | undefined;
	let startX = 0;
	let startWidth = 0;
	let latest = 0;

	const min = () => props.min ?? MIN_THREAD_PANE_WIDTH;
	const max = () => props.max ?? MAX_THREAD_PANE_WIDTH;
	const resolve = (raw: number) => {
		const limit = Math.max(
			min(),
			Math.min(max(), props.availableMax?.() ?? max()),
		);
		return clampPaneWidth(raw, min(), limit);
	};
	const visible = () => (hovered() && hintReady()) || resizing() || focused();

	const clearHint = () => {
		if (hintTimer !== undefined) clearTimeout(hintTimer);
		hintTimer = undefined;
	};

	const commit = (width: number) => {
		props.onWidthChange(width);
		props.onWidthCommit?.(width);
	};

	const onPointerMove = (event: PointerEvent) => {
		latest = resolve(startWidth + startX - event.clientX);
		props.onWidthChange(latest);
	};

	const onPointerUp = () => {
		window.removeEventListener("pointermove", onPointerMove);
		window.removeEventListener("pointerup", onPointerUp);
		setResizing(false);
		props.onWidthCommit?.(latest);
	};

	const onPointerDown = (event: PointerEvent) => {
		event.stopPropagation();
		if (event.button !== 0) return;
		event.preventDefault();
		clearHint();
		setHintReady(true);
		startX = event.clientX;
		startWidth = props.width;
		latest = startWidth;
		setResizing(true);
		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);
	};

	const onKeyDown = (event: KeyboardEvent) => {
		if (event.key === "ArrowLeft") {
			event.preventDefault();
			commit(resolve(props.width + PANE_RESIZE_STEP));
		} else if (event.key === "ArrowRight") {
			event.preventDefault();
			commit(resolve(props.width - PANE_RESIZE_STEP));
		} else if (event.key === "Home") {
			event.preventDefault();
			commit(resolve(props.defaultWidth ?? DEFAULT_THREAD_PANE_WIDTH));
		}
	};

	onCleanup(() => {
		clearHint();
		window.removeEventListener("pointermove", onPointerMove);
		window.removeEventListener("pointerup", onPointerUp);
	});

	return (
		<>
			<div
				aria-hidden="true"
				data-pane-resizer-line=""
				data-visible={visible() || undefined}
				class={cx(
					"pointer-events-none absolute top-0 left-0 z-40 h-full w-0.5 bg-border opacity-0 data-visible:bg-primary data-visible:opacity-100",
					props.class,
				)}
			/>
			<hr
				aria-label={props.label ?? "Resize thread panel"}
				aria-orientation="vertical"
				aria-valuenow={props.width}
				aria-valuemin={min()}
				aria-valuemax={max()}
				tabIndex={0}
				data-pane-resizer=""
				onPointerDown={onPointerDown}
				onPointerEnter={() => {
					setHovered(true);
					clearHint();
					hintTimer = setTimeout(() => setHintReady(true), HINT_DELAY_MS);
				}}
				onPointerLeave={() => {
					setHovered(false);
					clearHint();
					setHintReady(false);
				}}
				onFocus={() => setFocused(true)}
				onBlur={() => setFocused(false)}
				onDblClick={() =>
					commit(resolve(props.defaultWidth ?? DEFAULT_THREAD_PANE_WIDTH))
				}
				onKeyDown={onKeyDown}
				class="absolute top-0 left-0 z-40 m-0 h-full w-1.5 -translate-x-1/2 cursor-col-resize border-none bg-transparent outline-hidden"
			/>
		</>
	);
};
