import { AltArrowDownIcon } from "@solar-icons/solid/linear/alt-arrow-down";
import { AltArrowRightIcon } from "@solar-icons/solid/linear/alt-arrow-right";
import { type JSX, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { createRipple } from "../../utils/ripple";
import { Banner } from "../Banner/Banner";
import { Card } from "../Card/Card";
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
	platform?: ChannelPlatform;
	class?: string;
};

const SpaceButton = (props: {
	name: string;
	label?: string;
	desktop: boolean;
	onClick?: () => void;
}) => {
	const ripple = createRipple();
	return (
		<button
			ref={ripple}
			type="button"
			aria-haspopup="dialog"
			aria-label={props.label ?? `${props.name}, Space options`}
			onClick={() => props.onClick?.()}
			class={cx(
				"ripple flex min-w-0 cursor-pointer items-center border-0 bg-transparent p-0 text-left text-foreground outline-none focus-visible:shadow-[0_0_0_2px_var(--primary)]",
				props.desktop
					? "h-12 w-full gap-2 px-4 hover:bg-popover/60"
					: "max-w-full gap-2.5 rounded-control-xs",
			)}
		>
			<span
				data-space-name=""
				class={cx(
					"min-w-0 truncate font-bold",
					props.desktop ? "flex-1 text-base" : "text-xl",
				)}
			>
				{props.name}
			</span>
			<span class="flex size-4 shrink-0 text-muted-foreground [&>svg]:size-4">
				<Show when={props.desktop} fallback={<AltArrowRightIcon />}>
					<AltArrowDownIcon />
				</Show>
			</span>
		</button>
	);
};

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
				<SpaceButton
					name={props.name}
					label={props.openLabel}
					desktop
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
					<SpaceButton
						name={props.name}
						label={props.openLabel}
						desktop={false}
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
