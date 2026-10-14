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

const PASSIVE_CAPTURE = { capture: true, passive: true } as const;

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
	let pointerId: number | undefined;
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
		pointerId = event.pointerId;
		listen();
		startX = event.clientX;
		startY = event.clientY;
		startT = performance.now();
		pressing = true;
		moved = false;
	};

	const onPointerMove = (event: PointerEvent) => {
		if (!pressing || moved || event.pointerId !== pointerId) return;
		if (
			Math.hypot(event.clientX - startX, event.clientY - startY) > moveTolerance
		) {
			moved = true;
		}
	};

	const onPointerUp = (event: PointerEvent) => {
		if (!pressing || event.pointerId !== pointerId) return;
		pressing = false;
		unlisten();
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

	const onPointerCancel = (event: PointerEvent) => {
		if (event.pointerId !== pointerId) return;
		pressing = false;
		unlisten();
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

	let listening = false;

	const listen = () => {
		if (listening) return;
		listening = true;
		document.addEventListener("pointermove", onPointerMove, PASSIVE_CAPTURE);
		document.addEventListener("pointerup", onPointerUp, PASSIVE_CAPTURE);
		document.addEventListener(
			"pointercancel",
			onPointerCancel,
			PASSIVE_CAPTURE,
		);
	};

	const unlisten = () => {
		if (!listening) return;
		listening = false;
		document.removeEventListener("pointermove", onPointerMove, PASSIVE_CAPTURE);
		document.removeEventListener("pointerup", onPointerUp, PASSIVE_CAPTURE);
		document.removeEventListener(
			"pointercancel",
			onPointerCancel,
			PASSIVE_CAPTURE,
		);
	};

	element.addEventListener("pointerdown", onPointerDown, { passive: true });
	document.addEventListener("click", onClickCapture, { capture: true });

	onCleanup(() => {
		element.removeEventListener("pointerdown", onPointerDown);
		unlisten();
		document.removeEventListener("click", onClickCapture, { capture: true });
	});
};
