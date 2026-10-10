import { GripVerticalIcon } from "@solar-icons/solid/bold/grip-vertical";
import { AltArrowDownIcon } from "@solar-icons/solid/linear/alt-arrow-down";
import { AltArrowUpIcon } from "@solar-icons/solid/linear/alt-arrow-up";
import {
	type Accessor,
	batch,
	createEffect,
	createMemo,
	createSignal,
	For,
	type JSX,
	on,
	onCleanup,
	Show,
} from "solid-js";
import { cx } from "../../utils/cx";
import { type Haptics, useHaptics } from "../../utils/haptics";
import { prefersReducedMotion } from "../../utils/motion";
import { Button } from "../Button/Button";
import {
	contentOffset,
	createAutoscroller,
	rubberBand,
	scrollParent,
} from "../Sortable/autoscroll";
import {
	cancelFlips,
	captureTops,
	playFlips,
	reorderSprings,
	springAnimation,
} from "../Sortable/flip";
import {
	type PressPoint,
	type ReorderPress,
	startReorderPress,
} from "../Sortable/reorder-press";
import { ChannelCategory } from "./Category";
import { CategoryEmpty } from "./ChannelRow";
import {
	type ChannelLayout,
	type ChannelReorder,
	type ChannelSlot,
	channelsIn,
	edgeChannel,
	findCategory,
	findChannel,
	placeCategory,
	placeChannel,
	positionText,
	reconcileLayout,
	sameLayout,
	sameSlot,
	stepChannel,
} from "./channel-layout";

export type ChannelListCategory<T> = {
	id: string;
	name: string;
	channels: readonly T[];
	collapsed?: boolean;
};

export type ChannelListItemState = {
	dragging: Accessor<boolean>;
	reorderMode: Accessor<boolean>;
};

export type ChannelListProps<T> = {
	categories: readonly ChannelListCategory<T>[];
	uncategorized?: readonly T[];
	getId: (channel: T) => string;
	channelName: (channel: T) => string;
	renderChannel: (channel: T, state: ChannelListItemState) => JSX.Element;
	canReorder?: boolean;
	reorderMode?: boolean;
	onReorderModeChange?: (reorderMode: boolean) => void;
	onReorder?: (change: ChannelReorder) => unknown;
	onChannelLongPress?: (channel: T, event: PointerEvent) => void;
	onCategoryLongPress?: (categoryId: string, event: PointerEvent) => void;
	onCollapsedChange?: (categoryId: string, collapsed: boolean) => void;
	onCreateChannel?: (categoryId: string) => void;
	onOpenCategorySettings?: (categoryId: string) => void;
	emptyCategoryLabel?: string;
	haptics?: Haptics;
	class?: string;
};

type DragKind = "channel" | "category";

type DragState = {
	kind: DragKind;
	id: string;
	input: "pointer" | "keyboard";
};

type Overlay = {
	place: (x: number, y: number) => void;
	fade: (away: boolean) => void;
	settle: (target: DOMRect) => Promise<void>;
	remove: () => void;
};

type Geometry = {
	uncategorized: number[];
	categories: {
		id: string;
		mid: number;
		collapsed: boolean;
		channels: number[];
	}[];
};

type Session = DragState & {
	origin: ChannelLayout;
	press?: ReorderPress;
	pressEvent?: PointerEvent;
	overlay?: Overlay;
	liftPoint: PressPoint;
	grab: PressPoint;
	left: number;
	probeOffset: number;
	pointer: PressPoint;
	scroller?: HTMLElement;
	autoscroll?: ReturnType<typeof createAutoscroller>;
	geometry?: Geometry;
	springTimer?: ReturnType<typeof setTimeout>;
	springCategory?: string;
	outside: boolean;
	settling: boolean;
};

const SPRING_LOAD_MS = 550;
const OUTSIDE_MARGIN = 48;
const RUBBER_BAND_RANGE = 120;
const LIFT_SCALE_TOUCH = 1.03;
const LIFT_SCALE_POINTER = 1.015;

let instructionsCount = 0;

const keyFor = (
	kind: "channel" | "header" | "zone" | "empty" | "slot",
	id: string,
) => `${kind}:${id}`;

const midOf = (element: HTMLElement, scroller: HTMLElement) => {
	const rect = element.getBoundingClientRect();
	return contentOffset(scroller, rect.top + rect.height / 2);
};

const stripClone = (node: HTMLElement) => {
	node.removeAttribute("id");
	node.removeAttribute("data-list-node");
	node.style.removeProperty("opacity");
	for (const child of node.querySelectorAll<HTMLElement>("[id]"))
		child.removeAttribute("id");
	for (const child of node.querySelectorAll<HTMLElement>("[data-list-node]"))
		child.removeAttribute("data-list-node");
};

