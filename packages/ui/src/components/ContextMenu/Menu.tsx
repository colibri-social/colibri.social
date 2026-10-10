import { ContextMenu as KobalteContextMenu } from "@kobalte/core/context-menu";
import { DropdownMenu as KobalteDropdownMenu } from "@kobalte/core/dropdown-menu";
import { type JSX, type ParentProps, Show, splitProps } from "solid-js";
import { cx } from "../../utils/cx";
import { revealLayer, topLayerAttrs } from "../../utils/nested-layers";
import { usePopperOverflowPadding } from "../../utils/safe-area";
import { createSlot } from "../../utils/slot";

export const menuContentClass =
	"z-50 flex min-w-52 max-w-72 flex-col rounded-control-lg border border-border bg-popover p-1 text-foreground shadow-overlay outline-none";

export const menuItemClass =
	"flex h-8 w-full shrink-0 cursor-pointer items-center gap-2 rounded-control-sm px-2 text-left text-sm font-semibold outline-none select-none data-disabled:cursor-not-allowed data-disabled:opacity-50";

export const menuItemToneClass = {
	default: "text-foreground data-highlighted:bg-popover-highlight",
	destructive:
		"text-destructive data-highlighted:bg-[color-mix(in_srgb,var(--destructive)_14%,transparent)]",
} as const;

export type MenuItemTone = "default" | "destructive";

export type MenuItemProps = {
	label: JSX.Element;
	icon?: JSX.Element;
	tone?: MenuItemTone;
	disabled?: boolean;
	closeOnSelect?: boolean;
	onSelect?: () => void;
	hint?: string;
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
				menuItemClass,
				menuItemToneClass[props.tone ?? "default"],
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
			<Show when={props.hint}>
				<span
					data-menu-hint=""
					aria-hidden="true"
					class="ml-auto shrink-0 pl-4 font-sans text-xs font-medium text-muted-foreground"
				>
					{props.hint}
				</span>
			</Show>
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
			modal={false}
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
					{...topLayerAttrs}
					ref={revealLayer}
					{...rest}
					class={cx(
						menuContentClass,
						"max-h-(--kb-popper-content-available-height) origin-(--kb-menu-content-transform-origin) overflow-y-auto",
						"data-closed:animate-[ui-fade-out_calc(var(--duration-exit)*var(--motion-scale))_var(--ease-exit)_both]",
						local.contentClass,
					)}
				>
					{local.menu}
				</KobalteContextMenu.Content>
			</KobalteContextMenu.Portal>
		</KobalteContextMenu>
	);
};
