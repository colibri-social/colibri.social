export type PressPoint = { x: number; y: number };

export type ReorderPressOptions = {
	event: PointerEvent;
	element: HTMLElement;
	canDrag: boolean;
	immediate?: boolean;
	onHold?: (event: PointerEvent) => void;
	onLift: (origin: PressPoint, pointerType: string) => void;
	onMove: (point: PressPoint) => void;
	onRelease: (moved: boolean) => void;
	onCancel: () => void;
};

export type ReorderPress = {
	cancel: () => void;
};

export const HOLD_DELAY_MS = 400;
export const HOLD_SLOP = 10;
export const POINTER_ACTIVATION_DISTANCE = 4;
export const HOLD_MOVE_DISTANCE = 6;
const CLICK_SUPPRESS_MS = 700;

export const isHoldPointer = (pointerType: string) =>
	pointerType === "touch" || pointerType === "pen";

let suppressUntil = 0;
let suppressTarget: HTMLElement | undefined;

const swallowClick = (event: MouseEvent) => {
	const target = suppressTarget;
	if (performance.now() > suppressUntil || !target) {
		document.removeEventListener("click", swallowClick, true);
		suppressTarget = undefined;
		return;
	}
	if (!(event.target instanceof Node) || !target.contains(event.target)) return;
	event.preventDefault();
	event.stopPropagation();
	suppressUntil = 0;
	suppressTarget = undefined;
	document.removeEventListener("click", swallowClick, true);
};

export const suppressNextClick = (element: HTMLElement) => {
	suppressUntil = performance.now() + CLICK_SUPPRESS_MS;
	suppressTarget = element;
	document.addEventListener("click", swallowClick, true);
};

const root = () => document.documentElement.style;

const lockDocument = (pointerType: string) => {
	const style = root();
	const previous = {
		userSelect: style.userSelect,
		webkitUserSelect: style.getPropertyValue("-webkit-user-select"),
		callout: style.getPropertyValue("-webkit-touch-callout"),
		touchAction: style.touchAction,
		cursor: style.cursor,
	};
	style.userSelect = "none";
	style.setProperty("-webkit-user-select", "none");
	style.setProperty("-webkit-touch-callout", "none");
	style.touchAction = "none";
	if (pointerType === "mouse") style.cursor = "grabbing";
	window.getSelection()?.removeAllRanges();
	return () => {
		style.userSelect = previous.userSelect;
		style.setProperty("-webkit-user-select", previous.webkitUserSelect);
		style.setProperty("-webkit-touch-callout", previous.callout);
		style.touchAction = previous.touchAction;
		style.cursor = previous.cursor;
	};
};

