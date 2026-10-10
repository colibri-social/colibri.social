import { AltArrowDownIcon } from "@solar-icons/solid/linear/alt-arrow-down";
import { AltArrowRightIcon } from "@solar-icons/solid/linear/alt-arrow-right";
import { type JSX, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { createRipple } from "../../utils/ripple";
import { Banner } from "../Banner/Banner";
import { Card } from "../Card/Card";
import {
	type SpaceContextMenuActions,
	spaceContextMenuEntries,
} from "../ContextMenu/SpaceMenu";
import { DropdownMenu } from "../DropdownMenu/DropdownMenu";
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
	platform?: ChannelPlatform;
	class?: string;
};

export type SpaceMenuActions = SpaceContextMenuActions;

export const spaceMenuEntries = spaceContextMenuEntries;

const spaceNameClass =
	"group/space-name flex h-7 max-w-full min-w-0 cursor-pointer items-center gap-2 rounded-control-sm border-0 bg-transparent px-2 text-left text-foreground outline-none focus-ring hover:bg-popover data-expanded:bg-popover";

const SpaceNameContent = (props: { name: string; desktop: boolean }) => (
	<>
		<span
			data-space-name=""
			class={cx(
				"min-w-0 truncate font-bold",
				props.desktop ? "text-base" : "text-xl",
			)}
		>
			{props.name}
		</span>
		<span
			data-space-chevron=""
			class="flex size-4 shrink-0 text-muted-foreground transition-transform duration-[calc(200ms*var(--motion-scale))] ease-[cubic-bezier(0.2,0,0,1)] group-data-expanded/space-name:rotate-180 motion-reduce:transition-none reduced-motion:transition-none [&>svg]:size-4"
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
}) => {
	const ripple = createRipple();
	return (
		<Show
			when={props.menu}
			fallback={
				<button
					ref={ripple}
					type="button"
					data-space-name-button=""
					aria-haspopup="dialog"
					aria-label={props.label ?? `${props.name}, Space options`}
					onClick={() => props.onClick?.()}
					class={mobileSpaceNameClass}
				>
					<SpaceNameContent name={props.name} desktop={false} />
				</button>
			}
		>
			{(menu) => (
				<DropdownMenu
					platform="mobile"
					label={props.label ?? `${props.name}, Space options`}
					title={props.name}
					items={spaceMenuEntries(menu())}
					triggerClass={mobileSpaceNameClass}
					triggerProps={{ ref: ripple, "data-space-name-button": "" }}
					trigger={<SpaceNameContent name={props.name} desktop={false} />}
				/>
			)}
		</Show>
	);
};

const DesktopSpaceButton = (props: {
	name: string;
	label?: string;
	menu?: SpaceMenuActions;
	onClick?: () => void;
}) => (
	<div data-space-header-row="" class="flex h-11 min-w-0 items-center p-2">
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
					<SpaceNameContent name={props.name} desktop />
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
					trigger={<SpaceNameContent name={props.name} desktop />}
				/>
			)}
		</Show>
	</div>
);

export const ChannelListHeader = (props: ChannelListHeaderProps) => {
	const desktop = () => props.platform === "desktop";
	const chips = () => (
		<div class="flex flex-wrap gap-1">
			<MemberCountChip count={props.memberCount} label={props.memberLabel} />
			<Show when={props.ownerHandle}>
				{(handle) => <OwnerChip handle={handle()} />}
			</Show>
		</div>
	);

	return (
		<div
			data-channel-list-header=""
			data-platform={desktop() ? "desktop" : "mobile"}
			class={cx("flex w-full flex-col", props.class)}
		>
			<Show when={desktop()}>
				<DesktopSpaceButton
					name={props.name}
					label={props.openLabel}
					menu={props.menu}
					onClick={props.onOpenSpace}
				/>
			</Show>
			<Banner
				ratio="space"
				src={props.bannerSrc}
				tintFrom={props.iconSrc}
				color={props.bannerColor}
			/>
			<div
				class={cx(
					"flex flex-col gap-2 p-4",
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
