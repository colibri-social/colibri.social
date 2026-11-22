import {
	closestCenter,
	createSortable,
	DragDropProvider,
	type DragEvent,
	type Id,
	SortableProvider,
	transformStyle,
	useDragDropContext,
} from "@thisbeyond/solid-dnd";
import {
	type Accessor,
	createSignal,
	For,
	type JSX,
	onCleanup,
	type ParentProps,
} from "solid-js";
import { cx } from "../../utils/cx";
import { useHaptics } from "../../utils/haptics";
import { prefersReducedMotion } from "../../utils/motion";
import { createHoldSensor } from "./hold-sensor";

export const moveItem = <T,>(items: readonly T[], from: number, to: number) => {
	const next = [...items];
	const [moved] = next.splice(from, 1);
	next.splice(to, 0, moved);
	return next;
};

export type SortableHandleProps = {
	ref: (element: HTMLElement) => void;
	"data-sortable-handle": string;
	"aria-roledescription": string;
	"aria-describedby": string;
	"aria-pressed": boolean;
	onKeyDown: (event: KeyboardEvent) => void;
	onBlur: () => void;
};

export type SortableItemControls = {
	index: Accessor<number>;
	dragging: Accessor<boolean>;
	grabbed: Accessor<boolean>;
	handleProps: SortableHandleProps;
};

export type SortableListProps<T> = {
	items: readonly T[];
	getId: (item: T) => string;
	itemLabel: (item: T) => string;
	onReorder: (ids: string[]) => void;
	children: (item: T, controls: SortableItemControls) => JSX.Element;
	disabled?: boolean;
	class?: string;
	itemClass?: string;
	"aria-label"?: string;
};

let instructionsCount = 0;

const Sensors = (props: ParentProps) => {
	createHoldSensor();
	return props.children;
};

const SortableItem = <T,>(props: {
	item: T;
	id: string;
	index: Accessor<number>;
	disabled: boolean;
	class?: string;
	controls: Omit<SortableItemControls, "dragging" | "index">;
	render: (item: T, controls: SortableItemControls) => JSX.Element;
}) => {
	const sortable = createSortable(props.id);
	const context = useDragDropContext();
	const anyDragging = () => !!context?.[0].active.draggableId;
	const style = (): JSX.CSSProperties => {
		const transform = sortable.transform;
		const settled = transform.x === 0 && transform.y === 0;
		return {
			...(settled ? {} : transformStyle({ x: 0, y: transform.y })),
			transition:
				sortable.isActiveDraggable || !anyDragging() || prefersReducedMotion()
					? undefined
					: "transform calc(200ms * var(--motion-scale)) cubic-bezier(0.2, 0, 0, 1)",
		};
	};

	return (
		<li
			ref={sortable.ref}
			data-sortable-item={props.id}
			data-dragging={sortable.isActiveDraggable || undefined}
			{...(props.disabled ? {} : sortable.dragActivators)}
			style={style()}
			class={cx(
				"relative touch-pan-y select-none",
				sortable.isActiveDraggable && "z-10 cursor-grabbing",
				props.class,
			)}
		>
			{props.render(props.item, {
				...props.controls,
				index: props.index,
				dragging: () => sortable.isActiveDraggable,
			})}
		</li>
	);
};

