import { type Component, createSignal, onCleanup } from "solid-js";
import { useUserPreferences } from "../../../../contexts/UserPreferences";
import {
	clampThreadPaneWidth,
	DEFAULT_THREAD_PANE_WIDTH,
	MAX_THREAD_PANE_WIDTH,
	MIN_THREAD_PANE_WIDTH,
	setThreadPaneDragWidth,
} from "../../../../utils/thread-width";

const HINT_DELAY_MS = 1000;
const KEYBOARD_STEP = 16;
const MIN_CHAT_WIDTH = 360;

export const ThreadPaneResizer: Component = () => {
	const { preferences, setThreadPaneWidth } = useUserPreferences();

	const [hovered, setHovered] = createSignal(false);
	const [hintReady, setHintReady] = createSignal(false);
	const [focused, setFocused] = createSignal(false);
	const [resizing, setResizing] = createSignal(false);

	let hintTimer: ReturnType<typeof setTimeout> | undefined;
	let startX = 0;
	let startWidth = 0;
	let latest = 0;

	const width = () => preferences().threadPaneWidth;

	const visible = () => (hovered() && hintReady()) || resizing() || focused();

	const availableMax = (): number => {
		const sidebar =
			document.documentElement.clientWidth -
			preferences().channelSidebarWidth -
			MIN_CHAT_WIDTH;
		return Math.max(MIN_THREAD_PANE_WIDTH, sidebar);
	};

	const resolveWidth = (raw: number): number =>
		Math.min(clampThreadPaneWidth(raw), availableMax());

	const clearHintTimer = (): void => {
		if (hintTimer !== undefined) clearTimeout(hintTimer);
		hintTimer = undefined;
	};

	const onPointerEnter = (): void => {
		setHovered(true);
		clearHintTimer();
		hintTimer = setTimeout(() => setHintReady(true), HINT_DELAY_MS);
	};

	const onPointerLeave = (): void => {
		setHovered(false);
		clearHintTimer();
		setHintReady(false);
	};

	const onPointerMove = (e: PointerEvent): void => {
		latest = resolveWidth(startWidth + startX - e.clientX);
		setThreadPaneDragWidth(latest);
	};

	const onPointerUp = (): void => {
		window.removeEventListener("pointermove", onPointerMove);
		window.removeEventListener("pointerup", onPointerUp);

		setResizing(false);
		setThreadPaneWidth(latest);
		setThreadPaneDragWidth(null);
	};

	const onPointerDown = (e: PointerEvent): void => {
		e.stopPropagation();
		if (e.button !== 0) return;
		e.preventDefault();

		clearHintTimer();
		setHintReady(true);

		startX = e.clientX;
		startWidth = width();
		latest = startWidth;

		setResizing(true);

		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);
	};

	const onKeyDown = (e: KeyboardEvent): void => {
		if (e.key === "ArrowLeft") {
			e.preventDefault();
			setThreadPaneWidth(resolveWidth(width() + KEYBOARD_STEP));
		} else if (e.key === "ArrowRight") {
			e.preventDefault();
			setThreadPaneWidth(resolveWidth(width() - KEYBOARD_STEP));
		} else if (e.key === "Home") {
			e.preventDefault();
			setThreadPaneWidth(resolveWidth(DEFAULT_THREAD_PANE_WIDTH));
		}
	};

	onCleanup(() => {
		clearHintTimer();
		window.removeEventListener("pointermove", onPointerMove);
		window.removeEventListener("pointerup", onPointerUp);
		setThreadPaneDragWidth(null);
	});

	return (
		<>
			<div
				aria-hidden="true"
				class="pointer-events-none absolute top-0 left-0 z-40 h-full w-0.5 bg-border opacity-0 transition-opacity"
				classList={{ "opacity-100": visible() }}
			/>
			<hr
				aria-label="Resize thread panel"
				aria-orientation="vertical"
				aria-valuenow={width()}
				aria-valuemin={MIN_THREAD_PANE_WIDTH}
				aria-valuemax={MAX_THREAD_PANE_WIDTH}
				tabIndex={0}
				onPointerDown={onPointerDown}
				onPointerEnter={onPointerEnter}
				onPointerLeave={onPointerLeave}
				onFocus={() => setFocused(true)}
				onBlur={() => setFocused(false)}
				onDblClick={() => setThreadPaneWidth(DEFAULT_THREAD_PANE_WIDTH)}
				onKeyDown={onKeyDown}
				class="absolute top-0 left-0 z-40 m-0 h-full w-1.5 -translate-x-1/2 cursor-col-resize border-none bg-transparent outline-hidden"
			/>
		</>
	);
};
