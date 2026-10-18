import type { JSX } from "solid-js";
import { cx } from "../../utils/cx";
import {
	AvatarSkeleton,
	Skeleton,
	SkeletonCircle,
	SkeletonText,
} from "../Skeleton/Skeleton";

export type VoiceTileSkeletonProps = {
	compact?: boolean;
	class?: string;
	style?: JSX.CSSProperties;
};

export const VoiceTileSkeleton = (props: VoiceTileSkeletonProps) => (
	<div
		aria-hidden="true"
		data-voice-tile-skeleton=""
		class={cx(
			"relative flex items-center justify-center overflow-hidden rounded-surface border border-border bg-secondary",
			props.class,
		)}
		style={props.style}
	>
		<AvatarSkeleton size={props.compact ? "md" : "xl"} />
		<Skeleton
			class={cx(
				"absolute left-1/2 -translate-x-1/2 rounded-control-sm",
				props.compact ? "bottom-1.5 h-5 w-16" : "bottom-3 h-6 w-24",
			)}
		/>
	</div>
);

export const VoiceParticipantRowSkeleton = (props: {
	nameWidth?: string;
	class?: string;
}) => (
	<div
		aria-hidden="true"
		data-voice-participant-skeleton=""
		class={cx(
			"flex items-center gap-3 rounded-control bg-secondary py-2 pr-3 pl-2",
			props.class,
		)}
	>
		<SkeletonCircle size={32} />
		<span class="min-w-0 flex-1">
			<SkeletonText size="base" width={props.nameWidth ?? "40%"} />
		</span>
	</div>
);

export const VoiceStatusPanelSkeleton = (props: { class?: string }) => (
	<div
		aria-hidden="true"
		data-voice-status-skeleton=""
		class={cx(
			"flex w-full flex-col gap-2 border-t border-border p-3",
			props.class,
		)}
	>
		<div class="flex items-center justify-between gap-2">
			<div class="flex min-w-0 flex-1 items-center gap-2">
				<Skeleton class="size-8 shrink-0 rounded-control-sm" />
				<div class="flex min-w-0 flex-1 flex-col">
					<SkeletonText size="sm" width="50%" />
					<SkeletonText size="xs" width="70%" />
				</div>
			</div>
			<Skeleton class="size-10 shrink-0 rounded-control" />
		</div>
		<div class="grid w-full grid-cols-4 gap-2">
			<Skeleton class="h-10 w-full rounded-control" />
			<Skeleton class="h-10 w-full rounded-control" />
			<Skeleton class="h-10 w-full rounded-control" />
			<Skeleton class="h-10 w-full rounded-control" />
		</div>
	</div>
);
