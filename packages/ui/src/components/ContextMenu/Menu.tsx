import { ContextMenu as KobalteContextMenu } from "@kobalte/core/context-menu";
import { DropdownMenu as KobalteDropdownMenu } from "@kobalte/core/dropdown-menu";
import { type JSX, type ParentProps, Show, splitProps } from "solid-js";
import { cx } from "../../utils/cx";
import { usePopperOverflowPadding } from "../../utils/safe-area";
import { createSlot } from "../../utils/slot";

export const menuContentClass =
	"z-50 flex min-w-52 max-w-72 flex-col rounded-control-lg border border-border bg-popover p-1 text-foreground shadow-overlay outline-none";

export type MenuItemTone = "default" | "destructive";

export type MenuItemProps = {
	label: JSX.Element;
	icon?: JSX.Element;
	tone?: MenuItemTone;
	disabled?: boolean;
	closeOnSelect?: boolean;
	onSelect?: () => void;
	class?: string;
};

export const MenuItem = (props: MenuItemProps) => {
	const icon = createSlot(() => props.icon);
	return (
		<KobalteDropdownMenu.Item
			disabled={props.disabled}
			closeOnSelect={props.closeOnSelect ?? true}
			onSelect={() => props.onSelect?.()}
			data-tone={props.tone ?? "default"}
			class={cx(
				"flex h-8 w-full shrink-0 cursor-pointer items-center gap-2 rounded-control-sm px-2 text-left text-sm font-semibold outline-none select-none",
				"data-disabled:cursor-not-allowed data-disabled:opacity-50",
				props.tone === "destructive"
					? "text-destructive data-highlighted:bg-[color-mix(in_srgb,var(--destructive)_14%,transparent)]"
					: "text-foreground data-highlighted:bg-popover-highlight",
				props.class,
			)}
		>
			<Show when={icon.has()}>
				<span
					aria-hidden="true"
					class={cx(
						"flex size-5 shrink-0 items-center justify-center [&>svg]:size-5",
						props.tone === "destructive"
							? "text-destructive"
							: "text-muted-foreground",
					)}
				>
					{icon()}
				</span>
			</Show>
			<span class="min-w-0 flex-1 truncate">{props.label}</span>
		</KobalteDropdownMenu.Item>
	);
};

export const MenuSeparator = (props: { class?: string }) => (
	<KobalteDropdownMenu.Separator
		class={cx("mx-2 my-1 h-px shrink-0 border-0 bg-border", props.class)}
	/>
);

export type ContextMenuProps = ParentProps<{
	menu: JSX.Element;
	disabled?: boolean;
	onOpenChange?: (open: boolean) => void;
	class?: string;
	contentClass?: string;
	"aria-label"?: string;
}>;

export const ContextMenu = (props: ContextMenuProps) => {
	const overflowPadding = usePopperOverflowPadding();
	const [local, rest] = splitProps(props, [
		"menu",
		"disabled",
		"onOpenChange",
		"class",
		"contentClass",
		"children",
	]);
	return (
		<KobalteContextMenu
			onOpenChange={local.onOpenChange}
			overflowPadding={overflowPadding()}
		>
			<KobalteContextMenu.Trigger
				disabled={local.disabled}
				class={cx("block", local.class)}
			>
				{local.children}
			</KobalteContextMenu.Trigger>
			<KobalteContextMenu.Portal>
				<KobalteContextMenu.Content
					{...rest}
					class={cx(menuContentClass, local.contentClass)}
				>
					{local.menu}
				</KobalteContextMenu.Content>
			</KobalteContextMenu.Portal>
		</KobalteContextMenu>
	);
};

export type DropdownMenuPlacement =
	| "top"
	| "top-start"
	| "top-end"
	| "bottom"
	| "bottom-start"
	| "bottom-end"
	| "left"
	| "right";

export type DropdownMenuProps = {
	triggerLabel: string;
	triggerContent: JSX.Element;
	triggerClass?: string;
	menu: JSX.Element;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	placement?: DropdownMenuPlacement;
	contentClass?: string;
};

export const DropdownMenu = (props: DropdownMenuProps) => {
	const overflowPadding = usePopperOverflowPadding();
	return (
		<KobalteDropdownMenu
			open={props.open}
			onOpenChange={props.onOpenChange}
			placement={props.placement ?? "bottom-end"}
			gutter={6}
			overflowPadding={overflowPadding()}
		>
			<KobalteDropdownMenu.Trigger
				type="button"
				aria-label={props.triggerLabel}
				title={props.triggerLabel}
				class={props.triggerClass}
			>
				{props.triggerContent}
			</KobalteDropdownMenu.Trigger>
			<KobalteDropdownMenu.Portal>
				<KobalteDropdownMenu.Content
					class={cx(menuContentClass, props.contentClass)}
				>
					{props.menu}
				</KobalteDropdownMenu.Content>
			</KobalteDropdownMenu.Portal>
		</KobalteDropdownMenu>
	);
};
