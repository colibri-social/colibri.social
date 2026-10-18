import { prefersReducedMotion, useHaptics } from "@colibri-social/ui";
import {
	batch,
	createContext,
	createSignal,
	onCleanup,
	useContext,
} from "solid-js";
import { bindPan, type PanDirection } from "./gesture/pan";
import { projectedTarget } from "./gesture/projection";
import { bandedValue } from "./gesture/rubber-band";
import { bindSheetDrag } from "./gesture/sheet-drag";
import {
	isAtRest,
	paneSpring,
	type SpringState,
	stepSpring,
} from "./gesture/spring";
import {
	browserHistory,
	createHistorySync,
	type HistoryPort,
} from "./history-sync";
import {
	isSheetLayer,
	type Layer,
	layerPath,
	parsePath,
	type Root,
	type Route,
	routeRoot,
	sameLayer,
} from "./layers";
import { createLeaveGuard } from "./leave-guard";

export const SCRIM_OPACITY = 0.42;
const MAX_FRAME_SECONDS = 1 / 30;
const REDUCED_FADE_MS = 160;

type Frame = {
	frame: HTMLElement;
	scrim?: HTMLElement;
	edge?: HTMLElement;
};

export type PopGuard = {
	depth: number;
	blocked: () => boolean;
	onBlocked: () => void;
};

