import { type JSX, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { createSlot } from "../../utils/slot";
import { Banner } from "../Banner/Banner";
import { SpaceIcon } from "./SpaceIcon";
import { MemberCountChip, OwnerChip } from "./SpaceMeta";

export type SpaceProfileHeaderProps = {
	name: string;
	iconSrc?: string;
	bannerSrc?: string;
	bannerColor?: string;
	memberCount: number;
	memberLabel?: string;
	ownerHandle?: string;
	description?: string;
	actions?: JSX.Element;
	children?: JSX.Element;
	nameId?: string;
	class?: string;
};

export const SpaceProfileHeader = (props: SpaceProfileHeaderProps) => {
	const actions = createSlot(() => props.actions);
	const children = createSlot(() => props.children);

	return (
		<div class={cx("flex flex-col", props.class)}>
			<Banner
				ratio="space"
				src={props.bannerSrc}
				tintFrom={props.iconSrc}
				color={props.bannerColor}
			/>
			<div class="relative -mt-8 px-3">
				<SpaceIcon
					name={props.name}
					src={props.iconSrc}
					size={64}
					class="border-4 border-popover"
				/>
			</div>
			<div class="flex flex-col gap-4 px-4 pt-4">
				<div class="flex flex-col gap-2">
					<h2
						id={props.nameId}
						class="truncate text-xl leading-[26px] font-bold text-foreground"
					>
						{props.name}
					</h2>
					<div class="flex min-w-0 flex-wrap items-center gap-2">
						<MemberCountChip
							count={props.memberCount}
							label={props.memberLabel}
						/>
						<Show when={props.ownerHandle}>
							{(handle) => <OwnerChip handle={handle()} />}
						</Show>
					</div>
					<Show when={props.description}>
						<p class="text-base text-pretty text-muted-foreground">
							{props.description}
						</p>
					</Show>
				</div>
				<Show when={actions.has()}>
					<div class="flex flex-col gap-2">{actions()}</div>
				</Show>
				<Show when={children.has()}>{children()}</Show>
			</div>
		</div>
	);
};
