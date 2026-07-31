import { HoverCard as HoverCardPrimitive } from "@kobalte/core/hover-card";
import {
	type ComponentProps,
	mergeProps,
	splitProps,
	type ValidComponent,
} from "solid-js";

import { cx } from "../../utils/cva";
import { useOverflowPadding } from "../../utils/safe-area";

export const HoverCardPortal = HoverCardPrimitive.Portal;

export type HoverCardProps = ComponentProps<typeof HoverCardPrimitive>;

export const HoverCard = (props: HoverCardProps) => {
	const overflowPadding = useOverflowPadding();
	const merge = mergeProps<HoverCardProps[]>(
		{
			get overflowPadding() {
				return overflowPadding();
			},
		},
		props,
	);

	return <HoverCardPrimitive data-slot="hover-card" {...merge} />;
};

export type HoverCardTriggerProps<T extends ValidComponent = "a"> =
	ComponentProps<typeof HoverCardPrimitive.Trigger<T>>;

export const HoverCardTrigger = <T extends ValidComponent = "a">(
	props: HoverCardTriggerProps<T>,
) => {
	return (
		<HoverCardPrimitive.Trigger data-slot="hover-card-trigger" {...props} />
	);
};

export type HoverCardContentProps<T extends ValidComponent = "div"> =
	ComponentProps<typeof HoverCardPrimitive.Content<T>>;

export const HoverCardContent = <T extends ValidComponent = "div">(
	props: HoverCardContentProps<T>,
) => {
	const [, rest] = splitProps(props as HoverCardContentProps, ["class"]);

	return (
		<HoverCardPrimitive.Content
			data-slot="hover-card-content"
			class={cx(
				"bg-popover text-popover-foreground data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95 z-50 w-auto origin-(--kb-popper-content-transform-origin) rounded-md border p-1 shadow-md outline-hidden",
				props.class,
			)}
			{...rest}
		/>
	);
};
