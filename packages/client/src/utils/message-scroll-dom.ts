import type {
	FrameScheduler,
	MessageScrollController,
	ScrollSurface,
} from "./message-scroll";

export const SCROLL_QUIET_MS = 140;
export const GESTURE_SAFETY_MS = 1500;

const SCROLLING_KEYS = new Set([
	"ArrowUp",
	"ArrowDown",
	"PageUp",
	"PageDown",
	"Home",
	"End",
	" ",
]);

export const domFrameScheduler = (): FrameScheduler => ({
	request: (callback) => requestAnimationFrame(callback),
	cancel: (handle) => cancelAnimationFrame(handle),
});

const ROW_KEY_ATTR = "data-message-uri";

export const createDomScrollSurface = (
	getContainer: () => HTMLElement | undefined,
	getContent: () => HTMLElement | undefined,
): ScrollSurface => {
	const rows = (): HTMLCollection | undefined => getContent()?.children;

	const rowElement = (index: number): HTMLElement | undefined => {
		const element = rows()?.[index];
		return element instanceof HTMLElement ? element : undefined;
	};

	const offsetOf = (element: HTMLElement): number =>
		element.offsetTop - (getContainer()?.scrollTop ?? 0);

	const keyOfRow = (row: HTMLElement): string | undefined =>
		row.getAttribute(ROW_KEY_ATTR) ??
		row.querySelector(`[${ROW_KEY_ATTR}]`)?.getAttribute(ROW_KEY_ATTR) ??
		undefined;

	const rowContaining = (
		content: HTMLElement,
		node: HTMLElement,
	): HTMLElement | undefined => {
		let current: HTMLElement | null = node;
		while (current !== null && current.parentElement !== content)
			current = current.parentElement;
		return current ?? undefined;
	};

	return {
		getScrollTop: () => getContainer()?.scrollTop ?? 0,
		setScrollTop: (value) => {
			const container = getContainer();
			if (container) container.scrollTop = value;
		},
		getScrollHeight: () => getContainer()?.scrollHeight ?? 0,
		getClientHeight: () => getContainer()?.clientHeight ?? 0,
		rowCount: () => rows()?.length ?? 0,
		rowOffset: (index) => {
			const element = rowElement(index);
			return element ? offsetOf(element) : 0;
		},
		rowHeight: (index) => rowElement(index)?.offsetHeight ?? 0,
		rowKey: (index) => {
			const element = rowElement(index);
			return element ? keyOfRow(element) : undefined;
		},
		rowOffsetOfKey: (key) => {
			const content = getContent();
			if (!content) return undefined;
			const element = content.querySelector<HTMLElement>(
				`[${ROW_KEY_ATTR}="${CSS.escape(key)}"]`,
			);
			if (!element?.isConnected) return undefined;
			const row = rowContaining(content, element);
			return row ? offsetOf(row) : undefined;
		},
	};
};

export const bindScrollGestures = (
	container: HTMLElement,
	controller: MessageScrollController,
): (() => void) => {
	const hasScrollEnd = "onscrollend" in window;
	let sawScroll = false;
	let quietTimer: number | undefined;
	let safetyTimer: number | undefined;

	const clearTimers = () => {
		if (quietTimer !== undefined) clearTimeout(quietTimer);
		if (safetyTimer !== undefined) clearTimeout(safetyTimer);
		quietTimer = undefined;
		safetyTimer = undefined;
	};

	const finish = () => {
		clearTimers();
		if (!sawScroll) {
			controller.cancelGesture();
			return;
		}
		sawScroll = false;
		controller.endGesture();
	};

	const arm = () => {
		if (!controller.isGesturing()) sawScroll = false;
		clearTimers();
		controller.beginGesture();
		safetyTimer = window.setTimeout(finish, GESTURE_SAFETY_MS);
	};

	const onScroll = () => {
		if (!controller.isGesturing()) return;
		sawScroll = true;
		if (hasScrollEnd) return;
		if (quietTimer !== undefined) clearTimeout(quietTimer);
		quietTimer = window.setTimeout(finish, SCROLL_QUIET_MS);
	};

	const onPointerUp = () => {
		if (!controller.isGesturing()) return;
		if (!sawScroll) finish();
	};

	const onKeyDown = (event: KeyboardEvent) => {
		if (!SCROLLING_KEYS.has(event.key)) return;
		if (!(event.target instanceof Node) || !container.contains(event.target))
			return;
		arm();
	};

	const capture = { capture: true, passive: true } as const;

	container.addEventListener("pointerdown", arm, capture);
	container.addEventListener("touchstart", arm, capture);
	container.addEventListener("wheel", arm, { passive: true });
	container.addEventListener("keydown", onKeyDown);
	container.addEventListener("pointerup", onPointerUp, capture);
	container.addEventListener("pointercancel", onPointerUp, capture);
	container.addEventListener("scroll", onScroll, { passive: true });
	if (hasScrollEnd) container.addEventListener("scrollend", finish);

	return () => {
		clearTimers();
		container.removeEventListener("pointerdown", arm, capture);
		container.removeEventListener("touchstart", arm, capture);
		container.removeEventListener("wheel", arm);
		container.removeEventListener("keydown", onKeyDown);
		container.removeEventListener("pointerup", onPointerUp, capture);
		container.removeEventListener("pointercancel", onPointerUp, capture);
		container.removeEventListener("scroll", onScroll);
		if (hasScrollEnd) container.removeEventListener("scrollend", finish);
	};
};
