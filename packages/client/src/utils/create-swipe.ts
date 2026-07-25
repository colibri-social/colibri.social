import { onCleanup } from "solid-js";

export interface SwipeOptions {
	onSwipeRight?: () => void;
	onSwipeLeft?: () => void;
	onSwipeMove?: (dx: number | null) => void;
	threshold?: number;
	commitRatio?: number;
	velocity?: number;
	enabled?: () => boolean;
}

const VELOCITY_WINDOW = 120;

const isInScrollableX = (target: EventTarget | null, root: HTMLElement) => {
	let node = target as HTMLElement | null;
	while (node && node !== root) {
		if (node.tagName?.startsWith("MEDIA-")) return true;
		if (node.scrollWidth > node.clientWidth + 1) {
			const overflowX = getComputedStyle(node).overflowX;
			if (overflowX === "auto" || overflowX === "scroll") return true;
		}
		node = node.parentElement;
	}
	return false;
};

export const createSwipe = (el: HTMLElement, opts: SwipeOptions) => {
	const velocity = opts.velocity ?? 0.35;

	let startX = 0;
	let startY = 0;
	let tracking = false;
	let locked: boolean | null = null; // null = undecided, true = horizontal
	let claimed = false; // true once this gesture's direction is one we handle
	let samples: { x: number; t: number }[] = [];

	const reset = () => {
		tracking = false;
		locked = null;
		claimed = false;
		samples = [];
	};

	const onPointerDown = (e: PointerEvent) => {
		if (opts.enabled && !opts.enabled()) return;
		if (e.pointerType === "mouse") return;
		if (isInScrollableX(e.target, el)) return;
		startX = e.clientX;
		startY = e.clientY;
		tracking = true;
		locked = null;
		claimed = false;
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
			claimed = true;
		}

		if (!claimed) return;
		e.stopPropagation();
		const now = performance.now();
		samples.push({ x: e.clientX, t: now });
		while (samples.length > 2 && now - samples[0].t > VELOCITY_WINDOW) {
			samples.shift();
		}
		opts.onSwipeMove?.(dx);
	};

	const onPointerUp = (e: PointerEvent) => {
		if (!tracking || !claimed) {
			reset();
			return;
		}
		e.stopPropagation();
		const dx = e.clientX - startX;
		const commitDist = opts.commitRatio
			? el.clientWidth * opts.commitRatio
			: (opts.threshold ?? 60);
		const first = samples[0];
		const last = samples[samples.length - 1];
		const dt = last.t - first.t;
		const vx = dt > 0 ? (last.x - first.x) / dt : 0;
		const flick = Math.abs(vx) > velocity && Math.abs(dx) > 24;
		if (dx > commitDist || (flick && vx > 0)) opts.onSwipeRight?.();
		else if (dx < -commitDist || (flick && vx < 0)) opts.onSwipeLeft?.();
		opts.onSwipeMove?.(null);
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
		el.removeEventListener("pointerdown", onPointerDown);
		el.removeEventListener("pointermove", onPointerMove);
		el.removeEventListener("pointerup", onPointerUp);
		el.removeEventListener("pointercancel", onPointerCancel);
	});
};
