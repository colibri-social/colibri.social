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

export const buttonVariants = cva({
	base: [
		"pressable focus-ring relative inline-flex shrink-0 items-center justify-center gap-2",
		"h-9 px-5 rounded-control border font-sans text-sm font-semibold leading-none whitespace-nowrap",
		"cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
	],
	variants: {
		variant: {
			primary:
				"border-border bg-primary-fill text-primary-foreground enabled:hover:bg-primary-fill-highlight data-pressed:bg-primary-fill-highlight",
			secondary:
				"border-border bg-secondary text-secondary-foreground enabled:hover:bg-secondary-highlight data-pressed:bg-secondary-highlight",
			tertiary:
				"border-transparent bg-transparent text-foreground enabled:hover:bg-secondary data-pressed:bg-secondary",
			destructive:
				"border-border bg-destructive-fill text-destructive-foreground enabled:hover:bg-destructive-fill-highlight data-pressed:bg-destructive-fill-highlight",
			"destructive-subtle":
				"border-border bg-secondary text-destructive enabled:hover:bg-secondary-highlight data-pressed:bg-secondary-highlight",
		},
		block: {
			true: "w-full",
			false: "",
		},
	},
	defaultVariants: {
		variant: "primary",
		block: false,
	},
});

export type ButtonProps = Omit<
	JSX.ButtonHTMLAttributes<HTMLButtonElement>,
	"disabled"
> &
	VariantProps<typeof buttonVariants> & {
		disabled?: boolean;
		loading?: boolean;
		icon?: JSX.Element;
		iconEffect?: IconEffect;
		iconOrigin?: string;
		haptic?: HapticImpact;
	};

export const Button = (props: ButtonProps) => {
	const [local, handlers, rest] = splitProps(
		props,
		[
			"variant",
			"block",
			"loading",
			"icon",
			"iconEffect",
			"iconOrigin",
			"class",
			"children",
			"disabled",
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
			disabled={inactive()}
			aria-busy={local.loading || undefined}
			data-pressed={pressed() || undefined}
			data-icon-host=""
			data-loading={local.loading || undefined}
			class={cx(
				buttonVariants({ variant: local.variant, block: local.block }),
				local.loading && "disabled:opacity-100 disabled:cursor-progress",
				local.class,
			)}
		>
			<span
				class="inline-flex items-center gap-2 transition-opacity duration-[calc(var(--duration-color)*var(--motion-scale))]"
				classList={{ "opacity-0": !!local.loading }}
			>
				<Show when={icon.has()}>
					<span
						class={cx(
							"-ml-1 inline-flex size-4 items-center justify-center [&>svg]:size-4",
							local.iconEffect && iconEffectClass(local.iconEffect),
						)}
						style={iconEffectStyle({ origin: local.iconOrigin })}
					>
						{icon()}
					</span>
				</Show>
				{local.children}
			</span>
			<Show when={local.loading}>
				<span class="absolute inset-0 flex items-center justify-center">
					<Spinner size={18} />
				</span>
			</Show>
		</KobalteButton>
	);
};
