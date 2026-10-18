import { createEffect, onCleanup } from "solid-js";
import { stopScrollMotion } from "./stop-scroll";

export type LongPressOptions = {
	onLongPress: (event: PointerEvent) => void;
	delay?: number;
	moveCancel?: number;
	enabled?: () => boolean;
	shouldStart?: (event: PointerEvent) => boolean;
};

const SUPPRESS_WINDOW = 700;

const PASSIVE_CAPTURE = { capture: true, passive: true } as const;

export const createLongPress = (
	element: HTMLElement,
	options: LongPressOptions,
) => {
	const delay = options.delay ?? 400;
	const moveCancel = options.moveCancel ?? 12;

	let startX = 0;
	let startY = 0;
	let pressing = false;
	let pointerId: number | undefined;
	let moved = false;
	let lastEvent: PointerEvent | undefined;
	let armTimer: number | undefined;
	let suppressTimer: number | undefined;
	let suppressClickUntil = 0;
	let suppressing = false;

	const isEnabled = () => !options.enabled || options.enabled();

	const disarm = () => {
		if (armTimer === undefined) return;
		clearTimeout(armTimer);
		armTimer = undefined;
	};

	const stopSuppressing = () => {
		if (suppressTimer !== undefined) {
			clearTimeout(suppressTimer);
			suppressTimer = undefined;
		}
		if (!suppressing) return;
		document.removeEventListener("click", onClickCapture, { capture: true });
		document.removeEventListener("pointerdown", stopSuppressing, true);
		suppressing = false;
	};

	const startSuppressing = () => {
		suppressClickUntil = performance.now() + SUPPRESS_WINDOW;
		if (suppressTimer !== undefined) clearTimeout(suppressTimer);
		suppressTimer = window.setTimeout(stopSuppressing, SUPPRESS_WINDOW + 50);
		if (suppressing) return;
		document.addEventListener("click", onClickCapture, { capture: true });
		document.addEventListener("pointerdown", stopSuppressing, true);
		suppressing = true;
	};

	const fire = (event: PointerEvent) => {
		startSuppressing();
		options.onLongPress(event);
	};

	const onClickCapture = (event: MouseEvent) => {
		if (performance.now() > suppressClickUntil) {
			stopSuppressing();
			return;
		}
		event.stopPropagation();
		event.preventDefault();
		suppressClickUntil = 0;
		stopSuppressing();
	};

	const onPointerDown = (event: PointerEvent) => {
		if (!isEnabled()) return;
		if (event.pointerType === "mouse") return;
		if (options.shouldStart && !options.shouldStart(event)) return;
		pointerId = event.pointerId;
		stopScrollMotion(element);
		listen();
		startX = event.clientX;
		startY = event.clientY;
		pressing = true;
		moved = false;
		lastEvent = event;
		disarm();
		armTimer = window.setTimeout(() => {
			armTimer = undefined;
			if (pressing && !moved && lastEvent) fire(lastEvent);
		}, delay);
	};

	const onPointerMove = (event: PointerEvent) => {
		if (!pressing || moved || event.pointerId !== pointerId) return;
		lastEvent = event;
		if (
			Math.hypot(event.clientX - startX, event.clientY - startY) > moveCancel
		) {
			moved = true;
			disarm();
		}
	};

	const onPointerEnd = (event: PointerEvent) => {
		if (event.pointerId !== pointerId) return;
		pressing = false;
		unlisten();
		disarm();
	};

	const onContextMenu = (event: Event) => {
		if (!isEnabled()) return;
		event.preventDefault();
	};

	const onSelectStart = (event: Event) => {
		if (!isEnabled()) return;
		event.preventDefault();
	};

	createEffect(() => {
		const value = isEnabled() ? "none" : "";
		element.style.setProperty("-webkit-touch-callout", value);
		element.style.setProperty("user-select", value);
		element.style.setProperty("-webkit-user-select", value);
	});

	let listening = false;

	const listen = () => {
		if (listening) return;
		listening = true;
		document.addEventListener("pointermove", onPointerMove, PASSIVE_CAPTURE);
		document.addEventListener("pointerup", onPointerEnd, PASSIVE_CAPTURE);
		document.addEventListener("pointercancel", onPointerEnd, PASSIVE_CAPTURE);
	};

	const unlisten = () => {
		if (!listening) return;
		listening = false;
		document.removeEventListener("pointermove", onPointerMove, PASSIVE_CAPTURE);
		document.removeEventListener("pointerup", onPointerEnd, PASSIVE_CAPTURE);
		document.removeEventListener(
			"pointercancel",
			onPointerEnd,
			PASSIVE_CAPTURE,
		);
	};

	element.addEventListener("pointerdown", onPointerDown, { passive: true });
	element.addEventListener("contextmenu", onContextMenu);
	element.addEventListener("selectstart", onSelectStart);

	onCleanup(() => {
		disarm();
		stopSuppressing();
		element.removeEventListener("pointerdown", onPointerDown);
		unlisten();
		element.removeEventListener("contextmenu", onContextMenu);
		element.removeEventListener("selectstart", onSelectStart);
	});
};
