import { AltArrowDownIcon } from "@solar-icons/solid/linear/alt-arrow-down";
import { AltArrowRightIcon } from "@solar-icons/solid/linear/alt-arrow-right";
import {
	createSignal,
	type JSX,
	mergeProps,
	onCleanup,
	onMount,
	Show,
} from "solid-js";
import { cx } from "../../utils/cx";
import { createRipple } from "../../utils/ripple";
import { Banner, hasSpaceBanner } from "../Banner/Banner";
import { Card } from "../Card/Card";
import {
	type SpaceContextMenuActions,
	spaceContextMenuEntries,
} from "../ContextMenu/SpaceMenu";
import type { DeveloperModeCardProps } from "../DeveloperMode/DeveloperModeCard";
import { DropdownMenu } from "../DropdownMenu/DropdownMenu";
import { SpaceDrawer, type SpaceDrawerProps } from "../Space/SpaceDrawer";
import { MemberCountChip, OwnerChip } from "../Space/SpaceMeta";
import type { ChannelPlatform } from "./ChannelRow";

export type ChannelListHeaderProps = {
	name: string;
	iconSrc?: string;
	bannerSrc?: string;
	bannerColor?: string;
	memberCount: number;
	memberLabel?: string;
	ownerHandle?: string;
	onOpenSpace?: () => void;
	openLabel?: string;
	menu?: SpaceMenuActions;
	description?: string;
	developer?: DeveloperModeCardProps;
	platform?: ChannelPlatform;
	class?: string;
};

export type SpaceMenuActions = SpaceContextMenuActions;

export const spaceMenuEntries = spaceContextMenuEntries;

const spaceNameClass =
	"group/space-name flex h-7 max-w-full min-w-0 cursor-pointer items-center gap-2 rounded-control-sm border-0 bg-transparent px-2 text-left text-foreground outline-none focus-ring hover:bg-popover data-expanded:bg-popover";

const overlayTextClass = "text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.7)]";

const SpaceNameContent = (props: {
	name: string;
	desktop: boolean;
	overlay?: boolean;
}) => (
	<>
		<span
			data-space-name=""
			class={cx(
				"min-w-0 truncate font-bold",
				props.desktop ? "text-base" : "text-xl",
				props.overlay && overlayTextClass,
			)}
		>
			{props.name}
		</span>
		<span
			data-space-chevron=""
			class={cx(
				"flex size-4 shrink-0 transition-transform duration-[calc(200ms*var(--motion-scale))] ease-[cubic-bezier(0.2,0,0,1)] group-data-expanded/space-name:rotate-180 motion-reduce:transition-none reduced-motion:transition-none [&>svg]:size-4",
				props.overlay
					? "text-white [filter:drop-shadow(0_1px_2px_rgb(0_0_0/0.7))]"
					: "text-muted-foreground",
			)}
		>
			<Show when={props.desktop} fallback={<AltArrowRightIcon />}>
				<AltArrowDownIcon />
			</Show>
		</span>
	</>
);

const mobileSpaceNameClass =
	"ripple flex max-w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-control-xs border-0 bg-transparent p-0 text-left text-foreground outline-none focus-ring";

const MobileSpaceButton = (props: {
	name: string;
	label?: string;
	menu?: SpaceMenuActions;
	onClick?: () => void;
	drawer: Omit<SpaceDrawerProps, "open" | "onOpenChange">;
}) => {
	const ripple = createRipple();
	const [open, setOpen] = createSignal(false);
	return (
		<>
			<button
				ref={ripple}
				type="button"
				data-space-name-button=""
				aria-haspopup="dialog"
				aria-expanded={props.menu ? open() : undefined}
				aria-label={props.label ?? `${props.name}, Space options`}
				onClick={() => {
					if (props.menu) setOpen(true);
					else props.onClick?.();
				}}
				class={mobileSpaceNameClass}
			>
				<SpaceNameContent name={props.name} desktop={false} />
			</button>
			<Show when={props.menu}>
				<SpaceDrawer {...props.drawer} open={open()} onOpenChange={setOpen} />
			</Show>
		</>
	);
};

export const SPACE_HEADER_HEIGHT = 44;

const scrollParentOf = (node: HTMLElement) => {
	let current = node.parentElement;
	while (current) {
		const overflow = getComputedStyle(current).overflowY;
		if (overflow === "auto" || overflow === "scroll") return current;
		current = current.parentElement;
	}
	return undefined;
};

const DesktopSpaceRow = (props: {
	name: string;
	label?: string;
	menu?: SpaceMenuActions;
	onClick?: () => void;
	overlay: boolean;
	scrolled: boolean;
	ref: (node: HTMLDivElement) => void;
}) => (
	<div
		ref={props.ref}
		data-space-header-row=""
		data-overlay={props.overlay ? "" : undefined}
		data-scrolled={props.scrolled ? "" : undefined}
		class={cx(
			"sticky top-0 z-20 flex h-11 min-w-0 shrink-0 items-center justify-between gap-2 p-2 transition-[background-color,box-shadow] duration-[calc(150ms*var(--motion-scale))] ease-out motion-reduce:transition-none reduced-motion:transition-none",
			props.overlay ? "bg-transparent" : "bg-background",
			props.scrolled && "shadow-[inset_0_-1px_0_var(--secondary)]",
		)}
	>
		<Show
			when={props.menu}
			fallback={
				<button
					type="button"
					data-space-name-button=""
					aria-label={props.label ?? `${props.name}, Space options`}
					onClick={() => props.onClick?.()}
					class={spaceNameClass}
				>
					<SpaceNameContent name={props.name} desktop overlay={props.overlay} />
				</button>
			}
		>
			{(menu) => (
				<DropdownMenu
					platform="desktop"
					label={props.label ?? `${props.name}, Space options`}
					placement="bottom-start"
					items={spaceMenuEntries(menu())}
					triggerClass={spaceNameClass}
					triggerProps={{ "data-space-name-button": "" }}
					trigger={
						<SpaceNameContent
							name={props.name}
							desktop
							overlay={props.overlay}
						/>
					}
				/>
			)}
		</Show>
	</div>
);

