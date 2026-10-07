import { createEffect, onCleanup } from "solid-js";

export type DoubleTapOptions = {
	onDoubleTap: (event: PointerEvent) => void;
	delay?: number;
	moveTolerance?: number;
	maxTapDuration?: number;
	enabled?: () => boolean;
};

const CLICK_SUPPRESS_MS = 500;
const TAP_SLOP = 32;

export const createDoubleTap = (
	element: HTMLElement,
	options: DoubleTapOptions,
) => {
	const delay = options.delay ?? 300;
	const moveTolerance = options.moveTolerance ?? 10;
	const maxTapDuration = options.maxTapDuration ?? 350;

	const isEnabled = () => !options.enabled || options.enabled();

	let startX = 0;
	let startY = 0;
	let startT = 0;
	let pressing = false;
	let moved = false;
	let lastTapAt = Number.NEGATIVE_INFINITY;
	let lastTapX = 0;
	let lastTapY = 0;
	let suppressClickUntil = 0;

	const onClickCapture = (event: MouseEvent) => {
		if (performance.now() > suppressClickUntil) return;
		const target = event.target as Node | null;
		if (!target || !element.contains(target)) return;
		event.stopPropagation();
		event.preventDefault();
		suppressClickUntil = 0;
	};

	const onPointerDown = (event: PointerEvent) => {
		if (!isEnabled()) return;
		if (event.pointerType === "mouse") return;
		startX = event.clientX;
		startY = event.clientY;
		startT = performance.now();
		pressing = true;
		moved = false;
	};

	const onPointerMove = (event: PointerEvent) => {
		if (!pressing || moved) return;
		if (
			Math.hypot(event.clientX - startX, event.clientY - startY) > moveTolerance
		) {
			moved = true;
		}
	};

	const onPointerUp = (event: PointerEvent) => {
		if (!pressing) return;
		pressing = false;
		const now = performance.now();
		const isValidTap = !moved && now - startT <= maxTapDuration;
		if (!isValidTap) {
			lastTapAt = Number.NEGATIVE_INFINITY;
			return;
		}
		const gap = startT - lastTapAt;
		const nearPrevious =
			Math.hypot(startX - lastTapX, startY - lastTapY) <= TAP_SLOP;
		if (gap >= 0 && gap <= delay && nearPrevious) {
			lastTapAt = Number.NEGATIVE_INFINITY;
			suppressClickUntil = now + CLICK_SUPPRESS_MS;
			options.onDoubleTap(event);
			return;
		}
		lastTapAt = now;
		lastTapX = startX;
		lastTapY = startY;
	};

	const onPointerCancel = () => {
		pressing = false;
	};

	let applied = false;
	createEffect(() => {
		const enabled = isEnabled();
		if (!enabled && !applied) return;
		applied = enabled;
		element.style.touchAction = enabled ? "manipulation" : "";
		element.style.setProperty("user-select", enabled ? "none" : "");
		element.style.setProperty("-webkit-user-select", enabled ? "none" : "");
	});

	element.addEventListener("pointerdown", onPointerDown, { passive: true });
	element.addEventListener("pointermove", onPointerMove, { passive: true });
	element.addEventListener("pointerup", onPointerUp);
	element.addEventListener("pointercancel", onPointerCancel, { passive: true });
	document.addEventListener("click", onClickCapture, { capture: true });

	onCleanup(() => {
		element.removeEventListener("pointerdown", onPointerDown);
		element.removeEventListener("pointermove", onPointerMove);
		element.removeEventListener("pointerup", onPointerUp);
		element.removeEventListener("pointercancel", onPointerCancel);
		document.removeEventListener("click", onClickCapture, { capture: true });
	});
};