const createOverlay = (
	source: HTMLElement,
	rect: DOMRect,
	grab: PressPoint,
	scale: number,
): Overlay => {
	const computed = getComputedStyle(source);
	const host = document.createElement("div");
	host.dataset.reorderOverlay = "";
	host.setAttribute("aria-hidden", "true");
	Object.assign(host.style, {
		position: "fixed",
		left: "0",
		top: "0",
		width: `${rect.width}px`,
		height: `${rect.height}px`,
		zIndex: "2147483000",
		pointerEvents: "none",
		willChange: "transform",
		transform: `translate3d(${rect.left}px, ${rect.top}px, 0)`,
		color: computed.color,
		fontFamily: computed.fontFamily,
		fontSize: computed.fontSize,
		lineHeight: computed.lineHeight,
		direction: computed.direction,
	});
	const lift = document.createElement("div");
	lift.dataset.reorderLift = "";
	Object.assign(lift.style, {
		width: "100%",
		height: "100%",
		borderRadius: "var(--radius-control-sm)",
		background: "var(--popover)",
		transformOrigin: `${grab.x}px ${grab.y}px`,
	});
	const fade = document.createElement("div");
	Object.assign(fade.style, {
		width: "100%",
		height: "100%",
		transformOrigin: `${grab.x}px ${grab.y}px`,
	});
	const clone = source.cloneNode(true) as HTMLElement;
	stripClone(clone);
	clone.inert = true;
	fade.append(clone);
	lift.append(fade);
	host.append(lift);
	document.body.append(host);

	const shadow = getComputedStyle(document.documentElement)
		.getPropertyValue("--shadow-overlay")
		.trim();
	const rest = { transform: "scale(1)", boxShadow: "0 0 0 0 transparent" };
	const raised = {
		transform: `scale(${scale})`,
		boxShadow: shadow || "0 8px 8px 2px rgb(0 0 0 / 0.25)",
	};
	if (!springAnimation(lift, [rest, raised], reorderSprings.lift))
		lift.style.boxShadow = raised.boxShadow;

	let x = rect.left;
	let y = rect.top;

	return {
		place: (nextX, nextY) => {
			x = nextX;
			y = nextY;
			host.style.transform = `translate3d(${x}px, ${y}px, 0)`;
		},
		fade: (away) => {
			const keyframes = away
				? [
						{ opacity: 1, transform: "scale(1)" },
						{ opacity: 0.55, transform: "scale(0.97)" },
					]
				: [
						{ opacity: 0.55, transform: "scale(0.97)" },
						{ opacity: 1, transform: "scale(1)" },
					];
			for (const animation of fade.getAnimations()) animation.cancel();
			if (!springAnimation(fade, keyframes, reorderSprings.lift))
				fade.style.opacity = away ? "0.55" : "1";
		},
		settle: (target) => {
			const from = `translate3d(${x}px, ${y}px, 0)`;
			const to = `translate3d(${target.left}px, ${target.top}px, 0)`;
			host.style.transform = to;
			springAnimation(lift, [raised, rest], reorderSprings.settle);
			const move = springAnimation(
				host,
				[{ transform: from }, { transform: to }],
				reorderSprings.settle,
			);
			return move ? move.finished.then(() => undefined) : Promise.resolve();
		},
		remove: () => host.remove(),
	};
};

