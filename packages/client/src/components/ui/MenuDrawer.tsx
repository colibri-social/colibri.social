import {
	type ComponentProps,
	createEffect,
	createMemo,
	createSignal,
	type JSX,
	on,
	onCleanup,
	Show,
	splitProps,
	useContext,
} from "solid-js";
import { Portal } from "solid-js/web";
import { ViewportContext } from "../../contexts/Viewport";
import { usePortalMount } from "../../embed/context";
import { createHistoryBackClose } from "../../hooks/createHistoryBackClose";
import { cx } from "../../utils/cva";
import { animateKeyboardTransition } from "../../utils/keyboard-animation";
import { useIsMobile } from "../../utils/mobile-pane";
import { useIsTouch } from "../../utils/touch";
import { ScrollFadeBottom } from "./ScrollFadeBottom";

export const DRAWER_TRANSITION_MS = 300;

export const handoffDrawer = (close: () => void, open: () => void) => {
	close();
	window.setTimeout(open, DRAWER_TRANSITION_MS + 30);
};

const [openDrawerCount, setOpenDrawerCount] = createSignal(0);
export const isDrawerOpen = () => openDrawerCount() > 0;

export interface BottomSheetProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	children: JSX.Element;
	class?: string;
	hideHandle?: boolean;
	handleOverlay?: boolean;
}

const HALF_VIEWPORT = 0.5;
const MAX_VIEWPORT = 0.92;
const FLICK_VELOCITY = 0.5;
const FLICK_DISTANCE = 40;
const CLOSE_DISTANCE = 120;

const clamp = (value: number, min: number, max: number) =>
	Math.min(max, Math.max(min, value));

/**
 * A self-contained mobile bottom sheet. Short content hugs its natural
 * height like a normal sheet; content taller than half the viewport opens
 * collapsed to ~50dvh and can be dragged up via the handle to ~92dvh,
 * matching native bottom sheet detents.
 */
