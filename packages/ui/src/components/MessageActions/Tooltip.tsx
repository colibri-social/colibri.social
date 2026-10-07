import { Tooltip as KobalteTooltip } from "@kobalte/core/tooltip";
import { type JSX, type ParentProps, splitProps } from "solid-js";
import { cx } from "../../utils/cx";

export type TooltipPlacement = "top" | "bottom" | "left" | "right";

export type TooltipProps = ParentProps<{
	placement?: TooltipPlacement;
	openDelay?: number;
	closeDelay?: number;
	disabled?: boolean;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
}>;

export const Tooltip = (props: TooltipProps) => (
	<KobalteTooltip
		placement={props.placement ?? "top"}
		gutter={6}
		openDelay={props.openDelay ?? 400}
		closeDelay={props.closeDelay ?? 0}
		skipDelayDuration={300}
		disabled={props.disabled}
		open={props.open}
		onOpenChange={props.onOpenChange}
		overflowPadding={8}
	>
		{props.children}
	</KobalteTooltip>
);

export const TooltipTrigger = KobalteTooltip.Trigger;

export type TooltipContentProps = {
	class?: string;
	children?: JSX.Element;
};

export const TooltipContent = (props: TooltipContentProps) => {
	const [local, rest] = splitProps(props, ["class", "children"]);
	return (
		<KobalteTooltip.Portal>
			<KobalteTooltip.Content
				{...rest}
				class={cx(
					"z-50 max-w-64 rounded-control-xs border border-border bg-popover px-2 py-1 text-xs font-semibold text-foreground shadow-overlay",
					local.class,
				)}
			>
				{local.children}
			</KobalteTooltip.Content>
		</KobalteTooltip.Portal>
	);
};
