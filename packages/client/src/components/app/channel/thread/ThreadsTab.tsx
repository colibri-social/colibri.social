import { type Component, createMemo, createSignal, For, Show } from "solid-js";
import ArrowDownIcon from "~icons/ph/arrow-down";
import PlusIcon from "~icons/ph/plus";
import XIcon from "~icons/ph/x";
import type { ThreadFilter, ThreadView } from "../../../../atproto/views";
import { useChannelContext } from "../../../../contexts/Channel";
import { usePermissions } from "../../../../contexts/Community";
import { useThreads } from "../../../../contexts/Threads";
import { matchesFilter } from "../../../../contexts/thread-list";
import { useUserContext } from "../../../../contexts/User";
import { cx } from "../../../../utils/cva";
import { useThreadNavigation } from "../../../../utils/thread-navigation";
import { Button } from "../../../ui/Button";
import { ThreadRow } from "./ThreadRow";

const FILTERS: Array<{ key: ThreadFilter; label: string }> = [
	{ key: "all", label: "All" },
	{ key: "unread", label: "Unread" },
	{ key: "following", label: "Following" },
];

const FilterChip: Component<{
	label: string;
	active: boolean;
	onSelect: () => void;
}> = (props) => (
	<button
		type="button"
		aria-pressed={props.active}
		class={cx(
			"shrink-0 cursor-pointer rounded-full px-3 py-1 text-sm transition-colors",
			props.active
				? "bg-primary/15 text-foreground"
				: "text-muted-foreground hover:bg-muted",
		)}
		onClick={props.onSelect}
	>
		{props.label}
	</button>
);

export const ThreadsTab: Component<{ onClose: () => void }> = (props) => {
	const threads = useThreads();
	const channel = useChannelContext();
	const user = useUserContext();
	const { canCreateThread } = usePermissions();
	const { open } = useThreadNavigation();
	const [filter, setFilter] = createSignal<ThreadFilter>("all");

	const visible = createMemo<Array<ThreadView>>(() =>
		threads
			.inChannel(channel.channelSpace())
			.filter((thread) => matchesFilter(thread, filter())),
	);

	const startThread = () => {
		threads.openDraft({ channel: channel.channelSpace(), suggestedName: "" });
		props.onClose();
	};

	const firstUnread = () =>
		threads
			.inChannel(channel.channelSpace())
			.find((thread) => thread.viewer.hasUnread);

	return (
		<div class="flex h-full w-full flex-col">
			<div class="flex flex-row items-center gap-2 border-b border-border px-3 py-2">
				<For each={FILTERS}>
					{(entry) => (
						<FilterChip
							label={entry.label}
							active={filter() === entry.key}
							onSelect={() => setFilter(entry.key)}
						/>
					)}
				</For>
				<div class="ml-auto flex flex-row items-center gap-1">
					<Show when={firstUnread()}>
						{(thread) => (
							<Button
								size="sm"
								variant="ghost"
								onClick={(event) => {
									props.onClose();
									open(thread(), "full", event);
								}}
							>
								<ArrowDownIcon />
								Jump to unread
							</Button>
						)}
					</Show>
					<Show when={canCreateThread(user.did)}>
						<Button size="sm" variant="ghost" onClick={startThread}>
							<PlusIcon />
							New thread
						</Button>
					</Show>
					<button
						type="button"
						aria-label="Close threads"
						class="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
						onClick={props.onClose}
					>
						<XIcon />
					</button>
				</div>
			</div>
			<div class="flex-1 overflow-y-auto p-2">
				<Show
					when={visible().length > 0}
					fallback={
						<div class="flex flex-col items-center gap-3 py-8">
							<p class="text-center text-sm text-muted-foreground">
								{filter() === "all"
									? "No threads in this channel yet."
									: "Nothing matches that filter."}
							</p>
							<Show when={filter() === "all" && canCreateThread(user.did)}>
								<Button size="sm" variant="secondary" onClick={startThread}>
									<PlusIcon />
									Start a thread
								</Button>
							</Show>
						</div>
					}
				>
					<For each={visible()}>
						{(thread) => (
							<ThreadRow
								thread={thread}
								presentation="full"
								onOpen={props.onClose}
							/>
						)}
					</For>
				</Show>
			</div>
		</div>
	);
};
