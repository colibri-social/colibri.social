import { AltArrowLeftIcon } from "@solar-icons/solid/bold/alt-arrow-left";
import { AltArrowRightIcon } from "@solar-icons/solid/bold/alt-arrow-right";
import { CloseIcon } from "@solar-icons/solid/bold/close";
import { LinkIcon } from "@solar-icons/solid/bold/link";
import {
	batch,
	createEffect,
	createMemo,
	createSignal,
	For,
	type JSX,
	on,
	onCleanup,
	Show,
	untrack,
} from "solid-js";
import { Portal } from "solid-js/web";
import { AnimatedDownloadIcon } from "../../icons/animated/navigation";
import { copyText } from "../../utils/clipboard";
import { cx } from "../../utils/cx";
import {
	animateSpring,
	motionScale,
	prefersReducedMotion,
	type SpringConfig,
	type SpringHandle,
	springs,
	springTransition,
} from "../../utils/motion";
import { formatMessageTime, type TimeInput } from "../../utils/time";
import type { MediaItem } from "../Attachments/MediaGrid";
import { IconButton, iconButtonVariants } from "../IconButton/IconButton";
import { VideoPlayer } from "../Media/VideoPlayer";

export type LightboxAuthor = {
	name: string;
	avatarSrc?: string;
};

export type LightboxProps = {
	items: MediaItem[];
	open: boolean;
	onOpenChange: (open: boolean) => void;
	index?: number;
	defaultIndex?: number;
	onIndexChange?: (index: number) => void;
	getOriginElement?: (index: number) => HTMLElement | null | undefined;
	originRect?: DOMRect;
	author?: LightboxAuthor;
	timestamp?: TimeInput;
	now?: TimeInput;
	locale?: string;
	shareUrl?: string | ((index: number) => string);
	onShare?: (index: number) => void;
	label?: string;
};

type Rect = { left: number; top: number; width: number; height: number };
type Phase = "closed" | "opening" | "open" | "closing";
type Gesture =
	| { kind: "idle" }
	| { kind: "pending"; x: number; y: number; at: number }
	| { kind: "swipe" }
	| { kind: "dismiss" }
	| { kind: "pan"; startX: number; startY: number; panX: number; panY: number }
	| {
			kind: "pinch";
			distance: number;
			scale: number;
			panX: number;
			panY: number;
			midX: number;
			midY: number;
	  };

export const LIGHTBOX_ZOOM = 2.5;
const MAX_ZOOM = 4;
const SLIDE_GAP = 24;
const AXIS_LOCK_PX = 8;
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 0.6;
const SWIPE_VELOCITY = 0.45;
const TAP_SLOP_PX = 8;
const TAP_MAX_MS = 300;
const DOUBLE_TAP_MS = 280;
const CHROME_IDLE_MS = 2500;
const COPIED_MS = 1500;
const ORIGIN_RADIUS = 12;

const flight: SpringConfig = { stiffness: 380, damping: 36 };
const settle: SpringConfig = springs.sheet;

const clamp = (value: number, min: number, max: number) =>
	Math.min(max, Math.max(min, value));

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

const lerpRect = (from: Rect, to: Rect, t: number): Rect => ({
	left: lerp(from.left, to.left, t),
	top: lerp(from.top, to.top, t),
	width: lerp(from.width, to.width, t),
	height: lerp(from.height, to.height, t),
});

const toRect = (rect: DOMRect): Rect => ({
	left: rect.left,
	top: rect.top,
	width: rect.width,
	height: rect.height,
});

const isOnScreen = (rect: Rect, width: number, height: number) =>
	rect.width > 0 &&
	rect.height > 0 &&
	rect.left + rect.width > 0 &&
	rect.top + rect.height > 0 &&
	rect.left < width &&
	rect.top < height;

const kindNoun = (item: MediaItem | undefined) =>
	item?.kind === "video" ? "Video" : item?.kind === "gif" ? "GIF" : "Image";

const matches = (query: string) =>
	typeof window !== "undefined" && !!window.matchMedia?.(query).matches;

export const mediaTileOrigin =
	(container: () => HTMLElement | undefined) => (index: number) =>
		container()?.querySelector<HTMLElement>(
			`[data-media-tile][data-index="${index}"]`,
		) ?? null;

export const createLightbox = (options: { defaultIndex?: number } = {}) => {
	const [open, setOpen] = createSignal(false);
	const [index, setIndex] = createSignal(options.defaultIndex ?? 0);
	return {
		open,
		index,
		show: (next: number) =>
			batch(() => {
				setIndex(next);
				setOpen(true);
			}),
		close: () => setOpen(false),
		props: {
			get open() {
				return open();
			},
			onOpenChange: setOpen,
			get index() {
				return index();
			},
			onIndexChange: setIndex,
		},
	};
};

