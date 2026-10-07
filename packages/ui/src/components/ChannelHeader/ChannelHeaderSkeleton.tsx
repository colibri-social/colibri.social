import { Show } from "solid-js";
import { cx } from "../../utils/cx";
import { Skeleton, SkeletonText } from "../Skeleton/Skeleton";
import type { ChannelHeaderPlatform } from "./ChannelHeader";

export type ChannelHeaderSkeletonProps = {
	platform?: ChannelHeaderPlatform;
	actions?: number;
	class?: string;
};

export const ChannelHeaderSkeleton = (props: ChannelHeaderSkeletonProps) => (
	<Show
		when={(props.platform ?? "mobile") === "desktop"}
		fallback={
			<div
				aria-hidden="true"
				data-channel-header-skeleton="mobile"
				class={cx(
					"flex h-12 shrink-0 items-center gap-3 border-b border-border bg-background px-3 py-2",
					props.class,
				)}
			>
				<Skeleton class="size-8 shrink-0 rounded-control-sm" />
				<span class="flex min-w-0 flex-1 items-center gap-2">
					<Skeleton class="size-6 shrink-0 rounded-control-xs" />
					<SkeletonText size="xl" leading={26} width={140} />
				</span>
				<Skeleton class="size-8 shrink-0 rounded-control-sm" />
			</div>
		}
	>
		<div
			aria-hidden="true"
			data-channel-header-skeleton="desktop"
			class={cx(
				"flex h-12 shrink-0 items-center justify-between gap-4 border-b border-border bg-background p-2",
				props.class,
			)}
		>
			<span class="flex min-w-0 flex-1 items-center gap-2 pl-1">
				<Skeleton class="size-5 shrink-0 rounded-control-xs" />
				<SkeletonText size="base" leading={20} width={120} />
				<SkeletonText size="base" leading={20} width={220} />
			</span>
			<span class="flex shrink-0 items-center gap-2">
				<Skeleton class="size-8 rounded-control-sm" />
				<Show when={(props.actions ?? 2) > 1}>
					<Skeleton class="size-8 rounded-control-sm" />
				</Show>
			</span>
		</div>
	</Show>
);
