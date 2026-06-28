import { useDragDropContext } from "@thisbeyond/solid-dnd";
import { onCleanup, onMount, type ParentComponent } from "solid-js";
import { isMobileNow } from "./mobile-pane";

type Coordinates = { x: number; y: number };

const ACTIVATION_DELAY = 250;
const ACTIVATION_DISTANCE = 10;

const HOLD_DELAY = 400;
const EARLY_MOVE_CANCEL = 10;
const DRAG_START_DISTANCE = 12;

/**
 * A drop-in replacement for solid-dnd's `createPointerSensor`
 */
export const createLongPressSensor = (
	id: string | number = "pointer-sensor",
) => {
	const [
		state,
		{
			addSensor,
			removeSensor,
			sensorStart,
			sensorMove,
			sensorEnd,
			dragStart,
			dragEnd,
		},
	] = useDragDropContext()!;

	onMount(() => {
		addSensor({ id, activators: { pointerdown: attach } });
	});
	onCleanup(() => {
		removeSensor(id);
	});

	const isActiveSensor = () => state.active.sensorId === id;
	const initialCoordinates: Coordinates = { x: 0, y: 0 };
	let activationTimeoutId: number | null = null;
	let activationDraggableId: string | number | null = null;

	let armed = false;
	let dragging = false;

	const attach = (event: PointerEvent, draggableId: string | number) => {
		if (event.button !== 0) return;
		activationDraggableId = draggableId;
		initialCoordinates.x = event.clientX;
		initialCoordinates.y = event.clientY;

		const mobileTouch = event.pointerType !== "mouse" && isMobileNow();
		if (mobileTouch) {
			armed = false;
			dragging = false;
			document.addEventListener("pointermove", onMobileMove, { passive: true });
			document.addEventListener("pointerup", onMobileUp);
			document.addEventListener("pointercancel", onMobileCancel);
			activationTimeoutId = window.setTimeout(onArm, HOLD_DELAY);
			return;
		}

		document.addEventListener("pointermove", onPointerMove);
		document.addEventListener("pointerup", onPointerUp);
		activationTimeoutId = window.setTimeout(onActivate, ACTIVATION_DELAY);
	};

	const detach = () => {
		if (activationTimeoutId) {
			clearTimeout(activationTimeoutId);
			activationTimeoutId = null;
		}
		document.removeEventListener("pointermove", onPointerMove);
		document.removeEventListener("pointerup", onPointerUp);
		document.removeEventListener("selectionchange", clearSelection);
	};

	const onActivate = () => {
		if (!state.active.sensor) {
			sensorStart(id, { ...initialCoordinates });
			dragStart(activationDraggableId!);
			clearSelection();
			document.addEventListener("selectionchange", clearSelection);
		} else if (!isActiveSensor()) {
			detach();
		}
	};

	const onPointerMove = (event: PointerEvent) => {
		const coordinates = { x: event.clientX, y: event.clientY };
		if (!state.active.sensor) {
			const dist = Math.hypot(
				coordinates.x - initialCoordinates.x,
				coordinates.y - initialCoordinates.y,
			);
			if (dist > ACTIVATION_DISTANCE) onActivate();
		}
		if (isActiveSensor()) {
			event.preventDefault();
			sensorMove(coordinates);
		}
	};

	const onPointerUp = (event: PointerEvent) => {
		detach();
		if (isActiveSensor()) {
			event.preventDefault();
			dragEnd();
			sensorEnd();
		}
	};

	const detachMobile = () => {
		if (activationTimeoutId) {
			clearTimeout(activationTimeoutId);
			activationTimeoutId = null;
		}
		document.removeEventListener("pointermove", onMobileMove);
		document.removeEventListener("pointerup", onMobileUp);
		document.removeEventListener("pointercancel", onMobileCancel);
		document.removeEventListener("touchmove", blockTouchScroll);
		document.removeEventListener("selectionchange", clearSelection);
	};

	const blockTouchScroll = (event: TouchEvent) => {
		if (armed) event.preventDefault();
	};

	const onArm = () => {
		armed = true;
		activationTimeoutId = null;
		document.addEventListener("touchmove", blockTouchScroll, {
			passive: false,
		});
	};

	const onMobileMove = (event: PointerEvent) => {
		const coordinates = { x: event.clientX, y: event.clientY };
		const dist = Math.hypot(
			coordinates.x - initialCoordinates.x,
			coordinates.y - initialCoordinates.y,
		);
		if (!armed) {
			if (dist > EARLY_MOVE_CANCEL) detachMobile();
			return;
		}
		if (!dragging) {
			if (dist < DRAG_START_DISTANCE) return;
			dragging = true;
			sensorStart(id, { ...initialCoordinates });
			dragStart(activationDraggableId!);
			clearSelection();
			document.addEventListener("selectionchange", clearSelection);
		}
		if (isActiveSensor()) sensorMove(coordinates);
	};

	const onMobileUp = () => {
		const wasDragging = dragging;
		detachMobile();
		armed = false;
		dragging = false;
		if (wasDragging && isActiveSensor()) {
			dragEnd();
			sensorEnd();
		}
	};

	const onMobileCancel = () => {
		const wasDragging = dragging;
		detachMobile();
		armed = false;
		dragging = false;
		if (wasDragging && isActiveSensor()) {
			dragEnd();
			sensorEnd();
		}
	};

	const clearSelection = () => {
		window.getSelection()?.removeAllRanges();
	};
};

export const LongPressSensors: ParentComponent = (props) => {
	createLongPressSensor();
	return props.children;
};
