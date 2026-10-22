import {
	Button,
	IconButton,
	NavHeader,
	SectionLabel,
	SegmentedControl,
	StatusScreen,
	ThreadIcon,
	type ThreadLastMessage,
	ThreadRow,
	ThreadRowSkeleton,
} from "@colibri-social/ui";
import { AddCircleIcon } from "@solar-icons/solid/bold/add-circle";
import { CloseIcon } from "@solar-icons/solid/bold/close";
import {
	createMemo,
	createSignal,
	For,
	Match,
	onCleanup,
	Show,
	Switch,
} from "solid-js";
import { formatAge } from "../../data/adapters/time";
import { skeyOf } from "../../data/ids";
import { useData } from "../../data/store";
import type { ThreadView } from "../../data/types";
import { defineContract, slot } from "../../screen/define";
import { useStack } from "../../shell/stack";
import { ConversationUnavailable } from "../channel/conversation";
import { createThreadMenu } from "./thread-menu";
import { threadPreview } from "./thread-preview";

export type ThreadsArgs = {
	space: string;
	channel: string;
	channelType?: string;
};

export type ThreadFilter = "all" | "unread" | "following";

const FILTERS: { value: ThreadFilter; label: string }[] = [
	{ value: "all", label: "All" },
	{ value: "unread", label: "Unread" },
	{ value: "following", label: "Following" },
];

export const matchesThreadFilter = (
	thread: ThreadView,
	filter: ThreadFilter,
) => {
	if (filter === "unread") return !!thread.viewer.hasUnread;
	if (filter === "following") return !!thread.viewer.following;
	return true;
};

export const newestActivityFirst = (threads: readonly ThreadView[]) =>
	[...threads].sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));

type ThreadListModel = {
	now: () => Date;
	preview: (thread: ThreadView) => ThreadLastMessage | undefined;
	open: (thread: ThreadView, presentation?: "full") => void;
	menu: ReturnType<typeof createThreadMenu>;
};

const ThreadList = (props: {
	m: ThreadListModel;
	platform?: "mobile" | "desktop";
	threads: ThreadView[];
}) => (
	<ul data-thread-list="" class="m-0 flex list-none flex-col gap-2 p-0">
		<For each={props.threads}>
			{(thread) => (
				<li data-thread-id={thread.space}>
					<Show
						when={props.platform === "desktop"}
						fallback={
							<ThreadRow
								name={thread.name}
								messageCount={thread.messageCount}
								age={formatAge(thread.lastActivityAt, props.m.now())}
								lastMessage={props.m.preview(thread)}
								unread={thread.viewer.hasUnread}
								mentions={thread.viewer.unreadMentions}
								private={thread.private}
								onOpen={() => props.m.open(thread)}
								onMenu={() => props.m.menu.open(thread)}
							/>
						}
					>
						<props.m.menu.ContextMenu thread={thread}>
							<ThreadRow
								name={thread.name}
								messageCount={thread.messageCount}
								age={formatAge(thread.lastActivityAt, props.m.now())}
								lastMessage={props.m.preview(thread)}
								unread={thread.viewer.hasUnread}
								mentions={thread.viewer.unreadMentions}
								private={thread.private}
								onOpen={(event) =>
									props.m.open(thread, event.shiftKey ? undefined : "full")
								}
							/>
						</props.m.menu.ContextMenu>
					</Show>
				</li>
			)}
		</For>
	</ul>
);

