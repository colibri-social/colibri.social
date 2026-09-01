import { createSignal } from "solid-js";

export const MIN_THREAD_PANE_WIDTH = 320;
export const MAX_THREAD_PANE_WIDTH = 720;
export const DEFAULT_THREAD_PANE_WIDTH = 416;

export const clampThreadPaneWidth = (value: unknown): number =>
	typeof value === "number" && Number.isFinite(value)
		? Math.max(
				MIN_THREAD_PANE_WIDTH,
				Math.min(MAX_THREAD_PANE_WIDTH, Math.round(value)),
			)
		: DEFAULT_THREAD_PANE_WIDTH;

const [dragWidth, setDragWidth] = createSignal<number | null>(null);

export const threadPaneDragWidth = dragWidth;

export const setThreadPaneDragWidth = setDragWidth;
