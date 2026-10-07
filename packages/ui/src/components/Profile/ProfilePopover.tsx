import { Popover as KobaltePopover } from "@kobalte/core/popover";
import { createSignal, type JSX, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { usePopperOverflowPadding } from "../../utils/safe-area";
import type { PopoverPlacement } from "../Popover/Popover";
import { Skeleton, SkeletonText } from "../Skeleton/Skeleton";
import { ProfileHeaderSkeleton } from "../Skeleton/Skeletons";
import {
	type ProfileAction,
	ProfileContent,
	type ProfileData,
} from "./ProfileContent";

export type ProfilePopoverPlacement =
	| PopoverPlacement
	| "left-start"
	| "right-start";

export type ProfilePopoverProps = {
	profile?: ProfileData;
	loading?: boolean;
	children?: JSX.Element;
	anchor?: () => HTMLElement | undefined;
	as?: "div" | "span" | "button";
	triggerClass?: string;
	triggerLabel?: string;
	placement?: ProfilePopoverPlacement;
	disabled?: boolean;
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
	onAction?: (action: ProfileAction) => void;
	contentClass?: string;
};

export const PROFILE_POPOVER_WIDTH = 360;

const popoverFrame =
	"modal-motion z-50 flex w-90 max-w-[calc(100vw-32px-var(--safe-area-left,0px)-var(--safe-area-right,0px))] flex-col overflow-hidden rounded-surface border border-border bg-popover text-foreground shadow-overlay outline-none origin-(--kb-popover-content-transform-origin)";

export const ProfilePopoverSkeleton = (props: { class?: string }) => (
	<div
		data-profile-popover-skeleton=""
		aria-busy="true"
		class={cx("flex w-90 flex-col", props.class)}
	>
		<ProfileHeaderSkeleton surface="popover" />
		<div aria-hidden="true" class="flex flex-col gap-4 p-4">
			<div class="flex flex-col gap-2">
				<SkeletonText size="sm" width={40} />
				<SkeletonText size="base" lines={2} lastLineWidth="60%" />
			</div>
			<div class="flex flex-col gap-2">
				<SkeletonText size="sm" width={84} />
				<div class="flex gap-1">
					<Skeleton width={88} height={24} class="rounded-control-xs" />
					<Skeleton width={64} height={24} class="rounded-control-xs" />
				</div>
			</div>
		</div>
		<span class="sr-only">Loading profile</span>
	</div>
);

export const ProfilePopover = (props: ProfilePopoverProps) => {
	const overflowPadding = usePopperOverflowPadding(16);
	const [innerOpen, setInnerOpen] = createSignal(props.defaultOpen ?? false);
	const open = () => props.open ?? innerOpen();
	const setOpen = (next: boolean) => {
		if (next && props.disabled) return;
		setInnerOpen(next);
		props.onOpenChange?.(next);
	};

	const name = () =>
		props.profile ? (props.profile.nickname ?? props.profile.displayName) : "";

	return (
		<KobaltePopover
			open={open()}
			onOpenChange={setOpen}
			placement={props.placement ?? "left"}
			gutter={8}
			flip
			preventScroll
			modal={false}
			overflowPadding={overflowPadding()}
			anchorRef={props.anchor}
		>
			<Show when={!props.anchor}>
				<KobaltePopover.Trigger
					as={props.as ?? "div"}
					aria-label={props.triggerLabel}
					aria-disabled={props.disabled || undefined}
					data-profile-trigger=""
					class={cx(
						"cursor-pointer outline-none focus-visible:shadow-[0_0_0_2px_var(--primary)]",
						props.disabled && "pointer-events-none",
						props.triggerClass,
					)}
				>
					{props.children}
				</KobaltePopover.Trigger>
			</Show>
			<KobaltePopover.Portal>
				<KobaltePopover.Content
					aria-label={name() ? `${name()}'s profile` : "Loading profile"}
					data-profile-popover=""
					class={cx(popoverFrame, props.contentClass)}
					style={{
						"max-height": "var(--kb-popper-content-available-height, 80vh)",
					}}
					onContextMenu={(event: MouseEvent) => event.stopPropagation()}
					onCloseAutoFocus={(event: Event) => {
						const anchor = props.anchor?.();
						if (!anchor) return;
						event.preventDefault();
						anchor.focus({ preventScroll: true });
					}}
				>
					<div class="min-h-0 overflow-y-auto overscroll-contain">
						<Show
							when={!props.loading && props.profile}
							fallback={<ProfilePopoverSkeleton />}
						>
							{(profile) => (
								<ProfileContent
									profile={profile()}
									surface="popover"
									onAction={(action) => {
										setOpen(false);
										props.onAction?.(action);
									}}
								/>
							)}
						</Show>
					</div>
				</KobaltePopover.Content>
			</KobaltePopover.Portal>
		</KobaltePopover>
	);
};
