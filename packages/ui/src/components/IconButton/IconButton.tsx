import { Button as KobalteButton } from "@kobalte/core/button";
import { type JSX, Show, splitProps } from "solid-js";
import { cva, cx, type VariantProps } from "../../utils/cx";
import { type HapticImpact, useHaptics } from "../../utils/haptics";
import {
	type IconEffect,
	iconEffectClass,
	iconEffectStyle,
} from "../../utils/icon-fx";
import { callHandler, createPress } from "../../utils/press";
import { createSlot } from "../../utils/slot";
import { Spinner } from "../Spinner/Spinner";
import {
	Tooltip,
	TooltipContent,
	type TooltipPlacement,
	TooltipTrigger,
} from "../Tooltip/Tooltip";

export const iconButtonVariants = cva({
	base: [
		"pressable focus-ring relative inline-flex shrink-0 items-center justify-center border",
		"cursor-pointer aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
	],
	variants: {
		variant: {
			secondary:
				"border-border bg-secondary text-foreground not-aria-disabled:hover:bg-secondary-highlight data-pressed:bg-secondary-highlight",
			ghost:
				"border-transparent bg-transparent text-foreground not-aria-disabled:hover:bg-secondary data-pressed:bg-secondary",
			primary:
				"border-border bg-primary-fill text-primary-foreground not-aria-disabled:hover:bg-primary-fill-highlight data-pressed:bg-primary-fill-highlight",
			destructive:
				"border-border bg-destructive-fill text-destructive-foreground not-aria-disabled:hover:bg-destructive-fill-highlight data-pressed:bg-destructive-fill-highlight",
			inverse:
				"border-border bg-foreground text-background not-aria-disabled:hover:opacity-90 data-pressed:opacity-90",
		},
		size: {
			sm: "size-7 rounded-control-sm [&_svg]:size-4",
			md: "size-8 rounded-control-sm [&_svg]:size-5",
			lg: "size-10 rounded-control [&_svg]:size-6",
			xl: "size-12 rounded-control-lg [&_svg]:size-6",
		},
	},
	defaultVariants: {
		variant: "secondary",
		size: "md",
	},
});

export const iconButtonTouchTarget = [
	"-m-1.5 size-11 border-0 bg-transparent not-aria-disabled:hover:bg-transparent data-pressed:bg-transparent",
	"before:pointer-events-none before:absolute before:inset-1.5 before:rounded-control-sm before:content-['']",
	"before:transition-[background-color] before:duration-[calc(var(--duration-color)*var(--motion-scale))] motion-reduce:before:transition-none",
	"not-aria-disabled:hover:before:bg-secondary data-pressed:before:bg-secondary focus-visible:outline-offset-[-4px]",
	"[&_svg]:relative [&_svg]:size-5",
].join(" ");

export type IconButtonProps = Omit<
	JSX.ButtonHTMLAttributes<HTMLButtonElement>,
	"disabled" | "children" | "title"
> &
	VariantProps<typeof iconButtonVariants> & {
		label: string;
		icon: JSX.Element;
		iconEffect?: IconEffect;
		iconOrigin?: string;
		disabled?: boolean;
		loading?: boolean;
		haptic?: HapticImpact;
		tooltip?: string | false;
		tooltipPlacement?: TooltipPlacement;
	};

export const IconButton = (props: IconButtonProps) => {
	const [local, handlers, rest] = splitProps(
		props,
		[
			"variant",
			"size",
			"label",
			"icon",
			"iconEffect",
			"iconOrigin",
			"loading",
			"disabled",
			"class",
			"haptic",
			"tooltip",
			"tooltipPlacement",
			"type",
			"onClick",
		],
		[
			"onPointerDown",
			"onPointerUp",
			"onPointerLeave",
			"onPointerCancel",
			"onKeyDown",
			"onKeyUp",
			"onBlur",
		],
	);
	const haptics = useHaptics();
	const icon = createSlot(() => local.icon);
	const inactive = () => !!(local.disabled || local.loading);
	const whenActive =
		<E extends Event>(
			read: () => JSX.EventHandlerUnion<HTMLButtonElement, E> | undefined,
		) =>
		(event: E & { currentTarget: HTMLButtonElement; target: Element }) => {
			if (!inactive()) callHandler(read(), event);
		};
	const { pressed, pressProps } = createPress({
		disabled: inactive,
		handlers: {
			onPointerDown: whenActive(() => handlers.onPointerDown),
			onPointerUp: whenActive(() => handlers.onPointerUp),
			onKeyDown: whenActive(() => handlers.onKeyDown),
			onKeyUp: whenActive(() => handlers.onKeyUp),
			get onPointerLeave() {
				return handlers.onPointerLeave;
			},
			get onPointerCancel() {
				return handlers.onPointerCancel;
			},
			get onBlur() {
				return handlers.onBlur;
			},
		},
		onPressStart: () => {
			if (local.haptic) haptics.impact(local.haptic);
		},
	});

	const expanded = () =>
		rest["aria-expanded"] === true || rest["aria-expanded"] === "true";

	return (
		<Tooltip
			placement={local.tooltipPlacement}
			disabled={local.tooltip === false || expanded()}
		>
			<TooltipTrigger
				as={KobalteButton}
				type={(local.type ?? "button") as "button" | "submit" | "reset"}
				{...rest}
				{...pressProps}
				aria-label={local.label}
				onClick={(
					event: MouseEvent & {
						currentTarget: HTMLButtonElement;
						target: Element;
					},
				) => {
					if (inactive()) {
						event.preventDefault();
						event.stopPropagation();
						return;
					}
					callHandler(local.onClick, event);
				}}
				aria-disabled={inactive() ? "true" : undefined}
				data-disabled={inactive() ? "" : undefined}
				aria-busy={local.loading || undefined}
				data-pressed={pressed() || undefined}
				data-icon-host=""
				class={cx(
					iconButtonVariants({ variant: local.variant, size: local.size }),
					local.loading &&
						"aria-disabled:opacity-100 aria-disabled:cursor-progress",
					local.class,
				)}
			>
				<Show
					when={local.loading}
					fallback={
						<Show when={local.iconEffect} fallback={icon()}>
							{(effect) => (
								<span
									class={iconEffectClass(effect())}
									style={iconEffectStyle({ origin: local.iconOrigin })}
								>
									{icon()}
								</span>
							)}
						</Show>
					}
				>
					<Spinner />
				</Show>
			</TooltipTrigger>
			<Show when={local.tooltip !== false}>
				<TooltipContent>{local.tooltip || local.label}</TooltipContent>
			</Show>
		</Tooltip>
	);
};
