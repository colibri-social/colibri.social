export type ScrollSurface = {
	getScrollTop(): number;
	setScrollTop(value: number): void;
	getScrollHeight(): number;
	getClientHeight(): number;
	rowCount(): number;
	rowOffset(index: number): number;
	rowHeight(index: number): number;
	rowKey(index: number): string | undefined;
	rowOffsetOfKey(key: string): number | undefined;
};

export type AnchorCandidate = { key: string; offset: number };

export type Anchor =
	| { mode: "row"; candidates: Array<AnchorCandidate> }
	| { mode: "none" };

export type LoadTriggerState = {
	scrollTop: number;
	clientHeight: number;
	hasMore: boolean;
	loading: boolean;
	ready: boolean;
};

export type FrameScheduler = {
	request(callback: () => void): number;
	cancel(handle: number): void;
};

export type SettleOptions = {
	maxFrames?: number;
	stableFrames?: number;
	hold?: () => boolean;
};

export const BOTTOM_THRESHOLD_PX = 80;
export const JUMP_TO_LATEST_DISTANCE_PX = 200;
export const MIN_PREFETCH_PX = 400;
export const PREFETCH_VIEWPORTS = 1;
export const ANCHOR_CANDIDATES = 5;
export const DEFAULT_SETTLE_MAX_FRAMES = 60;
export const DEFAULT_SETTLE_STABLE_FRAMES = 2;
export const KEYBOARD_SETTLE_MAX_FRAMES = 90;
export const SELF_WRITE_EPSILON_PX = 1;
export const RESTORE_EPSILON_PX = 0.5;

export const distanceFromBottom = (surface: ScrollSurface): number =>
	Math.max(
		0,
		surface.getScrollHeight() -
			surface.getScrollTop() -
			surface.getClientHeight(),
	);

export const isPinnedToBottom = (
	surface: ScrollSurface,
	threshold = BOTTOM_THRESHOLD_PX,
): boolean => distanceFromBottom(surface) < threshold;

export const shouldShowJumpToLatest = (
	distance: number,
	visible: boolean,
	showAtPx = JUMP_TO_LATEST_DISTANCE_PX,
	hideBelowPx = BOTTOM_THRESHOLD_PX,
): boolean => {
	if (distance > showAtPx) return true;
	if (distance < hideBelowPx) return false;
	return visible;
};

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
	limit = ANCHOR_CANDIDATES,
): Anchor => {
	const start = findAnchorRow(surface);
	if (start === -1) return { mode: "none" };

	const candidates: Array<AnchorCandidate> = [];
	const count = surface.rowCount();

	for (let index = start; index < count && candidates.length < limit; index++) {
		const key = surface.rowKey(index);
		if (key === undefined) continue;
		candidates.push({ key, offset: surface.rowOffset(index) });
	}

	for (
		let index = start - 1;
		index >= 0 && candidates.length < limit;
		index--
	) {
		const key = surface.rowKey(index);
		if (key === undefined) continue;
		candidates.push({ key, offset: surface.rowOffset(index) });
	}

	if (candidates.length === 0) return { mode: "none" };
	return { mode: "row", candidates };
};

