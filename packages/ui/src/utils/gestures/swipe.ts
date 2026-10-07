import { batch, onCleanup } from "solid-js";

export type SwipeOptions = {
	onSwipeRight?: (dx: number) => void;
	onSwipeLeft?: (dx: number) => void;
	onSwipeMove?: (dx: number | null) => void;
	threshold?: number;
	commitRatio?: number;
	velocity?: number;
	enabled?: () => boolean;
	canSwipe?: (dx: number) => boolean;
};

const VELOCITY_WINDOW = 120;
const LOCK_DISTANCE = 10;
const HORIZONTAL_BIAS = 1.3;
const FLICK_MIN_DISTANCE = 24;

const walkUp = (
	target: EventTarget | null,
	root: HTMLElement,
	predicate: (node: HTMLElement) => boolean,
) => {
	let node = target as HTMLElement | null;
	while (node && node !== root) {
		if (predicate(node)) return true;
		node = node.parentElement;
	}
	return false;
};

const isInMediaPlayer = (target: EventTarget | null, root: HTMLElement) =>
	walkUp(target, root, (node) => !!node.tagName?.startsWith("MEDIA-"));

const blocksSwipeInDirection = (
	target: EventTarget | null,
	root: HTMLElement,
	dx: number,
) =>
	walkUp(target, root, (node) => {
		const maxScroll = node.scrollWidth - node.clientWidth;
		if (maxScroll <= 1) return false;
		const overflowX = getComputedStyle(node).overflowX;
		if (overflowX !== "auto" && overflowX !== "scroll") return false;
		return dx < 0 ? node.scrollLeft < maxScroll - 1 : node.scrollLeft > 1;
	});

export const createSwipe = (element: HTMLElement, options: SwipeOptions) => {
	const velocity = options.velocity ?? 0.35;

	let startX = 0;
	let startY = 0;
	let startTarget: EventTarget | null = null;
	let tracking = false;
	let locked: boolean | null = null;
	let claimed = false;
	let samples: { x: number; t: number }[] = [];
	let moveFrame: number | null = null;
	let pendingDx = 0;
	let clickSwallow: ((event: MouseEvent) => void) | null = null;

	const cancelMoveFrame = () => {
		if (moveFrame === null) return;
		cancelAnimationFrame(moveFrame);
		moveFrame = null;
	};

	const clearClickSwallow = () => {
		if (!clickSwallow) return;
		element.removeEventListener("click", clickSwallow, { capture: true });
		clickSwallow = null;
	};

	const suppressNextClick = () => {
		clearClickSwallow();
		clickSwallow = (event: MouseEvent) => {
			clickSwallow = null;
			event.preventDefault();
			event.stopPropagation();
		};
		element.addEventListener("click", clickSwallow, {
			capture: true,
			once: true,
		});
	};

	const reset = () => {
		cancelMoveFrame();
		tracking = false;
		locked = null;
		claimed = false;
		startTarget = null;
		samples = [];
	};

	const onPointerDown = (event: PointerEvent) => {
		reset();
		clearClickSwallow();
		if (options.enabled && !options.enabled()) return;
		if (event.pointerType === "mouse") return;
		if (isInMediaPlayer(event.target, element)) return;
		startX = event.clientX;
		startY = event.clientY;
		startTarget = event.target;
		tracking = true;
		samples = [{ x: event.clientX, t: performance.now() }];
	};

	const onPointerMove = (event: PointerEvent) => {
		if (!tracking) return;
		const dx = event.clientX - startX;
		const dy = event.clientY - startY;

		if (locked === null) {
			if (Math.hypot(dx, dy) < LOCK_DISTANCE) return;
			locked = Math.abs(dx) > Math.abs(dy) * HORIZONTAL_BIAS;
			if (!locked) {
				tracking = false;
				return;
			}
			const wantsDirection =
				dx < 0 ? !!options.onSwipeLeft : !!options.onSwipeRight;
			if (!wantsDirection) {
				tracking = false;
				return;
			}
			if (options.canSwipe && !options.canSwipe(dx)) {
				tracking = false;
				return;
			}
			if (blocksSwipeInDirection(startTarget, element, dx)) {
				tracking = false;
				return;
			}
			claimed = true;
		}

		if (!claimed) return;
		event.stopPropagation();
		const now = performance.now();
		samples.push({ x: event.clientX, t: now });
		while (samples.length > 2 && now - samples[0].t > VELOCITY_WINDOW) {
			samples.shift();
		}
		pendingDx = dx;
		if (moveFrame !== null) return;
		moveFrame = requestAnimationFrame(() => {
			moveFrame = null;
			options.onSwipeMove?.(pendingDx);
		});
	};

	const onPointerUp = (event: PointerEvent) => {
		if (!tracking || !claimed) {
			reset();
			return;
		}
		event.stopPropagation();
		const dx = event.clientX - startX;
		const commitDistance = options.commitRatio
			? element.clientWidth * options.commitRatio
			: (options.threshold ?? 60);
		const first = samples[0];
		const last = samples[samples.length - 1];
		const elapsed = last.t - first.t;
		const vx = elapsed > 0 ? (last.x - first.x) / elapsed : 0;
		const flick = Math.abs(vx) > velocity && Math.abs(dx) > FLICK_MIN_DISTANCE;
		batch(() => {
			if (dx > commitDistance || (flick && vx > 0)) options.onSwipeRight?.(dx);
			else if (dx < -commitDistance || (flick && vx < 0))
				options.onSwipeLeft?.(dx);
			options.onSwipeMove?.(null);
		});
		suppressNextClick();
		reset();
	};

	const onPointerCancel = () => {
		if (claimed) options.onSwipeMove?.(null);
		reset();
	};

	element.addEventListener("pointerdown", onPointerDown, { passive: true });
	element.addEventListener("pointermove", onPointerMove, { passive: true });
	element.addEventListener("pointerup", onPointerUp, { passive: true });
	element.addEventListener("pointercancel", onPointerCancel, { passive: true });

	onCleanup(() => {
		cancelMoveFrame();
		clearClickSwallow();
		element.removeEventListener("pointerdown", onPointerDown);
		element.removeEventListener("pointermove", onPointerMove);
		element.removeEventListener("pointerup", onPointerUp);
		element.removeEventListener("pointercancel", onPointerCancel);
	});
};
