export type RowRef = unknown;

export type ScrollSurface = {
	getScrollTop(): number;
	setScrollTop(value: number): void;
	getScrollHeight(): number;
	getClientHeight(): number;
	rowCount(): number;
	rowAt(index: number): RowRef | undefined;
	rowOffset(index: number): number;
	rowHeight(index: number): number;
	rowOffsetOf(row: RowRef): number | undefined;
};

export type Anchor =
	| { mode: "bottom" }
	| { mode: "row"; row: RowRef; offset: number }
	| { mode: "none" };

export type LoadTriggerState = {
	scrollTop: number;
	clientHeight: number;
	hasMore: boolean;
	loading: boolean;
	ready: boolean;
};

export const BOTTOM_THRESHOLD_PX = 80;
export const MIN_PREFETCH_PX = 400;
export const PREFETCH_VIEWPORTS = 1;

export const distanceFromBottom = (surface: ScrollSurface): number =>
	surface.getScrollHeight() -
	surface.getScrollTop() -
	surface.getClientHeight();

export const isPinnedToBottom = (
	surface: ScrollSurface,
	threshold = BOTTOM_THRESHOLD_PX,
): boolean => distanceFromBottom(surface) < threshold;

export const findTopmostVisibleRow = (surface: ScrollSurface): number => {
	let low = 0;
	let high = surface.rowCount() - 1;
	let found = -1;

	while (low <= high) {
		const mid = (low + high) >> 1;
		if (surface.rowOffset(mid) + surface.rowHeight(mid) > 0) {
			found = mid;
			high = mid - 1;
		} else {
			low = mid + 1;
		}
	}

	return found;
};

export const findFirstRowBelowTop = (surface: ScrollSurface): number => {
	let low = 0;
	let high = surface.rowCount() - 1;
	let found = -1;

	while (low <= high) {
		const mid = (low + high) >> 1;
		if (surface.rowOffset(mid) >= 0) {
			found = mid;
			high = mid - 1;
		} else {
			low = mid + 1;
		}
	}

	return found;
};

export const findAnchorRow = (surface: ScrollSurface): number => {
	const below = findFirstRowBelowTop(surface);
	if (below !== -1 && surface.rowOffset(below) < surface.getClientHeight())
		return below;
	return findTopmostVisibleRow(surface);
};

export const captureAnchor = (
	surface: ScrollSurface,
	threshold = BOTTOM_THRESHOLD_PX,
): Anchor => {
	if (isPinnedToBottom(surface, threshold)) return { mode: "bottom" };

	const index = findAnchorRow(surface);
	if (index === -1) return { mode: "none" };

	const row = surface.rowAt(index);
	if (row === undefined) return { mode: "none" };

	return { mode: "row", row, offset: surface.rowOffset(index) };
};

export const anchoredScrollTop = (
	surface: ScrollSurface,
	anchor: Anchor,
): number | undefined => {
	if (anchor.mode === "none") return undefined;
	if (anchor.mode === "bottom")
		return surface.getScrollHeight() - surface.getClientHeight();

	const offset = surface.rowOffsetOf(anchor.row);
	if (offset === undefined) return undefined;

	return surface.getScrollTop() + (offset - anchor.offset);
};

export const prefetchDistance = (clientHeight: number): number =>
	Math.max(MIN_PREFETCH_PX, clientHeight * PREFETCH_VIEWPORTS);

export const shouldLoadOlder = (state: LoadTriggerState): boolean =>
	state.ready &&
	state.hasMore &&
	!state.loading &&
	state.scrollTop < prefetchDistance(state.clientHeight);

export type GrowthSide = "upper" | "lower";

export const decideGrowthSide = (
	boundaryOffset: number,
	clientHeight: number,
): GrowthSide => {
	if (boundaryOffset <= 0) return "lower";
	if (boundaryOffset >= clientHeight) return "upper";
	return clientHeight - boundaryOffset > boundaryOffset ? "lower" : "upper";
};

export type ScrollAnchorController = {
	capture(): void;
	restore(): boolean;
	absorbGrowth(boundaryOffset: number, delta: number): void;
	pinToBottom(): void;
	handleScroll(): void;
	anchorMode(): Anchor["mode"];
	isAtBottom(): boolean;
};

export const createScrollAnchor = (
	surface: ScrollSurface,
	options: { bottomThresholdPx?: number } = {},
): ScrollAnchorController => {
	const threshold = options.bottomThresholdPx ?? BOTTOM_THRESHOLD_PX;
	let anchor: Anchor = { mode: "bottom" };
	let lastWritten: number | undefined;

	const write = (value: number): void => {
		const max = Math.max(
			0,
			surface.getScrollHeight() - surface.getClientHeight(),
		);
		const clamped = Math.min(Math.max(value, 0), max);
		lastWritten = clamped;
		surface.setScrollTop(clamped);
	};

	const capture = () => {
		anchor = captureAnchor(surface, threshold);
	};

	const restore = () => {
		const target = anchoredScrollTop(surface, anchor);
		if (target === undefined) return false;
		if (Math.abs(target - surface.getScrollTop()) < 0.5) return false;
		write(target);
		return true;
	};

	return {
		capture,
		restore,
		absorbGrowth(boundaryOffset, delta) {
			if (anchor.mode === "bottom" || delta === 0) {
				restore();
				return;
			}

			const side = decideGrowthSide(boundaryOffset, surface.getClientHeight());
			if (side === "upper" || boundaryOffset <= 0) {
				restore();
				return;
			}

			write(surface.getScrollTop() + delta);
			capture();
		},
		pinToBottom() {
			anchor = { mode: "bottom" };
			write(surface.getScrollHeight());
		},
		handleScroll() {
			const current = surface.getScrollTop();
			if (lastWritten !== undefined && Math.abs(current - lastWritten) < 1)
				return;
			lastWritten = undefined;
			anchor = captureAnchor(surface, threshold);
		},
		anchorMode: () => anchor.mode,
		isAtBottom: () => isPinnedToBottom(surface, threshold),
	};
};

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

	return {
		getScrollTop: () => getContainer()?.scrollTop ?? 0,
		setScrollTop: (value) => {
			const container = getContainer();
			if (container) container.scrollTop = value;
		},
		getScrollHeight: () => getContainer()?.scrollHeight ?? 0,
		getClientHeight: () => getContainer()?.clientHeight ?? 0,
		rowCount: () => rows()?.length ?? 0,
		rowAt: (index) => rowElement(index),
		rowOffset: (index) => {
			const element = rowElement(index);
			return element ? offsetOf(element) : 0;
		},
		rowHeight: (index) => rowElement(index)?.offsetHeight ?? 0,
		rowOffsetOf: (row) => {
			if (!(row instanceof HTMLElement) || !row.isConnected) return undefined;
			return offsetOf(row);
		},
	};
};