export const anchoredScrollTop = (
	surface: ScrollSurface,
	anchor: Anchor,
): number | undefined => {
	if (anchor.mode === "none") return undefined;

	for (const candidate of anchor.candidates) {
		const offset = surface.rowOffsetOfKey(candidate.key);
		if (offset === undefined) continue;
		return surface.getScrollTop() + (offset - candidate.offset);
	}

	return undefined;
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

export type MessageScrollController = {
	isPinned(): boolean;
	isGesturing(): boolean;
	isSettling(): boolean;
	isAtBottom(): boolean;
	distanceFromBottom(): number;
	anchorMode(): Anchor["mode"];
	pin(settleOptions?: SettleOptions | false): void;
	unpin(): void;
	reset(): void;
	assert(): boolean;
	settle(settleOptions?: SettleOptions): void;
	captureRowAnchor(): void;
	absorbGrowth(boundaryOffset: number, delta: number): void;
	absorbPrepend(): boolean;
	beginGesture(): void;
	endGesture(): void;
	cancelGesture(): void;
	handleScroll(): void;
	dispose(): void;
};

export const createMessageScrollController = (
	surface: ScrollSurface,
	options: { scheduler: FrameScheduler; bottomThresholdPx?: number },
): MessageScrollController => {
	const threshold = options.bottomThresholdPx ?? BOTTOM_THRESHOLD_PX;
	const scheduler = options.scheduler;

	let pinned = true;
	let anchor: Anchor = { mode: "none" };
	let gesturing = false;
	let lastWritten: number | undefined;

	let settleHandle: number | undefined;
	let settleFrames = 0;
	let settleStable = 0;
	let settleBudget = DEFAULT_SETTLE_MAX_FRAMES;
	let settleTarget = DEFAULT_SETTLE_STABLE_FRAMES;
	let settleHold: (() => boolean) | undefined;
	let settleScrollHeight = -1;
	let settleClientHeight = -1;

	const write = (value: number): void => {
		surface.setScrollTop(value);
		lastWritten = surface.getScrollTop();
	};

	const assertBottom = (): boolean => {
		const before = surface.getScrollTop();
		write(surface.getScrollHeight());
		return surface.getScrollTop() !== before;
	};

	const restoreRow = (): boolean => {
		const target = anchoredScrollTop(surface, anchor);
		if (target === undefined) {
			anchor = captureAnchor(surface);
			return false;
		}
		if (Math.abs(target - surface.getScrollTop()) < RESTORE_EPSILON_PX)
			return false;
		write(target);
		return true;
	};

	const cancelSettle = (): void => {
		if (settleHandle !== undefined) scheduler.cancel(settleHandle);
		settleHandle = undefined;
		settleHold = undefined;
	};

	const step = (): void => {
		settleHandle = undefined;
		if (!pinned || gesturing) {
			settleHold = undefined;
			return;
		}

		assertBottom();

		const scrollHeight = surface.getScrollHeight();
		const clientHeight = surface.getClientHeight();
		const quiet =
			scrollHeight === settleScrollHeight &&
			clientHeight === settleClientHeight &&
			distanceFromBottom(surface) < SELF_WRITE_EPSILON_PX;

		if (quiet) {
			settleStable++;
		} else {
			settleStable = 0;
			settleScrollHeight = scrollHeight;
			settleClientHeight = clientHeight;
		}

		settleFrames++;
		if (settleFrames >= settleBudget) {
			settleHold = undefined;
			return;
		}
		if (settleStable >= settleTarget && settleHold?.() !== true) {
			settleHold = undefined;
			return;
		}

		settleHandle = scheduler.request(step);
	};

	const settle = (settleOptions: SettleOptions = {}): void => {
		if (!pinned || gesturing) return;
		settleBudget = settleOptions.maxFrames ?? DEFAULT_SETTLE_MAX_FRAMES;
		settleTarget = settleOptions.stableFrames ?? DEFAULT_SETTLE_STABLE_FRAMES;
		if (settleOptions.hold) settleHold = settleOptions.hold;
		settleFrames = 0;
		settleStable = 0;
		settleScrollHeight = -1;
		settleClientHeight = -1;
		if (settleHandle === undefined) settleHandle = scheduler.request(step);
	};

	return {
		isPinned: () => pinned,
		isGesturing: () => gesturing,
		isSettling: () => settleHandle !== undefined,
		isAtBottom: () => isPinnedToBottom(surface, threshold),
		distanceFromBottom: () => distanceFromBottom(surface),
		anchorMode: () => anchor.mode,

		pin(settleOptions) {
			pinned = true;
			anchor = { mode: "none" };
			assertBottom();
			if (settleOptions !== false) settle(settleOptions ?? {});
		},

		unpin() {
			pinned = false;
			cancelSettle();
			anchor = captureAnchor(surface);
		},

		reset() {
			cancelSettle();
			gesturing = false;
			pinned = true;
			anchor = { mode: "none" };
			lastWritten = undefined;
		},

		assert() {
			if (gesturing) return false;
			return pinned ? assertBottom() : restoreRow();
		},

		settle,

		captureRowAnchor() {
			anchor = captureAnchor(surface);
		},

		absorbGrowth(boundaryOffset, delta) {
			if (gesturing) {
				if (delta === 0 || boundaryOffset > 0) return;
				write(surface.getScrollTop() + delta);
				return;
			}
			if (pinned) {
				assertBottom();
				return;
			}
			if (delta === 0) {
				restoreRow();
				return;
			}

			const side = decideGrowthSide(boundaryOffset, surface.getClientHeight());
			if (side === "upper" || boundaryOffset <= 0) {
				restoreRow();
				return;
			}

			write(surface.getScrollTop() + delta);
			anchor = captureAnchor(surface);
		},

		absorbPrepend() {
			if (isPinnedToBottom(surface, threshold)) {
				assertBottom();
				return true;
			}

			const target = anchoredScrollTop(surface, anchor);
			if (target === undefined) {
				anchor = captureAnchor(surface);
				return false;
			}

			if (Math.abs(target - surface.getScrollTop()) >= RESTORE_EPSILON_PX)
				write(target);
			return true;
		},

		beginGesture() {
			gesturing = true;
			cancelSettle();
		},

		endGesture() {
			if (!gesturing) return;
			gesturing = false;
			lastWritten = undefined;
			pinned = isPinnedToBottom(surface, threshold);
			anchor = pinned ? { mode: "none" } : captureAnchor(surface);
			if (pinned) settle();
		},

		cancelGesture() {
			if (!gesturing) return;
			gesturing = false;
			if (pinned) settle();
		},

		handleScroll() {
			const current = surface.getScrollTop();
			if (
				lastWritten !== undefined &&
				Math.abs(current - lastWritten) < SELF_WRITE_EPSILON_PX
			)
				return;
			lastWritten = undefined;
			if (gesturing || pinned) return;
			anchor = captureAnchor(surface);
		},

		dispose: cancelSettle,
	};
};
