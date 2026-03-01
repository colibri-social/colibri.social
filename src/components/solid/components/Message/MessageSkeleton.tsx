import { For } from "solid-js";

/**
 * A single skeleton row that mimics the layout of a non-subsequent message.
 */
const MessageSkeletonRow = (props: { wide?: boolean }) => (
	<div class="w-full h-fit flex flex-row pr-4 pl-3.5 pb-0 pt-1 mt-2 gap-4 border-l-2 border-transparent">
		{/* Avatar */}
		<div class="w-10 h-10 min-w-10 min-h-10 rounded-full bg-muted animate-pulse" />
		<div class="flex flex-col gap-2 w-full justify-center">
			{/* Name + timestamp row */}
			<div class="flex gap-2 items-baseline">
				<div class="h-3 w-20 rounded-sm bg-muted animate-pulse" />
				<div class="h-2.5 w-24 rounded-sm bg-muted/60 animate-pulse" />
			</div>
			{/* Message body line(s) */}
			<div
				class="h-3 rounded-sm bg-muted animate-pulse"
				style={{ width: props.wide ? "75%" : "45%" }}
			/>
		</div>
	</div>
);

/**
 * A skeleton row that mimics a subsequent (same-author) message — no avatar,
 * just a narrow timestamp placeholder and a text line.
 */
const SubsequentSkeletonRow = (props: { wide?: boolean }) => (
	<div class="w-full h-fit flex flex-row pr-4 pl-3.5 py-0 gap-4 border-l-2 border-transparent">
		{/* Timestamp ghost */}
		<div class="w-10 h-8 min-w-10 min-h-8 flex items-center justify-center">
			<div class="h-2.5 w-8 rounded-sm bg-muted/50 animate-pulse" />
		</div>
		<div class="flex flex-col gap-2 w-full justify-center py-0.5">
			<div
				class="h-3 rounded-sm bg-muted animate-pulse"
				style={{ width: props.wide ? "60%" : "35%" }}
			/>
		</div>
	</div>
);

/**
 * A group of skeleton rows that mimics a realistic cluster of messages from one
 * author followed by a couple from another. Rendered while older messages are
 * being fetched during upward pagination.
 */
export const MessageSkeletonGroup = () => (
	<div class="flex flex-col">
		<MessageSkeletonRow wide />
		<SubsequentSkeletonRow />
		<SubsequentSkeletonRow wide />
		<MessageSkeletonRow />
		<SubsequentSkeletonRow wide />
	</div>
);

/**
 * A column of skeleton groups used as the initial loading fallback while the
 * first page of messages is being fetched. Renders enough groups to overfill
 * any screen height — the parent is expected to be overflow-hidden so the
 * excess is clipped, leaving the bottom-anchored skeletons always visible.
 */
export const MessageSkeletonList = () => (
	<div class="flex flex-col py-2">
		<For each={Array.from({ length: 20 })}>
			{() => <MessageSkeletonGroup />}
		</For>
	</div>
);
