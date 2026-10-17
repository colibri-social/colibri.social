import CorvuDrawer from "@corvu/drawer";
import {
	createContext,
	createEffect,
	createRenderEffect,
	createSignal,
	type JSX,
	on,
	onCleanup,
	type ParentProps,
	Show,
	splitProps,
	useContext,
} from "solid-js";
import { cx } from "../../utils/cx";
import {
	createDirtyGuard,
	type DirtyGuard,
	DirtyGuardContext,
} from "../../utils/dirty-guard";
import { createHeightTransition } from "../../utils/height-transition";
import {
	revealLayer,
	topLayerAttrs,
	useParentLayers,
} from "../../utils/nested-layers";
import { keyboardLiftAttrs } from "../../utils/safe-area";
import { createSlot } from "../../utils/slot";
import { Button } from "../Button/Button";

export type DrawerProps = ParentProps<{
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	initialOpen?: boolean;
	modal?: boolean;
	initialFocus?: "first-focusable" | "content";
	initialFocusEl?: HTMLElement;
	restoreFocus?: boolean;
	dirty?: boolean;
	discardDescription?: JSX.Element;
}>;

const DrawerContentRef = createContext<(element: HTMLElement) => void>();

const OPENING_SETTLE_FRAMES = 3;
const FLICK_MIN_VELOCITY = 0.15;
const FLICK_GAIN = 2.5;
const RELEASE_WINDOW_MS = 80;
const CLOSE_MIN_SPEED = 1.2;
const CLOSE_MIN_MS = 110;
const CLOSE_MAX_MS = 280;
const CLOSE_BREAKPOINT = 0.72;
const CLOSE_SLOW_EASE = "cubic-bezier(0.3, 0.6, 0.6, 1)";
const CLOSE_FALLBACK_SLACK_MS = 250;

const longestTransitionMs = (element: HTMLElement) => {
	const style = getComputedStyle(element);
	const seconds = (value: string) =>
		value.split(",").map((part) => {
			const trimmed = part.trim();
			const amount = Number.parseFloat(trimmed);
			if (Number.isNaN(amount)) return 0;
			return trimmed.endsWith("ms") ? amount : amount * 1000;
		});
	const durations = seconds(style.transitionDuration);
	const delays = seconds(style.transitionDelay);
	return Math.max(
		0,
		...durations.map((duration, index) => duration + (delays[index] ?? 0)),
	);
};

