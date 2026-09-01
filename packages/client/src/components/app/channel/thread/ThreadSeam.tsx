import { type Component, Show } from "solid-js";
import ArrowsMergeIcon from "~icons/ph/arrows-merge";
import LockSimpleFillIcon from "~icons/ph/lock-simple-fill";
import type { ThreadView } from "../../../../atproto/views";
import { formatCompactAge } from "../../../../utils/format-timestamp";
import { useNow } from "../../../../utils/now";
import { useThreadNavigation } from "../../../../utils/thread-navigation";
import { ThreadContextMenu } from "./ThreadContextMenu";

export const ThreadSeam: Component<{ thread: ThreadView }> = (props) => {
	const now = useNow();
	const { open } = useThreadNavigation();

	const age = () =>
		formatCompactAge(props.thread.lastActivityAt, new Date(now()));

	const replies = () => props.thread.messageCount;

	const movedIn = () => props.thread.movedInCount ?? 0;

	return (
		<ThreadContextMenu thread={props.thread}>
			<button
				type="button"
				class="group/seam ml-17.5 mr-2 my-1 flex w-[calc(100%-5rem)] cursor-pointer flex-col items-start gap-0.5 rounded-md border border-border/70 px-2.5 py-1.5 text-left hover:border-border hover:bg-card/60"
				onClick={(event) => open(props.thread, "split", event)}
			>
				<span class="flex w-full min-w-0 flex-row items-center gap-2">
					<ArrowsMergeIcon class="size-4 shrink-0 rotate-180 text-muted-foreground" />
					<span class="min-w-0 truncate text-sm font-medium">
						{props.thread.name}
					</span>
					<Show when={props.thread.private}>
						<LockSimpleFillIcon class="size-3 shrink-0 text-muted-foreground" />
					</Show>
					<Show when={props.thread.viewer.hasUnread}>
						<span class="size-2 shrink-0 rounded-full bg-foreground" />
					</Show>
					<span class="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
						{replies() === 1 ? "1 message" : `${replies()} messages`} &middot;{" "}
						{age()}
					</span>
				</span>
				<Show when={movedIn() > 0}>
					<span class="pl-6 text-xs text-muted-foreground">
						{movedIn() === 1
							? "1 message was moved in here"
							: `${movedIn()} messages were moved in here`}
					</span>
				</Show>
			</button>
		</ThreadContextMenu>
	);
};
