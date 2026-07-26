import { createEffect, onCleanup } from "solid-js";

export interface LongPressOptions {
	onLongPress: (e: PointerEvent) => void;
	delay?: number;
	moveCancel?: number;
	enabled?: () => boolean;
}

/**
 * Touch/pen long-press detector. Mouse pointers are ignored so desktop is
 * untouched (desktop uses right-click menus)
 */
export const createLongPress = (el: HTMLElement, opts: LongPressOptions) => {
	const delay = opts.delay ?? 400;
	const moveCancel = opts.moveCancel ?? 12;

	let startX = 0;
	let startY = 0;
	let pressing = false;
	let moved = false;
	let lastEvent: PointerEvent | undefined;
	let armTimer: number | undefined;
	let suppressTimer: number | undefined;
	let suppressClickUntil = 0;
	let suppressing = false;

	const SUPPRESS_WINDOW = 700;

	const isEnabled = () => !opts.enabled || opts.enabled();

	const disarm = () => {
		if (armTimer !== undefined) {
			clearTimeout(armTimer);
			armTimer = undefined;
		}
	};

	// Only listen on `document` while a long press has actually fired. This used
	// to be attached for the lifetime of every element the primitive was applied
	// to, which meant one document-wide capture listener per message and per
	// member row.
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
		// The click that follows a long press may never arrive — whatever the press
		// opened can swallow it — so give the listener a hard expiry too.
		suppressTimer = window.setTimeout(stopSuppressing, SUPPRESS_WINDOW + 50);
		if (suppressing) return;
		document.addEventListener("click", onClickCapture, { capture: true });
		suppressing = true;
	};

	const fire = (e: PointerEvent) => {
		startSuppressing();
		opts.onLongPress(e);
	};

	const onClickCapture = (e: MouseEvent) => {
		if (performance.now() > suppressClickUntil) {
			stopSuppressing();
			return;
		}
		const target = e.target as Node | null;
		if (!target || !el.contains(target)) return;
		e.stopPropagation();
		e.preventDefault();
		suppressClickUntil = 0;
		stopSuppressing();
	};

	const onPointerDown = (e: PointerEvent) => {
		if (!isEnabled()) return;
		if (e.pointerType === "mouse") return;
		startX = e.clientX;
		startY = e.clientY;
		pressing = true;
		moved = false;
		lastEvent = e;
		disarm();
		armTimer = window.setTimeout(() => {
			armTimer = undefined;
			if (pressing && !moved && lastEvent) fire(lastEvent);
		}, delay);
	};

	const onPointerMove = (e: PointerEvent) => {
		if (!pressing || moved) return;
		lastEvent = e;
		if (Math.hypot(e.clientX - startX, e.clientY - startY) > moveCancel) {
			moved = true;
			disarm();
		}
	};

	const onPointerUp = () => {
		pressing = false;
		disarm();
	};

	const onPointerCancel = () => {
		pressing = false;
		disarm();
	};

	const onContextMenu = (e: Event) => {
		if (!isEnabled()) return;
		e.preventDefault();
	};

	const onSelectStart = (e: Event) => {
		if (!isEnabled()) return;
		e.preventDefault();
	};

	createEffect(() => {
		const value = isEnabled() ? "none" : "";
		el.style.setProperty("-webkit-touch-callout", value);
		el.style.setProperty("user-select", value);
		el.style.setProperty("-webkit-user-select", value);
	});

	el.addEventListener("pointerdown", onPointerDown, { passive: true });
	el.addEventListener("pointermove", onPointerMove, { passive: true });
	el.addEventListener("pointerup", onPointerUp);
	el.addEventListener("pointercancel", onPointerCancel, { passive: true });
	el.addEventListener("contextmenu", onContextMenu);
	el.addEventListener("selectstart", onSelectStart);

	onCleanup(() => {
		disarm();
		stopSuppressing();
		el.removeEventListener("pointerdown", onPointerDown);
		el.removeEventListener("pointermove", onPointerMove);
		el.removeEventListener("pointerup", onPointerUp);
		el.removeEventListener("pointercancel", onPointerCancel);
		el.removeEventListener("contextmenu", onContextMenu);
		el.removeEventListener("selectstart", onSelectStart);
	});
};
