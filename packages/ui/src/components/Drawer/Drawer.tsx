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
import { createHeightTransition } from "../../utils/height-transition";
import {
	revealLayer,
	topLayerAttrs,
	useParentLayers,
} from "../../utils/nested-layers";
import { createSlot } from "../../utils/slot";

export type DrawerProps = ParentProps<{
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	initialOpen?: boolean;
	modal?: boolean;
	initialFocus?: "first-focusable" | "content";
	initialFocusEl?: HTMLElement;
}>;

const DrawerContentRef = createContext<(element: HTMLElement) => void>();

const OPENING_SETTLE_FRAMES = 3;
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

	const onOpenChange = (next: boolean) => {
		if (props.open === undefined) apply(next);
		props.onOpenChange?.(next);
	};

	return (
		<CorvuDrawer
			open={open()}
			onOpenChange={onOpenChange}
			modal={props.modal ?? true}
			side="bottom"
			velocityFunction={(distance, time) => distance / time}
			initialFocusEl={initialFocusEl()}
		>
			{() => (
				<DrawerContentRef.Provider value={setContentElement}>
					{props.children}
				</DrawerContentRef.Provider>
			)}
		</CorvuDrawer>
	);
};

export const DrawerTrigger = CorvuDrawer.Trigger;
export const DrawerClose = CorvuDrawer.Close;

export type DrawerContentProps = {
	title?: JSX.Element;
	titleIcon?: JSX.Element;
	description?: JSX.Element;
	header?: JSX.Element;
	footer?: JSX.Element;
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
		"footer",
		"class",
		"children",
	]);
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
				ref={(element: HTMLElement) => {
					contentNode = element;
					revealLayer(element);
					registerContent?.(element);
					heightTransition(element);
				}}
				class={cx(
					"sheet-motion fixed inset-x-0 bottom-0 z-50 flex max-h-[min(90dvh,calc(100dvh-var(--safe-area-top,0px)-16px))] flex-col pl-safe pr-safe",
					"rounded-t-sheet bg-popover text-foreground outline-none",
					"after:absolute after:inset-x-0 after:top-full after:h-1/2 after:bg-inherit",
					local.class,
				)}
			>
				<div
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
					<CorvuDrawer.Description class="-mt-4 shrink-0 px-4 pb-6 text-sm text-pretty text-muted-foreground">
						{description()}
					</CorvuDrawer.Description>
				</Show>
				<div
					data-drawer-scroll=""
					class={cx(
						"flex min-h-0 flex-col overflow-y-auto overscroll-contain",
						footer.has() ? "pb-4" : "pb-safe-offset-4",
						!header.has() && "-mt-(--focus-ring-reach) pt-(--focus-ring-reach)",
						header.has() && "rounded-t-sheet",
					)}
				>
					<Show when={header.has()}>
						<div data-drawer-header="" class="shrink-0">
							{header()}
						</div>
					</Show>
					<div class={cx("flex flex-col gap-6 px-4", header.has() && "pt-6")}>
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
