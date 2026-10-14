import { blockTouchScroll } from "@colibri-social/ui";
import { createVelocityTracker } from "./velocity";

export type SheetDragHandlers = {
	enabled: () => boolean;
	onStart: () => void;
	onMove: (dy: number) => void;
	onEnd: (dy: number, velocity: number) => void;
};

export const SHEET_HANDLE_ZONE = 72;
const CLAIM_PX = 8;
const AXIS_RATIO = 1.2;

const inHandle = (event: PointerEvent, root: HTMLElement) => {
	const target = event.target;
	if (target instanceof Element && target.closest("[data-sheet-handle]")) {
		return true;
	}
	const top = root.getBoundingClientRect().top;
	const safeTop =
		Number.parseFloat(
			getComputedStyle(root).getPropertyValue("--safe-area-top"),
		) || 0;
	return event.clientY - top <= SHEET_HANDLE_ZONE + safeTop;
};

export const bindSheetDrag = (
	root: HTMLElement,
	handlers: SheetDragHandlers,
) => {
	const tracker = createVelocityTracker();
	let pointerId: number | null = null;
	let startX = 0;
	let startY = 0;
	let claimed = false;
	let swallowClick = false;

	const reset = () => {
		pointerId = null;
		claimed = false;
		tracker.reset();
	};

	const onDown = (event: PointerEvent) => {
		if (!event.isPrimary || event.button > 0 || !handlers.enabled()) return;
		swallowClick = false;
		if (!inHandle(event, root)) return;
		pointerId = event.pointerId;
		startX = event.clientX;
		startY = event.clientY;
		claimed = false;
		tracker.reset();
		tracker.add(event.clientY, event.timeStamp);
	};

	const onMove = (event: PointerEvent) => {
		if (event.pointerId !== pointerId) return;
		const dx = event.clientX - startX;
		const dy = event.clientY - startY;
		tracker.add(event.clientY, event.timeStamp);
		if (!claimed) {
			if (Math.abs(dx) > CLAIM_PX && Math.abs(dx) > Math.abs(dy)) {
				reset();
				return;
			}
			if (dy < CLAIM_PX || dy < Math.abs(dx) * AXIS_RATIO) return;
			claimed = true;
			try {
				root.setPointerCapture?.(event.pointerId);
			} catch {}
			handlers.onStart();
		}
		handlers.onMove(dy);
	};

	const onUp = (event: PointerEvent) => {
		if (event.pointerId !== pointerId) return;
		if (claimed) {
			swallowClick = true;
			handlers.onEnd(event.clientY - startY, tracker.velocity(event.timeStamp));
		}
		reset();
	};

	const onClick = (event: MouseEvent) => {
		if (!swallowClick) return;
		swallowClick = false;
		event.preventDefault();
		event.stopPropagation();
	};

	const unblock = blockTouchScroll(root, () => claimed);
	root.addEventListener("pointerdown", onDown);
	root.addEventListener("pointermove", onMove);
	root.addEventListener("pointerup", onUp);
	root.addEventListener("pointercancel", onUp);
	root.addEventListener("click", onClick, true);
	return () => {
		unblock();
		root.removeEventListener("pointerdown", onDown);
		root.removeEventListener("pointermove", onMove);
		root.removeEventListener("pointerup", onUp);
		root.removeEventListener("pointercancel", onUp);
		root.removeEventListener("click", onClick, true);
	};
};
