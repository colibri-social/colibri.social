import { cx } from "../../utils/cx";
import { Card, type CardTone } from "../Card/Card";
import { Skeleton, SkeletonCircle, SkeletonText } from "../Skeleton/Skeleton";

type ThreadSkeletonProps = {
	tone?: CardTone;
	class?: string;
};

const ThreadSummarySkeleton = (
	props: ThreadSkeletonProps & { size: "compact" | "regular" },
) => {
	const compact = () => props.size === "compact";
	return (
		<Card
			tone={props.tone ?? "secondary"}
			aria-hidden="true"
			data-thread-skeleton={props.size}
			class={cx(
				"flex items-center",
				compact() ? "gap-2.5 p-2.5" : "gap-3 p-3",
				props.class,
			)}
		>
			<Skeleton
				class={cx(
					"shrink-0",
					compact() ? "size-9 rounded-control" : "size-11 rounded-control-lg",
				)}
			/>
			<span class="flex min-w-0 flex-1 flex-col">
				<span class="flex w-full min-w-0 items-center justify-between gap-2">
					<SkeletonText
						size={compact() ? "sm" : "base"}
						leading={compact() ? 20 : 24}
						width={compact() ? 96 : 120}
					/>
					<SkeletonText size="xs" leading={16} width={84} />
				</span>
				<span
					class={cx(
						"flex w-full min-w-0 items-center gap-1.5",
						compact() ? "h-4" : "h-5",
					)}
				>
					<SkeletonCircle size={compact() ? 14 : 18} />
					<SkeletonText
						size={compact() ? "xs" : "sm"}
						leading={compact() ? 16 : 20}
						width={44}
					/>
					<SkeletonText
						size={compact() ? "xs" : "sm"}
						leading={compact() ? 16 : 20}
						width="60%"
						class="flex-1"
					/>
				</span>
			</span>
		</Card>
	);
};

export const ThreadCardSkeleton = (props: ThreadSkeletonProps) => (
	<ThreadSummarySkeleton {...props} size="compact" />
);

export const ThreadRowSkeleton = (props: ThreadSkeletonProps) => (
	<ThreadSummarySkeleton {...props} size="regular" />
);
