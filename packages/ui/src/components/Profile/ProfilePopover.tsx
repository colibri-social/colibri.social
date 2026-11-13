import { Popover as KobaltePopover } from "@kobalte/core/popover";
import { MenuDotsIcon } from "@solar-icons/solid/bold/menu-dots";
import {
	createMemo,
	createSignal,
	type JSX,
	mergeProps,
	Show,
	type ValidComponent,
} from "solid-js";
import { createAnchorScroll } from "../../utils/anchor-scroll";
import { createAnchorToggle } from "../../utils/anchor-toggle";
import { cx } from "../../utils/cx";
import { createExitHold } from "../../utils/exit-hold";
import { createLiveAnchor } from "../../utils/live-anchor";
import { revealLayer, topLayerAttrs } from "../../utils/nested-layers";
import { reducedMotionActive } from "../../utils/playback";
import { usePopperOverflowPadding } from "../../utils/safe-area";
import {
	MemberDropdownMenu,
	type MemberMenuActions,
	memberMenuEntries,
} from "../ContextMenu/MemberMenu";
import { IconButton } from "../IconButton/IconButton";
import type { PopoverPlacement } from "../Popover/Popover";
import { Skeleton, SkeletonText } from "../Skeleton/Skeleton";
import { ProfileHeaderSkeleton } from "../Skeleton/Skeletons";
import { BlockedProfileFrame } from "./BlockedProfileFrame";
import { ProfileContent, type ProfileData } from "./ProfileContent";

export type ProfilePopoverPlacement =
	| PopoverPlacement
	| "left-start"
	| "right-start";

export type ProfileMenuActions = Omit<MemberMenuActions, "onViewProfile">;

export type ProfilePopoverProps = {
	profile?: ProfileData;
	loading?: boolean;
	children?: JSX.Element;
	anchor?: () => HTMLElement | undefined;
	anchorRect?: () => DOMRect | undefined;
	alignTo?: string;
	as?: "div" | "span" | "button";
	triggerClass?: string;
	triggerLabel?: string;
	placement?: ProfilePopoverPlacement;
	disabled?: boolean;
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
	menu?: ProfileMenuActions;
	contentClass?: string;
	footer?: JSX.Element;
	label?: string;
	renderTrigger?: (trigger: ValidComponent) => JSX.Element;
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

const ProfileMenuButton = (props: {
	name: string;
	actions: ProfileMenuActions;
}) => {
	const actions = mergeProps(props.actions, { onViewProfile: undefined });
	const hasEntries = createMemo(
		() => memberMenuEntries(props.name, actions).length > 0,
	);

	return (
		<Show when={hasEntries()}>
			<div data-profile-menu="" class="flex rounded-control-sm bg-popover">
				<MemberDropdownMenu
					{...actions}
					name={props.name}
					triggerAs={IconButton}
					triggerProps={{
						variant: "ghost",
						size: "sm",
						class: "size-6 [&_svg]:size-4",
						label: `More options for ${props.name}`,
						icon: <MenuDotsIcon />,
						"data-profile-menu-trigger": "",
					}}
				/>
			</div>
		</Show>
	);
};

const focusMovedElsewhere = (content: EventTarget | null) => {
	const active = document.activeElement;
	if (!active || active === document.body) return false;
	return !(content instanceof Node && content.contains(active));
};

export const ProfilePopover = (props: ProfilePopoverProps) => {
	const overflowPadding = usePopperOverflowPadding(16);
	const [innerOpen, setInnerOpen] = createSignal(props.defaultOpen ?? false);
	const open = () => props.open ?? innerOpen();
	const setOpen = (next: boolean) => {
		if (next && props.disabled) return;
		setInnerOpen(next);
		props.onOpenChange?.(next);
	};

	const anchorScroll = createAnchorScroll({
		active: open,
		snapshot: () => props.anchorRect?.(),
		onLeave: () => setOpen(false),
	});

	const live = createLiveAnchor({
		element: () => props.anchor?.(),
		active: open,
		onLost: () => setOpen(false),
	});

	const toggleFromAnchor = createAnchorToggle({
		anchor: live.anchor,
		open,
		close: () => setOpen(false),
	});

	const alignedAnchor = (element?: HTMLElement) => {
		if (!element || !props.alignTo) return element;
		return element.closest<HTMLElement>(props.alignTo) ?? element;
	};

	const shown = createExitHold(
		() => ({ profile: props.profile, loading: props.loading }),
		open,
	);
	const ExitHoldMarker = () => {
		shown.track();
		return null;
	};

	const name = () => {
		const profile = shown.value().profile;
		return profile ? (profile.nickname ?? profile.displayName) : "";
	};

	return (
		<KobaltePopover
			open={open()}
			onOpenChange={setOpen}
			placement={props.placement ?? "left"}
			gutter={8}
			flip
			preventScroll={false}
			modal={false}
			overflowPadding={overflowPadding()}
			anchorRef={live.anchor}
			getAnchorRect={(element?: HTMLElement) =>
				anchorScroll.rect(alignedAnchor(element)) ?? live.rect(element)
			}
		>
			<Show when={props.renderTrigger}>
				{(render) => render()(KobaltePopover.Trigger)}
			</Show>
			<Show when={!props.anchor && !props.renderTrigger}>
				<KobaltePopover.Trigger
					as={props.as ?? "div"}
					aria-label={props.triggerLabel}
					aria-disabled={props.disabled || undefined}
					data-profile-trigger=""
					class={cx(
						"cursor-pointer outline-none focus-ring",
						props.disabled && "pointer-events-none",
						props.triggerClass,
					)}
				>
					{props.children}
				</KobaltePopover.Trigger>
			</Show>
			<KobaltePopover.Portal>
				<KobaltePopover.Content
					{...topLayerAttrs}
					ref={revealLayer}
					aria-label={
						props.label ?? (name() ? `${name()}'s profile` : "Loading profile")
					}
					data-profile-popover=""
					class={cx(popoverFrame, props.contentClass)}
					style={{
						"max-height": "var(--kb-popper-content-available-height, 80vh)",
					}}
					tabIndex={-1}
					onContextMenu={(event: MouseEvent) => event.stopPropagation()}
					onInteractOutside={toggleFromAnchor}
					onOpenAutoFocus={(event: Event) => {
						event.preventDefault();
						(event.currentTarget as HTMLElement).focus({ preventScroll: true });
					}}
					onCloseAutoFocus={(event: Event) => {
						if (focusMovedElsewhere(event.currentTarget)) {
							event.preventDefault();
							return;
						}
						const anchor = live.anchor();
						if (!anchor) return;
						event.preventDefault();
						if (anchor.isConnected) anchor.focus({ preventScroll: true });
					}}
				>
					<ExitHoldMarker />
					<div class="min-h-0 overflow-y-auto overscroll-contain">
						<Show
							when={!shown.value().loading && shown.value().profile}
							fallback={<ProfilePopoverSkeleton />}
						>
							{(profile) => (
								<BlockedProfileFrame profile={profile()} open={open()}>
									<ProfileContent
										profile={profile()}
										surface="popover"
										tight
										avatarPlay={open() && !reducedMotionActive()}
										footer={props.footer}
										showActions={false}
										showDeveloper={false}
										headerActions={
											<Show when={props.menu}>
												{(menu) => (
													<ProfileMenuButton name={name()} actions={menu()} />
												)}
											</Show>
										}
									/>
								</BlockedProfileFrame>
							)}
						</Show>
					</div>
				</KobaltePopover.Content>
			</KobaltePopover.Portal>
		</KobaltePopover>
	);
};