export type StackOptions = {
	history?: HistoryPort;
	initialPath?: string;
	forward: (top: Layer | undefined, root: Root) => Layer | undefined;
	canForward?: (top: Layer | undefined) => boolean;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const PARKED_CLEARANCE_PX = 1;

const boxSize = (node: HTMLElement) => {
	const box = node.getBoundingClientRect();
	return { width: box.width, height: box.height };
};

export const createStack = (options: StackOptions) => {
	const haptics = useHaptics();
	const port = options.history ?? browserHistory();
	const initial = parsePath(options.initialPath ?? port.path());

	const [root, setRootSignal] = createSignal<Root>(initial.root);
	const [mounted, setMounted] = createSignal<Layer[]>(initial.layers);
	const [activeDepth, setActiveDepth] = createSignal(initial.layers.length);
	const [moving, setMoving] = createSignal(false);

	let depth = initial.layers.length;
	let target = depth;
	let velocity = 0;
	let frameRequest = 0;
	let pushRequest = 0;
	let lastTime = 0;
	let held = false;
	let width = typeof window === "undefined" ? 400 : window.innerWidth;
	let height = typeof window === "undefined" ? 800 : window.innerHeight;
	let sheetAxis: "x" | "y" = "y";
	let gesture: { start: number; min: number; max: number } | undefined;
	let lastProjected: number | undefined;
	let element: HTMLElement | undefined;

	const frames = new Map<number, Frame>();
	let popGuard: PopGuard | undefined;

	const leave = createLeaveGuard(() => target);

	const blocksPop = (next: number, retry: () => void) => {
		if (leave.bypassing()) return false;
		if (popGuard && next < popGuard.depth && popGuard.blocked()) {
			popGuard.onBlocked();
			return true;
		}
		return leave.holds(next, retry);
	};

	const setPopGuard = (guard: PopGuard) => {
		popGuard = guard;
		return () => {
			if (popGuard === guard) popGuard = undefined;
		};
	};

	const committed = (): Route => ({
		root: root(),
		layers: mounted().slice(0, target),
	});

	const history = createHistorySync({
		port,
		route: committed,
		stacksOverTab: (next) => next.tab === "settings",
		onExternal: (navigation) => {
			if (blocksPop(navigation.depth, () => popTo(navigation.depth))) {
				history.sync();
				return;
			}
			const current = mounted();
			setRootSignal(routeRoot(navigation.route) ?? root());
			const mountedThere = current[navigation.depth - 1];
			if (
				navigation.depth > 0 &&
				mountedThere &&
				layerPath(mountedThere) === navigation.path
			) {
				animateTo(navigation.depth);
				return;
			}
			const isPrefix = navigation.route.layers.every((layer, index) =>
				sameLayer(layer, current[index]),
			);
			if (!isPrefix) {
				setMounted(
					navigation.route.layers.map((layer, index) => {
						const kept = current[index];
						return kept && sameLayer(layer, kept) ? kept : layer;
					}),
				);
				jump(navigation.depth);
				return;
			}
			animateTo(navigation.depth);
		},
	});

	const render = () => {
		const list = mounted();
		const base = frames.get(0);
		if (base) paint(base, 0, 1, clamp01(depth));
		for (let index = 1; index <= list.length; index++) {
			const entry = frames.get(index);
			if (!entry) continue;
			paint(entry, index, clamp01(depth - (index - 1)), clamp01(depth - index));
		}
	};

	const paint = (
		entry: Frame,
		index: number,
		entered: number,
		covered: number,
	) => {
		const style = entry.frame.style;
		const sheet =
			index > 0 && isSheetLayer(mounted()[index - 1]) && sheetAxis === "y";
		const distance = sheet ? height : width;
		const offset =
			index === 0
				? 0
				: entered <= 0
					? Math.ceil(distance) + PARKED_CLEARANCE_PX
					: Math.round((1 - entered) * distance * 100) / 100;
		style.transform =
			offset === 0
				? ""
				: sheet
					? `translate3d(0,${offset}px,0)`
					: `translate3d(${offset}px,0,0)`;
		const top = Math.ceil(depth - 0.0001);
		const underTop = index === top - 1;
		const parked = index === top + 1;
		const buried = covered >= 1 && !underTop;
		const offscreen = entered <= 0 && !parked;
		const hidden = buried || offscreen;
		style.visibility = hidden ? "hidden" : "";
		style.willChange = index > 0 && !hidden && covered < 1 ? "transform" : "";
		const transitioning = entered > 0 && entered < 1;
		if (entry.scrim) {
			entry.scrim.style.visibility = transitioning ? "" : "hidden";
			entry.scrim.style.opacity = String(SCRIM_OPACITY * entered);
		}
		if (entry.edge) {
			entry.edge.style.visibility = transitioning && !sheet ? "" : "hidden";
		}
	};

	const stopLoop = () => {
		if (frameRequest) cancelAnimationFrame(frameRequest);
		frameRequest = 0;
		lastTime = 0;
	};

	const blurInactive = () => {
		const focused = document.activeElement;
		if (!(focused instanceof HTMLElement)) return;
		const pane = focused.closest<HTMLElement>("[data-pane-index]");
		if (pane && Number(pane.dataset.paneIndex) !== target) focused.blur();
	};

	const settle = () => {
		stopLoop();
		depth = target;
		velocity = 0;
		sheetAxis = "y";
		batch(() => {
			setMoving(false);
			setActiveDepth(target);
			setMounted((list) => list.slice(0, target + 1));
		});
		render();
		blurInactive();
		history.sync();
	};

	const tick = (time: number) => {
		const seconds =
			lastTime === 0
				? 1 / 60
				: Math.min(MAX_FRAME_SECONDS, (time - lastTime) / 1000);
		lastTime = time;
		const next: SpringState = stepSpring(
			{ position: depth, velocity },
			target,
			paneSpring,
			seconds,
		);
		depth = next.position;
		velocity = next.velocity;
		if (isAtRest(next, target)) {
			settle();
			return;
		}
		render();
		frameRequest = requestAnimationFrame(tick);
	};

	const fadeIn = (index: number) => {
		const entry = frames.get(index);
		entry?.frame.animate([{ opacity: 0 }, { opacity: 1 }], {
			duration: REDUCED_FADE_MS,
			easing: "ease-out",
		});
	};

	const animateTo = (next: number, initialVelocity?: number) => {
		const clamped = Math.max(0, Math.min(mounted().length, next));
		target = clamped;
		blurInactive();
		setActiveDepth(clamped);
		if (initialVelocity !== undefined) velocity = initialVelocity;
		if (initialVelocity === undefined && prefersReducedMotion()) {
			const opening = clamped > depth;
			depth = clamped;
			setMoving(false);
			settle();
			if (opening) fadeIn(clamped);
			return;
		}
		setMoving(true);
		if (!frameRequest) frameRequest = requestAnimationFrame(tick);
	};

	const jump = (next: number) => {
		stopLoop();
		target = next;
		depth = next;
		settle();
	};

	const setRoot = (next: Root) => {
		setRootSignal(next);
		if (target === 0 && !moving()) history.sync();
	};

	const push = (layer: Layer) => {
		const list = mounted();
		const top = list[target - 1];
		if (sameLayer(top, layer)) return;
		const existing = list[target];
		const reused = sameLayer(existing, layer);
		const next = target + 1;
		setMounted([
			...list.slice(0, target),
			reused ? (existing as Layer) : layer,
		]);
		setActiveDepth(next);
		target = next;
		history.sync();
		if (reused) {
			animateTo(next, 0);
			return;
		}
		setMoving(true);
		render();
		cancelAnimationFrame(pushRequest);
		pushRequest = requestAnimationFrame(() => {
			if (target === next && !gesture) animateTo(next, 0);
		});
	};

	const replaceTop = (layer: Layer) => {
		if (target === 0) {
			push(layer);
			return;
		}
		setMounted((list) => [...list.slice(0, target - 1), layer]);
		history.sync();
	};

	const pop = () => {
		if (target === 0) return false;
		if (blocksPop(target - 1, () => void pop())) return true;
		animateTo(target - 1, 0);
		return true;
	};

	const popTo = (next: number) => {
		if (next >= target) return;
		if (blocksPop(next, () => popTo(next))) return;
		animateTo(next, 0);
	};

	const forwardCandidate = (top: Layer | undefined) => {
		if (options.canForward && !options.canForward(top)) return undefined;
		const parked = mounted()[target];
		const candidate = options.forward(top, root());
		if (parked && (!candidate || parked.kind === candidate.kind)) return parked;
		return candidate;
	};

	const allow = (direction: PanDirection) => {
		if (held && depth !== Math.round(depth)) return true;
		const top = mounted()[target - 1];
		if (direction === "back") {
			return target > 0 && !blocksPop(target - 1, () => void pop());
		}
		return !!forwardCandidate(top);
	};

	const startGesture = (direction: PanDirection) => {
		if (element) width = boxSize(element).width || width;
		sheetAxis = "x";
		const rounded = Math.round(depth);
		const midFlight = Math.abs(depth - rounded) > 0.001 || target !== rounded;
		if (midFlight) {
			gesture = {
				start: depth,
				min: Math.min(Math.floor(depth), target),
				max: Math.max(Math.ceil(depth), target),
			};
		} else if (direction === "back") {
			gesture = { start: depth, min: rounded - 1, max: rounded };
		} else {
			const top = mounted()[rounded - 1];
			const candidate = forwardCandidate(top);
			if (candidate) {
				setMounted((list) => [...list.slice(0, rounded), candidate]);
			}
			gesture = { start: depth, min: rounded, max: rounded + 1 };
		}
		held = false;
		lastProjected = undefined;
		setMoving(true);
		render();
	};

	const moveGesture = (dx: number) => {
		if (!gesture) return;
		const raw = gesture.start - dx / width;
		depth = bandedValue(raw, gesture.min, gesture.max, 0.25);
		const projected = Math.round(
			Math.min(gesture.max, Math.max(gesture.min, depth)),
		);
		if (lastProjected !== undefined && projected !== lastProjected) {
			haptics.selection();
		}
		lastProjected = projected;
		render();
	};

	const endGesture = (_dx: number, velocityX: number) => {
		if (!gesture) return;
		const depthVelocity = -velocityX / width;
		const next = projectedTarget({
			position: depth,
			velocity: depthVelocity,
			min: gesture.min,
			max: gesture.max,
		});
		gesture = undefined;
		animateTo(next, depthVelocity);
	};

	const cancelGesture = () => {
		if (!gesture) return;
		gesture = undefined;
		held = false;
		animateTo(target, 0);
	};

	const bindSheet = (frame: HTMLElement, index: number) =>
		bindSheetDrag(frame, {
			enabled: () =>
				target === index && !blocksPop(index - 1, () => popTo(index - 1)),
			onStart: () => {
				if (element) height = boxSize(element).height || height;
				sheetAxis = "y";
				stopLoop();
				gesture = { start: depth, min: index - 1, max: index };
				held = false;
				lastProjected = undefined;
				setMoving(true);
				render();
			},
			onMove: (dy) => {
				if (!gesture) return;
				const raw = gesture.start - dy / height;
				depth = bandedValue(raw, gesture.min, gesture.max, 0.25);
				render();
			},
			onEnd: (_dy, velocityY) => {
				if (!gesture) return;
				const depthVelocity = -velocityY / height;
				const next = projectedTarget({
					position: depth,
					velocity: depthVelocity,
					min: gesture.min,
					max: gesture.max,
				});
				gesture = undefined;
				animateTo(next, depthVelocity);
			},
		});

	const attach = (node: HTMLElement) => {
		element = node;
		const measure = () => {
			const size = boxSize(node);
			width = size.width || width;
			height = size.height || height;
		};
		measure();
		const observer = new ResizeObserver(() => {
			measure();
			render();
		});
		observer.observe(node);
		const swallowInactive = (event: MouseEvent) => {
			if (!moving()) return;
			const pane = (event.target as Element | null)?.closest?.<HTMLElement>(
				"[data-pane-index]",
			);
			if (!pane || Number(pane.dataset.paneIndex) === target) return;
			event.preventDefault();
			event.stopPropagation();
		};
		node.addEventListener("click", swallowInactive, true);
		const unbind = bindPan(node, {
			enabled: () => true,
			allow,
			onPress: () => {
				if (!frameRequest) return;
				stopLoop();
				held = true;
				velocity = 0;
			},
			onRelease: () => {
				if (!held) return;
				held = false;
				animateTo(target, 0);
			},
			onStart: startGesture,
			onMove: moveGesture,
			onEnd: endGesture,
			onCancel: cancelGesture,
		});
		onCleanup(() => {
			observer.disconnect();
			node.removeEventListener("click", swallowInactive, true);
			unbind();
			stopLoop();
			cancelAnimationFrame(pushRequest);
			history.dispose();
		});
		history.seed(committed());
		render();
	};

	const registerFrame = (index: number, entry: Frame) => {
		frames.set(index, entry);
		if (element) render();
	};

	const unregisterFrame = (index: number, entry: Frame) => {
		if (frames.get(index)?.frame === entry.frame) frames.delete(index);
	};

	return {
		root,
		setRoot,
		mounted,
		activeDepth,
		moving,
		push,
		replaceTop,
		pop,
		popTo,
		forcePop: () => {
			if (target === 0) return;
			animateTo(target - 1, 0);
		},
		setPopGuard,
		registerLeave: leave.register,
		confirmLeave: leave.confirm,
		leaveGuard: leave.guard,
		depth: () => target,
		attach,
		registerFrame,
		unregisterFrame,
		bindSheet,
		top: (): Layer | undefined => mounted()[activeDepth() - 1],
		isVisible: (match: (layer: Layer) => boolean) => {
			const top = mounted()[activeDepth() - 1];
			return !!top && match(top);
		},
	};
};

export type Stack = ReturnType<typeof createStack>;

export type Navigator = Pick<
	Stack,
	| "root"
	| "setRoot"
	| "mounted"
	| "activeDepth"
	| "moving"
	| "push"
	| "replaceTop"
	| "pop"
	| "popTo"
	| "forcePop"
	| "setPopGuard"
	| "registerLeave"
	| "confirmLeave"
	| "leaveGuard"
	| "depth"
	| "top"
	| "isVisible"
>;

export const StackContext = createContext<Navigator>();

export const useStack = () => {
	const stack = useContext(StackContext);
	if (!stack) throw new Error("useStack needs a StackContext provider");
	return stack;
};
