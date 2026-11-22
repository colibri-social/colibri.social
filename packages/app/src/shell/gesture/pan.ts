import { blockTouchScroll } from "@colibri-social/ui";
import { decideAxis } from "./direction-lock";
import { createVelocityTracker } from "./velocity";

export type PanDirection = "back" | "forward";

export type PanHandlers = {
	enabled: () => boolean;
	allow: (direction: PanDirection, target: EventTarget | null) => boolean;
	onPress: () => void;
	onRelease: () => void;
	onStart: (direction: PanDirection) => void;
	onMove: (dx: number) => void;
	onEnd: (dx: number, velocity: number) => void;
	onCancel: () => void;
};

const OWN_GESTURE_SELECTOR =
	'[data-gesture="own"], input[type="range"], [role="slider"], [contenteditable="true"], textarea';

const ownsGesture = (target: EventTarget | null) =>
	target instanceof Element && !!target.closest(OWN_GESTURE_SELECTOR);

const inMediaPlayer = (target: EventTarget | null, root: HTMLElement) => {
	let node = target as HTMLElement | null;
	while (node && node !== root) {
		if (node.tagName?.startsWith("MEDIA-")) return true;
		node = node.parentElement;
	}
	return false;
};

const scrollsHorizontally = (
	target: EventTarget | null,
	root: HTMLElement,
	dx: number,
) => {
	let node = target as HTMLElement | null;
	while (node && node !== root) {
		const range = node.scrollWidth - node.clientWidth;
		if (range > 1) {
			const overflow = getComputedStyle(node).overflowX;
			if (overflow === "auto" || overflow === "scroll") {
				const canScroll =
					dx < 0 ? node.scrollLeft < range - 1 : node.scrollLeft > 1;
				if (canScroll) return true;
			}
		}
		node = node.parentElement;
	}
	return false;
};

const PENDING_TIMEOUT_MS = 300;

export const bindPan = (root: HTMLElement, handlers: PanHandlers) => {
	const tracker = createVelocityTracker();
	let pressedAt = 0;
	let pointerId: number | null = null;
	let startX = 0;
	let startY = 0;
	let lockX = 0;
	let target: EventTarget | null = null;
	let state: "idle" | "pending" | "dragging" = "idle";
	let horizontalId: number | null = null;

	const swallowClick = () => {
		const release = () => {
			root.removeEventListener("click", swallow, { capture: true });
			window.removeEventListener("pointerdown", release, true);
			clearTimeout(timer);
		};
		const swallow = (event: MouseEvent) => {
			event.preventDefault();
			event.stopPropagation();
			release();
		};
		root.addEventListener("click", swallow, { capture: true });
		window.addEventListener("pointerdown", release, true);
		const timer = setTimeout(release, 400);
	};

	const finish = () => {
		if (pointerId !== null && root.hasPointerCapture(pointerId)) {
			try {
				root.releasePointerCapture(pointerId);
			} catch {}
		}
		pointerId = null;
		target = null;
		state = "idle";
		tracker.reset();
	};

	const onPointerDown = (event: PointerEvent) => {
		if (state === "dragging" || !event.isPrimary) return;
		if (state === "pending") {
			finish();
			handlers.onRelease();
		}
		if (event.pointerType === "mouse" && event.button !== 0) return;
		if (!handlers.enabled()) return;
		if (ownsGesture(event.target) || inMediaPlayer(event.target, root)) return;
		pointerId = event.pointerId;
		startX = event.clientX;
		startY = event.clientY;
		target = event.target;
		state = "pending";
		pressedAt = event.timeStamp;
		tracker.add(event.clientX, event.timeStamp);
		handlers.onPress();
	};

	const onPointerMove = (event: PointerEvent) => {
		if (event.pointerId !== pointerId || state === "idle") return;
		if (state === "pending") {
			const dx = event.clientX - startX;
			const axis = decideAxis(dx, event.clientY - startY);
			if (axis === null) {
				if (event.timeStamp - pressedAt > PENDING_TIMEOUT_MS) {
					finish();
					handlers.onRelease();
				}
				return;
			}
			if (event.timeStamp - pressedAt > PENDING_TIMEOUT_MS) {
				finish();
				handlers.onRelease();
				return;
			}
			const direction: PanDirection = dx > 0 ? "back" : "forward";
			const nativeScroll =
				axis === "vertical" || scrollsHorizontally(target, root, dx);
			if (!nativeScroll) horizontalId = event.pointerId;
			if (nativeScroll || !handlers.allow(direction, target)) {
				finish();
				handlers.onRelease();
				return;
			}
			state = "dragging";
			lockX = event.clientX;
			try {
				root.setPointerCapture(event.pointerId);
			} catch {}
			handlers.onStart(direction);
		}
		const samples = event.getCoalescedEvents?.() ?? [];
		for (const sample of samples.length ? samples : [event]) {
			tracker.add(sample.clientX, sample.timeStamp);
		}
		handlers.onMove(event.clientX - lockX);
	};

	const onPointerUp = (event: PointerEvent) => {
		if (event.pointerId !== pointerId) return;
		if (state === "dragging") {
			tracker.add(event.clientX, event.timeStamp);
			const velocity = tracker.velocity(event.timeStamp);
			const dx = event.clientX - lockX;
			finish();
			swallowClick();
			handlers.onEnd(dx, velocity);
			return;
		}
		finish();
		handlers.onRelease();
	};

	const onPointerCancel = (event: PointerEvent) => {
		if (event.pointerId !== pointerId) return;
		const wasDragging = state === "dragging";
		finish();
		if (wasDragging) handlers.onCancel();
		else handlers.onRelease();
	};

	const onTouchEnd = (event: TouchEvent) => {
		if (event.touches.length === 0) horizontalId = null;
	};

	root.addEventListener("pointerdown", onPointerDown);
	root.addEventListener("pointermove", onPointerMove);
	const unblock = blockTouchScroll(root, () => horizontalId !== null);
	window.addEventListener("touchend", onTouchEnd, true);
	window.addEventListener("touchcancel", onTouchEnd, true);
	window.addEventListener("pointerup", onPointerUp, true);
	window.addEventListener("pointercancel", onPointerCancel, true);

	return () => {
		root.removeEventListener("pointerdown", onPointerDown);
		root.removeEventListener("pointermove", onPointerMove);
		unblock();
		window.removeEventListener("touchend", onTouchEnd, true);
		window.removeEventListener("touchcancel", onTouchEnd, true);
		window.removeEventListener("pointerup", onPointerUp, true);
		window.removeEventListener("pointercancel", onPointerCancel, true);
	};
};
