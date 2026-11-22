import { batch, createMemo, createSignal, onCleanup } from "solid-js";
import { stopScrollMotion } from "../../utils/gestures/stop-scroll";
import type { Haptics } from "../../utils/haptics";
import { prefersReducedMotion } from "../../utils/motion";
import { createAutoscroller, rubberBand } from "../Sortable/autoscroll";
import { reorderSprings, springAnimation } from "../Sortable/flip";
import {
	isHoldPointer,
	type PressPoint,
	type ReorderPress,
	startReorderPress,
	suppressNextClick,
} from "../Sortable/reorder-press";
import {
	keyboardSlot,
	placeAt,
	positionText,
	reconcileOrder,
	sameOrder,
	shiftOf,
	slotAt,
} from "./rail-order";

const LIFT_SCALE_TOUCH = 1.08;
const LIFT_SCALE_POINTER = 1.04;
const OUTSIDE_MARGIN = 64;
const RUBBER_BAND_RANGE = 24;
const SHIFT_TRANSITION =
	"transform calc(200ms * var(--motion-scale)) cubic-bezier(0.2, 0, 0, 1)";

type Overlay = {
	place: (x: number, y: number) => void;
	fade: (away: boolean) => void;
	settle: (left: number, top: number) => Promise<void>;
	remove: () => void;
};

type Session = {
	id: string;
	origin: string[];
	press?: ReorderPress;
	overlay?: Overlay;
	grab: PressPoint;
	left: number;
	lift: PressPoint;
	pointer: PressPoint;
	scroller?: HTMLElement;
	autoscroll?: ReturnType<typeof createAutoscroller>;
	outside: boolean;
	settling: boolean;
};

type RailItemEntry = {
	element: HTMLElement;
	label: () => string;
};

export type RailReorderElements = {
	rail: HTMLElement;
	scroller: HTMLElement;
	content: HTMLElement;
};

export type RailReorderOptions = {
	enabled: () => boolean;
	onReorder: (ids: string[]) => unknown;
	step: () => number;
	haptics: () => Haptics;
};

const focusableOf = (element: HTMLElement) =>
	element.querySelector<HTMLElement>("[data-rail-focusable]") ?? element;

const stripClone = (node: HTMLElement) => {
	node.removeAttribute("id");
	node.removeAttribute("data-rail-focusable");
	for (const child of node.querySelectorAll<HTMLElement>("[id]"))
		child.removeAttribute("id");
};

