import { type Component, Show } from "solid-js";
import ArrowsMergeIcon from "~icons/ph/arrows-merge";
import ArrowsOutSimpleIcon from "~icons/ph/arrows-out-simple";
import CaretLeftIcon from "~icons/ph/caret-left";
import DotsThreeIcon from "~icons/ph/dots-three";
import LockSimpleFillIcon from "~icons/ph/lock-simple-fill";
import XIcon from "~icons/ph/x";
import type { ThreadView } from "../../../../atproto/views";
import { useCommunityContext } from "../../../../contexts/Community";
import { useThreadNavigation } from "../../../../utils/thread-navigation";
import type { ThreadPresentation } from "../../../../utils/thread-presentation";
import { Button } from "../../../ui/Button";
import { ThreadContextMenu } from "./ThreadContextMenu";

export const ThreadHeader: Component<{
	thread: ThreadView;
	presentation: ThreadPresentation;
	isMobile: boolean;
}> = (props) => {
	const community = useCommunityContext();
	const { close, expand } = useThreadNavigation();

	const channelName = () =>
		community().channels.find(
			(channel) => channel.space === props.thread.channel,
		)?.name;

	return (
		<div class="flex w-full h-12 shrink-0 flex-col border-b border-border bg-background">
			<div class="flex h-12 w-full flex-row items-center justify-between gap-2 p-2">
				<div class="flex min-w-0 flex-1 flex-row items-center gap-2 pl-1">
					<button
						type="button"
						onClick={() => close(props.thread.channel)}
						class="-ml-1 flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md hover:bg-muted/50"
						aria-label="Back to channel"
					>
						<Show
							when={props.isMobile}
							fallback={<XIcon width={18} height={18} />}
						>
							<CaretLeftIcon width={20} height={20} />
						</Show>
					</button>
					<ArrowsMergeIcon
						class="shrink-0 rotate-180 text-muted-foreground"
						width={18}
						height={18}
					/>
					<div class="flex min-w-0 flex-col">
						<span class="flex min-w-0 flex-row items-center gap-1.5">
							<span class="min-w-0 truncate text-sm">{props.thread.name}</span>
							<Show when={props.thread.private}>
								<LockSimpleFillIcon class="size-3 shrink-0 text-muted-foreground" />
							</Show>
						</span>
						<Show when={channelName()}>
							{(name) => (
								<span class="truncate text-xs text-muted-foreground">
									in {name()}
								</span>
							)}
						</Show>
					</div>
				</div>
				<div class="flex h-full shrink-0 items-center gap-1">
					<Show when={props.presentation === "split" && !props.isMobile}>
						<Button
							size="sm"
							variant="ghost"
							class="size-8"
							aria-label="Expand thread"
							onClick={() => expand()}
						>
							<ArrowsOutSimpleIcon />
						</Button>
					</Show>
					<ThreadContextMenu thread={props.thread} trigger="click">
						<Button
							size="sm"
							variant="ghost"
							class="size-8"
							aria-label="Thread options"
						>
							<DotsThreeIcon />
						</Button>
					</ThreadContextMenu>
				</div>
			</div>
		</div>
	);
};