export const startReorderPress = (
	options: ReorderPressOptions,
): ReorderPress => {
	const { event } = options;
	const pointerId = event.pointerId;
	const pointerType = event.pointerType || "mouse";
	const origin = { x: event.clientX, y: event.clientY };
	let current = { ...origin };
	let liftPoint = { ...origin };
	const hold = isHoldPointer(pointerType) && !options.immediate;
	let holdTimer: ReturnType<typeof setTimeout> | undefined;
	let lifted = false;
	let moved = false;
	let done = false;
	let unlock: (() => void) | undefined;
	const seen = new WeakSet<Event>();
	const anchors = [
		...new Set(
			[options.element, event.target].filter(
				(node): node is EventTarget => node instanceof EventTarget,
			),
		),
	];
	const once =
		<E extends Event>(handler: (event: E) => void) =>
		(incoming: E) => {
			if (seen.has(incoming)) return;
			seen.add(incoming);
			handler(incoming);
		};

	const blockTouch = (touch: TouchEvent) => {
		if (touch.cancelable) touch.preventDefault();
	};
	const blockContextMenu = (menu: Event) => {
		menu.preventDefault();
		menu.stopPropagation();
	};
	const clearSelection = () => window.getSelection()?.removeAllRanges();

	const teardown = () => {
		done = true;
		if (holdTimer) clearTimeout(holdTimer);
		holdTimer = undefined;
		for (const target of [document, ...anchors]) {
			target.removeEventListener("pointermove", handleMove, true);
			target.removeEventListener("pointerup", handleUp, true);
			target.removeEventListener("pointercancel", handleSystemCancel, true);
			target.removeEventListener("touchmove", handleTouch);
		}
		document.removeEventListener("pointerdown", onOtherPointer, true);
		document.removeEventListener("dragstart", blockContextMenu, true);
		document.removeEventListener("selectionchange", clearSelection);
		document.removeEventListener("keydown", onKeyDown, true);
		document.removeEventListener("visibilitychange", onSystemCancel);
		window.removeEventListener("blur", onSystemCancel);
		unlock?.();
		unlock = undefined;
		if (isHoldPointer(pointerType))
			setTimeout(
				() =>
					document.removeEventListener("contextmenu", blockContextMenu, true),
				CLICK_SUPPRESS_MS,
			);
		else document.removeEventListener("contextmenu", blockContextMenu, true);
	};

	const lift = () => {
		if (done || lifted) return;
		lifted = true;
		liftPoint = { ...current };
		moved = !hold;
		suppressNextClick(options.element);
		unlock = lockDocument(pointerType);
		for (const target of [document, ...anchors])
			target.addEventListener("touchmove", handleTouch, { passive: false });
		document.addEventListener("selectionchange", clearSelection);
		document.addEventListener("keydown", onKeyDown, true);
		if (pointerType === "mouse") {
			try {
				options.element.setPointerCapture(pointerId);
			} catch {}
		}
		options.onLift(liftPoint, pointerType);
	};

	const cancel = () => {
		if (done) return;
		const wasLifted = lifted;
		teardown();
		if (wasLifted) options.onCancel();
	};

	const onMove = (move: PointerEvent) => {
		if (move.pointerId !== pointerId) return;
		const point = { x: move.clientX, y: move.clientY };
		current = point;
		const distance = Math.hypot(point.x - origin.x, point.y - origin.y);
		if (!lifted) {
			if (hold) {
				if (distance > HOLD_SLOP) teardown();
				return;
			}
			if (distance < POINTER_ACTIVATION_DISTANCE) return;
			if (!options.canDrag) {
				teardown();
				return;
			}
			lift();
		}
		if (move.cancelable) move.preventDefault();
		if (
			!moved &&
			Math.hypot(point.x - liftPoint.x, point.y - liftPoint.y) >=
				HOLD_MOVE_DISTANCE
		)
			moved = true;
		options.onMove(point);
	};

	const onUp = (up: PointerEvent) => {
		if (up.pointerId !== pointerId) return;
		const wasLifted = lifted;
		teardown();
		if (wasLifted) options.onRelease(moved);
	};

	const onSystemCancel = () => cancel();

	const onOtherPointer = (down: PointerEvent) => {
		if (down.pointerId === pointerId) return;
		cancel();
	};

	const handleMove = once(onMove) as EventListener;
	const handleUp = once(onUp) as EventListener;
	const handleSystemCancel = once(onSystemCancel) as EventListener;
	const handleTouch = once(blockTouch) as EventListener;

	const onKeyDown = (key: KeyboardEvent) => {
		if (key.key !== "Escape") return;
		key.preventDefault();
		key.stopPropagation();
		cancel();
	};

	for (const target of [document, ...anchors]) {
		target.addEventListener("pointermove", handleMove, {
			capture: true,
			passive: false,
		});
		target.addEventListener("pointerup", handleUp, true);
		target.addEventListener("pointercancel", handleSystemCancel, true);
	}
	document.addEventListener("pointerdown", onOtherPointer, true);
	document.addEventListener("dragstart", blockContextMenu, true);
	document.addEventListener("visibilitychange", onSystemCancel);
	window.addEventListener("blur", onSystemCancel);
	if (isHoldPointer(pointerType))
		document.addEventListener("contextmenu", blockContextMenu, true);

	if (hold) {
		holdTimer = setTimeout(() => {
			holdTimer = undefined;
			if (done) return;
			if (options.canDrag) {
				lift();
				return;
			}
			suppressNextClick(options.element);
			teardown();
			options.onHold?.(event);
		}, HOLD_DELAY_MS);
	}

	return { cancel };
};
