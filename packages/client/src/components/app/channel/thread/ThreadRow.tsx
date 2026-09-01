import { type Component, Show } from "solid-js";
import LockSimpleFillIcon from "~icons/ph/lock-simple-fill";
import type { ProfileView, ThreadView } from "../../../../atproto/views";
import { useCommunityContext } from "../../../../contexts/Community";
import { formatCompactAge } from "../../../../utils/format-timestamp";
import { useNow } from "../../../../utils/now";
import { useThreadNavigation } from "../../../../utils/thread-navigation";
import type { ThreadPresentation } from "../../../../utils/thread-presentation";
import User from "../../user";
import { ThreadContextMenu } from "./ThreadContextMenu";

export const ThreadRow: Component<{
	thread: ThreadView;
	presentation: ThreadPresentation;
	onOpen?: () => void;
}> = (props) => {
	const community = useCommunityContext();
	const now = useNow();
	const { open } = useThreadNavigation();

	const participants = (): Array<ProfileView> =>
		props.thread.participants.flatMap((did) => {
			const member = community().utils.getMember(did);
			return member ? [member.actor] : [];
		});

	const age = () =>
		formatCompactAge(props.thread.lastActivityAt, new Date(now()));

	return (
		<ThreadContextMenu thread={props.thread}>
			<button
				type="button"
				class="flex w-full cursor-pointer flex-row items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-card"
				onClick={(event) => {
					props.onOpen?.();
					open(props.thread, props.presentation, event);
				}}
			>
				<div class="flex min-w-0 flex-1 flex-col gap-0.5">
					<span class="flex min-w-0 flex-row items-center gap-2">
						<span
							class="min-w-0 truncate text-sm"
							classList={{ "font-semibold": props.thread.viewer.hasUnread }}
						>
							{props.thread.name}
						</span>
						<Show when={props.thread.private}>
							<LockSimpleFillIcon class="size-3 shrink-0 text-muted-foreground" />
						</Show>
					</span>
					<span class="text-xs text-muted-foreground tabular-nums">
						{props.thread.messageCount === 1
							? "1 message"
							: `${props.thread.messageCount} messages`}{" "}
						&middot; {age()}
					</span>
				</div>
				<User.AvatarStack users={participants()} />
				<Show
					when={props.thread.viewer.unreadMentions > 0}
					fallback={
						<Show when={props.thread.viewer.hasUnread}>
							<span class="size-2 shrink-0 rounded-full bg-foreground" />
						</Show>
					}
				>
					<span class="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
						{props.thread.viewer.unreadMentions > 9
							? "9+"
							: props.thread.viewer.unreadMentions}
					</span>
				</Show>
			</button>
		</ThreadContextMenu>
	);
};