export const threads = defineContract({
	id: "threads",
	model: (args: ThreadsArgs) => {
		const data = useData();
		const stack = useStack();
		const [filter, setFilter] = createSignal<ThreadFilter>("all");
		const [now, setNow] = createSignal(new Date());
		const timer = setInterval(() => setNow(new Date()), 60_000);
		onCleanup(() => clearInterval(timer));
		const community = createMemo(() => data.spaceByKey(args.space));
		const space = createMemo(() => {
			const current = community();
			return current ? data.space(current) : undefined;
		});
		const parent = createMemo(() => space()?.channelBySlug(args.channel));
		const load = createMemo(() => {
			const ref = parent()?.space;
			return ref ? data.channel(ref).threads : undefined;
		});
		const unavailable = createMemo<"space" | "channel" | undefined>(() => {
			if (data.communities.loading()) return undefined;
			const current = space();
			if (!current) return "space";
			if (current.channels.loading()) return undefined;
			return parent() ? undefined : "channel";
		});
		const all = createMemo(() => newestActivityFirst(load()?.value() ?? []));
		const visible = createMemo(() =>
			all().filter((thread) => matchesThreadFilter(thread, filter())),
		);
		const openThreads = createMemo(() =>
			visible().filter((thread) => !thread.closedAt),
		);
		const closedThreads = createMemo(() =>
			visible().filter((thread) => !!thread.closedAt),
		);
		const [showClosed, setShowClosed] = createSignal(false);
		const loading = () => !load() || load()?.loading();
		const canCreate = () => {
			const viewer = community()?.viewer;
			return (
				!!viewer?.isOwner || !!viewer?.permissions?.includes("thread.create")
			);
		};
		const channelType = () => parent()?.type ?? args.channelType;
		const open = (thread: ThreadView, presentation?: "full") =>
			stack.push({
				kind: "thread",
				space: args.space,
				channel: args.channel,
				channelType: channelType(),
				thread: skeyOf(thread.space),
				via: "threads",
				...(presentation ? { presentation } : {}),
			});
		const startThread = () =>
			stack.push({
				kind: "threadDraft",
				space: args.space,
				channel: args.channel,
				channelType: channelType(),
			});
		const menu = createThreadMenu({
			space: args.space,
			channel: args.channel,
			channelType: args.channelType,
		});
		const preview = (thread: ThreadView) =>
			threadPreview(thread, {
				viewer: data.viewer,
				member: (did) => space()?.memberByDid(did),
				live: (entry) => data.lastMessage(entry.space),
				emoji: (feature) => data.emoji.mention(community()?.did, feature),
			});
		return {
			args,
			stack,
			filter,
			setFilter,
			now,
			parent,
			all,
			visible,
			openThreads,
			closedThreads,
			showClosed,
			setShowClosed,
			loading,
			unavailable,
			canCreate,
			open,
			startThread,
			menu,
			preview,
		};
	},
	slots: {
		Header: slot((m, p: { platform?: "mobile" | "desktop" }) => (
			<Show
				when={p.platform !== "desktop"}
				fallback={
					<div class="flex shrink-0 items-center gap-1">
						<Show when={m.canCreate() && !m.unavailable()}>
							<Button
								variant="tertiary"
								icon={<AddCircleIcon />}
								onClick={m.startThread}
								class="h-8 px-3"
							>
								New thread
							</Button>
						</Show>
						<IconButton
							variant="ghost"
							size="md"
							label="Close threads"
							icon={<CloseIcon />}
							onClick={() => {
								if (m.stack.top()?.kind === "threads") m.stack.pop();
							}}
						/>
					</div>
				}
			>
				<NavHeader
					safeTop
					kind="back"
					navigateLabel={`Back to #${m.parent()?.name ?? m.args.channel}`}
					onNavigate={() => m.stack.pop()}
					title={`Threads in #${m.parent()?.name ?? m.args.channel}`}
					action={
						m.canCreate() && !m.unavailable()
							? {
									type: "icon",
									label: "New thread",
									icon: <AddCircleIcon />,
									onClick: m.startThread,
								}
							: undefined
					}
				/>
			</Show>
		)),
		Unavailable: slot((m) => (
			<Show when={m.unavailable()}>
				{(kind) => (
					<ConversationUnavailable
						kind={kind()}
						actionLabel="Back to channels"
						onAction={() => m.stack.popTo(0)}
					/>
				)}
			</Show>
		)),
		Filters: slot((m, p: { class?: string }) => (
			<SegmentedControl
				aria-label="Filter threads"
				size="sm"
				class={p.class}
				value={m.filter()}
				onChange={(value) => m.setFilter(value as ThreadFilter)}
				options={FILTERS.map((entry) => ({
					value: entry.value,
					label: entry.label,
				}))}
			/>
		)),
		List: slot((m, p: { platform?: "mobile" | "desktop" }) => (
			<Switch>
				<Match when={m.loading()}>
					<div class="flex flex-col gap-2">
						<For each={[0, 1, 2, 3]}>{() => <ThreadRowSkeleton />}</For>
					</div>
				</Match>
				<Match when={m.visible().length === 0}>
					<StatusScreen
						icon={<ThreadIcon size={28} />}
						title={
							m.filter() === "all"
								? "No threads in this channel yet"
								: "Nothing matches that filter"
						}
						description={
							m.filter() === "all"
								? "Threads keep side conversations out of the main channel."
								: undefined
						}
						actions={
							<Show when={m.filter() === "all" && m.canCreate()}>
								<Button block onClick={m.startThread}>
									Start a thread
								</Button>
							</Show>
						}
					/>
				</Match>
				<Match when={m.visible().length > 0}>
					<div class="flex flex-col gap-4">
						<Show when={m.openThreads().length > 0}>
							<ThreadList
								m={m}
								platform={p.platform}
								threads={m.openThreads()}
							/>
						</Show>
						<Show when={m.closedThreads().length > 0}>
							<section data-closed-threads="" class="flex flex-col gap-2">
								<SectionLabel
									label="Closed"
									count={m.closedThreads().length}
									action={{
										label: m.showClosed() ? "Hide" : "Show",
										onClick: () => m.setShowClosed(!m.showClosed()),
									}}
								/>
								<Show when={m.showClosed()}>
									<ThreadList
										m={m}
										platform={p.platform}
										threads={m.closedThreads()}
									/>
								</Show>
							</section>
						</Show>
					</div>
				</Match>
			</Switch>
		)),
		Menu: slot((m) => <m.menu.Overlay />),
	},
});
