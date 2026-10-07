import { type JSX, Show, splitProps } from "solid-js";
import { Banner } from "../Banner/Banner";
import { Card } from "../Card/Card";
import { SpaceIcon } from "./SpaceIcon";
import { MemberCountChip } from "./SpaceMeta";

export type SpaceCardProps = {
	name: string;
	iconSrc?: string;
	bannerSrc?: string;
	bannerColor?: string;
	memberCount: number;
	memberLabel?: string;
	description?: string;
	href?: string;
	onClick?: JSX.EventHandler<HTMLElement, MouseEvent>;
	class?: string;
};

export const SpaceCard = (props: SpaceCardProps) => {
	const [local, rest] = splitProps(props, [
		"name",
		"iconSrc",
		"bannerSrc",
		"bannerColor",
		"memberCount",
		"memberLabel",
		"description",
		"class",
	]);

	return (
		<Card {...rest} tone="card" class={local.class}>
			<Banner
				ratio="space"
				src={local.bannerSrc}
				tintFrom={local.iconSrc}
				color={local.bannerColor}
			/>
			<span class="flex flex-col gap-3 p-3">
				<span class="flex min-w-0 items-center gap-3">
					<SpaceIcon name={local.name} src={local.iconSrc} />
					<span class="flex min-w-0 flex-1 flex-col items-start gap-1">
						<span class="block w-full truncate text-xl leading-[26px] font-bold text-foreground">
							{local.name}
						</span>
						<MemberCountChip
							count={local.memberCount}
							label={local.memberLabel}
						/>
					</span>
				</span>
				<Show when={local.description}>
					<span class="line-clamp-3 text-base text-pretty text-muted-foreground">
						{local.description}
					</span>
				</Show>
			</span>
		</Card>
	);
};
