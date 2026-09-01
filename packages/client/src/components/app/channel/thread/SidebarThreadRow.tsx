import { type Component, Show } from "solid-js";
import ArrowsMergeIcon from "~icons/ph/arrows-merge";
import BellSlashIcon from "~icons/ph/bell-slash";
import LockSimpleFillIcon from "~icons/ph/lock-simple-fill";
import type { ThreadView } from "../../../../atproto/views";
import { useMutes } from "../../../../contexts/Mutes";
import { useThreadNavigation } from "../../../../utils/thread-navigation";
import { ThreadContextMenu } from "./ThreadContextMenu";

export const SidebarThreadRow: Component<{
	thread: ThreadView;
	active: boolean;
}> = (props) => {
	const mutes = useMutes();
	const { open } = useThreadNavigation();

	const muted = () => mutes.isChannelMuted(props.thread.space) && !props.active;

	return (
		<ThreadContextMenu thread={props.thread}>
			<div class="border-l border-border pl-4 relative right-2.5 w-[calc(100%+10px)]">
				<button
					type="button"
					class="flex w-full cursor-pointer flex-row items-center gap-1.5 rounded-sm px-1 py-1 text-left text-xs text-muted-foreground hover:bg-card"
					classList={{
						"bg-muted! text-foreground!": props.active,
						"opacity-70": muted(),
					}}
					onClick={(event) => open(props.thread, "full", event)}
				>
					<ArrowsMergeIcon class="size-3.5 shrink-0 rotate-180" />
					<span
						class="min-w-0 flex-1 truncate"
						classList={{
							"font-semibold text-foreground": props.thread.viewer.hasUnread,
						}}
					>
						{props.thread.name}
					</span>
					<Show when={props.thread.private}>
						<LockSimpleFillIcon class="size-3 shrink-0" />
					</Show>
					<Show when={muted()}>
						<BellSlashIcon class="size-3 shrink-0" />
					</Show>
					<Show when={props.thread.viewer.hasUnread}>
						<span class="size-1.5 shrink-0 rounded-full bg-foreground" />
					</Show>
				</button>
			</div>
		</ThreadContextMenu>
	);
};
