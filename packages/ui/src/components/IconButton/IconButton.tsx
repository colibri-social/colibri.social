import { Button as KobalteButton } from "@kobalte/core/button";
import { type JSX, Show, splitProps } from "solid-js";
import { cva, cx, type VariantProps } from "../../utils/cx";
import { type HapticImpact, useHaptics } from "../../utils/haptics";
import {
	type IconEffect,
	iconEffectClass,
	iconEffectStyle,
} from "../../utils/icon-fx";
import { createPress } from "../../utils/press";
import { createSlot } from "../../utils/slot";
import { Spinner } from "../Spinner/Spinner";

export const iconButtonVariants = cva({
	base: [
		"pressable focus-ring relative inline-flex shrink-0 items-center justify-center border",
		"cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
	],
	variants: {
		variant: {
			secondary:
				"border-border bg-secondary text-foreground enabled:hover:bg-secondary-highlight data-pressed:bg-secondary-highlight",
			ghost:
				"border-transparent bg-transparent text-foreground enabled:hover:bg-secondary data-pressed:bg-secondary",
			primary:
				"border-border bg-primary-fill text-primary-foreground enabled:hover:bg-primary-fill-highlight data-pressed:bg-primary-fill-highlight",
			destructive:
				"border-border bg-destructive-fill text-destructive-foreground enabled:hover:bg-destructive-fill-highlight data-pressed:bg-destructive-fill-highlight",
			inverse:
				"border-border bg-foreground text-background enabled:hover:opacity-90 data-pressed:opacity-90",
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

export type IconButtonProps = Omit<
	JSX.ButtonHTMLAttributes<HTMLButtonElement>,
	"disabled" | "children"
> &
	VariantProps<typeof iconButtonVariants> & {
		label: string;
		icon: JSX.Element;
		iconEffect?: IconEffect;
		iconOrigin?: string;
		disabled?: boolean;
		loading?: boolean;
		haptic?: HapticImpact;
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
	const inactive = () => local.disabled || local.loading;
	const { pressed, pressProps } = createPress({
		disabled: inactive,
		handlers,
		onPressStart: () => {
			if (local.haptic) haptics.impact(local.haptic);
		},
	});

	return (
		<KobalteButton
			type="button"
			{...rest}
			{...pressProps}
			aria-label={local.label}
			title={rest.title ?? local.label}
			disabled={inactive()}
			aria-busy={local.loading || undefined}
			data-pressed={pressed() || undefined}
			data-icon-host=""
			class={cx(
				iconButtonVariants({ variant: local.variant, size: local.size }),
				local.loading && "disabled:opacity-100 disabled:cursor-progress",
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
		</KobalteButton>
	);
};