export const ChannelList = <T,>(props: ChannelListProps<T>) => {
	const contextHaptics = useHaptics();
	const haptics = () => props.haptics ?? contextHaptics;
	const instructionsId = `channel-list-instructions-${++instructionsCount}`;
	const nodes = new Map<string, HTMLElement>();
	const handles = new Map<string, HTMLElement>();
	let root: HTMLDivElement | undefined;
	let session: Session | undefined;
	let refocusing = false;
	let commitToken = 0;
	let committedSettled = true;

	const [announcement, setAnnouncement] = createSignal("");
	const [preview, setPreview] = createSignal<ChannelLayout>();
	const [optimistic, setOptimistic] = createSignal<ChannelLayout>();
	const [drag, setDrag] = createSignal<DragState>();
	const [dragHeight, setDragHeight] = createSignal(0);
	const [springOpen, setSpringOpen] = createSignal<ReadonlySet<string>>(
		new Set(),
	);
	const [dropTarget, setDropTarget] = createSignal<string>();
	const [innerCollapsed, setInnerCollapsed] = createSignal<
		Record<string, boolean>
	>({});

	const sameOrUnset = (a: ChannelLayout | undefined, b: ChannelLayout) =>
		!!a && sameLayout(a, b);

	const propsLayout = createMemo<
		ChannelLayout,
		undefined,
		ChannelLayout | undefined
	>(
		() => ({
			uncategorized: (props.uncategorized ?? []).map((channel) =>
				props.getId(channel),
			),
			categories: props.categories.map((category) => ({
				id: category.id,
				channels: category.channels.map((channel) => props.getId(channel)),
			})),
		}),
		undefined,
		{ equals: sameOrUnset },
	);

	const layout = createMemo<
		ChannelLayout,
		undefined,
		ChannelLayout | undefined
	>(
		() => {
			const base = preview() ?? optimistic();
			return base ? reconcileLayout(base, propsLayout()) : propsLayout();
		},
		undefined,
		{ equals: sameOrUnset },
	);

	const channelsById = createMemo(() => {
		const map = new Map<string, T>();
		for (const channel of props.uncategorized ?? [])
			map.set(props.getId(channel), channel);
		for (const category of props.categories)
			for (const channel of category.channels)
				map.set(props.getId(channel), channel);
		return map;
	});

	const categoriesById = createMemo(
		() => new Map(props.categories.map((category) => [category.id, category])),
	);

	const canReorder = () => !!props.canReorder;
	const reorderMode = () => canReorder() && !!props.reorderMode;

	const baseCollapsed = (id: string) =>
		categoriesById().get(id)?.collapsed ?? innerCollapsed()[id] ?? false;

	const isCollapsed = (id: string) => {
		if (drag()?.kind === "category") return true;
		if (springOpen().has(id)) return false;
		return baseCollapsed(id);
	};

	const setCollapsed = (id: string, collapsed: boolean) => {
		setInnerCollapsed((previous) => ({ ...previous, [id]: collapsed }));
		props.onCollapsedChange?.(id, collapsed);
	};

	const announce = (message: string) => {
		setAnnouncement("");
		queueMicrotask(() => setAnnouncement(message));
	};

	const channelLabel = (id: string) => {
		const channel = channelsById().get(id);
		return channel === undefined ? id : props.channelName(channel);
	};

	const categoryLabel = (id: string) => categoriesById().get(id)?.name ?? id;

	const describeChannel = (current: ChannelLayout, id: string) => {
		const slot = findChannel(current, id);
		if (!slot) return "";
		return positionText(
			slot.index,
			channelsIn(current, slot.categoryId).length,
			slot.categoryId === null ? undefined : categoryLabel(slot.categoryId),
		);
	};

	const describeCategory = (current: ChannelLayout, id: string) =>
		`position ${findCategory(current, id) + 1} of ${current.categories.length}`;

	const describe = (kind: DragKind, current: ChannelLayout, id: string) =>
		kind === "channel"
			? describeChannel(current, id)
			: describeCategory(current, id);

	const labelFor = (kind: DragKind, id: string) =>
		kind === "channel" ? channelLabel(id) : categoryLabel(id);

	const flipEntries = () => {
		const active = session;
		return [...nodes.entries()].filter(
			([key]) =>
				!(
					active?.input === "pointer" &&
					key ===
						keyFor(active.kind === "channel" ? "channel" : "header", active.id)
				),
		);
	};

	const transition = (change: () => void) => {
		const entries = [...nodes.entries()];
		const before = captureTops(entries);
		cancelFlips(entries);
		batch(change);
		measure();
		playFlips(before, flipEntries());
	};

	const measure = () => {
		const active = session;
		if (!active?.scroller) return;
		const scroller = active.scroller;
		const current = layout();
		const mids = (ids: readonly string[]) =>
			ids
				.filter((id) => id !== active.id)
				.map((id) => nodes.get(keyFor("channel", id)))
				.filter((element): element is HTMLElement => !!element)
				.map((element) => midOf(element, scroller));
		active.geometry = {
			uncategorized: mids(current.uncategorized),
			categories: current.categories
				.filter(
					(category) =>
						!(active.kind === "category" && category.id === active.id),
				)
				.map((category) => {
					const header = nodes.get(keyFor("header", category.id));
					return {
						id: category.id,
						mid: header ? midOf(header, scroller) : 0,
						collapsed: isCollapsed(category.id),
						channels: isCollapsed(category.id) ? [] : mids(category.channels),
					};
				}),
		};
	};

	const below = (mids: number[], probe: number) =>
		mids.filter((mid) => mid < probe).length;

	const hitTest = (active: Session): ChannelSlot | number | undefined => {
		const geometry = active.geometry;
		if (!geometry || !active.scroller) return undefined;
		const overlayTop = active.pointer.y - active.grab.y;
		const probe = contentOffset(
			active.scroller,
			overlayTop + active.probeOffset,
		);
		if (active.kind === "category")
			return below(
				geometry.categories.map((category) => category.mid),
				probe,
			);
		let found = -1;
		geometry.categories.forEach((category, index) => {
			if (probe >= category.mid) found = index;
		});
		if (found < 0)
			return { categoryId: null, index: below(geometry.uncategorized, probe) };
		const category = geometry.categories[found];
		return {
			categoryId: category.id,
			index: category.collapsed
				? channelsIn(layout(), category.id).filter((id) => id !== active.id)
						.length
				: below(category.channels, probe),
		};
	};

	const clearSpring = (active: Session) => {
		if (active.springTimer) clearTimeout(active.springTimer);
		active.springTimer = undefined;
		active.springCategory = undefined;
	};

	const armSpring = (active: Session, categoryId: string | undefined) => {
		if (categoryId === active.springCategory) return;
		clearSpring(active);
		if (dropTarget() !== categoryId)
			transition(() => setDropTarget(categoryId));
		if (categoryId === undefined) return;
		active.springCategory = categoryId;
		active.springTimer = setTimeout(() => {
			active.springTimer = undefined;
			if (session !== active || active.outside) return;
			haptics().impact("light");
			transition(() => {
				setSpringOpen((open) => new Set([...open, categoryId]));
				setDropTarget(undefined);
			});
			active.springCategory = undefined;
			retarget();
		}, SPRING_LOAD_MS);
	};

	const retarget = () => {
		const active = session;
		if (!active || active.outside || active.settling) return;
		const target = hitTest(active);
		if (target === undefined) return;
		const current = layout();
		if (active.kind === "category") {
			const index = target as number;
			if (index === findCategory(current, active.id)) return;
			haptics().selection();
			transition(() => setPreview(placeCategory(current, active.id, index)));
			return;
		}
		const slot = target as ChannelSlot;
		armSpring(
			active,
			slot.categoryId !== null && isCollapsed(slot.categoryId)
				? slot.categoryId
				: undefined,
		);
		const from = findChannel(current, active.id);
		if (from && sameSlot(from, slot)) return;
		haptics().selection();
		transition(() => setPreview(placeChannel(current, active.id, slot)));
	};

	const sourceElement = (kind: DragKind, id: string) =>
		nodes.get(keyFor(kind === "channel" ? "channel" : "header", id));

	const placeholderRect = (active: Session) =>
		sourceElement(active.kind, active.id)?.getBoundingClientRect();

	const beginSession = (state: DragState, extra?: Partial<Session>) => {
		finishImmediately();
		const scroller = root ? scrollParent(root) : undefined;
		const active: Session = {
			...state,
			origin: layout(),
			liftPoint: { x: 0, y: 0 },
			grab: { x: 0, y: 0 },
			left: 0,
			probeOffset: 0,
			pointer: { x: 0, y: 0 },
			scroller,
			outside: false,
			settling: false,
			...extra,
		};
		session = active;
		return active;
	};

	const onScroll = () => retarget();

	const startPointerDrag = (
		active: Session,
		point: PressPoint,
		pointerType: string,
	) => {
		const element = sourceElement(active.kind, active.id);
		if (!element) return;
		const rect = element.getBoundingClientRect();
		active.liftPoint = point;
		active.pointer = point;
		active.grab = { x: point.x - rect.left, y: point.y - rect.top };
		active.left = rect.left;
		active.probeOffset =
			active.kind === "channel"
				? Math.min(rect.height / 2, 32)
				: rect.height / 2;
		active.overlay = createOverlay(
			element,
			rect,
			active.grab,
			pointerType === "mouse" ? LIFT_SCALE_POINTER : LIFT_SCALE_TOUCH,
		);
		if (active.scroller) {
			active.autoscroll = createAutoscroller({
				scroller: active.scroller,
				onScroll,
			});
			active.scroller.addEventListener("scroll", onScroll, { passive: true });
		}
		haptics().impact("medium");
		transition(() => {
			setDragHeight(rect.height);
			setDrag({ kind: active.kind, id: active.id, input: "pointer" });
		});
		announce(
			`Picked up ${labelFor(active.kind, active.id)}, ${describe(active.kind, active.origin, active.id)}.`,
		);
		retarget();
	};

	const movePointerDrag = (active: Session, point: PressPoint) => {
		active.pointer = point;
		active.overlay?.place(
			active.left + rubberBand(point.x - active.liftPoint.x, RUBBER_BAND_RANGE),
			point.y - active.grab.y,
		);
		const bounds = root?.getBoundingClientRect();
		const outside =
			!!bounds &&
			(point.x < bounds.left - OUTSIDE_MARGIN ||
				point.x > bounds.right + OUTSIDE_MARGIN);
		if (outside !== active.outside) {
			active.outside = outside;
			active.overlay?.fade(outside);
			haptics().impact("light");
			if (outside) {
				active.autoscroll?.stop();
				clearSpring(active);
				setDropTarget(undefined);
				transition(() => setPreview(active.origin));
				return;
			}
		}
		if (outside) return;
		active.autoscroll?.update(point.y);
		retarget();
	};

	const teardownPointer = (active: Session) => {
		active.autoscroll?.stop();
		active.scroller?.removeEventListener("scroll", onScroll);
		clearSpring(active);
	};

	const endSession = (active: Session, keepOpen?: string | null) => {
		if (session !== active) return;
		teardownPointer(active);
		active.overlay?.remove();
		session = undefined;
		const opened = springOpen();
		batch(() => {
			if (keepOpen && opened.has(keepOpen)) setCollapsed(keepOpen, false);
			setSpringOpen(new Set<string>());
			setDropTarget(undefined);
			setPreview(undefined);
			setDrag(undefined);
		});
	};

	const finishImmediately = () => {
		const active = session;
		if (!active) return;
		active.press?.cancel();
		if (active.settling) {
			endSession(active);
			return;
		}
		transition(() => setPreview(active.origin));
		endSession(active);
	};

	const settleAndEnd = (active: Session, keepOpen?: string | null) => {
		active.settling = true;
		teardownPointer(active);
		const target = placeholderRect(active);
		if (!active.overlay || !target) {
			endSession(active, keepOpen);
			return;
		}
		void active.overlay.settle(target).then(() => endSession(active, keepOpen));
	};

	const revert = (change: ChannelReorder) => {
		transition(() => setOptimistic(undefined));
		haptics().notification("error");
		announce(
			`Couldn't move ${labelFor(change.type, change.id)}. It's back at ${describe(change.type, layout(), change.id)}.`,
		);
	};

	const commit = (
		active: { kind: DragKind; id: string; origin: ChannelLayout },
		final: ChannelLayout,
	) => {
		const change: ChannelReorder =
			active.kind === "channel"
				? {
						type: "channel",
						id: active.id,
						from: findChannel(active.origin, active.id) ?? {
							categoryId: null,
							index: 0,
						},
						to: findChannel(final, active.id) ?? { categoryId: null, index: 0 },
						layout: final,
					}
				: {
						type: "category",
						id: active.id,
						from: findCategory(active.origin, active.id),
						to: findCategory(final, active.id),
						layout: final,
					};
		const token = ++commitToken;
		committedSettled = false;
		batch(() => {
			setOptimistic(final);
			setPreview(undefined);
		});
		let result: unknown;
		try {
			result = props.onReorder?.(change);
		} catch {
			revert(change);
			return;
		}
		if (result instanceof Promise) {
			result.then(
				() => {
					if (token === commitToken) committedSettled = true;
				},
				() => {
					if (token === commitToken) revert(change);
				},
			);
			return;
		}
		committedSettled = true;
	};

	createEffect(
		on(
			propsLayout,
			(actual) => {
				const pending = optimistic();
				if (!pending) return;
				if (
					committedSettled ||
					sameLayout(reconcileLayout(pending, actual), actual)
				)
					setOptimistic(undefined);
			},
			{ defer: true },
		),
	);

	const drop = (active: Session) => {
		const final = layout();
		const changed = !sameLayout(final, active.origin);
		if (changed) commit(active, final);
		else setPreview(undefined);
		haptics().impact("soft");
		announce(
			changed
				? `Moved ${labelFor(active.kind, active.id)} to ${describe(active.kind, final, active.id)}.`
				: `Dropped ${labelFor(active.kind, active.id)}. Its position didn't change.`,
		);
		const keepOpen =
			active.kind === "channel"
				? findChannel(final, active.id)?.categoryId
				: null;
		return keepOpen;
	};

	const cancelDrag = (active: Session, quiet = false) => {
		clearSpring(active);
		transition(() => setPreview(active.origin));
		if (quiet) return;
		announce(
			`Reorder cancelled. ${labelFor(active.kind, active.id)} is back at ${describe(active.kind, active.origin, active.id)}.`,
		);
	};

	const startPress = (
		event: PointerEvent,
		kind: DragKind,
		id: string,
		element: HTMLElement,
		immediate: boolean,
	) => {
		if (event.button !== 0 || !event.isPrimary) return;
		const longPress =
			kind === "channel"
				? props.onChannelLongPress &&
					((pressEvent: PointerEvent) => {
						const channel = channelsById().get(id);
						if (channel !== undefined)
							props.onChannelLongPress?.(channel, pressEvent);
					})
				: props.onCategoryLongPress &&
					((pressEvent: PointerEvent) =>
						props.onCategoryLongPress?.(id, pressEvent));
		if (!canReorder() && !longPress) return;
		if (session && !session.settling) return;
		let active: Session | undefined;
		const press = startReorderPress({
			event,
			element,
			canDrag: canReorder(),
			immediate,
			onHold: longPress,
			onLift: (point, pointerType) => {
				active = beginSession(
					{ kind, id, input: "pointer" },
					{ press, pressEvent: event },
				);
				startPointerDrag(active, point, pointerType);
			},
			onMove: (point) => {
				if (active && session === active) movePointerDrag(active, point);
			},
			onRelease: (moved) => {
				if (!active || session !== active) return;
				if (!moved && !immediate && longPress) {
					cancelDrag(active, true);
					settleAndEnd(active);
					longPress(event);
					return;
				}
				if (active.outside) {
					cancelDrag(active);
					settleAndEnd(active);
					return;
				}
				settleAndEnd(active, drop(active));
			},
			onCancel: () => {
				if (!active || session !== active) return;
				cancelDrag(active);
				settleAndEnd(active);
			},
		});
	};

	const refocus = (key: string) => {
		const focus = () => handles.get(key)?.focus({ preventScroll: true });
		focus();
		const handle = handles.get(key);
		handle?.scrollIntoView({
			block: "nearest",
			behavior: prefersReducedMotion() ? "auto" : "smooth",
		});
		if (document.activeElement === handle) return;
		refocusing = true;
		requestAnimationFrame(() => {
			focus();
			refocusing = false;
		});
	};

	const keyboardMove = (active: Session, next: ChannelSlot | number) => {
		const current = layout();
		let updated: ChannelLayout;
		let open: string | undefined;
		if (active.kind === "category") {
			updated = placeCategory(current, active.id, next as number);
		} else {
			const slot = next as ChannelSlot;
			updated = placeChannel(current, active.id, slot);
			if (slot.categoryId !== null && isCollapsed(slot.categoryId))
				open = slot.categoryId;
		}
		haptics().selection();
		refocusing = true;
		transition(() => {
			if (open) {
				const opening = open;
				setSpringOpen((previous) => new Set([...previous, opening]));
			}
			setPreview(updated);
		});
		refocusing = false;
		refocus(handleKey(active.kind, active.id));
		announce(
			`Moved ${labelFor(active.kind, active.id)} to ${describe(active.kind, updated, active.id)}.`,
		);
	};

	const handleKey = (kind: DragKind, id: string) =>
		keyFor(kind === "channel" ? "channel" : "header", id);

	const keyboardDrop = (active: Session) => {
		const final = layout();
		const changed = !sameLayout(final, active.origin);
		if (changed) commit(active, final);
		haptics().impact("soft");
		announce(
			changed
				? `Dropped ${labelFor(active.kind, active.id)} at ${describe(active.kind, final, active.id)}.`
				: `Dropped ${labelFor(active.kind, active.id)}. Its position didn't change.`,
		);
		const keepOpen =
			active.kind === "channel"
				? findChannel(final, active.id)?.categoryId
				: null;
		const key = handleKey(active.kind, active.id);
		refocusing = true;
		endSession(active, keepOpen);
		refocusing = false;
		refocus(key);
	};

	const keyboardCancel = (active: Session) => {
		const key = handleKey(active.kind, active.id);
		refocusing = true;
		cancelDrag(active);
		endSession(active);
		refocusing = false;
		refocus(key);
	};

	const onHandleKeyDown = (
		event: KeyboardEvent,
		kind: DragKind,
		id: string,
	) => {
		const active = session;
		const lifted =
			active?.input === "keyboard" && active.kind === kind && active.id === id;
		if (!lifted) {
			if (event.key === " " || event.key === "Enter") {
				event.preventDefault();
				const started = beginSession({ kind, id, input: "keyboard" });
				refocusing = true;
				transition(() => setDrag({ kind, id, input: "keyboard" }));
				refocusing = false;
				refocus(handleKey(kind, id));
				haptics().selection();
				announce(
					`Picked up ${labelFor(kind, id)}, ${describe(kind, started.origin, id)}. Use the arrow keys to move it, Enter to drop it, Escape to cancel.`,
				);
			} else if (event.key === "Escape") {
				event.preventDefault();
				event.stopPropagation();
				props.onReorderModeChange?.(false);
			}
			return;
		}
		const current = layout();
		const move = (next: ChannelSlot | number | undefined) => {
			event.preventDefault();
			if (next === undefined) return;
			keyboardMove(active, next);
		};
		if (event.key === "ArrowUp" || event.key === "ArrowDown") {
			const delta = event.key === "ArrowUp" ? -1 : 1;
			if (kind === "category") {
				const index = findCategory(current, id) + delta;
				move(
					index >= 0 && index < current.categories.length ? index : undefined,
				);
			} else move(stepChannel(current, id, delta));
		} else if (event.key === "Home" || event.key === "End") {
			if (kind === "category") {
				const index = event.key === "Home" ? 0 : current.categories.length - 1;
				move(index === findCategory(current, id) ? undefined : index);
			} else
				move(edgeChannel(current, id, event.key === "Home" ? "start" : "end"));
		} else if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			keyboardDrop(active);
		} else if (event.key === "Escape") {
			event.preventDefault();
			event.stopPropagation();
			keyboardCancel(active);
		} else if (event.key === "Tab") {
			keyboardDrop(active);
		}
	};

	const onHandleBlur = (kind: DragKind, id: string) => {
		const active = session;
		if (
			refocusing ||
			active?.input !== "keyboard" ||
			active.kind !== kind ||
			active.id !== id
		)
			return;
		queueMicrotask(() => {
			if (refocusing || session !== active) return;
			if (document.activeElement === handles.get(handleKey(kind, id))) return;
			keyboardDrop(active);
		});
	};

	createEffect(
		on(canReorder, (allowed) => {
			if (!allowed) finishImmediately();
		}),
	);

	const stepKey = (kind: DragKind, id: string, delta: number) =>
		`${delta < 0 ? "up" : "down"}:${handleKey(kind, id)}`;

	const nextStep = (
		current: ChannelLayout,
		kind: DragKind,
		id: string,
		delta: number,
	): ChannelSlot | number | undefined => {
		if (kind === "channel") return stepChannel(current, id, delta);
		const index = findCategory(current, id) + delta;
		return index >= 0 && index < current.categories.length ? index : undefined;
	};

	const canStep = (kind: DragKind, id: string, delta: number) =>
		!drag() && nextStep(layout(), kind, id, delta) !== undefined;

	const stepMove = (kind: DragKind, id: string, delta: number) => {
		if (session) return;
		const current = layout();
		const next = nextStep(current, kind, id, delta);
		if (next === undefined) return;
		let updated: ChannelLayout;
		let open: string | undefined;
		if (kind === "category") {
			updated = placeCategory(current, id, next as number);
		} else {
			const slot = next as ChannelSlot;
			updated = placeChannel(current, id, slot);
			if (slot.categoryId !== null && isCollapsed(slot.categoryId))
				open = slot.categoryId;
		}
		haptics().selection();
		transition(() => {
			if (open) setCollapsed(open, false);
			setOptimistic(updated);
		});
		announce(`Moved ${labelFor(kind, id)} to ${describe(kind, updated, id)}.`);
		commit({ kind, id, origin: current }, updated);
		refocus(stepKey(kind, id, delta));
	};

	let lastReorderFocus: { kind: DragKind; id: string } | undefined;
	let releaseFocusHold: (() => void) | undefined;

	const holdFocus = (key: string) => {
		releaseFocusHold?.();
		const release = () => {
			clearTimeout(timer);
			document.removeEventListener("focusin", onFocusIn, true);
			document.removeEventListener("pointerdown", release, true);
			document.removeEventListener("keydown", release, true);
			if (releaseFocusHold === release) releaseFocusHold = undefined;
		};
		const onFocusIn = (event: FocusEvent) => {
			const target = handles.get(key);
			if (!target?.isConnected) return release();
			if (event.target instanceof Node && root?.contains(event.target)) return;
			queueMicrotask(() => target.focus({ preventScroll: true }));
		};
		const timer = setTimeout(release, 1000);
		document.addEventListener("focusin", onFocusIn, true);
		document.addEventListener("pointerdown", release, true);
		document.addEventListener("keydown", release, true);
		releaseFocusHold = release;
	};

	const firstReorderKey = () => {
		const current = layout();
		const first =
			current.uncategorized[0] ??
			current.categories.find(
				(category) => !isCollapsed(category.id) && category.channels.length > 0,
			)?.channels[0];
		if (first !== undefined) return keyFor("channel", first);
		const category = current.categories[0];
		return category ? keyFor("header", category.id) : undefined;
	};

	const restoreRowFocus = () => {
		const owner = lastReorderFocus;
		lastReorderFocus = undefined;
		if (!owner) return;
		const active = document.activeElement;
		if (active && active !== document.body && active.isConnected) return;
		const container =
			owner.kind === "channel"
				? nodes.get(keyFor("channel", owner.id))
				: nodes.get(keyFor("header", owner.id));
		container
			?.querySelector<HTMLElement>("a[href], button:not([disabled])")
			?.focus({ preventScroll: true });
	};

	createEffect(
		on(
			reorderMode,
			(mode, previous) => {
				if (!mode && session?.input === "keyboard") finishImmediately();
				if (mode && !previous) {
					const key = firstReorderKey();
					if (!key) return;
					refocus(key);
					holdFocus(key);
				} else if (!mode && previous) {
					releaseFocusHold?.();
					restoreRowFocus();
				}
			},
			{ defer: true },
		),
	);

	const blockScrollWhileLifted = (event: TouchEvent) => {
		if (session?.input === "pointer" && !session.settling && event.cancelable)
			event.preventDefault();
	};

	createEffect(() => {
		const element = root;
		if (!element || !canReorder()) return;
		element.addEventListener("touchmove", blockScrollWhileLifted, {
			passive: false,
		});
		onCleanup(() =>
			element.removeEventListener("touchmove", blockScrollWhileLifted),
		);
	});

	onCleanup(() => {
		releaseFocusHold?.();
		finishImmediately();
		nodes.clear();
		handles.clear();
	});

	const register =
		(map: Map<string, HTMLElement>, key: string) => (element: HTMLElement) => {
			map.set(key, element);
			onCleanup(() => {
				if (map.get(key) === element) map.delete(key);
			});
		};

	const pointerDragging = (kind: DragKind, id: string) => {
		const state = drag();
		return state?.input === "pointer" && state.kind === kind && state.id === id;
	};

	const keyboardLifted = (kind: DragKind, id: string) => {
		const state = drag();
		return (
			state?.input === "keyboard" && state.kind === kind && state.id === id
		);
	};

	const Handle = (handleProps: {
		kind: DragKind;
		id: string;
		label: string;
	}) => (
		<button
			type="button"
			ref={register(handles, handleKey(handleProps.kind, handleProps.id))}
			data-reorder-handle=""
			aria-label={`Reorder ${handleProps.label}`}
			aria-roledescription="sortable"
			aria-describedby={instructionsId}
			aria-pressed={keyboardLifted(handleProps.kind, handleProps.id)}
			onKeyDown={(event) =>
				onHandleKeyDown(event, handleProps.kind, handleProps.id)
			}
			onFocus={() => {
				lastReorderFocus = { kind: handleProps.kind, id: handleProps.id };
			}}
			onBlur={() => onHandleBlur(handleProps.kind, handleProps.id)}
			onPointerDown={(event) => {
				event.stopPropagation();
				const element = sourceElement(handleProps.kind, handleProps.id);
				if (element)
					startPress(event, handleProps.kind, handleProps.id, element, true);
			}}
			class={cx(
				"relative z-10 flex shrink-0 cursor-grab touch-none items-center justify-center rounded-control-sm border-0 bg-transparent p-0 text-muted-foreground outline-none select-none [-webkit-touch-callout:none] hover:text-foreground focus-ring-inset active:cursor-grabbing",
				"aria-pressed:bg-primary/15 aria-pressed:text-primary-highlight",
				handleProps.kind === "channel"
					? "size-8 [&>svg]:size-5"
					: "size-6 [&>svg]:size-4",
			)}
		>
			<GripVerticalIcon />
		</button>
	);

	const StepButtons = (stepProps: {
		kind: DragKind;
		id: string;
		label: string;
	}) => (
		<span
			data-step-buttons=""
			class={cx(
				"flex shrink-0",
				stepProps.kind === "channel" ? "flex-col" : "flex-row",
			)}
		>
			<For each={[-1, 1]}>
				{(delta) => {
					const blocked = () => !canStep(stepProps.kind, stepProps.id, delta);
					return (
						<button
							type="button"
							ref={register(
								handles,
								stepKey(stepProps.kind, stepProps.id, delta),
							)}
							data-step={delta < 0 ? "up" : "down"}
							aria-label={`Move ${stepProps.label} ${delta < 0 ? "up" : "down"}`}
							aria-disabled={blocked() || undefined}
							onFocus={() => {
								lastReorderFocus = { kind: stepProps.kind, id: stepProps.id };
							}}
							onPointerDown={(event) => event.stopPropagation()}
							onClick={() => {
								if (!blocked()) stepMove(stepProps.kind, stepProps.id, delta);
							}}
							class={cx(
								"flex cursor-pointer items-center justify-center rounded-control-xs border-0 bg-transparent p-0 text-muted-foreground outline-none hover:text-foreground focus-ring-inset",
								"aria-disabled:cursor-default aria-disabled:opacity-35 aria-disabled:hover:text-muted-foreground",
								stepProps.kind === "channel"
									? "h-4 w-6 [&>svg]:size-3.5"
									: "size-6 [&>svg]:size-4",
							)}
						>
							{delta < 0 ? <AltArrowUpIcon /> : <AltArrowDownIcon />}
						</button>
					);
				}}
			</For>
		</span>
	);

	const ChannelNode = (nodeProps: { id: string }) => {
		const id = nodeProps.id;
		const key = keyFor("channel", id);
		const itemState: ChannelListItemState = {
			dragging: () => drag()?.kind === "channel" && drag()?.id === id,
			reorderMode,
		};
		return (
			<Show when={channelsById().get(id)} keyed>
				{(channel) => (
					<div
						ref={register(nodes, key)}
						data-list-node="channel"
						data-channel-id={id}
						data-lifted={keyboardLifted("channel", id) || undefined}
						data-placeholder={pointerDragging("channel", id) || undefined}
						onPointerDown={(event) => {
							const element = nodes.get(key);
							if (element) startPress(event, "channel", id, element, false);
						}}
						class={cx(
							"relative flex w-full items-start rounded-control-sm transition-[padding,background-color,box-shadow] duration-[calc(var(--duration-color,150ms)*var(--motion-scale))]",
							reorderMode() && "pr-16",
							pointerDragging("channel", id) && "opacity-0",
							keyboardLifted("channel", id) && "z-10 bg-popover shadow-overlay",
						)}
					>
						<div class="flex min-w-0 flex-1" inert={reorderMode() || undefined}>
							{props.renderChannel(channel, itemState)}
						</div>
						<Show when={reorderMode()}>
							<span class="absolute top-0 right-0 flex h-full max-h-14 items-center gap-0.5">
								<StepButtons
									kind="channel"
									id={id}
									label={props.channelName(channel)}
								/>
								<Handle
									kind="channel"
									id={id}
									label={props.channelName(channel)}
								/>
							</span>
						</Show>
					</div>
				)}
			</Show>
		);
	};

	const CategoryNode = (nodeProps: { id: string }) => {
		const id = nodeProps.id;
		const category = () => categoriesById().get(id);
		const channels = () => channelsIn(layout(), id);
		let wrapper: HTMLDivElement | undefined;
		const bindHeader = (element: HTMLDivElement) => {
			wrapper = element;
			queueMicrotask(() => {
				const header = wrapper?.querySelector<HTMLElement>(
					"[data-category-header]",
				);
				if (!header) return;
				nodes.set(keyFor("header", id), header);
			});
			onCleanup(() => {
				const header = nodes.get(keyFor("header", id));
				if (header && wrapper?.contains(header))
					nodes.delete(keyFor("header", id));
			});
		};
		const channelDrag = () => drag()?.kind === "channel";
		return (
			<Show when={category()}>
				{(current) => (
					<div
						ref={bindHeader}
						data-list-category={id}
						data-drop-target={dropTarget() === id || undefined}
						data-lifted={keyboardLifted("category", id) || undefined}
						onPointerDown={(event) => {
							const header = nodes.get(keyFor("header", id));
							if (
								!header ||
								!(event.target instanceof Node) ||
								!header.contains(event.target)
							)
								return;
							startPress(event, "category", id, header, false);
						}}
						class={cx(
							"[&_[data-category-header]]:rounded-control-xs [&_[data-category-header]]:transition-[background-color,box-shadow,opacity] [&_[data-category-header]]:duration-[calc(var(--duration-color,150ms)*var(--motion-scale))]",
							"[&[data-drop-target]_[data-category-header]]:bg-primary/15",
							"[&[data-lifted]_[data-category-header]]:bg-popover [&[data-lifted]_[data-category-header]]:shadow-overlay",
							pointerDragging("category", id) &&
								"[&_[data-category-header]]:opacity-0",
						)}
					>
						<ChannelCategory
							name={current().name}
							collapsed={isCollapsed(id)}
							onCollapsedChange={(collapsed) => setCollapsed(id, collapsed)}
							instant={!!drag()}
							onCreateChannel={
								reorderMode() || !props.onCreateChannel
									? undefined
									: () => props.onCreateChannel?.(id)
							}
							onOpenSettings={
								reorderMode() || !props.onOpenCategorySettings
									? undefined
									: () => props.onOpenCategorySettings?.(id)
							}
							headerTrailing={
								<Show when={reorderMode()}>
									<StepButtons kind="category" id={id} label={current().name} />
									<Handle kind="category" id={id} label={current().name} />
								</Show>
							}
						>
							<For each={channels()}>
								{(channelId) => <ChannelNode id={channelId} />}
							</For>
							<Show when={channels().length === 0}>
								<Show
									when={channelDrag()}
									fallback={
										<Show when={props.emptyCategoryLabel !== undefined}>
											<div
												ref={register(nodes, keyFor("empty", id))}
												data-list-node="empty"
											>
												<CategoryEmpty>
													{props.emptyCategoryLabel}
												</CategoryEmpty>
											</div>
										</Show>
									}
								>
									<div
										ref={register(nodes, keyFor("zone", id))}
										data-list-node="zone"
										data-drop-zone={id}
										style={{ height: `${dragHeight()}px` }}
										class="flex w-full items-center justify-center rounded-control-sm border border-dashed border-border text-xs text-muted-foreground"
									>
										Drop here
									</div>
								</Show>
							</Show>
						</ChannelCategory>
						<Show when={dropTarget() === id}>
							<div
								ref={register(nodes, keyFor("slot", id))}
								data-list-node="slot"
								data-drop-slot={id}
								aria-hidden="true"
								style={{ height: `${dragHeight() + 8}px` }}
							/>
						</Show>
					</div>
				)}
			</Show>
		);
	};

	return (
		<div
			ref={root}
			data-channel-list=""
			data-reorder-mode={reorderMode() || undefined}
			data-dragging={drag()?.kind}
			class={cx("relative flex w-full flex-col", props.class)}
		>
			<span id={instructionsId} class="sr-only">
				Press Space or Enter to pick up a channel or category. Use the arrow
				keys to move it, Enter to drop it, and Escape to cancel.
			</span>
			<span role="status" aria-live="assertive" class="sr-only">
				{announcement()}
			</span>
			<Show when={reorderMode()}>
				<div
					data-reorder-bar=""
					class="sticky top-2 z-20 mx-2 mt-2 flex items-center gap-3 rounded-control bg-popover py-2 pr-2 pl-3 shadow-overlay"
				>
					<span class="min-w-0 flex-1 text-sm leading-5">
						<span class="block font-semibold">Reorder channels</span>
						<span class="block text-xs text-muted-foreground">
							Drag the handles, or use Space and the arrow keys.
						</span>
					</span>
					<Button
						variant="secondary"
						onClick={() => props.onReorderModeChange?.(false)}
					>
						Done
					</Button>
				</div>
			</Show>
			<Show
				when={layout().uncategorized.length > 0 || drag()?.kind === "channel"}
			>
				<div
					data-list-uncategorized=""
					class={cx(
						"flex flex-col gap-2 px-2",
						layout().uncategorized.length > 0 && "pt-2",
					)}
				>
					<For each={layout().uncategorized}>
						{(channelId) => <ChannelNode id={channelId} />}
					</For>
				</div>
			</Show>
			<For each={layout().categories.map((category) => category.id)}>
				{(categoryId) => <CategoryNode id={categoryId} />}
			</For>
		</div>
	);
};