const DesktopHeader = (props: ChannelListHeaderProps) => {
	const banner = () => hasSpaceBanner(props);
	const [scrolled, setScrolled] = createSignal(false);
	let row: HTMLDivElement | undefined;
	let hero: HTMLDivElement | undefined;

	onMount(() => {
		if (!row) return;
		const scroller = scrollParentOf(row);
		if (!scroller) return;
		let frame = 0;
		const measure = () => {
			frame = 0;
			if (!row) return;
			const rowBottom = row.getBoundingClientRect().bottom;
			const reference = hero?.isConnected
				? hero.getBoundingClientRect().bottom
				: scroller.getBoundingClientRect().top + SPACE_HEADER_HEIGHT;
			setScrolled(
				banner() ? reference <= rowBottom + 0.5 : scroller.scrollTop > 0.5,
			);
		};
		const schedule = () => {
			if (!frame) frame = requestAnimationFrame(measure);
		};
		measure();
		scroller.addEventListener("scroll", schedule, { passive: true });
		const resize = new ResizeObserver(schedule);
		resize.observe(scroller);
		onCleanup(() => {
			scroller.removeEventListener("scroll", schedule);
			resize.disconnect();
			if (frame) cancelAnimationFrame(frame);
		});
	});

	return (
		<>
			<DesktopSpaceRow
				ref={(node) => {
					row = node;
				}}
				name={props.name}
				label={props.openLabel}
				menu={props.menu}
				onClick={props.onOpenSpace}
				overlay={banner() && !scrolled()}
				scrolled={scrolled()}
			/>
			<Show when={banner()}>
				<div
					ref={(node) => {
						hero = node;
					}}
					data-space-hero=""
					class="relative -mt-11"
				>
					<Banner
						ratio="space"
						src={props.bannerSrc}
						tintFrom={props.iconSrc}
						color={props.bannerColor}
					/>
					<span
						aria-hidden="true"
						data-space-scrim=""
						class="pointer-events-none absolute inset-x-0 top-0 h-16 bg-linear-to-b from-black/45 to-transparent"
					/>
				</div>
			</Show>
		</>
	);
};

export const ChannelListHeader = (props: ChannelListHeaderProps) => {
	const desktop = () => props.platform === "desktop";
	const chips = () => (
		<div data-space-chips="" class="flex min-w-0 flex-wrap gap-1">
			<MemberCountChip count={props.memberCount} label={props.memberLabel} />
			<Show when={props.ownerHandle}>
				{(handle) => <OwnerChip handle={handle()} short />}
			</Show>
		</div>
	);

	return (
		<div
			data-channel-list-header=""
			data-platform={desktop() ? "desktop" : "mobile"}
			data-banner-flush={desktop() && hasSpaceBanner(props) ? "" : undefined}
			class={cx(desktop() ? "contents" : "flex w-full flex-col", props.class)}
		>
			<Show
				when={desktop()}
				fallback={
					<Show when={hasSpaceBanner(props)}>
						<div data-space-hero="" class="relative flex flex-col">
							<Banner
								ratio="space"
								src={props.bannerSrc}
								tintFrom={props.iconSrc}
								color={props.bannerColor}
							/>
						</div>
					</Show>
				}
			>
				<DesktopHeader {...props} />
			</Show>
			<div
				class={cx(
					"flex flex-col gap-2",
					desktop() && !hasSpaceBanner(props) ? "px-4 pt-0 pb-4" : "p-4",
					desktop()
						? "border-0 border-b border-solid border-secondary"
						: "border-0 border-y border-solid border-secondary",
				)}
			>
				<Show when={!desktop()}>
					<MobileSpaceButton
						name={props.name}
						label={props.openLabel}
						menu={props.menu}
						onClick={props.onOpenSpace}
						drawer={mergeProps(() => props.menu ?? {}, {
							get name() {
								return props.name;
							},
							get iconSrc() {
								return props.iconSrc;
							},
							get bannerSrc() {
								return props.bannerSrc;
							},
							get bannerColor() {
								return props.bannerColor;
							},
							get memberCount() {
								return props.memberCount;
							},
							get memberLabel() {
								return props.memberLabel;
							},
							get ownerHandle() {
								return props.ownerHandle;
							},
							get description() {
								return props.description;
							},
							get developer() {
								return props.developer;
							},
						})}
					/>
				</Show>
				{chips()}
			</div>
		</div>
	);
};

export type ActionTileProps = {
	icon: JSX.Element;
	label: string;
	onClick?: () => void;
	class?: string;
};

export const ActionTile = (props: ActionTileProps) => (
	<Card
		tone="secondary"
		onClick={() => props.onClick?.()}
		class={cx(
			"flex min-w-0 flex-1 flex-col items-center justify-center gap-2 px-2 py-4",
			props.class,
		)}
	>
		<span
			aria-hidden="true"
			class="flex size-6 shrink-0 text-foreground [&>svg]:size-6"
		>
			{props.icon}
		</span>
		<span class="w-full truncate text-center text-sm leading-5 text-foreground">
			{props.label}
		</span>
	</Card>
);

export const ActionTiles = (props: {
	children: JSX.Element;
	class?: string;
}) => <div class={cx("flex w-full gap-2", props.class)}>{props.children}</div>;