export const Drawer = (props: DrawerProps) => {
	const [open, setOpen] = createSignal(
		props.open ?? props.initialOpen ?? false,
	);
	let settling = false;
	let pendingClose = false;
	let frame = 0;

	const settle = (remaining: number) => {
		frame = requestAnimationFrame(() => {
			if (remaining > 1) {
				settle(remaining - 1);
				return;
			}
			frame = 0;
			settling = false;
			if (pendingClose) {
				pendingClose = false;
				setOpen(false);
			}
		});
	};

	const apply = (next: boolean) => {
		if (next) {
			pendingClose = false;
			if (open()) return;
			setOpen(true);
			settling = true;
			if (frame) cancelAnimationFrame(frame);
			settle(OPENING_SETTLE_FRAMES);
			return;
		}
		if (settling) {
			pendingClose = true;
			return;
		}
		setOpen(false);
	};

	if (open()) {
		settling = true;
		settle(OPENING_SETTLE_FRAMES);
	}

	createEffect(
		on(
			() => props.open,
			(next) => {
				if (next !== undefined) apply(next);
			},
			{ defer: true },
		),
	);

	onCleanup(() => {
		if (frame) cancelAnimationFrame(frame);
	});

	const parentLayers = useParentLayers();
	let releaseLayer: (() => void) | undefined;
	createRenderEffect(
		on(open, (isOpen) => {
			if (!parentLayers) return;
			if (isOpen && !releaseLayer) {
				releaseLayer = parentLayers.register();
				return;
			}
			if (!isOpen && releaseLayer) {
				const release = releaseLayer;
				releaseLayer = undefined;
				requestAnimationFrame(() => release());
			}
		}),
	);
	onCleanup(() => releaseLayer?.());

	const [contentElement, setContentElement] = createSignal<HTMLElement>();
	const initialFocusEl = () =>
		props.initialFocusEl ??
		(props.initialFocus === "content" ? contentElement() : undefined);

	let releaseVelocity = 0;
	let releasedAt = 0;

	const velocityFunction = (distance: number, time: number) => {
		releaseVelocity = distance / time;
		releasedAt = performance.now();
		if (releaseVelocity <= FLICK_MIN_VELOCITY) return 1;
		return 1 + releaseVelocity * FLICK_GAIN;
	};

	const tuneCloseMotion = () => {
		const element = contentElement();
		if (!element) return;
		const fromDrag = performance.now() - releasedAt < RELEASE_WINDOW_MS;
		if (!fromDrag) {
			element.style.removeProperty("--sheet-close-duration");
			element.style.removeProperty("--sheet-close-ease");
			return;
		}
		const remaining = Math.max(
			0,
			window.innerHeight - element.getBoundingClientRect().top,
		);
		const speed = Math.max(releaseVelocity, CLOSE_MIN_SPEED);
		const duration = Math.min(
			CLOSE_MAX_MS,
			Math.max(CLOSE_MIN_MS, remaining / speed),
		);
		element.style.setProperty("--sheet-close-duration", `${duration}ms`);
		element.style.setProperty(
			"--sheet-close-ease",
			releaseVelocity >= CLOSE_MIN_SPEED ? "linear" : CLOSE_SLOW_EASE,
		);
	};

	const guard = createDirtyGuard();
	guard.register({ dirty: () => !!props.dirty });
	const [promptMounted, setPromptMounted] = createSignal(false);
	createEffect(() => {
		if (guard.prompting()) setPromptMounted(true);
	});
	createEffect(
		on(open, (isOpen) => {
			if (!isOpen) guard.keep();
		}),
	);

	const commit = (next: boolean) => {
		if (!next) tuneCloseMotion();
		if (props.open === undefined) apply(next);
		props.onOpenChange?.(next);
	};

	const [snapPoint, setSnapPoint] = createSignal<number | `${number}px`>(0);

	const onOpenChange = (next: boolean) => {
		if (next) {
			commit(true);
			return;
		}
		if (guard.hold(() => commit(false))) setSnapPoint(1);
		else commit(false);
	};

	return (
		<>
			<CorvuDrawer
				open={open()}
				onOpenChange={onOpenChange}
				modal={props.modal ?? true}
				side="bottom"
				closeOnOutsidePointerStrategy="pointerdown"
				closeOnOutsideFocus={false}
				onOutsidePointer={(event) => {
					if (event.target instanceof Node && !event.target.isConnected) {
						event.preventDefault();
					}
				}}
				velocityFunction={velocityFunction}
				breakPoints={[CLOSE_BREAKPOINT]}
				activeSnapPoint={snapPoint()}
				onActiveSnapPointChange={setSnapPoint}
				initialFocusEl={initialFocusEl()}
				restoreFocus={props.restoreFocus ?? true}
			>
				{() => (
					<DrawerContentRef.Provider value={setContentElement}>
						<DirtyGuardContext.Provider value={guard}>
							{props.children}
						</DirtyGuardContext.Provider>
					</DrawerContentRef.Provider>
				)}
			</CorvuDrawer>
			<Show when={promptMounted()}>
				<DiscardChangesDrawer
					guard={guard}
					description={props.discardDescription}
				/>
			</Show>
		</>
	);
};

const DISCARD_DESCRIPTION = "Your changes won't be saved.";

const DiscardChangesDrawer = (props: {
	guard: DirtyGuard;
	description?: JSX.Element;
}) => (
	<Drawer
		open={props.guard.prompting()}
		onOpenChange={(next) => {
			if (!next) props.guard.keep();
		}}
	>
		<DrawerContent
			title="Discard changes?"
			description={
				props.description ?? props.guard.description() ?? DISCARD_DESCRIPTION
			}
		>
			<div data-discard-actions="" class="grid grid-cols-2 gap-2">
				<Button variant="secondary" block onClick={() => props.guard.keep()}>
					Cancel
				</Button>
				<Button
					variant="destructive"
					block
					onClick={() => props.guard.discard()}
				>
					Discard changes
				</Button>
			</div>
		</DrawerContent>
	</Drawer>
);

export const DrawerTrigger = CorvuDrawer.Trigger;
export const DrawerClose = CorvuDrawer.Close;

export type DrawerContentProps = {
	title?: JSX.Element;
	titleIcon?: JSX.Element;
	description?: JSX.Element;
	header?: JSX.Element;
	headerBleed?: boolean;
	onEscapeKeyDown?: (event: KeyboardEvent) => void;
	footer?: JSX.Element;
	handle?: boolean;
	fill?: boolean;
	class?: string;
	children?: JSX.Element;
	"aria-label"?: string;
};

