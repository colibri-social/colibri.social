import { onCleanup } from "solid-js";

export interface SwipeOptions {
	onSwipeRight?: () => void;
	onSwipeLeft?: () => void;
	threshold?: number;
	velocity?: number;
	enabled?: () => boolean;
}

const isInScrollableX = (target: EventTarget | null, root: HTMLElement) => {
	let node = target as HTMLElement | null;
	while (node && node !== root) {
		if (node.tagName?.startsWith("MEDIA-")) return true;
		const style = getComputedStyle(node);
		if (
			(style.overflowX === "auto" || style.overflowX === "scroll") &&
			node.scrollWidth > node.clientWidth + 1
		) {
			return true;
		}
		node = node.parentElement;
	}
	return false;
};

export const createSwipe = (el: HTMLElement, opts: SwipeOptions) => {
	const threshold = opts.threshold ?? 60;
	const velocity = opts.velocity ?? 0.3;

	let startX = 0;
	let startY = 0;
	let startT = 0;
	let tracking = false;
	let locked: boolean | null = null; // null = undecided, true = horizontal

	const onPointerDown = (e: PointerEvent) => {
		if (opts.enabled && !opts.enabled()) return;
		if (e.pointerType === "mouse") return;
		if (isInScrollableX(e.target, el)) return;
		startX = e.clientX;
		startY = e.clientY;
		startT = performance.now();
		tracking = true;
		locked = null;
	};

	const onPointerMove = (e: PointerEvent) => {
		if (!tracking || locked !== null) return;
		const dx = e.clientX - startX;
		const dy = e.clientY - startY;
		if (Math.hypot(dx, dy) < 10) return;
		locked = Math.abs(dx) > Math.abs(dy) * 1.3;
		if (!locked) tracking = false;
	};

	const onPointerUp = (e: PointerEvent) => {
		if (!tracking || !locked) {
			tracking = false;
			return;
		}
		tracking = false;
		const dx = e.clientX - startX;
		const dt = performance.now() - startT;
		const flick = Math.abs(dx) / dt > velocity && Math.abs(dx) > 24;
		if (dx > threshold || (flick && dx > 0)) opts.onSwipeRight?.();
		else if (dx < -threshold || (flick && dx < 0)) opts.onSwipeLeft?.();
	};

	const onPointerCancel = () => {
		tracking = false;
		locked = null;
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
