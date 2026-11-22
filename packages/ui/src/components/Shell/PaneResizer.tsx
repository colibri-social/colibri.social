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

export type PaneResizerEdge = "start" | "end";

export type PaneResizerAxis = "x" | "y";

export type PaneResizerProps = {
	width: number;
	onWidthChange: (width: number) => void;
	onWidthCommit?: (width: number) => void;
	min?: number;
	max?: number;
	defaultWidth?: number;
	availableMax?: () => number;
	edge?: PaneResizerEdge;
	axis?: PaneResizerAxis;
	label?: string;
	class?: string;
};

const lockDocument = (cursor: string) => {
	const style = document.documentElement.style;
	const previous = {
		userSelect: style.userSelect,
		webkitUserSelect: style.getPropertyValue("-webkit-user-select"),
		cursor: style.cursor,
	};
	style.userSelect = "none";
	style.setProperty("-webkit-user-select", "none");
	style.cursor = cursor;
	window.getSelection()?.removeAllRanges();
	return () => {
		style.userSelect = previous.userSelect;
		style.setProperty("-webkit-user-select", previous.webkitUserSelect);
		style.cursor = previous.cursor;
	};
};

export const PaneResizer = (props: PaneResizerProps) => {
	const [hovered, setHovered] = createSignal(false);
	const [hintReady, setHintReady] = createSignal(false);
	const [focused, setFocused] = createSignal(false);
	const [resizing, setResizing] = createSignal(false);
	let hintTimer: ReturnType<typeof setTimeout> | undefined;
	let handle: HTMLHRElement | undefined;
	let activePointer: number | undefined;
	let unlock: (() => void) | undefined;
	let startPosition = 0;
	let startWidth = 0;
	let latest = 0;

	const min = () => props.min ?? MIN_THREAD_PANE_WIDTH;
	const max = () => props.max ?? MAX_THREAD_PANE_WIDTH;
	const growth = () => (props.edge === "end" ? 1 : -1);
	const vertical = () => props.axis === "y";
	const position = (event: PointerEvent) =>
		vertical() ? event.clientY : event.clientX;
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

	const teardown = () => {
		window.removeEventListener("pointermove", onPointerMove, true);
		window.removeEventListener("pointerup", onPointerUp, true);
		window.removeEventListener("pointercancel", onPointerCancel, true);
		window.removeEventListener("keydown", onDragKeyDown, true);
		window.removeEventListener("blur", onWindowBlur);
		handle?.removeEventListener("lostpointercapture", onLostCapture);
		const pointer = activePointer;
		activePointer = undefined;
		if (pointer !== undefined && handle?.hasPointerCapture?.(pointer)) {
			try {
				handle.releasePointerCapture(pointer);
			} catch {}
		}
		unlock?.();
		unlock = undefined;
		setResizing(false);
	};

	const end = () => {
		if (activePointer === undefined) return;
		teardown();
		props.onWidthCommit?.(latest);
	};

	const cancel = () => {
		if (activePointer === undefined) return;
		teardown();
		latest = startWidth;
		props.onWidthChange(startWidth);
	};

	const onPointerMove = (event: PointerEvent) => {
		if (event.pointerId !== activePointer) return;
		if (event.pointerType === "mouse" && event.buttons === 0) {
			end();
			return;
		}
		event.preventDefault();
		const next = resolve(
			startWidth + growth() * (position(event) - startPosition),
		);
		if (next === latest) return;
		latest = next;
		props.onWidthChange(latest);
	};

	const onPointerUp = (event: PointerEvent) => {
		if (event.pointerId !== activePointer) return;
		end();
	};

	const onPointerCancel = (event: PointerEvent) => {
		if (event.pointerId !== activePointer) return;
		end();
	};

	const onLostCapture = (event: PointerEvent) => {
		if (event.pointerId !== activePointer) return;
		end();
	};

	const onWindowBlur = () => end();

	const onDragKeyDown = (event: KeyboardEvent) => {
		if (event.key !== "Escape") return;
		event.preventDefault();
		event.stopPropagation();
		cancel();
	};

	const onPointerDown = (event: PointerEvent) => {
		event.stopPropagation();
		if (event.button !== 0 || activePointer !== undefined) return;
		event.preventDefault();
		clearHint();
		setHintReady(true);
		activePointer = event.pointerId;
		startPosition = position(event);
		startWidth = props.width;
		latest = startWidth;
		setResizing(true);
		unlock = lockDocument(vertical() ? "row-resize" : "col-resize");
		window.addEventListener("pointermove", onPointerMove, {
			capture: true,
			passive: false,
		});
		window.addEventListener("pointerup", onPointerUp, true);
		window.addEventListener("pointercancel", onPointerCancel, true);
		window.addEventListener("keydown", onDragKeyDown, true);
		window.addEventListener("blur", onWindowBlur);
		try {
			handle?.setPointerCapture(event.pointerId);
			handle?.addEventListener("lostpointercapture", onLostCapture);
		} catch {}
	};

	const onKeyDown = (event: KeyboardEvent) => {
		const forward = vertical() ? "ArrowDown" : "ArrowRight";
		const backward = vertical() ? "ArrowUp" : "ArrowLeft";
		const step =
			event.key === forward
				? PANE_RESIZE_STEP
				: event.key === backward
					? -PANE_RESIZE_STEP
					: 0;
		if (step !== 0) {
			event.preventDefault();
			commit(resolve(props.width + growth() * step));
		} else if (event.key === "Home") {
			event.preventDefault();
			commit(resolve(props.defaultWidth ?? DEFAULT_THREAD_PANE_WIDTH));
		}
	};

	onCleanup(() => {
		clearHint();
		if (activePointer !== undefined) teardown();
	});

	return (
		<>
			<div
				aria-hidden="true"
				data-pane-resizer-line=""
				data-visible={visible() || undefined}
				class={cx(
					"pointer-events-none absolute z-40 bg-border opacity-0 data-visible:bg-primary data-visible:opacity-100",
					vertical()
						? cx(
								"left-0 h-0.5 w-full",
								props.edge === "end" ? "bottom-0" : "top-0",
							)
						: cx(
								"top-0 h-full w-0.5",
								props.edge === "end" ? "right-0" : "left-0",
							),
					props.class,
				)}
			/>
			<hr
				ref={handle}
				aria-label={props.label ?? "Resize thread panel"}
				aria-orientation={vertical() ? "horizontal" : "vertical"}
				aria-valuenow={props.width}
				aria-valuemin={min()}
				aria-valuemax={max()}
				tabIndex={0}
				data-pane-resizer=""
				data-edge={props.edge ?? "start"}
				data-axis={props.axis ?? "x"}
				data-resizing={resizing() || undefined}
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
				class={cx(
					"absolute z-40 m-0 touch-none border-none bg-transparent outline-hidden",
					vertical()
						? cx(
								"left-0 h-1.5 w-full cursor-row-resize",
								props.edge === "end"
									? "bottom-0 translate-y-1/2"
									: "top-0 -translate-y-1/2",
							)
						: cx(
								"top-0 h-full w-1.5 cursor-col-resize",
								props.edge === "end"
									? "right-0 translate-x-1/2"
									: "left-0 -translate-x-1/2",
							),
				)}
			/>
		</>
	);
};
