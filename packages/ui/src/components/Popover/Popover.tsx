import { Popover as KobaltePopover } from "@kobalte/core/popover";
import { type JSX, type ParentProps, Show, splitProps } from "solid-js";
import { cx } from "../../utils/cx";
import { revealLayer, topLayerAttrs } from "../../utils/nested-layers";
import { usePopperOverflowPadding } from "../../utils/safe-area";
import { createSlot } from "../../utils/slot";

export type PopoverPlacement =
	| "top"
	| "top-start"
	| "top-end"
	| "bottom"
	| "bottom-start"
	| "bottom-end"
	| "left"
	| "right";

export type PopoverProps = ParentProps<{
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	defaultOpen?: boolean;
	placement?: PopoverPlacement;
	gutter?: number;
	modal?: boolean;
}>;

export const Popover = (props: PopoverProps) => {
	const overflowPadding = usePopperOverflowPadding(16);
	return (
		<KobaltePopover
			open={props.open}
			onOpenChange={props.onOpenChange}
			defaultOpen={props.defaultOpen}
			placement={props.placement ?? "bottom-start"}
			gutter={props.gutter ?? 8}
			modal={props.modal ?? false}
			overflowPadding={overflowPadding()}
		>
			{props.children}
		</KobaltePopover>
	);
};

export const PopoverTrigger = KobaltePopover.Trigger;
export const PopoverAnchor = KobaltePopover.Anchor;
export const PopoverClose = KobaltePopover.CloseButton;

export type PopoverContentProps = {
	title?: JSX.Element;
	class?: string;
	children?: JSX.Element;
	"aria-label"?: string;
};

export const PopoverContent = (props: PopoverContentProps) => {
	const [local, rest] = splitProps(props, ["title", "class", "children"]);
	const title = createSlot(() => local.title);

	return (
		<KobaltePopover.Portal>
			<KobaltePopover.Content
				{...topLayerAttrs}
				{...rest}
				ref={revealLayer}
				class={cx(
					"modal-motion z-50 flex max-w-[calc(100vw-32px-var(--safe-area-left,0px)-var(--safe-area-right,0px))] flex-col gap-2 rounded-surface border border-border",
					"bg-popover p-2 text-foreground shadow-overlay outline-none",
					"origin-(--kb-popover-content-transform-origin)",
					local.class,
				)}
			>
				<Show when={title.has()}>
					<KobaltePopover.Title class="px-1 pt-1 text-sm font-medium text-muted-foreground">
						{title()}
					</KobaltePopover.Title>
				</Show>
				{local.children}
			</KobaltePopover.Content>
		</KobaltePopover.Portal>
	);
};
