import {
	type ComponentProps,
	createEffect,
	createSignal,
	type JSX,
	onCleanup,
	Show,
	splitProps,
} from "solid-js";
import { Portal } from "solid-js/web";
import { cx } from "../../utils/cva";

export const DRAWER_TRANSITION_MS = 300;

export const handoffDrawer = (close: () => void, open: () => void) => {
	close();
	window.setTimeout(open, DRAWER_TRANSITION_MS + 30);
};

export interface BottomSheetProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	children: JSX.Element;
	class?: string;
	hideHandle?: boolean;
	handleOverlay?: boolean;
}

/**
 * A self-contained mobile bottom sheet
 */
export const BottomSheet = (props: BottomSheetProps) => {
	const [mounted, setMounted] = createSignal(props.open);
	const [shown, setShown] = createSignal(false);
	const [dragOffset, setDragOffset] = createSignal(0);
	const [dragging, setDragging] = createSignal(false);

	let closeTimer: number | undefined;
	let raf1 = 0;
	let raf2 = 0;
	let openedAt = 0;

	createEffect(() => {
		if (props.open) {
			clearTimeout(closeTimer);
			setDragOffset(0);
			setMounted(true);
			openedAt = performance.now();
			raf1 = requestAnimationFrame(() => {
				raf2 = requestAnimationFrame(() => setShown(true));
			});
		} else if (mounted()) {
			setShown(false);
			closeTimer = window.setTimeout(() => {
				setMounted(false);
				setDragOffset(0);
			}, DRAWER_TRANSITION_MS);
		}
	});

	onCleanup(() => {
		clearTimeout(closeTimer);
		cancelAnimationFrame(raf1);
		cancelAnimationFrame(raf2);
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

	// Close on a fresh tap outside
	const onBackdropPointerDown = () => {
		if (performance.now() - openedAt < 150) return;
		close();
	};

	let dragStartY = 0;
	let dragStartT = 0;

	const onHandlePointerMove = (e: PointerEvent) => {
		setDragOffset(Math.max(0, e.clientY - dragStartY));
	};

	const endHandleDrag = () => {
		document.removeEventListener("pointermove", onHandlePointerMove);
		document.removeEventListener("pointerup", onHandlePointerUp);
		document.removeEventListener("pointercancel", onHandlePointerUp);
	};

	const onHandlePointerUp = (e: PointerEvent) => {
		endHandleDrag();
		const dy = Math.max(0, e.clientY - dragStartY);
		const dt = performance.now() - dragStartT || 1;
		const flick = dy / dt > 0.5 && dy > 40;
		setDragging(false);
		if (dy > 120 || flick) close();
		else setDragOffset(0);
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

	const sheetTransform = () => {
		if (!shown()) return "translateY(100%)";
		return dragOffset() > 0 ? `translateY(${dragOffset()}px)` : "translateY(0)";
	};

	return (
		<Show when={mounted()}>
			<Portal>
				<div class="fixed inset-0 z-50">
					<div
						class="absolute inset-0 bg-black/50 transition-opacity duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
						classList={{ "opacity-100": shown(), "opacity-0": !shown() }}
						onPointerDown={onBackdropPointerDown}
					/>
					<div
						role="dialog"
						aria-modal="true"
						class={cx(
							"bg-background absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-lg border-t will-change-transform",
							!dragging() &&
								"transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
							props.class,
						)}
						style={{ transform: sheetTransform() }}
					>
						<Show when={!props.hideHandle}>
							<div
								class={cx(
									"flex cursor-grab touch-none items-center justify-center active:cursor-grabbing",
									props.handleOverlay
										? "absolute inset-x-0 top-0 z-20 pt-2 pb-3"
										: "shrink-0 pt-2 pb-1",
								)}
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
			<div class="flex flex-col gap-0.5 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] overflow-y-auto">
				{props.children}
			</div>
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
