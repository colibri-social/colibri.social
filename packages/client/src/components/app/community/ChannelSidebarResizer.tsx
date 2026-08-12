import {
	type Accessor,
	type Component,
	createSignal,
	onCleanup,
} from "solid-js";
import {
	clampSidebarWidth,
	DEFAULT_CHANNEL_SIDEBAR_WIDTH,
	MAX_CHANNEL_SIDEBAR_WIDTH,
	MIN_CHANNEL_SIDEBAR_WIDTH,
} from "../../../utils/sidebar-width";

const HINT_DELAY_MS = 1000;
const KEYBOARD_STEP = 16;
const COMMUNITY_RAIL_WIDTH = 56;
const MIN_CHAT_WIDTH = 360;

type ChannelSidebarResizerProps = {
	width: Accessor<number>;
	onDrag: (width: number | null) => void;
	onCommit: (width: number) => void;
	onResizingChange: (resizing: boolean) => void;
};

export const ChannelSidebarResizer: Component<ChannelSidebarResizerProps> = (
	props,
) => {
	const [hovered, setHovered] = createSignal(false);
	const [hintReady, setHintReady] = createSignal(false);
	const [focused, setFocused] = createSignal(false);
	const [resizing, setResizing] = createSignal(false);

	let hintTimer: ReturnType<typeof setTimeout> | undefined;
	let startX = 0;
	let startWidth = 0;
	let latest = 0;

	const visible = () => (hovered() && hintReady()) || resizing() || focused();

	const availableMax = (): number =>
		Math.max(
			MIN_CHANNEL_SIDEBAR_WIDTH,
			window.innerWidth - COMMUNITY_RAIL_WIDTH - MIN_CHAT_WIDTH,
		);

	const resolveWidth = (raw: number): number =>
		Math.min(clampSidebarWidth(raw), availableMax());

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
		latest = resolveWidth(startWidth + e.clientX - startX);
		props.onDrag(latest);
	};

	const onPointerUp = (): void => {
		window.removeEventListener("pointermove", onPointerMove);
		window.removeEventListener("pointerup", onPointerUp);

		setResizing(false);
		props.onResizingChange(false);
		props.onCommit(latest);
		props.onDrag(null);
	};

	const onPointerDown = (e: PointerEvent): void => {
		e.stopPropagation();

		if (e.button !== 0) return;

		e.preventDefault();

		clearHintTimer();
		setHintReady(true);

		startX = e.clientX;
		startWidth = props.width();
		latest = startWidth;

		setResizing(true);
		props.onResizingChange(true);

		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);
	};

	const onDblClick = (): void => {
		props.onCommit(DEFAULT_CHANNEL_SIDEBAR_WIDTH);
	};

	const onKeyDown = (e: KeyboardEvent): void => {
		if (e.key === "ArrowLeft") {
			e.preventDefault();
			props.onCommit(resolveWidth(props.width() - KEYBOARD_STEP));
		} else if (e.key === "ArrowRight") {
			e.preventDefault();
			props.onCommit(resolveWidth(props.width() + KEYBOARD_STEP));
		} else if (e.key === "Home") {
			e.preventDefault();
			props.onCommit(resolveWidth(DEFAULT_CHANNEL_SIDEBAR_WIDTH));
		}
	};

	onCleanup(() => {
		clearHintTimer();
		window.removeEventListener("pointermove", onPointerMove);
		window.removeEventListener("pointerup", onPointerUp);
	});

	return (
		<>
			<div
				aria-hidden="true"
				class="pointer-events-none absolute top-0 right-0 z-40 h-full w-0.5 bg-border opacity-0 transition-opacity"
				classList={{ "opacity-100": visible() }}
			/>
			<hr
				aria-label="Resize channel sidebar"
				aria-orientation="vertical"
				aria-valuenow={props.width()}
				aria-valuemin={MIN_CHANNEL_SIDEBAR_WIDTH}
				aria-valuemax={MAX_CHANNEL_SIDEBAR_WIDTH}
				tabIndex={0}
				onPointerDown={onPointerDown}
				onPointerEnter={onPointerEnter}
				onPointerLeave={onPointerLeave}
				onFocus={() => setFocused(true)}
				onBlur={() => setFocused(false)}
				onDblClick={onDblClick}
				onKeyDown={onKeyDown}
				class="absolute top-0 right-0 z-40 m-0 h-full w-1.5 translate-x-1/2 cursor-col-resize border-none bg-transparent outline-hidden"
			/>
		</>
	);
};