export const DrawerContent = (props: DrawerContentProps) => {
	const [local, rest] = splitProps(props, [
		"title",
		"titleIcon",
		"description",
		"header",
		"headerBleed",
		"onEscapeKeyDown",
		"footer",
		"handle",
		"fill",
		"class",
		"children",
	]);
	const showHandle = () => local.handle ?? true;
	const context = CorvuDrawer.useContext();
	const registerContent = useContext(DrawerContentRef);
	const title = createSlot(() => local.title);
	const titleIcon = createSlot(() => local.titleIcon);
	const description = createSlot(() => local.description);
	const header = createSlot(() => local.header);
	const footer = createSlot(() => local.footer);
	const heightTransition = createHeightTransition({
		isBusy: () => context.isTransitioning() || context.isDragging(),
	});
	let contentNode: HTMLElement | undefined;

	createEffect(() => {
		if (context.transitionState() !== "closing") return;
		const element = contentNode;
		if (!element) return;
		const timer = setTimeout(() => {
			if (context.transitionState() !== "closing") return;
			element.dispatchEvent(
				new TransitionEvent("transitionend", {
					propertyName: "transform",
					bubbles: true,
				}),
			);
		}, longestTransitionMs(element) + CLOSE_FALLBACK_SLACK_MS);
		onCleanup(() => clearTimeout(timer));
	});

	return (
		<CorvuDrawer.Portal>
			<CorvuDrawer.Overlay
				{...topLayerAttrs}
				class="sheet-motion fixed inset-0 z-50 bg-overlay"
				style={{ opacity: context.openPercentage() }}
			/>
			<CorvuDrawer.Content
				{...rest}
				{...topLayerAttrs}
				{...keyboardLiftAttrs}
				ref={(element: HTMLElement) => {
					contentNode = element;
					element.addEventListener("keydown", (event) => {
						if (event.key === "Escape") local.onEscapeKeyDown?.(event);
					});
					revealLayer(element);
					registerContent?.(element);
					heightTransition(element);
				}}
				class={cx(
					"sheet-motion fixed inset-x-0 bottom-(--keyboard-lift,0px) z-50 flex max-h-[min(90dvh,calc(100dvh-var(--overlay-top,0px)-16px-var(--keyboard-lift,0px)))] flex-col pl-safe pr-safe",
					"bg-popover text-foreground outline-none",
					"after:absolute after:inset-x-0 after:top-full after:h-1/2 after:bg-inherit",
					local.fill
						? "h-[calc(100dvh-var(--keyboard-lift,0px))] max-h-none rounded-none pt-overlay"
						: "rounded-t-sheet",
					local.class,
				)}
				data-fill={local.fill ? "" : undefined}
			>
				<div
					hidden={!showHandle()}
					class={cx(
						"flex shrink-0 justify-center",
						header.has()
							? "pointer-events-none absolute inset-x-0 top-0 z-10 pt-2"
							: "pt-2 pb-3",
					)}
					aria-hidden="true"
				>
					<span
						class={cx(
							"h-1 w-10 rounded-full",
							header.has()
								? "bg-white/80 shadow-[0_1px_3px_rgb(0_0_0/0.45)]"
								: "bg-accent",
						)}
					/>
				</div>
				<Show when={title.has()}>
					<div
						class={cx(
							"flex shrink-0 items-center gap-2 px-4 pb-6",
							header.has() && "pt-6",
						)}
					>
						<Show when={titleIcon.has()}>
							<span class="flex size-6 shrink-0 items-center justify-center [&>svg]:size-6">
								{titleIcon()}
							</span>
						</Show>
						<CorvuDrawer.Label class="truncate text-xl font-bold text-foreground">
							{title()}
						</CorvuDrawer.Label>
					</div>
				</Show>
				<Show when={description.has()}>
					<CorvuDrawer.Description class="-mt-4 shrink-0 px-4 pb-6 text-sm leading-prose text-pretty text-muted-foreground">
						{description()}
					</CorvuDrawer.Description>
				</Show>
				<div
					data-drawer-scroll=""
					class={cx(
						"flex min-h-0 flex-col overflow-y-auto overscroll-contain",
						footer.has() ? "pb-4" : "pb-safe-offset-4",
						!header.has() &&
							(showHandle()
								? "-mt-(--focus-ring-reach) pt-(--focus-ring-reach)"
								: "pt-4"),
						header.has() && !local.fill && "rounded-t-sheet",
						local.fill && "flex-1",
					)}
				>
					<Show when={header.has()}>
						<div
							data-drawer-header=""
							data-bleed={local.headerBleed || undefined}
							class={cx("shrink-0", !local.headerBleed && "px-4 pt-6")}
						>
							{header()}
						</div>
					</Show>
					<div
						class={cx(
							"flex flex-col gap-6 px-4",
							header.has() && "pt-6",
							local.fill && "min-h-0 flex-1",
						)}
					>
						{local.children}
					</div>
				</div>
				<Show when={footer.has()}>
					<div
						data-drawer-footer=""
						class="relative z-10 shrink-0 bg-popover px-4 pt-2 pb-safe-offset-4"
					>
						{footer()}
					</div>
				</Show>
			</CorvuDrawer.Content>
		</CorvuDrawer.Portal>
	);
};
