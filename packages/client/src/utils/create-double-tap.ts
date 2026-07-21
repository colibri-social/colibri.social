import { onCleanup } from "solid-js";

export interface DoubleTapOptions {
	onDoubleTap: (e: PointerEvent) => void;
	delay?: number;
	moveTolerance?: number;
	maxTapDuration?: number;
	enabled?: () => boolean;
}

/**
 * Touch/pen double-tap detector. Mouse pointers are ignored, matching
 * `create-long-press.ts`.
 */
export const createDoubleTap = (el: HTMLElement, opts: DoubleTapOptions) => {
	const delay = opts.delay ?? 300;
	const moveTolerance = opts.moveTolerance ?? 10;
	const maxTapDuration = opts.maxTapDuration ?? 350;

	const isEnabled = () => !opts.enabled || opts.enabled();

	let startX = 0;
	let startY = 0;
	let startT = 0;
	let pressing = false;
	let moved = false;
	let lastTapAt = -Infinity;
	let suppressClickUntil = 0;

	const onClickCapture = (e: MouseEvent) => {
		if (performance.now() > suppressClickUntil) return;
		const target = e.target as Node | null;
		if (!target || !el.contains(target)) return;
		e.stopPropagation();
		e.preventDefault();
		suppressClickUntil = 0;
	};

	const onPointerDown = (e: PointerEvent) => {
		if (!isEnabled()) return;
		if (e.pointerType === "mouse") return;
		startX = e.clientX;
		startY = e.clientY;
		startT = performance.now();
		pressing = true;
		moved = false;
	};

	const onPointerMove = (e: PointerEvent) => {
		if (!pressing || moved) return;
		if (Math.hypot(e.clientX - startX, e.clientY - startY) > moveTolerance) {
			moved = true;
		}
	};

	const onPointerUp = (e: PointerEvent) => {
		if (!pressing) return;
		pressing = false;
		const now = performance.now();
		const isValidTap = !moved && now - startT <= maxTapDuration;
		if (!isValidTap) {
			lastTapAt = -Infinity;
			return;
		}
		if (now - lastTapAt <= delay) {
			lastTapAt = -Infinity;
			suppressClickUntil = now + 500;
			opts.onDoubleTap(e);
		} else {
			lastTapAt = now;
		}
	};

	const onPointerCancel = () => {
		pressing = false;
	};

	el.addEventListener("pointerdown", onPointerDown, { passive: true });
	el.addEventListener("pointermove", onPointerMove, { passive: true });
	el.addEventListener("pointerup", onPointerUp);
	el.addEventListener("pointercancel", onPointerCancel, { passive: true });
	document.addEventListener("click", onClickCapture, { capture: true });

	onCleanup(() => {
		el.removeEventListener("pointerdown", onPointerDown);
		el.removeEventListener("pointermove", onPointerMove);
		el.removeEventListener("pointerup", onPointerUp);
		el.removeEventListener("pointercancel", onPointerCancel);
		document.removeEventListener("click", onClickCapture, { capture: true });
	});
};