export const BottomSheet = (props: BottomSheetProps) => {
	const [mounted, setMounted] = createSignal(props.open);
	const [shown, setShown] = createSignal(false);
	const [dragging, setDragging] = createSignal(false);
	const [dragDeltaY, setDragDeltaY] = createSignal(0);
	const [expanded, setExpanded] = createSignal(false);
	const [contentEl, setContentEl] = createSignal<HTMLElement>();
	const [contentHeight, setContentHeight] = createSignal(0);

	const viewportCtx = useContext(ViewportContext);
	const isMobile = useIsMobile();
	const isTouch = useIsTouch();
	const tracksViewport = () => isMobile() || isTouch();
	const keyboardOffset = () =>
		tracksViewport() ? (viewportCtx?.keyboardInset() ?? 0) : 0;
	const viewportHeightPx = () =>
		(tracksViewport() ? viewportCtx?.height() : undefined) ??
		window.innerHeight;
	const halfHeightPx = () => viewportHeightPx() * HALF_VIEWPORT;
	// Never ask for more than the content actually has — natural content is
	// always >= halfHeightPx here since isTall() gates it, but it can be
	// less than the 92% ceiling, in which case there's nothing more to
	// reveal past the content's own natural height.
	const fullHeightPx = () =>
		Math.min(viewportHeightPx() * MAX_VIEWPORT, contentHeight());
	const isTall = () => contentHeight() > halfHeightPx();

	let sheetAnimation: Animation | undefined;

	createEffect(
		on(
			() => viewportCtx?.keyboardTransition(),
			(transition) => {
				const node = contentEl();
				if (!transition || !node || !tracksViewport()) return;
				sheetAnimation?.cancel();
				sheetAnimation = animateKeyboardTransition(
					node,
					transition,
					(inset) => ({
						bottom: `${Math.max(0, inset)}px`,
					}),
				);
			},
			{ defer: true },
		),
	);

	onCleanup(() => sheetAnimation?.cancel());

	let closeTimer: number | undefined;
	let raf1 = 0;
	let raf2 = 0;
	let openedAt = 0;

	// Measure the sheet's natural (unconstrained) content height exactly
	// once per open. We can't keep re-measuring reactively: as soon as a
	// height constraint is applied below, flex-shrink children collapse to
	// fit it, which would shrink the very value we're measuring and create
	// a feedback loop (constrain -> measure smaller -> un-constrain -> ...).
	createEffect(() => {
		const node = contentEl();
		if (!node || !mounted()) return;
		let measured = false;
		const update = () => {
			if (measured) return;
			const height = node.scrollHeight;
			if (height > 0) {
				measured = true;
				setContentHeight(height);
			}
		};
		update();
		const resizeObserver = new ResizeObserver(update);
		resizeObserver.observe(node);
		onCleanup(() => resizeObserver.disconnect());
	});

	createEffect(() => {
		if (props.open) {
			clearTimeout(closeTimer);
			setDragDeltaY(0);
			setExpanded(false);
			setContentHeight(0);
			setMounted(true);
			openedAt = performance.now();
			raf1 = requestAnimationFrame(() => {
				raf2 = requestAnimationFrame(() => setShown(true));
			});
		} else if (mounted()) {
			setShown(false);
			closeTimer = window.setTimeout(() => {
				setMounted(false);
				setDragDeltaY(0);
			}, DRAWER_TRANSITION_MS);
		}
	});

	onCleanup(() => {
		clearTimeout(closeTimer);
		cancelAnimationFrame(raf1);
		cancelAnimationFrame(raf2);
	});

	// Keep pane-swipe gestures disarmed while any sheet is open or mid-close
	createEffect(() => {
		if (!mounted()) return;
		setOpenDrawerCount((c) => c + 1);
		onCleanup(() => setOpenDrawerCount((c) => c - 1));
	});

	// Lock body scroll while a sheet is mounted
	createEffect(() => {
		if (!mounted()) return;
		const previous = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		onCleanup(() => {
			document.body.style.overflow = previous;
		});
	});

	const close = () => props.onOpenChange(false);

	createHistoryBackClose(() => tracksViewport() && props.open, close);

	// Close on a fresh tap outside
	const onBackdropPointerDown = () => {
		if (performance.now() - openedAt < 150) return;
		close();
	};

	let dragStartY = 0;
	let dragStartT = 0;

	const onHandlePointerMove = (e: PointerEvent) => {
		setDragDeltaY(e.clientY - dragStartY);
	};

	const endHandleDrag = () => {
		document.removeEventListener("pointermove", onHandlePointerMove);
		document.removeEventListener("pointerup", onHandlePointerUp);
		document.removeEventListener("pointercancel", onHandlePointerUp);
	};

	const onHandlePointerUp = (e: PointerEvent) => {
		endHandleDrag();
		const dy = e.clientY - dragStartY;
		const dt = performance.now() - dragStartT || 1;
		const flickDown = dy / dt > FLICK_VELOCITY && dy > FLICK_DISTANCE;
		const flickUp = -dy / dt > FLICK_VELOCITY && dy < -FLICK_DISTANCE;
		setDragging(false);

		if (!isTall()) {
			if (dy > CLOSE_DISTANCE || flickDown) close();
		} else if (dy < 0) {
			const growRoom = fullHeightPx() - halfHeightPx();
			if (!expanded() && (flickUp || -dy > growRoom / 2)) setExpanded(true);
		} else if (expanded()) {
			const shrinkRoom = fullHeightPx() - halfHeightPx();
			if (dy <= shrinkRoom) {
				if (dy > shrinkRoom / 2 || flickDown) setExpanded(false);
			} else {
				const remainder = dy - shrinkRoom;
				if (remainder > CLOSE_DISTANCE || flickDown) close();
				else setExpanded(false);
			}
		} else if (dy > CLOSE_DISTANCE || flickDown) {
			close();
		}
		setDragDeltaY(0);
	};

	const onHandlePointerDown = (e: PointerEvent) => {
		dragStartY = e.clientY;
		dragStartT = performance.now();
		setDragging(true);
		document.addEventListener("pointermove", onHandlePointerMove);
		document.addEventListener("pointerup", onHandlePointerUp);
		document.addEventListener("pointercancel", onHandlePointerUp);
	};

	onCleanup(() =>
		document.removeEventListener("pointermove", onHandlePointerMove),
	);

	// While collapsed/expanded around the tall-content anchors, dragging
	// changes height (grow/shrink) before it changes translate (close).
	const liveMaxHeight = createMemo(() => {
		if (!isTall()) return undefined;
		if (!dragging()) return expanded() ? fullHeightPx() : halfHeightPx();
		const dy = dragDeltaY();
		if (dy < 0) {
			if (expanded()) return fullHeightPx();
			return clamp(halfHeightPx() - dy, halfHeightPx(), fullHeightPx());
		}
		if (expanded()) {
			return clamp(fullHeightPx() - dy, halfHeightPx(), fullHeightPx());
		}
		return halfHeightPx();
	});

	const liveTranslate = createMemo(() => {
		if (!dragging()) return 0;
		const dy = dragDeltaY();
		if (dy <= 0) return 0;
		if (!isTall()) return dy;
		if (expanded()) {
			const shrinkRoom = fullHeightPx() - halfHeightPx();
			return dy > shrinkRoom ? dy - shrinkRoom : 0;
		}
		return dy;
	});

	const sheetTransform = () => {
		if (!shown()) return "translateY(100%)";
		const t = liveTranslate();
		return t > 0 ? `translateY(${t}px)` : "translateY(0)";
	};

	const portalMount = usePortalMount();

	return (
		<Show when={mounted()}>
			<Portal mount={portalMount}>
				<div class="fixed inset-0 z-50 pointer-events-auto">
					<div
						class="absolute inset-0 bg-black/50 transition-opacity duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
						classList={{ "opacity-100": shown(), "opacity-0": !shown() }}
						onPointerDown={onBackdropPointerDown}
					/>
					<div
						role="dialog"
						aria-modal="true"
						ref={setContentEl}
						class={cx(
							"bg-background absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-lg border-t will-change-transform",
							!dragging() &&
								"transition-[max-height,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
							props.class,
						)}
						classList={{
							"overflow-hidden": isTall() && !expanded(),
							"overflow-y-auto": !isTall() || expanded(),
						}}
						style={{
							transform: sheetTransform(),
							...(liveMaxHeight() !== undefined
								? { "max-height": `${liveMaxHeight()}px` }
								: {}),
							...(keyboardOffset() > 0
								? { bottom: `${keyboardOffset()}px` }
								: {}),
						}}
					>
						<Show when={!props.hideHandle}>
							<div
								class={cx(
									"flex cursor-grab touch-none items-center justify-center active:cursor-grabbing",
									props.handleOverlay
										? "absolute inset-x-0 top-0 z-20 pt-2 pb-3"
										: "shrink-0 pt-2 pb-1",
								)}
								style={{ "touch-action": "none" }}
								onPointerDown={onHandlePointerDown}
							>
								<div
									class={cx(
										"h-1.5 w-12 rounded-full",
										props.handleOverlay
											? "bg-white/70 shadow-sm"
											: "bg-muted-foreground/30",
									)}
								/>
							</div>
						</Show>
						{props.children}
					</div>
				</div>
			</Portal>
		</Show>
	);
};

