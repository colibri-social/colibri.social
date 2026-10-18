import { cx } from "../../utils/cx";
import { AvatarSkeleton, SkeletonText } from "../Skeleton/Skeleton";
import {
	type MemberRowVariant,
	memberAvatarSize,
	memberRowBase,
	memberRowShape,
} from "./MemberRow";

export type MemberRowSkeletonProps = {
	status?: boolean;
	nameWidth?: string;
	variant?: MemberRowVariant;
	class?: string;
};

export const MemberRowSkeleton = (props: MemberRowSkeletonProps) => (
	<div
		aria-hidden="true"
		class={cx(
			memberRowBase,
			memberRowShape[props.variant ?? "desktop"],
			props.class,
		)}
	>
		<AvatarSkeleton size={memberAvatarSize[props.variant ?? "desktop"]} />
		<span class="flex min-w-0 flex-1 flex-col">
			<SkeletonText size="base" leading={20} width={props.nameWidth ?? "45%"} />
			{props.status ? (
				<SkeletonText size="xs" leading={16} width="70%" />
			) : null}
		</span>
	</div>
);

export type MemberGroupHeaderSkeletonProps = {
	variant?: MemberRowVariant;
	class?: string;
};

export const MemberGroupHeaderSkeleton = (
	props: MemberGroupHeaderSkeletonProps,
) => (
	<div
		aria-hidden="true"
		class={cx(
			"flex items-center",
			props.variant === "mobile" ? "min-h-5" : "min-h-[18px]",
			props.variant === "mobile" ? undefined : "px-2",
			props.class,
		)}
	>
		<SkeletonText
			size="sm"
			leading={props.variant === "mobile" ? 20 : 18}
			width="96px"
		/>
	</div>
);
