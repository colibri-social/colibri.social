import {
	ContextMenu as KobalteContextMenu,
	useContextMenuContext,
} from "@kobalte/core/context-menu";
import { DropdownMenu as KobalteDropdownMenu } from "@kobalte/core/dropdown-menu";
import { useMenuContext } from "@kobalte/core/menu";
import {
	createSignal,
	type JSX,
	onCleanup,
	onMount,
	type ParentProps,
	Show,
	splitProps,
	untrack,
} from "solid-js";
import { spread } from "solid-js/web";
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

const LONG_PRESS_MS = 700;

type PendingOpen = { x: number; y: number; focus: boolean };

const AdoptTrigger = (props: Record<string, unknown>) => {
	const [own, others] = splitProps(props, ["element", "ref", "style"]);
	const element = own.element as HTMLElement;
	(own.ref as ((node: HTMLElement) => void) | undefined)?.(element);
	spread(element, others, false, true);
	return undefined;
};

let activeMenuClose: (() => void) | undefined;

const claimActiveMenu = (close: () => void) => {
	const previous = activeMenuClose;
	activeMenuClose = close;
	if (previous && previous !== close) previous();
};

const releaseActiveMenu = (close: () => void) => {
	if (activeMenuClose === close) activeMenuClose = undefined;
};

const OpenOnArm = (props: {
	take: () => PendingOpen | undefined;
	bindClose: (close: (() => void) | undefined) => void;
}) => {
	const anchor = useContextMenuContext();
	const menu = useMenuContext();
	props.bindClose(() => menu.close(true));
	onCleanup(() => props.bindClose(undefined));
	onMount(() => {
		const request = props.take();
		if (!request) return;
		anchor.setAnchorRect({ x: request.x, y: request.y });
		menu.open(request.focus);
	});
	return undefined;
};

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
	const [open, setOpen] = createSignal(false);
	let closeMenu: (() => void) | undefined;
	const closeActive = () => closeMenu?.();
	onCleanup(() => releaseActiveMenu(closeActive));
	const change = (next: boolean) => {
		if (next) claimActiveMenu(closeActive);
		else releaseActiveMenu(closeActive);
		setOpen(next);
		local.onOpenChange?.(next);
	};
	const swallowClick = () => {
		const swallow = (event: MouseEvent) => {
			event.preventDefault();
			event.stopPropagation();
			stop();
		};
		const timer = setTimeout(() => stop(), 600);
		const stop = () => {
			clearTimeout(timer);
			window.removeEventListener("click", swallow, true);
		};
		window.addEventListener("click", swallow, true);
	};
	const bindTrigger = (element: HTMLElement) => {
		const closeOnPress = (event: PointerEvent) => {
			if (!untrack(open) || event.button !== 0) return;
			event.preventDefault();
			event.stopPropagation();
			swallowClick();
			const pointerType = event.pointerType;
			setTimeout(() =>
				document.body.dispatchEvent(
					new PointerEvent("pointerdown", {
						bubbles: true,
						cancelable: true,
						button: 0,
						pointerType,
					}),
				),
			);
		};
		element.addEventListener("pointerdown", closeOnPress, true);
		onCleanup(() =>
			element.removeEventListener("pointerdown", closeOnPress, true),
		);
	};
	let trigger: HTMLDivElement | undefined;
	let pending: PendingOpen | undefined;
	let longPress: ReturnType<typeof setTimeout> | undefined;
	const [armed, setArmed] = createSignal(false);
	const clearLongPress = () => clearTimeout(longPress);
	onCleanup(clearLongPress);
	const arm = (request: PendingOpen) => {
		pending = request;
		setArmed(true);
	};
	const onLazyContextMenu = (event: MouseEvent) => {
		if (local.disabled || event.defaultPrevented) return;
		clearLongPress();
		event.preventDefault();
		event.stopPropagation();
		arm({ x: event.clientX, y: event.clientY, focus: true });
	};
	const isTouchOrPen = (event: PointerEvent) =>
		event.pointerType === "touch" || event.pointerType === "pen";
	const onLazyPointerDown = (event: PointerEvent) => {
		if (local.disabled || !isTouchOrPen(event)) return;
		clearLongPress();
		const request = { x: event.clientX, y: event.clientY, focus: false };
		longPress = setTimeout(() => arm(request), LONG_PRESS_MS);
	};
	const onLazyPointerEnd = (event: PointerEvent) => {
		if (isTouchOrPen(event)) clearLongPress();
	};
	return (
		<div
			ref={(element) => {
				trigger = element;
				bindTrigger(element);
			}}
			data-disabled={local.disabled ? "" : undefined}
			class={cx("block", local.class)}
			style={{ "-webkit-touch-callout": "none" }}
			onContextMenu={onLazyContextMenu}
			onPointerDown={onLazyPointerDown}
			onPointerMove={onLazyPointerEnd}
			onPointerCancel={onLazyPointerEnd}
			onPointerUp={onLazyPointerEnd}
		>
			{local.children}
			<Show when={armed() && trigger}>
				{(element) => (
					<KobalteContextMenu
						modal={false}
						onOpenChange={change}
						overflowPadding={overflowPadding()}
					>
						<KobalteContextMenu.Trigger
							as={AdoptTrigger}
							element={element()}
							disabled={local.disabled}
						/>
						<OpenOnArm
							take={() => pending}
							bindClose={(close) => {
								closeMenu = close;
							}}
						/>
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
				)}
			</Show>
		</div>
	);
};