export const SortableList = <T,>(props: SortableListProps<T>) => {
	const haptics = useHaptics();
	const instructionsId = `sortable-instructions-${++instructionsCount}`;
	const [announcement, setAnnouncement] = createSignal("");
	const [grabbedId, setGrabbedId] = createSignal<string>();
	let grabbedFrom = -1;
	let moving = false;
	let grabbedOrder: string[] = [];
	const handles = new Map<string, HTMLElement>();

	const ids = () => props.items.map((item) => props.getId(item));
	const labelFor = (id: string) => {
		const item = props.items.find((entry) => props.getId(entry) === id);
		return item === undefined ? id : props.itemLabel(item);
	};
	const position = (index: number) =>
		`position ${index + 1} of ${props.items.length}`;

	const announce = (message: string) => {
		setAnnouncement("");
		queueMicrotask(() => setAnnouncement(message));
	};

	const refocus = (id: string) => {
		const handle = handles.get(id);
		handle?.focus({ preventScroll: false });
		if (document.activeElement === handle) return;
		moving = true;
		requestAnimationFrame(() => {
			handles.get(id)?.focus({ preventScroll: false });
			moving = false;
		});
	};

	const moveBy = (id: string, delta: number) => {
		const order = ids();
		const from = order.indexOf(id);
		const to = Math.max(0, Math.min(order.length - 1, from + delta));
		if (from === to || from < 0) return;
		props.onReorder(moveItem(order, from, to));
		haptics.selection();
		announce(`${labelFor(id)} moved to ${position(to)}.`);
		refocus(id);
	};

	const drop = (id: string) => {
		setGrabbedId(undefined);
		announce(`${labelFor(id)} dropped at ${position(ids().indexOf(id))}.`);
	};

	const cancel = (id: string) => {
		setGrabbedId(undefined);
		props.onReorder(grabbedOrder);
		announce(
			`Reorder cancelled. ${labelFor(id)} returned to ${position(grabbedFrom)}.`,
		);
		refocus(id);
	};

	const onHandleKeyDown = (id: string, event: KeyboardEvent) => {
		if (props.disabled) return;
		const grabbed = grabbedId() === id;
		if (event.key === " " || event.key === "Enter") {
			event.preventDefault();
			if (grabbed) {
				drop(id);
				return;
			}
			grabbedOrder = ids();
			grabbedFrom = grabbedOrder.indexOf(id);
			setGrabbedId(id);
			haptics.selection();
			announce(
				`Picked up ${labelFor(id)}, ${position(grabbedFrom)}. Use the arrow keys to move it, Space to drop it, Escape to cancel.`,
			);
			return;
		}
		if (!grabbed) return;
		if (event.key === "ArrowUp") {
			event.preventDefault();
			moveBy(id, -1);
		} else if (event.key === "ArrowDown") {
			event.preventDefault();
			moveBy(id, 1);
		} else if (event.key === "Home") {
			event.preventDefault();
			moveBy(id, -ids().indexOf(id));
		} else if (event.key === "End") {
			event.preventDefault();
			moveBy(id, ids().length - 1 - ids().indexOf(id));
		} else if (event.key === "Escape") {
			event.preventDefault();
			event.stopPropagation();
			cancel(id);
		}
	};

	const onDragStart = ({ draggable }: DragEvent) => {
		const id = String(draggable.id);
		setGrabbedId(undefined);
		haptics.selection();
		announce(`Picked up ${labelFor(id)}, ${position(ids().indexOf(id))}.`);
	};

	const onDragEnd = ({ draggable, droppable }: DragEvent) => {
		const id = String(draggable.id);
		const order = ids();
		const from = order.indexOf(id);
		const to = droppable ? order.indexOf(String(droppable.id)) : from;
		if (from >= 0 && to >= 0 && from !== to) {
			props.onReorder(moveItem(order, from, to));
			haptics.selection();
		}
		announce(`${labelFor(id)} dropped at ${position(to < 0 ? from : to)}.`);
	};

	onCleanup(() => handles.clear());

	return (
		<div data-sortable-list="">
			<span id={instructionsId} class="sr-only">
				Press Space to pick up an item. Use the arrow keys to move it, Space to
				drop it, and Escape to cancel. On touch, press and hold to drag.
			</span>
			<span role="status" aria-live="assertive" class="sr-only">
				{announcement()}
			</span>
			<DragDropProvider
				collisionDetector={closestCenter}
				onDragStart={onDragStart}
				onDragEnd={onDragEnd}
			>
				<Sensors>
					<SortableProvider ids={ids() as Id[]}>
						<ol
							aria-label={props["aria-label"]}
							class={cx("m-0 flex list-none flex-col p-0", props.class)}
						>
							<For each={props.items}>
								{(item, index) => {
									const id = props.getId(item);
									return (
										<SortableItem
											item={item}
											id={id}
											index={index}
											disabled={!!props.disabled}
											class={props.itemClass}
											render={props.children}
											controls={{
												grabbed: () => grabbedId() === id,
												handleProps: {
													ref: (element: HTMLElement) =>
														handles.set(id, element),
													"data-sortable-handle": id,
													"aria-roledescription": "sortable",
													"aria-describedby": instructionsId,
													get "aria-pressed"() {
														return grabbedId() === id;
													},
													onKeyDown: (event: KeyboardEvent) =>
														onHandleKeyDown(id, event),
													onBlur: () => {
														if (grabbedId() !== id || moving) return;
														queueMicrotask(() => {
															if (
																!moving &&
																grabbedId() === id &&
																document.activeElement !== handles.get(id)
															) {
																drop(id);
															}
														});
													},
												},
											}}
										/>
									);
								}}
							</For>
						</ol>
					</SortableProvider>
				</Sensors>
			</DragDropProvider>
		</div>
	);
};
