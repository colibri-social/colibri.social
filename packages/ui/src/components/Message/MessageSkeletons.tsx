import { Show } from "solid-js";
import { cx } from "../../utils/cx";
import { AvatarSkeleton, Skeleton, SkeletonText } from "../Skeleton/Skeleton";
import { type ChatPlatform, chatLayoutVars } from "./layout";

export type MessageRowSkeletonProps = {
	continuation?: boolean;
	lines?: number;
	reply?: boolean;
	nameWidth?: number | string;
	platform?: ChatPlatform;
	class?: string;
};

export const MessageRowSkeleton = (props: MessageRowSkeletonProps) => {
	const lines = () => props.lines ?? 1;
	const headless = () => !!props.continuation && !props.reply;
	return (
		<div
			aria-hidden="true"
			data-message-skeleton=""
			style={chatLayoutVars(props.platform ?? "desktop")}
			class={cx(
				"flex flex-col gap-2 pr-(--chat-row-end-padding) pl-(--chat-row-padding)",
				headless() ? "py-1" : "mt-(--chat-group-gap) py-1",
				props.class,
			)}
		>
			<Show when={props.reply}>
				<div class="flex h-4 items-center gap-2 pl-[calc(40px+var(--chat-avatar-gap))]">
					<Skeleton class="rounded-full" width={16} height={16} />
					<SkeletonText size="xs" leading={16} width={64} />
					<SkeletonText size="xs" leading={16} width="40%" class="flex-1" />
				</div>
			</Show>
			<div class="flex gap-(--chat-avatar-gap)">
				<Show when={!headless()} fallback={<span class="w-10 shrink-0" />}>
					<AvatarSkeleton size="md" />
				</Show>
				<div class="flex min-w-0 flex-1 flex-col gap-1">
					<Show when={!headless()}>
						<div class="flex h-4 items-center gap-3">
							<SkeletonText
								size="sm"
								leading={16}
								width={props.nameWidth ?? 84}
							/>
							<SkeletonText size="xs" leading={16} width={92} />
						</div>
					</Show>
					<SkeletonText
						size="base"
						leading={21}
						lines={lines()}
						width={lines() > 1 ? "100%" : "68%"}
					/>
				</div>
			</div>
		</div>
	);
};

export type MessagePreviewSkeletonProps = {
	lines?: number;
	reply?: boolean;
	class?: string;
};

export const MessagePreviewSkeleton = (props: MessagePreviewSkeletonProps) => {
	const lines = () => props.lines ?? 1;
	return (
		<div
			aria-hidden="true"
			data-message-preview-skeleton=""
			class={cx("flex w-full flex-col gap-2 p-3", props.class)}
		>
			<Show when={props.reply}>
				<div class="flex h-4 items-center gap-1">
					<Skeleton class="rounded-full" width={16} height={16} />
					<SkeletonText size="xs" leading={16} width="58%" />
				</div>
			</Show>
			<div class="flex flex-col gap-1">
				<div class="flex h-4 items-center gap-3">
					<SkeletonText size="sm" leading={16} width={84} />
					<SkeletonText size="xs" leading={16} width={92} />
				</div>
				<SkeletonText
					size="base"
					leading={21}
					lines={lines()}
					width={lines() > 1 ? "100%" : "72%"}
				/>
			</div>
		</div>
	);
};
