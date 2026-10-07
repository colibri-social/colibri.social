import { For, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { Skeleton, SkeletonText } from "../Skeleton/Skeleton";
import { BannerSkeleton, ChipSkeleton } from "../Skeleton/Skeletons";
import {
	SPACE_RAIL_METRICS,
	type SpaceRailPlatform,
} from "../SpaceRail/SpaceRail";
import type { ChannelPlatform } from "./ChannelRow";

export type ChannelRowSkeletonProps = {
	preview?: boolean;
	density?: "default" | "compact";
	nameWidth?: number | string;
	class?: string;
};

export const ChannelRowSkeleton = (props: ChannelRowSkeletonProps) => (
	<div
		aria-hidden="true"
		data-channel-row-skeleton=""
		class={cx(
			"flex w-full flex-col justify-center gap-1 px-2 py-1.5",
			props.density === "compact" && "h-8",
			props.class,
		)}
	>
		<span class="flex h-5 w-full items-center gap-2">
			<Skeleton width={16} height={16} class="shrink-0 rounded-[4px]" />
			<SkeletonText size="base" leading={20} width={props.nameWidth ?? "55%"} />
		</span>
		<Show when={props.density !== "compact" && (props.preview ?? true)}>
			<SkeletonText size="xs" leading={16} width="80%" />
		</Show>
	</div>
);

export type VoiceChannelRowSkeletonProps = {
	participants?: number;
	nameWidth?: number | string;
	class?: string;
};

export const VoiceChannelRowSkeleton = (
	props: VoiceChannelRowSkeletonProps,
) => (
	<div
		aria-hidden="true"
		data-voice-row-skeleton=""
		class={cx("flex w-full flex-col", props.class)}
	>
		<span class="flex h-8 w-full items-center gap-2 border-0 border-l-2 border-solid border-transparent p-1.5">
			<Skeleton width={16} height={16} class="shrink-0 rounded-[4px]" />
			<SkeletonText size="base" leading={20} width={props.nameWidth ?? "45%"} />
		</span>
		<Show when={(props.participants ?? 0) > 0}>
			<span class="flex flex-col gap-1 border-0 border-l-2 border-solid border-transparent pt-1 pl-6">
				<For each={Array.from({ length: props.participants ?? 0 })}>
					{() => (
						<span class="flex items-center gap-2 p-1">
							<Skeleton width={24} height={24} class="shrink-0 rounded-full" />
							<SkeletonText size="base" leading={20} width="40%" />
						</span>
					)}
				</For>
			</span>
		</Show>
	</div>
);

export type CategorySkeletonProps = {
	rows?: number;
	class?: string;
};

export const CategoryHeaderSkeleton = (props: { class?: string }) => (
	<span
		aria-hidden="true"
		class={cx("flex w-full items-center gap-2 px-2 py-1", props.class)}
	>
		<Skeleton width={16} height={16} class="shrink-0 rounded-[4px]" />
		<SkeletonText size="xs" leading={16} width={96} />
	</span>
);

export const CategorySkeleton = (props: CategorySkeletonProps) => (
	<div
		aria-hidden="true"
		class={cx("flex w-full flex-col gap-2 p-2", props.class)}
	>
		<CategoryHeaderSkeleton />
		<For each={Array.from({ length: props.rows ?? 3 })}>
			{() => <ChannelRowSkeleton />}
		</For>
	</div>
);

export type ChannelListHeaderSkeletonProps = {
	platform?: ChannelPlatform;
	class?: string;
};

export const ChannelListHeaderSkeleton = (
	props: ChannelListHeaderSkeletonProps,
) => {
	const desktop = () => props.platform === "desktop";
	return (
		<div
			aria-hidden="true"
			data-channel-list-header-skeleton=""
			class={cx("flex w-full flex-col", props.class)}
		>
			<Show when={desktop()}>
				<span class="flex h-12 items-center px-4">
					<SkeletonText size="base" leading={24} width="50%" />
				</span>
			</Show>
			<BannerSkeleton ratio="space" />
			<div
				class={cx(
					"flex flex-col gap-2 p-4",
					desktop()
						? "border-0 border-b border-solid border-secondary"
						: "border-0 border-y border-solid border-secondary",
				)}
			>
				<Show when={!desktop()}>
					<SkeletonText size="xl" leading={28} width="60%" />
				</Show>
				<span class="flex gap-1">
					<ChipSkeleton width={104} />
					<ChipSkeleton width={140} />
				</span>
			</div>
		</div>
	);
};

export type SpaceRailSkeletonProps = {
	count?: number;
	platform?: SpaceRailPlatform;
	class?: string;
};

export const SpaceRailSkeleton = (props: SpaceRailSkeletonProps) => {
	const metrics = () => SPACE_RAIL_METRICS[props.platform ?? "mobile"];
	return (
		<div
			aria-hidden="true"
			data-space-rail-skeleton=""
			class={cx(
				"flex h-full shrink-0 flex-col overflow-hidden pb-2",
				props.class,
			)}
			style={{
				width: `${metrics().width}px`,
				gap: `${metrics().gap}px`,
				"padding-top": `${metrics().paddingTop}px`,
			}}
		>
			<For each={Array.from({ length: props.count ?? 5 })}>
				{() => (
					<span
						class="flex shrink-0 justify-center"
						style={{ height: `${metrics().icon}px` }}
					>
						<Skeleton
							class="rounded-control"
							width={metrics().icon}
							height={metrics().icon}
						/>
					</span>
				)}
			</For>
		</div>
	);
};