export interface MenuDrawerProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title?: JSX.Element;
	children: JSX.Element;
}

/**
 * Bottom-sheet replacement for context menus / dropdowns / popovers on mobile
 */
export const MenuDrawer = (props: MenuDrawerProps) => {
	return (
		<BottomSheet open={props.open} onOpenChange={props.onOpenChange}>
			<Show when={props.title}>
				<div class="px-4 pt-1 pb-1">
					<span class="m-0 text-sm font-medium text-muted-foreground">
						{props.title}
					</span>
				</div>
			</Show>
			<ScrollFadeBottom class="flex flex-col gap-0.5 px-2 pb-[calc(0.5rem+var(--safe-area-bottom))]">
				{props.children}
			</ScrollFadeBottom>
		</BottomSheet>
	);
};

export type MenuDrawerItemProps = ComponentProps<"button"> & {
	destructive?: boolean;
};

/** A full-width tappable row for use inside `MenuDrawer`. */
export const MenuDrawerItem = (props: MenuDrawerItemProps) => {
	const [, rest] = splitProps(props, ["class", "destructive", "children"]);
	return (
		<button
			type="button"
			class={cx(
				"flex w-full flex-row items-center gap-3 rounded-md px-3 py-3 text-left text-base hover:bg-muted/50 active:bg-muted [&_svg]:size-5 [&_svg]:shrink-0",
				props.destructive && "text-destructive [&_svg]:text-destructive",
				props.class,
			)}
			{...rest}
		>
			{props.children}
		</button>
	);
};