export const Lightbox = (props: LightboxProps) => {
	const [phase, setPhase] = createSignal<Phase>("closed");
	const [internalIndex, setInternalIndex] = createSignal(
		props.index ?? props.defaultIndex ?? 0,
	);
	const [viewport, setViewport] = createSignal({
		width: typeof window === "undefined" ? 0 : window.innerWidth,
		height: typeof window === "undefined" ? 0 : window.innerHeight,
	});
	const [natural, setNatural] = createSignal<
		Record<number, { width: number; height: number }>
	>({});
	const [progress, setProgress] = createSignal(0);
	const [fade, setFade] = createSignal(1);
	const [origin, setOrigin] = createSignal<Rect | undefined>();
	const [swipeX, setSwipeX] = createSignal(0);
	const [dismissY, setDismissY] = createSignal(0);
	const [zoom, setZoom] = createSignal(1);
	const [pan, setPan] = createSignal({ x: 0, y: 0 });
	const [zoomAnimating, setZoomAnimating] = createSignal(false);
	const [chrome, setChrome] = createSignal(true);
	const [copied, setCopied] = createSignal(false);
	const [altExpanded, setAltExpanded] = createSignal(false);
	const [desktop, setDesktop] = createSignal(
		matches("(hover: hover) and (pointer: fine)"),
	);

	let root: HTMLDivElement | undefined;
	let stage: HTMLDivElement | undefined;
	let pressStart: { x: number; y: number } | undefined;
	let lastMouseToggle = 0;
	let closeButton: HTMLButtonElement | undefined;
	let returnFocus: HTMLElement | null = null;
	let spring: SpringHandle | undefined;
	let chromeTimer: ReturnType<typeof setTimeout> | undefined;
	let copiedTimer: ReturnType<typeof setTimeout> | undefined;
	let tapTimer: ReturnType<typeof setTimeout> | undefined;
	let lastTap: { x: number; y: number; at: number } | undefined;
	let gesture: Gesture = { kind: "idle" };
	const pointers = new Map<number, { x: number; y: number }>();
	let samples: { x: number; y: number; at: number }[] = [];
	let previousOverflow = "";

	const index = () => clamp(internalIndex(), 0, props.items.length - 1);
	const item = () => props.items[index()];
	const count = () => props.items.length;
	const mounted = () => phase() !== "closed";
	const zoomed = () => zoom() > 1.01;
	const isVideo = (target?: MediaItem) => target?.kind === "video";

	createEffect(
		on(
			() => props.index,
			(next) => {
				if (next !== undefined) setInternalIndex(next);
			},
		),
	);

	const setIndex = (next: number) => {
		const bounded = clamp(next, 0, count() - 1);
		if (bounded === index()) return;
		batch(() => {
			setInternalIndex(bounded);
			setZoom(1);
			setPan({ x: 0, y: 0 });
			setAltExpanded(false);
		});
		props.onIndexChange?.(bounded);
	};

	const padding = () =>
		desktop() ? { x: 72, top: 64, bottom: 64 } : { x: 0, top: 56, bottom: 56 };

	const sizeOf = (target: number) => {
		const known = natural()[target];
		if (known) return known;
		const entry = props.items[target];
		if (entry?.width && entry.height)
			return { width: entry.width, height: entry.height };
		return { width: 4, height: 3 };
	};

	const fittedRect = (target: number): Rect => {
		const { width: vw, height: vh } = viewport();
		const pad = padding();
		const size = sizeOf(target);
		const availableWidth = Math.max(1, vw - pad.x * 2);
		const availableHeight = Math.max(1, vh - pad.top - pad.bottom);
		const scale = Math.min(
			availableWidth / size.width,
			availableHeight / size.height,
			desktop() ? 1 : Number.POSITIVE_INFINITY,
		);
		const width = size.width * scale;
		const height = size.height * scale;
		return {
			left: (vw - width) / 2,
			top: pad.top + (availableHeight - height) / 2,
			width,
			height,
		};
	};

	const originFor = (target: number): Rect | undefined => {
		const element = props.getOriginElement?.(target);
		if (element) return toRect(element.getBoundingClientRect());
		if (target === untrack(index) && props.originRect)
			return toRect(props.originRect);
		return undefined;
	};

	const currentRect = createMemo((): Rect => {
		const target = fittedRect(index());
		const from = origin();
		if (!from || phase() === "open") return target;
		return lerpRect(from, target, progress());
	});

	const radius = () => {
		if (!origin() || phase() === "open") return 0;
		return ORIGIN_RADIUS * (1 - progress());
	};

	const dismissRatio = () =>
		Math.min(1, Math.abs(dismissY()) / (viewport().height * 0.45));

	const backdropOpacity = () => {
		const base = origin() ? progress() : fade();
		return clamp(base, 0, 1) * (1 - dismissRatio() * 0.85);
	};

	const chromeOpacity = () =>
		phase() === "open" && chrome() && dismissRatio() < 0.05 ? 1 : 0;

	const stopSpring = () => {
		spring?.stop();
		spring = undefined;
	};

	const runSpring = (
		from: number,
		to: number,
		config: SpringConfig,
		onUpdate: (value: number) => void,
		velocity = 0,
	) => {
		stopSpring();
		const handle = animateSpring({ from, to, config, onUpdate, velocity });
		spring = handle;
		return handle.finished;
	};

	const lockScroll = () => {
		previousOverflow = document.documentElement.style.overflow;
		document.documentElement.style.overflow = "hidden";
	};

	const unlockScroll = () => {
		document.documentElement.style.overflow = previousOverflow;
	};

	const onResize = () => {
		setViewport({ width: window.innerWidth, height: window.innerHeight });
		setDesktop(matches("(hover: hover) and (pointer: fine)"));
	};

	const restoreFocus = () => {
		const tile = props.getOriginElement?.(index());
		const target =
			tile?.querySelector<HTMLElement>("button, a, [tabindex]") ??
			tile ??
			returnFocus;
		target?.focus({ preventScroll: true });
	};

	const finishClose = () => {
		stopSpring();
		batch(() => {
			setPhase("closed");
			setOrigin(undefined);
			setSwipeX(0);
			setDismissY(0);
			setZoom(1);
			setPan({ x: 0, y: 0 });
			setChrome(true);
		});
		unlockScroll();
		window.removeEventListener("resize", onResize);
		restoreFocus();
	};

	const openViewer = () => {
		returnFocus = document.activeElement as HTMLElement | null;
		onResize();
		lockScroll();
		window.addEventListener("resize", onResize);
		const from = originFor(index());
		const reduced = prefersReducedMotion();
		const flies =
			!!from &&
			!reduced &&
			isOnScreen(from, viewport().width, viewport().height);
		batch(() => {
			setOrigin(flies ? from : undefined);
			setProgress(flies ? 0 : 1);
			setFade(flies ? 1 : 0);
			setChrome(true);
			setPhase("opening");
		});
		queueMicrotask(() => closeButton?.focus({ preventScroll: true }));
		const done = flies
			? runSpring(0, 1, flight, setProgress)
			: runSpring(0, 1, springs.overlayIn, setFade);
		void done.then(() => {
			if (phase() !== "opening") return;
			batch(() => {
				setOrigin(undefined);
				setProgress(1);
				setFade(1);
				setPhase("open");
			});
			scheduleChromeHide();
		});
	};

	const closeViewer = () => {
		if (phase() === "closed" || phase() === "closing") return;
		const reduced = prefersReducedMotion();
		const to = zoomed() || reduced ? undefined : originFor(index());
		const start: Rect = {
			...currentRect(),
			top: currentRect().top + dismissY(),
		};
		const flies = !!to && isOnScreen(to, viewport().width, viewport().height);
		batch(() => {
			setPhase("closing");
			setSwipeX(0);
			setZoom(1);
			setPan({ x: 0, y: 0 });
		});
		if (flies && to) {
			batch(() => {
				setDismissY(0);
				setOrigin(to);
				setProgress(1);
			});
			const lift = start.top - fittedRect(index()).top;
			const startProgress = 1;
			void runSpring(startProgress, 0, flight, (value) => {
				batch(() => {
					setProgress(value);
					setDismissY(lift * value);
				});
			}).then(finishClose);
			return;
		}
		const fromFade = fade() * (1 - dismissRatio());
		void runSpring(fromFade, 0, springs.overlayIn, setFade).then(finishClose);
	};

	createEffect(
		on(
			() => props.open,
			(isOpen) => {
				if (isOpen && (phase() === "closed" || phase() === "closing")) {
					if (phase() === "closing") finishClose();
					openViewer();
				} else if (!isOpen && mounted()) {
					closeViewer();
				}
			},
		),
	);

	const requestClose = () => props.onOpenChange(false);

	onCleanup(() => {
		stopSpring();
		clearTimeout(chromeTimer);
		clearTimeout(copiedTimer);
		clearTimeout(tapTimer);
		if (mounted()) {
			unlockScroll();
			window.removeEventListener("resize", onResize);
		}
	});

	createEffect(() => {
		if (!mounted()) return;
		for (const neighbor of [index() - 1, index() + 1]) {
			const entry = props.items[neighbor];
			if (!entry || isVideo(entry)) continue;
			const image = new Image();
			image.src = entry.src;
		}
	});

	const scheduleChromeHide = () => {
		clearTimeout(chromeTimer);
		if (!desktop()) return;
		chromeTimer = setTimeout(() => {
			if (root?.querySelector("[data-lightbox-chrome]:focus-within")) return;
			setChrome(false);
		}, CHROME_IDLE_MS * motionScale());
	};

	const onRootPointerMove = (event: PointerEvent) => {
		if (event.pointerType !== "mouse") return;
		setChrome(true);
		scheduleChromeHide();
	};

	const go = (direction: -1 | 1) => {
		const next = index() + direction;
		if (next < 0 || next >= count() || phase() !== "open") return;
		const distance = viewport().width + SLIDE_GAP;
		const reduced = prefersReducedMotion();
		if (reduced) {
			setSwipeX(0);
			setIndex(next);
			return;
		}
		void runSpring(swipeX(), -direction * distance, settle, setSwipeX).then(
			() =>
				batch(() => {
					setSwipeX(0);
					setIndex(next);
				}),
		);
	};

	const panBounds = (scale: number) => {
		const rect = fittedRect(index());
		const { width, height } = viewport();
		return {
			x: Math.max(0, (rect.width * scale - width) / 2),
			y: Math.max(0, (rect.height * scale - height) / 2),
		};
	};

	const clampPan = (next: { x: number; y: number }, scale: number) => {
		const bounds = panBounds(scale);
		return {
			x: clamp(next.x, -bounds.x, bounds.x),
			y: clamp(next.y, -bounds.y, bounds.y),
		};
	};

	const centerOffset = (clientX: number, clientY: number) => {
		const rect = fittedRect(index());
		return {
			x: clientX - (rect.left + rect.width / 2),
			y: clientY - (rect.top + rect.height / 2),
		};
	};

	const toggleZoom = (clientX: number, clientY: number) => {
		if (isVideo(item())) return;
		setZoomAnimating(!prefersReducedMotion());
		if (zoomed()) {
			batch(() => {
				setZoom(1);
				setPan({ x: 0, y: 0 });
			});
			return;
		}
		const point = centerOffset(clientX, clientY);
		batch(() => {
			setZoom(LIGHTBOX_ZOOM);
			setPan(
				clampPan(
					{
						x: point.x * (1 - LIGHTBOX_ZOOM),
						y: point.y * (1 - LIGHTBOX_ZOOM),
					},
					LIGHTBOX_ZOOM,
				),
			);
		});
	};

	const velocity = () => {
		if (samples.length < 2) return { x: 0, y: 0 };
		const first = samples[0] as { x: number; y: number; at: number };
		const last = samples[samples.length - 1] as {
			x: number;
			y: number;
			at: number;
		};
		const elapsed = Math.max(1, last.at - first.at);
		return { x: (last.x - first.x) / elapsed, y: (last.y - first.y) / elapsed };
	};

	const track = (x: number, y: number) => {
		const at = performance.now();
		samples.push({ x, y, at });
		samples = samples.filter((sample) => at - sample.at < 100);
	};

	const pinchState = () => {
		const [a, b] = [...pointers.values()] as [
			{ x: number; y: number },
			{ x: number; y: number },
		];
		return {
			distance: Math.hypot(a.x - b.x, a.y - b.y),
			midX: (a.x + b.x) / 2,
			midY: (a.y + b.y) / 2,
		};
	};

	const onPointerDown = (event: PointerEvent) => {
		if (phase() !== "open") return;
		if (event.pointerType === "mouse" && event.button !== 0) return;
		if (
			(event.target as Element).closest(
				"[data-video-controls], [data-lightbox-chrome]",
			)
		)
			return;
		pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		pressStart =
			pointers.size === 1 ? { x: event.clientX, y: event.clientY } : undefined;
		stopSpring();
		setZoomAnimating(false);
		if (pointers.size === 2 && !isVideo(item())) {
			for (const id of pointers.keys()) capture(id);
			const state = pinchState();
			const point = centerOffset(state.midX, state.midY);
			gesture = {
				kind: "pinch",
				distance: state.distance,
				scale: zoom(),
				panX: pan().x,
				panY: pan().y,
				midX: point.x,
				midY: point.y,
			};
			return;
		}
		if (pointers.size > 1) return;
		samples = [];
		track(event.clientX, event.clientY);
		gesture = zoomed()
			? {
					kind: "pan",
					startX: event.clientX,
					startY: event.clientY,
					panX: pan().x,
					panY: pan().y,
				}
			: {
					kind: "pending",
					x: event.clientX,
					y: event.clientY,
					at: performance.now(),
				};
	};

	const pendingStart = { x: 0, y: 0 };

	const capture = (pointerId: number) => {
		try {
			if (!stage?.hasPointerCapture(pointerId))
				stage?.setPointerCapture(pointerId);
		} catch {}
	};

	const mediaHit = (clientX: number, clientY: number) => {
		const rect = fittedRect(index());
		const scale = zoom();
		const centerX = rect.left + rect.width / 2 + pan().x;
		const centerY = rect.top + rect.height / 2 + pan().y;
		return (
			Math.abs(clientX - centerX) <= (rect.width * scale) / 2 &&
			Math.abs(clientY - centerY) <= (rect.height * scale) / 2
		);
	};

	const mouseClick = (event: PointerEvent) => {
		const target = event.target as Element;
		if (target.closest("[data-lightbox-chrome], [data-video-player]")) return;
		const now = performance.now();
		if (now - lastMouseToggle < DOUBLE_TAP_MS * motionScale()) return;
		if (!isVideo(item()) && mediaHit(event.clientX, event.clientY)) {
			lastMouseToggle = now;
			toggleZoom(event.clientX, event.clientY);
			return;
		}
		requestClose();
	};

	const onPointerMove = (event: PointerEvent) => {
		if (!pointers.has(event.pointerId)) return;
		pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		track(event.clientX, event.clientY);
		const current = gesture;
		if (current.kind === "pinch" && pointers.size >= 2) {
			const state = pinchState();
			const scale = clamp(
				(current.scale * state.distance) / Math.max(1, current.distance),
				1,
				MAX_ZOOM,
			);
			const ratio = scale / current.scale;
			const point = centerOffset(state.midX, state.midY);
			batch(() => {
				setZoom(scale);
				setPan(
					clampPan(
						{
							x: point.x - (current.midX - current.panX) * ratio,
							y: point.y - (current.midY - current.panY) * ratio,
						},
						scale,
					),
				);
			});
			return;
		}
		if (current.kind === "pan") {
			capture(event.pointerId);
			setPan(
				clampPan(
					{
						x: current.panX + event.clientX - current.startX,
						y: current.panY + event.clientY - current.startY,
					},
					zoom(),
				),
			);
			return;
		}
		if (current.kind === "pending") {
			const dx = event.clientX - current.x;
			const dy = event.clientY - current.y;
			if (Math.max(Math.abs(dx), Math.abs(dy)) < AXIS_LOCK_PX) return;
			pendingStart.x = current.x;
			pendingStart.y = current.y;
			gesture =
				Math.abs(dx) > Math.abs(dy) ? { kind: "swipe" } : { kind: "dismiss" };
			capture(event.pointerId);
			clearTimeout(tapTimer);
			lastTap = undefined;
		}
		if (gesture.kind === "swipe") {
			const raw = event.clientX - pendingStart.x;
			const atEdge =
				(raw > 0 && index() === 0) || (raw < 0 && index() === count() - 1);
			setSwipeX(atEdge ? raw * 0.3 : raw);
			return;
		}
		if (gesture.kind === "dismiss") {
			setDismissY(event.clientY - pendingStart.y);
		}
	};

	const handleTap = (event: PointerEvent) => {
		const now = performance.now();
		const target = event.target as Element;
		if (target.closest("[data-video-player]")) return;
		const onMedia = !!target.closest("[data-lightbox-media]");
		if (
			lastTap &&
			now - lastTap.at < DOUBLE_TAP_MS * motionScale() &&
			Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) <
				TAP_SLOP_PX * 4
		) {
			clearTimeout(tapTimer);
			lastTap = undefined;
			toggleZoom(event.clientX, event.clientY);
			return;
		}
		lastTap = { x: event.clientX, y: event.clientY, at: now };
		clearTimeout(tapTimer);
		tapTimer = setTimeout(() => {
			lastTap = undefined;
			if (desktop() && !onMedia && !zoomed()) {
				requestClose();
				return;
			}
			setChrome((visible) => !visible);
		}, DOUBLE_TAP_MS * motionScale());
	};

	const onPointerUp = (event: PointerEvent) => {
		if (!pointers.has(event.pointerId)) return;
		pointers.delete(event.pointerId);
		const current = gesture;
		if (current.kind === "pinch") {
			if (pointers.size === 1) {
				const [remaining] = [...pointers.values()] as [
					{ x: number; y: number },
				];
				gesture = {
					kind: "pan",
					startX: remaining.x,
					startY: remaining.y,
					panX: pan().x,
					panY: pan().y,
				};
				return;
			}
			gesture = { kind: "idle" };
			if (zoom() < 1.05) {
				setZoomAnimating(!prefersReducedMotion());
				batch(() => {
					setZoom(1);
					setPan({ x: 0, y: 0 });
				});
			}
			return;
		}
		if (pointers.size > 0) return;
		gesture = { kind: "idle" };
		const speed = velocity();
		const start = pressStart;
		pressStart = undefined;
		const still =
			!!start &&
			Math.hypot(event.clientX - start.x, event.clientY - start.y) <
				TAP_SLOP_PX;
		if (
			event.pointerType === "mouse" &&
			still &&
			(current.kind === "pending" || current.kind === "pan")
		) {
			mouseClick(event);
			return;
		}
		if (current.kind === "pending") {
			const elapsed = performance.now() - current.at;
			if (elapsed < TAP_MAX_MS * motionScale() && event.pointerType !== "mouse")
				handleTap(event);
			return;
		}
		if (current.kind === "swipe") {
			const distance = viewport().width * 0.25;
			const dx = swipeX();
			const direction =
				dx < -distance || speed.x < -SWIPE_VELOCITY
					? 1
					: dx > distance || speed.x > SWIPE_VELOCITY
						? -1
						: 0;
			const target = index() + direction;
			if (direction !== 0 && target >= 0 && target < count()) {
				go(direction as -1 | 1);
				return;
			}
			void runSpring(dx, 0, settle, setSwipeX, speed.x * 1000);
			return;
		}
		if (current.kind === "dismiss") {
			const dy = dismissY();
			if (
				Math.abs(dy) > DISMISS_DISTANCE ||
				Math.abs(speed.y) > DISMISS_VELOCITY
			) {
				requestClose();
				return;
			}
			void runSpring(dy, 0, settle, setDismissY, speed.y * 1000);
		}
	};

	const onPointerCancel = (event: PointerEvent) => {
		pointers.delete(event.pointerId);
		if (pointers.size > 0) return;
		gesture = { kind: "idle" };
		void runSpring(swipeX(), 0, settle, setSwipeX);
		void runSpring(dismissY(), 0, settle, setDismissY);
	};

	const focusables = () =>
		[
			...(root?.querySelectorAll<HTMLElement>(
				"a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])",
			) ?? []),
		].filter(
			(element) =>
				element.offsetParent !== null || element === document.activeElement,
		);

	const onKeyDown = (event: KeyboardEvent) => {
		if (event.key === "Escape") {
			event.preventDefault();
			requestClose();
			return;
		}
		if (event.key === "ArrowRight") {
			event.preventDefault();
			go(1);
			return;
		}
		if (event.key === "ArrowLeft") {
			event.preventDefault();
			go(-1);
			return;
		}
		if (event.key === "Tab") {
			setChrome(true);
			scheduleChromeHide();
			const list = focusables();
			if (list.length === 0) {
				event.preventDefault();
				return;
			}
			const first = list[0] as HTMLElement;
			const last = list[list.length - 1] as HTMLElement;
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		}
	};

	const shareTarget = () => {
		const url = props.shareUrl;
		if (!url) return undefined;
		return typeof url === "function" ? url(index()) : url;
	};

	const share = async (event: MouseEvent) => {
		if (props.onShare) {
			props.onShare(index());
			return;
		}
		const url = shareTarget();
		if (!url) return;
		if (!(await copyText(url, event.currentTarget as HTMLElement))) return;
		clearTimeout(copiedTimer);
		setCopied(true);
		copiedTimer = setTimeout(() => setCopied(false), COPIED_MS);
	};

	const dialogLabel = () => {
		if (props.label) return props.label;
		const noun = kindNoun(item());
		const position = count() > 1 ? ` ${index() + 1} of ${count()}` : "";
		const from = props.author ? ` from ${props.author.name}` : "";
		return `${noun}${position}${from}`;
	};

	const slideStyle = (offset: number): JSX.CSSProperties => {
		if (offset === 0) {
			const rect = currentRect();
			const scale = 1 - dismissRatio() * 0.25;
			const fadeScale = origin() ? 1 : 0.94 + 0.06 * fade();
			return {
				left: `${rect.left}px`,
				top: `${rect.top}px`,
				width: `${rect.width}px`,
				height: `${rect.height}px`,
				"border-radius": `${radius()}px`,
				opacity: origin() ? 1 : fade(),
				transform: `translate3d(${swipeX()}px, ${dismissY()}px, 0) scale(${scale * fadeScale})`,
			};
		}
		const rect = fittedRect(index() + offset);
		const shift = offset * (viewport().width + SLIDE_GAP) + swipeX();
		return {
			left: `${rect.left}px`,
			top: `${rect.top}px`,
			width: `${rect.width}px`,
			height: `${rect.height}px`,
			transform: `translate3d(${shift}px, 0, 0)`,
		};
	};

	const mediaStyle = (offset: number): JSX.CSSProperties | undefined => {
		if (offset !== 0) return undefined;
		return {
			transform: `translate3d(${pan().x}px, ${pan().y}px, 0) scale(${zoom()})`,
			transition: zoomAnimating()
				? springTransition("transform", springs.overlayIn)
				: "none",
		};
	};

	const rememberSize = (
		target: number,
		element: HTMLImageElement | HTMLVideoElement,
	) => {
		if (element instanceof HTMLVideoElement && element.error) return;
		const width =
			element instanceof HTMLImageElement
				? element.naturalWidth
				: element.videoWidth;
		const height =
			element instanceof HTMLImageElement
				? element.naturalHeight
				: element.videoHeight;
		if (!width || !height) return;
		const entry = props.items[target];
		if (entry?.width && entry.height) return;
		setNatural((previous) => ({ ...previous, [target]: { width, height } }));
	};

	const slides = () =>
		phase() === "open"
			? [-1, 0, 1].filter((offset) => props.items[index() + offset])
			: [0];

	const chromeButton = cx(
		iconButtonVariants({ variant: "ghost", size: "lg" }),
		"border-transparent text-white enabled:hover:bg-white/10 hover:bg-white/10 data-pressed:bg-white/15",
	);

	return (
		<Show when={mounted() && item()}>
			<Portal>
				<div
					ref={root}
					role="dialog"
					aria-modal="true"
					aria-label={dialogLabel()}
					data-lightbox=""
					data-phase={phase()}
					data-zoomed={zoomed() || undefined}
					data-index={index()}
					tabindex="-1"
					class="fixed inset-0 z-[70] overflow-hidden text-white outline-none select-none [-webkit-touch-callout:none]"
					onKeyDown={onKeyDown}
					onPointerMove={onRootPointerMove}
				>
					<div
						aria-hidden="true"
						data-lightbox-backdrop=""
						class="absolute inset-0 bg-black/95"
						style={{ opacity: backdropOpacity() }}
					/>
					<div
						ref={stage}
						data-lightbox-stage=""
						class="absolute inset-0 touch-none"
						onPointerDown={onPointerDown}
						onPointerMove={onPointerMove}
						onPointerUp={onPointerUp}
						onPointerCancel={onPointerCancel}
					>
						<For each={slides()}>
							{(offset) => {
								const target = () => index() + offset;
								const entry = () => props.items[target()];
								return (
									<div
										data-lightbox-slide={offset}
										class={cx(
											"absolute will-change-transform",
											offset === 0 && (zoomed() || zoomAnimating())
												? "z-10 overflow-visible"
												: "overflow-hidden",
										)}
										style={slideStyle(offset)}
									>
										<Show
											when={isVideo(entry())}
											fallback={
												<img
													data-lightbox-media=""
													src={entry()?.src}
													alt={entry()?.alt ?? ""}
													draggable={false}
													onLoad={(event) =>
														rememberSize(target(), event.currentTarget)
													}
													class={cx(
														"block size-full object-cover",
														zoomed() && offset === 0
															? "cursor-zoom-out"
															: "cursor-zoom-in",
													)}
													style={mediaStyle(offset)}
												/>
											}
										>
											<Show
												when={offset === 0}
												fallback={
													<Show
														when={entry()?.poster}
														fallback={
															<video
																data-lightbox-media=""
																src={entry()?.src}
																aria-label={
																	entry()?.alt ?? entry()?.name ?? "Video"
																}
																tabindex={-1}
																muted
																playsinline
																preload="metadata"
																class="block size-full bg-black object-contain"
															/>
														}
													>
														{(poster) => (
															<img
																data-lightbox-media=""
																src={poster()}
																alt=""
																draggable={false}
																class="block size-full bg-black object-contain"
															/>
														)}
													</Show>
												}
											>
												<VideoPlayer
													src={entry()?.src ?? ""}
													poster={entry()?.poster}
													label={entry()?.alt ?? entry()?.name ?? "Video"}
													handoff="viewer"
													interactive={phase() === "open"}
													onReady={(video) => rememberSize(target(), video)}
													class="size-full"
												/>
											</Show>
										</Show>
									</div>
								);
							}}
						</For>
					</div>
					<div
						data-lightbox-chrome=""
						class="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-linear-to-b from-black/70 to-transparent px-safe-offset-3 pt-safe-offset-2 pb-6"
						style={{
							opacity: chromeOpacity(),
							transition: `opacity calc(160ms * var(--motion-scale)) ease-out`,
						}}
					>
						<div class="pointer-events-auto flex min-w-0 flex-col justify-center gap-0.5 py-1.5">
							<Show when={props.author}>
								{(author) => (
									<span class="truncate text-sm font-semibold">
										{author().name}
									</span>
								)}
							</Show>
							<Show when={props.timestamp !== undefined}>
								<span class="truncate text-xs text-white/70">
									{formatMessageTime(
										props.timestamp as TimeInput,
										props.now,
										props.locale,
									)}
								</span>
							</Show>
						</div>
						<Show when={count() > 1}>
							<span
								data-lightbox-counter=""
								class="pointer-events-auto absolute top-[calc(var(--safe-area-top,0px)+14px)] left-1/2 -translate-x-1/2 rounded-control-xs bg-black/40 px-2 py-0.5 text-sm font-semibold tabular-nums"
							>
								{index() + 1} / {count()}
							</span>
						</Show>
						<div class="pointer-events-auto flex shrink-0 items-center gap-1">
							<Show when={item()?.downloadHref}>
								{(href) => (
									<a
										href={href()}
										download={item()?.name ?? ""}
										data-icon-host=""
										aria-label="Download"
										title="Download"
										class={chromeButton}
									>
										<AnimatedDownloadIcon />
									</a>
								)}
							</Show>
							<Show when={props.onShare || props.shareUrl}>
								<button
									type="button"
									aria-label={copied() ? "Link copied" : "Copy link"}
									title="Copy link"
									class={chromeButton}
									onClick={(event) => void share(event)}
								>
									<LinkIcon />
								</button>
								<span
									role="status"
									class={cx(
										"text-xs font-semibold transition-opacity",
										copied() ? "opacity-100" : "w-0 overflow-hidden opacity-0",
									)}
								>
									{copied() ? "Copied" : ""}
								</span>
							</Show>
							<button
								ref={closeButton}
								type="button"
								aria-label="Close"
								title="Close"
								class={chromeButton}
								onClick={requestClose}
							>
								<CloseIcon />
							</button>
						</div>
					</div>
					<Show when={desktop() && count() > 1}>
						<div
							data-lightbox-chrome=""
							class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-safe-offset-4"
							style={{ opacity: chromeOpacity() }}
						>
							<IconButton
								label="Previous"
								variant="ghost"
								size="xl"
								icon={<AltArrowLeftIcon />}
								disabled={index() === 0}
								class="pointer-events-auto border-transparent bg-black/40 text-white enabled:hover:bg-white/15"
								onClick={() => go(-1)}
							/>
						</div>
						<div
							data-lightbox-chrome=""
							class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-safe-offset-4"
							style={{ opacity: chromeOpacity() }}
						>
							<IconButton
								label="Next"
								variant="ghost"
								size="xl"
								icon={<AltArrowRightIcon />}
								disabled={index() === count() - 1}
								class="pointer-events-auto border-transparent bg-black/40 text-white enabled:hover:bg-white/15"
								onClick={() => go(1)}
							/>
						</div>
					</Show>
					<Show when={item()?.alt}>
						{(alt) => (
							<div
								data-lightbox-chrome=""
								class="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-linear-to-t from-black/75 to-transparent px-safe-offset-4 pt-10 pb-safe-offset-4"
								style={{
									opacity: chromeOpacity(),
									transition: `opacity calc(160ms * var(--motion-scale)) ease-out`,
								}}
							>
								<div class="pointer-events-auto flex max-w-[640px] flex-col items-start gap-1">
									<p
										data-lightbox-alt=""
										class={cx(
											"m-0 text-sm text-pretty text-white/90",
											!altExpanded() && "line-clamp-2",
										)}
									>
										<span class="mr-1.5 rounded-badge bg-white/15 px-1 text-xs font-bold">
											ALT
										</span>
										{alt()}
									</p>
									<Show when={alt().length > 120}>
										<button
											type="button"
											class="cursor-pointer rounded-control-xs border-0 bg-transparent p-0 text-xs font-semibold text-white/70 hover:text-white"
											aria-expanded={altExpanded()}
											onClick={() => setAltExpanded((value) => !value)}
										>
											{altExpanded() ? "Show less" : "Show more"}
										</button>
									</Show>
								</div>
							</div>
						)}
					</Show>
				</div>
			</Portal>
		</Show>
	);
};
