import { createEffect, onCleanup } from "solid-js";

export type LongPressOptions = {
	onLongPress: (event: PointerEvent) => void;
	delay?: number;
	moveCancel?: number;
	enabled?: () => boolean;
	shouldStart?: (event: PointerEvent) => boolean;
};

const SUPPRESS_WINDOW = 700;

export const createLongPress = (
	element: HTMLElement,
	options: LongPressOptions,
) => {
	const delay = options.delay ?? 400;
	const moveCancel = options.moveCancel ?? 12;

	let startX = 0;
	let startY = 0;
	let pressing = false;
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
		suppressing = false;
	};

	const startSuppressing = () => {
		suppressClickUntil = performance.now() + SUPPRESS_WINDOW;
		if (suppressTimer !== undefined) clearTimeout(suppressTimer);
		suppressTimer = window.setTimeout(stopSuppressing, SUPPRESS_WINDOW + 50);
		if (suppressing) return;
		document.addEventListener("click", onClickCapture, { capture: true });
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
		const target = event.target as Node | null;
		if (!target || !element.contains(target)) return;
		event.stopPropagation();
		event.preventDefault();
		suppressClickUntil = 0;
		stopSuppressing();
	};

	const onPointerDown = (event: PointerEvent) => {
		if (!isEnabled()) return;
		if (event.pointerType === "mouse") return;
		if (options.shouldStart && !options.shouldStart(event)) return;
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
		if (!pressing || moved) return;
		lastEvent = event;
		if (
			Math.hypot(event.clientX - startX, event.clientY - startY) > moveCancel
		) {
			moved = true;
			disarm();
		}
	};

	const onPointerEnd = () => {
		pressing = false;
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

	element.addEventListener("pointerdown", onPointerDown, { passive: true });
	element.addEventListener("pointermove", onPointerMove, { passive: true });
	element.addEventListener("pointerup", onPointerEnd);
	element.addEventListener("pointercancel", onPointerEnd, { passive: true });
	element.addEventListener("contextmenu", onContextMenu);
	element.addEventListener("selectstart", onSelectStart);

	onCleanup(() => {
		disarm();
		stopSuppressing();
		element.removeEventListener("pointerdown", onPointerDown);
		element.removeEventListener("pointermove", onPointerMove);
		element.removeEventListener("pointerup", onPointerEnd);
		element.removeEventListener("pointercancel", onPointerEnd);
		element.removeEventListener("contextmenu", onContextMenu);
		element.removeEventListener("selectstart", onSelectStart);
	});
};
