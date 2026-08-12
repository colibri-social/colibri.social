import { batch, onCleanup } from "solid-js";

export interface SwipeOptions {
	onSwipeRight?: (dx: number) => void;
	onSwipeLeft?: (dx: number) => void;
	onSwipeMove?: (dx: number | null) => void;
	threshold?: number;
	commitRatio?: number;
	velocity?: number;
	enabled?: () => boolean;
	/**
	 * Consulted once the gesture's axis and direction are known. Returning false
	 * leaves the gesture completely alone — no drag feedback and no propagation
	 * suppression — so a single direction can be switched off without it looking
	 * merely blocked, and without the recognizer swallowing the touch.
	 */
	canSwipe?: (dx: number) => boolean;
}

const VELOCITY_WINDOW = 120;

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

/**
 * Media players own their horizontal gestures (seeking, volume), so a touch
 * that starts inside one never becomes a swipe.
 */
const isInMediaPlayer = (target: EventTarget | null, root: HTMLElement) =>
	walkUp(target, root, (node) => !!node.tagName?.startsWith("MEDIA-"));

/**
 * True when an ancestor is a horizontal scroller that still has room to scroll
 * in the gesture's direction, in which case the scroll wins.
 *
 * This deliberately takes the direction and the current scroll position into
 * account rather than just asking "is anything scrollable here". A container
 * that only sets `overflow-y` computes its `overflow-x` to `auto` per CSS
 * Overflow 3, so a single overflowing child used to make the whole subtree
 * swipe-proof — which is how one stray wide message could kill the pane swipe
 * for an entire channel. It also means a scroller that is already pinned to
 * its edge hands the gesture on instead of swallowing it.
 */
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

export const createSwipe = (el: HTMLElement, opts: SwipeOptions) => {
	const velocity = opts.velocity ?? 0.35;

	let startX = 0;
	let startY = 0;
	let startTarget: EventTarget | null = null;
	let tracking = false;
	let locked: boolean | null = null; // null = undecided, true = horizontal
	let claimed = false; // true once this gesture's direction is one we handle
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
		el.removeEventListener("click", clickSwallow, { capture: true });
		clickSwallow = null;
	};

	const suppressNextClick = () => {
		clearClickSwallow();
		clickSwallow = (event: MouseEvent) => {
			clickSwallow = null;
			event.preventDefault();
			event.stopPropagation();
		};
		el.addEventListener("click", clickSwallow, { capture: true, once: true });
	};

	const reset = () => {
		cancelMoveFrame();
		tracking = false;
		locked = null;
		claimed = false;
		startTarget = null;
		samples = [];
	};

	const onPointerDown = (e: PointerEvent) => {
		// Always clear first. A nested recognizer that claimed the previous
		// gesture stops propagation on pointerup, so this one can still be left
		// mid-gesture with a stale `startX` — and the early returns below would
		// otherwise preserve it into the next touch.
		reset();
		clearClickSwallow();
		if (opts.enabled && !opts.enabled()) return;
		if (e.pointerType === "mouse") return;
		if (isInMediaPlayer(e.target, el)) return;
		startX = e.clientX;
		startY = e.clientY;
		startTarget = e.target;
		tracking = true;
		samples = [{ x: e.clientX, t: performance.now() }];
	};

	const onPointerMove = (e: PointerEvent) => {
		if (!tracking) return;
		const dx = e.clientX - startX;
		const dy = e.clientY - startY;

		if (locked === null) {
			if (Math.hypot(dx, dy) < 10) return;
			locked = Math.abs(dx) > Math.abs(dy) * 1.3;
			if (!locked) {
				tracking = false;
				return;
			}
			const wantsThisDirection =
				dx < 0 ? !!opts.onSwipeLeft : !!opts.onSwipeRight;
			if (!wantsThisDirection) {
				// Not interested in this direction
				tracking = false;
				return;
			}
			if (opts.canSwipe && !opts.canSwipe(dx)) {
				tracking = false;
				return;
			}
			// The direction is only known now, which is why this check lives here
			// rather than on pointerdown.
			if (blocksSwipeInDirection(startTarget, el, dx)) {
				tracking = false;
				return;
			}
			claimed = true;
		}

		if (!claimed) return;
		e.stopPropagation();
		const now = performance.now();
		samples.push({ x: e.clientX, t: now });
		while (samples.length > 2 && now - samples[0].t > VELOCITY_WINDOW) {
			samples.shift();
		}
		pendingDx = dx;
		if (moveFrame !== null) return;
		moveFrame = requestAnimationFrame(() => {
			moveFrame = null;
			opts.onSwipeMove?.(pendingDx);
		});
	};

	const onPointerUp = (e: PointerEvent) => {
		if (!tracking || !claimed) {
			reset();
			return;
		}
		e.stopPropagation();
		const dx = e.clientX - startX;
		// Read layout before the batch — this forces a reflow, which would defeat
		// the point of coalescing the writes below.
		const commitDist = opts.commitRatio
			? el.clientWidth * opts.commitRatio
			: (opts.threshold ?? 60);
		const first = samples[0];
		const last = samples[samples.length - 1];
		const dt = last.t - first.t;
		const vx = dt > 0 ? (last.x - first.x) / dt : 0;
		const flick = Math.abs(vx) > velocity && Math.abs(dx) > 24;
		// The commit and the drag release have to land in one style recalculation.
		// The commit is what moves every pane's resting offset, so if a forced
		// layout read sneaks in between the two, the panes get painted with the
		// new resting offset and the stale drag offset — a full viewport of jump.
		batch(() => {
			if (dx > commitDist || (flick && vx > 0)) opts.onSwipeRight?.(dx);
			else if (dx < -commitDist || (flick && vx < 0)) opts.onSwipeLeft?.(dx);
			opts.onSwipeMove?.(null);
		});
		suppressNextClick();
		reset();
	};

	const onPointerCancel = () => {
		if (claimed) opts.onSwipeMove?.(null);
		reset();
	};

	el.addEventListener("pointerdown", onPointerDown, { passive: true });
	el.addEventListener("pointermove", onPointerMove, { passive: true });
	el.addEventListener("pointerup", onPointerUp, { passive: true });
	el.addEventListener("pointercancel", onPointerCancel, { passive: true });

	onCleanup(() => {
		cancelMoveFrame();
		clearClickSwallow();
		el.removeEventListener("pointerdown", onPointerDown);
		el.removeEventListener("pointermove", onPointerMove);
		el.removeEventListener("pointerup", onPointerUp);
		el.removeEventListener("pointercancel", onPointerCancel);
	});
};