const createRailOverlay = (
	source: HTMLElement,
	rect: DOMRect,
	grab: PressPoint,
	scale: number,
): Overlay => {
	const computed = getComputedStyle(source);
	const host = document.createElement("div");
	host.dataset.railReorderOverlay = "";
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
	});
	const lift = document.createElement("div");
	Object.assign(lift.style, {
		width: "100%",
		height: "100%",
		borderRadius: "var(--radius-control)",
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
						{ opacity: 0.55, transform: "scale(0.94)" },
					]
				: [
						{ opacity: 0.55, transform: "scale(0.94)" },
						{ opacity: 1, transform: "scale(1)" },
					];
			for (const animation of fade.getAnimations()) animation.cancel();
			if (!springAnimation(fade, keyframes, reorderSprings.lift))
				fade.style.opacity = away ? "0.55" : "1";
		},
		settle: (left, top) => {
			const from = `translate3d(${x}px, ${y}px, 0)`;
			const to = `translate3d(${left}px, ${top}px, 0)`;
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

export const createRailReorder = (options: RailReorderOptions) => {
	const items = new Map<string, RailItemEntry>();
	const [actual, setActual] = createSignal<string[]>([], {
		equals: sameOrder,
	});
	const [target, setTarget] = createSignal<string[]>();
	const [lifted, setLifted] = createSignal<string>();
	const [instant, setInstant] = createSignal(false);
	const [announcement, setAnnouncement] = createSignal("");
	let elements: RailReorderElements | undefined;
	let session: Session | undefined;
	let token = 0;
	let instantFrame: number | undefined;
	let syncQueued = false;

	const enabled = () => options.enabled();

	const order = createMemo(() => {
		const pending = target();
		return pending ? reconcileOrder(pending, actual()) : undefined;
	});

	const currentOrder = () => order() ?? actual();

	const labelOf = (id: string) => items.get(id)?.label() ?? id;

	const announce = (message: string) => {
		setAnnouncement("");
		queueMicrotask(() => setAnnouncement(message));
	};

	const readOrder = () => {
		const content = elements?.content;
		if (!content) return [];
		return Array.from(content.querySelectorAll<HTMLElement>("[data-rail-id]"))
			.map((element) => element.dataset.railId ?? "")
			.filter((id) => items.has(id));
	};

	const sync = () => {
		syncQueued = false;
		const next = readOrder();
		if (sameOrder(next, actual())) return;
		if (instantFrame !== undefined) cancelAnimationFrame(instantFrame);
		batch(() => {
			setInstant(true);
			setActual(next);
			const pending = target();
			if (pending && !session && sameOrder(reconcileOrder(pending, next), next))
				setTarget(undefined);
		});
		instantFrame = requestAnimationFrame(() => {
			instantFrame = undefined;
			setInstant(false);
		});
	};

	const queueSync = () => {
		if (syncQueued) return;
		syncQueued = true;
		queueMicrotask(sync);
	};

	const register = (id: string, element: HTMLElement, label: () => string) => {
		items.set(id, { element, label });
		queueSync();
		onCleanup(() => {
			if (items.get(id)?.element === element) items.delete(id);
			queueSync();
		});
	};

	const offset = (id: string) => shiftOf(order(), actual(), id, options.step());

	const transition = () =>
		instant() || prefersReducedMotion() ? undefined : SHIFT_TRANSITION;

	const retarget = () => {
		const active = session;
		if (!active || active.outside || active.settling || !elements) return;
		const ids = actual();
		const first = ids[0] === undefined ? undefined : items.get(ids[0]);
		if (!first) return;
		const contentTop = elements.content.getBoundingClientRect().top;
		const overlayTop = active.pointer.y - active.grab.y;
		const index = slotAt(
			overlayTop - contentTop,
			first.element.offsetTop,
			options.step(),
			ids.length,
		);
		const current = currentOrder();
		if (current.indexOf(active.id) === index) return;
		options.haptics().selection();
		setTarget(placeAt(current, active.id, index));
	};

	const onScroll = () => retarget();

	const teardownPointer = (active: Session) => {
		active.autoscroll?.stop();
		active.scroller?.removeEventListener("scroll", onScroll);
	};

	const settleTarget = () => {
		if (session) return;
		sync();
		setTarget(undefined);
	};

	const revert = (id: string) => {
		if (!session) setTarget(undefined);
		options.haptics().notification("error");
		announce(`Couldn't move ${labelOf(id)}. It's back where it was.`);
	};

	const commit = (id: string, final: string[]) => {
		const mine = ++token;
		setTarget(final);
		let result: unknown;
		try {
			result = options.onReorder(final);
		} catch {
			revert(id);
			return;
		}
		sync();
		if (result instanceof Promise) {
			result.then(
				() => {
					if (mine === token) settleTarget();
				},
				() => {
					if (mine === token) revert(id);
				},
			);
			return;
		}
		requestAnimationFrame(() => {
			if (mine === token) settleTarget();
		});
	};

	const endSession = (active: Session) => {
		if (session !== active) return;
		teardownPointer(active);
		active.overlay?.remove();
		session = undefined;
		setLifted(undefined);
		const pending = target();
		if (pending && sameOrder(reconcileOrder(pending, actual()), actual()))
			setTarget(undefined);
	};

	const settle = (active: Session) => {
		active.settling = true;
		teardownPointer(active);
		sync();
		const entry = items.get(active.id);
		if (!active.overlay || !entry || !elements) {
			endSession(active);
			return;
		}
		const left = focusableOf(entry.element).getBoundingClientRect().left;
		const top =
			elements.content.getBoundingClientRect().top +
			entry.element.offsetTop +
			offset(active.id);
		void active.overlay.settle(left, top).then(() => endSession(active));
	};

	const finishImmediately = () => {
		const active = session;
		if (!active) return;
		active.press?.cancel();
		teardownPointer(active);
		active.overlay?.remove();
		session = undefined;
		batch(() => {
			setLifted(undefined);
			setTarget(undefined);
		});
	};

	const begin = (
		id: string,
		element: HTMLElement,
		point: PressPoint,
		pointerType: string,
	) => {
		finishImmediately();
		sync();
		const source = focusableOf(element);
		const rect = source.getBoundingClientRect();
		const scroller = elements?.scroller;
		const active: Session = {
			id,
			origin: currentOrder(),
			grab: { x: point.x - rect.left, y: point.y - rect.top },
			left: rect.left,
			lift: point,
			pointer: point,
			scroller,
			outside: false,
			settling: false,
		};
		active.overlay = createRailOverlay(
			source,
			rect,
			active.grab,
			pointerType === "mouse" ? LIFT_SCALE_POINTER : LIFT_SCALE_TOUCH,
		);
		if (scroller) {
			active.autoscroll = createAutoscroller({ scroller, onScroll });
			scroller.addEventListener("scroll", onScroll, { passive: true });
		}
		session = active;
		batch(() => {
			setTarget(active.origin);
			setLifted(id);
		});
		options.haptics().impact("medium");
		announce(
			`Picked up ${labelOf(id)}, ${positionText(active.origin.indexOf(id), active.origin.length)}.`,
		);
		retarget();
		return active;
	};

	const move = (active: Session, point: PressPoint) => {
		active.pointer = point;
		active.overlay?.place(
			active.left + rubberBand(point.x - active.lift.x, RUBBER_BAND_RANGE),
			point.y - active.grab.y,
		);
		const bounds = elements?.rail.getBoundingClientRect();
		const outside =
			!!bounds &&
			(point.x < bounds.left - OUTSIDE_MARGIN ||
				point.x > bounds.right + OUTSIDE_MARGIN);
		if (outside !== active.outside) {
			active.outside = outside;
			active.overlay?.fade(outside);
			options.haptics().impact("light");
			if (outside) {
				active.autoscroll?.stop();
				setTarget(active.origin);
				return;
			}
		}
		if (outside) return;
		active.autoscroll?.update(point.y);
		retarget();
	};

	const cancelDrag = (active: Session, quiet = false) => {
		setTarget(undefined);
		if (quiet) return;
		announce(
			`Reorder cancelled. ${labelOf(active.id)} is back at ${positionText(active.origin.indexOf(active.id), active.origin.length)}.`,
		);
	};

	const drop = (active: Session) => {
		const final = currentOrder();
		const changed = !sameOrder(final, active.origin);
		options.haptics().impact("soft");
		if (!changed) {
			setTarget(undefined);
			announce(`Dropped ${labelOf(active.id)}. Its position didn't change.`);
			return;
		}
		announce(
			`Moved ${labelOf(active.id)} to ${positionText(final.indexOf(active.id), final.length)}.`,
		);
		commit(active.id, final);
	};

	const press = (
		event: PointerEvent,
		id: string,
		element: HTMLElement,
		menu?: (event: PointerEvent) => void,
	) => {
		if (!enabled() || event.button !== 0 || !event.isPrimary) return;
		if (session && !session.settling) return;
		const hold = isHoldPointer(event.pointerType);
		if (hold) stopScrollMotion(element);
		const pointerId = event.pointerId;
		let active: Session | undefined;
		const release = () => {
			document.removeEventListener("gotpointercapture", onCapture, true);
			document.removeEventListener("pointerup", onEnd, true);
			document.removeEventListener("pointercancel", onEnd, true);
		};
		const handle = startReorderPress({
			event,
			element,
			canDrag: true,
			onLift: (point, pointerType) => {
				active = begin(id, element, point, pointerType);
				active.press = handle;
			},
			onMove: (point) => {
				if (active && session === active) move(active, point);
			},
			onRelease: (moved) => {
				release();
				if (!active || session !== active) return;
				suppressNextClick(element);
				if (!moved && hold && menu) {
					cancelDrag(active, true);
					settle(active);
					menu(event);
					return;
				}
				if (active.outside) {
					cancelDrag(active);
					settle(active);
					return;
				}
				drop(active);
				settle(active);
			},
			onCancel: () => {
				release();
				if (!active || session !== active) return;
				cancelDrag(active);
				settle(active);
			},
		});
		const onCapture = (capture: PointerEvent) => {
			if (capture.pointerId !== pointerId) return;
			if (capture.target instanceof Node && element.contains(capture.target))
				return;
			release();
			handle.cancel();
		};
		const onEnd = (end: PointerEvent) => {
			if (end.pointerId === pointerId) queueMicrotask(release);
		};
		document.addEventListener("gotpointercapture", onCapture, true);
		document.addEventListener("pointerup", onEnd, true);
		document.addEventListener("pointercancel", onEnd, true);
	};

	const refocus = (button: HTMLElement) => {
		const focus = () => {
			if (!button.isConnected || document.activeElement === button) return;
			button.focus({ preventScroll: true });
		};
		focus();
		button.scrollIntoView({
			block: "nearest",
			behavior: prefersReducedMotion() ? "auto" : "smooth",
		});
		requestAnimationFrame(focus);
	};

	const keyMove = (event: KeyboardEvent, id: string) => {
		if (!enabled() || !event.altKey || event.ctrlKey || event.metaKey)
			return false;
		const current = currentOrder();
		const from = current.indexOf(id);
		if (from < 0) return false;
		const to = keyboardSlot(event.key, from, current.length);
		if (to === undefined) return false;
		event.preventDefault();
		event.stopPropagation();
		if (session || to === from) return true;
		const final = placeAt(current, id, to);
		const button = items.get(id)?.element;
		options.haptics().selection();
		announce(`Moved ${labelOf(id)} to ${positionText(to, final.length)}.`);
		commit(id, final);
		if (button) refocus(focusableOf(button));
		return true;
	};

	const attach = (next: RailReorderElements) => {
		elements = next;
		const observer = new MutationObserver(queueSync);
		observer.observe(next.content, { childList: true, subtree: true });
		queueSync();
		onCleanup(() => {
			observer.disconnect();
			finishImmediately();
			if (instantFrame !== undefined) cancelAnimationFrame(instantFrame);
			elements = undefined;
		});
	};

	return {
		enabled,
		register,
		attach,
		offset,
		transition,
		lifted,
		actual,
		announcement,
		press,
		keyMove,
		finishImmediately,
	};
};

export type RailReorder = ReturnType<typeof createRailReorder>;
