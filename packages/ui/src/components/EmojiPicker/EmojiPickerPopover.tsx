import { Popover as KobaltePopover } from "@kobalte/core/popover";
import { type JSX, Show, splitProps } from "solid-js";
import { cx } from "../../utils/cx";
import { revealLayer, topLayerAttrs } from "../../utils/nested-layers";
import { usePopperOverflowPadding } from "../../utils/safe-area";
import { Drawer, DrawerContent } from "../Drawer/Drawer";
import type { PopoverPlacement } from "../Popover/Popover";
import {
	type EmojiPick,
	EmojiPicker,
	type EmojiPickerPlatform,
	type EmojiPickerProps,
} from "./EmojiPicker";

export type AnchoredPickerProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	platform?: EmojiPickerPlatform;
	anchor?: JSX.Element;
	anchorElement?: HTMLElement;
	placement?: PopoverPlacement;
	label?: string;
	returnFocusTo?: () => HTMLElement | undefined;
};

const FOCUSABLE = "button, [href], input, [tabindex]:not([tabindex='-1'])";

export const popoverSurface = [
	"modal-motion z-50 flex max-h-(--anchored-max-height) max-w-[calc(100vw-32px-var(--safe-area-left,0px)-var(--safe-area-right,0px))] flex-col rounded-surface border border-border",
	"[--anchored-max-height:min(calc(100dvh-32px),var(--kb-popper-content-available-height,100dvh))]",
	"bg-popover p-2 text-foreground shadow-overlay outline-none",
	"origin-(--kb-popover-content-transform-origin)",
];

export const AnchoredPicker = (
	props: AnchoredPickerProps & {
		class?: string;
		children: JSX.Element;
	},
) => {
	const overflowPadding = usePopperOverflowPadding(16);
	let wrapper: HTMLSpanElement | undefined;
	const anchorElement = () => props.anchorElement ?? wrapper;

	const returnFocus = (event: Event) => {
		event.preventDefault();
		const target = props.returnFocusTo?.();
		if (target) {
			target.focus();
			return;
		}
		const anchor = anchorElement();
		if (!anchor) return;
		const focusable = anchor.matches(FOCUSABLE)
			? anchor
			: anchor.querySelector<HTMLElement>(FOCUSABLE);
		focusable?.focus();
	};

	return (
		<Show
			when={(props.platform ?? "desktop") === "desktop"}
			fallback={
				<>
					{props.anchor}
					<Drawer
						open={props.open}
						onOpenChange={props.onOpenChange}
						initialFocus="content"
					>
						<DrawerContent aria-label={props.label}>
							{props.children}
						</DrawerContent>
					</Drawer>
				</>
			}
		>
			<KobaltePopover
				open={props.open}
				onOpenChange={props.onOpenChange}
				placement={props.placement ?? "top-end"}
				gutter={8}
				overflowPadding={overflowPadding()}
				anchorRef={anchorElement}
			>
				<Show when={!props.anchorElement}>
					<span ref={wrapper} class="inline-flex">
						{props.anchor}
					</span>
				</Show>
				<KobaltePopover.Portal>
					<KobaltePopover.Content
						{...topLayerAttrs}
						ref={revealLayer}
						aria-label={props.label}
						onInteractOutside={(event) => {
							const target = event.detail.originalEvent.target as Node | null;
							if (target && anchorElement()?.contains(target))
								event.preventDefault();
						}}
						onCloseAutoFocus={returnFocus}
						class={cx(popoverSurface, props.class)}
					>
						{props.children}
					</KobaltePopover.Content>
				</KobaltePopover.Portal>
			</KobaltePopover>
		</Show>
	);
};

export type EmojiPickerPopoverProps = Omit<EmojiPickerProps, "platform"> &
	AnchoredPickerProps & {
		closeOnPick?: boolean;
	};

export const EmojiPickerPopover = (props: EmojiPickerPopoverProps) => {
	const [anchored, picker] = splitProps(props, [
		"open",
		"onOpenChange",
		"platform",
		"anchor",
		"anchorElement",
		"placement",
		"label",
		"returnFocusTo",
		"closeOnPick",
		"onPick",
	]);

	const onPick = (pick: EmojiPick, event: MouseEvent) => {
		anchored.onPick(pick, event);
		if (anchored.closeOnPick === false || event.shiftKey) return;
		anchored.onOpenChange(false);
	};

	return (
		<AnchoredPicker
			open={anchored.open}
			onOpenChange={anchored.onOpenChange}
			platform={anchored.platform}
			anchor={anchored.anchor}
			anchorElement={anchored.anchorElement}
			placement={anchored.placement}
			returnFocusTo={anchored.returnFocusTo}
			label={anchored.label ?? "Emoji picker"}
			class="w-[352px]"
		>
			<EmojiPicker
				{...picker}
				platform={anchored.platform}
				autofocus
				onPick={onPick}
			/>
		</AnchoredPicker>
	);
};
