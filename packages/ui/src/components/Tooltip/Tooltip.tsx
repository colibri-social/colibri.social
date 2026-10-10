import { Tooltip as KobalteTooltip } from "@kobalte/core/tooltip";
import {
	createContext,
	createSignal,
	type JSX,
	onCleanup,
	type ParentProps,
	splitProps,
	useContext,
} from "solid-js";
import { cx } from "../../utils/cx";
import { revealLayer, topLayerAttrs } from "../../utils/nested-layers";
import { usePopperOverflowPadding } from "../../utils/safe-area";

export type TooltipPlacement =
	| "top"
	| "top-start"
	| "top-end"
	| "bottom"
	| "bottom-start"
	| "bottom-end"
	| "left"
	| "right";

export const TOOLTIP_OPEN_DELAY = 500;
export const TOOLTIP_SKIP_DELAY = 300;
const ARROW_SIZE = 14;

let lastClosedAt = Number.NEGATIVE_INFINITY;
let openCount = 0;

const isWarm = () =>
	openCount > 0 || performance.now() - lastClosedAt < TOOLTIP_SKIP_DELAY;

type TooltipState = {
	instant: () => boolean;
	setHoverCapable: (capable: boolean) => void;
};

const TooltipStateContext = createContext<TooltipState>({
	instant: () => false,
	setHoverCapable: () => {},
});

export type TooltipProps = ParentProps<{
	placement?: TooltipPlacement;
	openDelay?: number;
	closeDelay?: number;
	gutter?: number;
	disabled?: boolean;
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
}>;

export const Tooltip = (props: TooltipProps) => {
	const overflowPadding = usePopperOverflowPadding();
	const [instant, setInstant] = createSignal(false);
	const [hoverCapable, setHoverCapable] = createSignal(true);
	let counted = false;

	const onOpenChange = (open: boolean) => {
		if (open && !counted) {
			setInstant(isWarm());
			counted = true;
			openCount += 1;
		} else if (!open && counted) {
			counted = false;
			openCount = Math.max(0, openCount - 1);
			lastClosedAt = performance.now();
		}
		props.onOpenChange?.(open);
	};

	onCleanup(() => {
		if (!counted) return;
		counted = false;
		openCount = Math.max(0, openCount - 1);
		lastClosedAt = performance.now();
	});

	return (
		<KobalteTooltip
			placement={props.placement ?? "top"}
			gutter={props.gutter ?? 8}
			openDelay={props.openDelay ?? TOOLTIP_OPEN_DELAY}
			closeDelay={props.closeDelay ?? 0}
			skipDelayDuration={TOOLTIP_SKIP_DELAY}
			disabled={props.disabled || !hoverCapable()}
			open={props.open}
			defaultOpen={props.defaultOpen}
			onOpenChange={onOpenChange}
			overflowPadding={overflowPadding()}
		>
			<TooltipStateContext.Provider value={{ instant, setHoverCapable }}>
				{props.children}
			</TooltipStateContext.Provider>
		</KobalteTooltip>
	);
};

const isHoverPointer = (event: PointerEvent) =>
	event.pointerType !== "touch" && event.pointerType !== "pen";

const callUserHandler = (handler: unknown, event: Event) => {
	if (typeof handler === "function") handler(event);
	else if (Array.isArray(handler) && typeof handler[0] === "function")
		handler[0](handler[1], event);
};

const TooltipTriggerImpl = (props: Record<string, unknown>) => {
	const [local, rest] = splitProps(props, [
		"onPointerEnter",
		"onPointerDown",
		"onBlur",
	]);
	const state = useContext(TooltipStateContext);
	return (
		<KobalteTooltip.Trigger
			{...rest}
			onPointerEnter={(event: PointerEvent) => {
				state.setHoverCapable(isHoverPointer(event));
				callUserHandler(local.onPointerEnter, event);
			}}
			onPointerDown={(event: PointerEvent) => {
				state.setHoverCapable(isHoverPointer(event));
				callUserHandler(local.onPointerDown, event);
			}}
			onBlur={(event: FocusEvent) => {
				state.setHoverCapable(true);
				callUserHandler(local.onBlur, event);
			}}
		/>
	);
};

export const TooltipTrigger =
	TooltipTriggerImpl as unknown as typeof KobalteTooltip.Trigger;

export type TooltipContentProps = {
	class?: string;
	children?: JSX.Element;
	arrow?: boolean;
};

export const TooltipContent = (props: TooltipContentProps) => {
	const [local, rest] = splitProps(props, ["class", "children", "arrow"]);
	const state = useContext(TooltipStateContext);
	return (
		<KobalteTooltip.Portal>
			<KobalteTooltip.Content
				{...topLayerAttrs}
				ref={revealLayer}
				{...rest}
				data-tooltip=""
				data-instant={state.instant() ? "" : undefined}
				class={cx(
					"tooltip-motion z-50 max-w-64 rounded-control-xs border bg-popover px-2 py-1 text-xs font-semibold text-pretty text-foreground",
					"[border-color:color-mix(in_srgb,var(--foreground)_8%,var(--popover))]",
					"origin-(--kb-tooltip-content-transform-origin) drop-shadow-[0_4px_6px_var(--shadow-color)]",
					local.class,
				)}
			>
				{local.arrow !== false && (
					<KobalteTooltip.Arrow size={ARROW_SIZE} data-tooltip-arrow="" />
				)}
				{local.children}
			</KobalteTooltip.Content>
		</KobalteTooltip.Portal>
	);
};
