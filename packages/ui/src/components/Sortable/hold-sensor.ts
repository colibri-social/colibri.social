import { type Id, useDragDropContext } from "@thisbeyond/solid-dnd";
import { onCleanup, onMount } from "solid-js";
import { useHaptics } from "../../utils/haptics";

type Coordinates = { x: number; y: number };

const POINTER_ACTIVATION_DISTANCE = 4;
const HOLD_DELAY_MS = 400;
const HOLD_SLOP = 10;
const HOLD_DRAG_DISTANCE = 4;

const isHoldPointer = (pointerType: string) =>
	pointerType === "touch" || pointerType === "pen";

export const createHoldSensor = (id: Id = "hold-sensor") => {
	const context = useDragDropContext();
	if (!context) throw new Error("createHoldSensor needs a DragDropProvider");
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
	] = context;
	const haptics = useHaptics();

	const origin: Coordinates = { x: 0, y: 0 };
	let draggableId: Id | null = null;
	let holdTimer: ReturnType<typeof setTimeout> | undefined;
	let armed = false;
	let dragging = false;
	let holding = false;

	const isActive = () => state.active.sensorId === id;

	const clearSelection = () => window.getSelection()?.removeAllRanges();

	const blockTouchScroll = (event: TouchEvent) => {
		if (armed) event.preventDefault();
	};

	const listen = () => {
		document.addEventListener("pointermove", onMove, { passive: false });
		document.addEventListener("pointerup", onUp);
		document.addEventListener("pointercancel", onCancel);
		document.addEventListener("dragstart", onCancel);
	};

	const unlisten = () => {
		if (holdTimer) clearTimeout(holdTimer);
		holdTimer = undefined;
		document.removeEventListener("pointermove", onMove);
		document.removeEventListener("pointerup", onUp);
		document.removeEventListener("pointercancel", onCancel);
		document.removeEventListener("dragstart", onCancel);
		document.removeEventListener("touchmove", blockTouchScroll);
		document.removeEventListener("selectionchange", clearSelection);
	};

	const reset = () => {
		unlisten();
		armed = false;
		dragging = false;
		holding = false;
		draggableId = null;
	};

	const begin = () => {
		if (state.active.sensor || draggableId === null) return;
		if (!state.sensors[id]) return;
		dragging = true;
		sensorStart(id, { ...origin });
		dragStart(draggableId);
		clearSelection();
		document.addEventListener("selectionchange", clearSelection);
	};

	const attach = (event: PointerEvent, target: Id) => {
		if (event.button !== 0 || state.active.sensor) return;
		draggableId = target;
		origin.x = event.clientX;
		origin.y = event.clientY;
		armed = false;
		dragging = false;
		holding = isHoldPointer(event.pointerType);
		listen();
		if (holding) {
			holdTimer = setTimeout(() => {
				holdTimer = undefined;
				armed = true;
				haptics.impact("medium");
				document.addEventListener("touchmove", blockTouchScroll, {
					passive: false,
				});
			}, HOLD_DELAY_MS);
		}
	};

	const onMove = (event: PointerEvent) => {
		const point = { x: event.clientX, y: event.clientY };
		const distance = Math.hypot(point.x - origin.x, point.y - origin.y);
		if (!dragging) {
			if (holding) {
				if (!armed) {
					if (distance > HOLD_SLOP) reset();
					return;
				}
				if (distance < HOLD_DRAG_DISTANCE) return;
			} else if (distance < POINTER_ACTIVATION_DISTANCE) {
				return;
			}
			begin();
		}
		if (isActive()) {
			event.preventDefault();
			sensorMove(point);
		}
	};

	const finish = () => {
		const wasActive = dragging && isActive();
		reset();
		if (wasActive) {
			dragEnd();
			sensorEnd();
		}
	};

	const onUp = () => finish();
	const onCancel = () => finish();

	onMount(() => {
		addSensor({ id, activators: { pointerdown: attach } });
	});

	onCleanup(() => {
		reset();
		removeSensor(id);
	});
};
