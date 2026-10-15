import {
	Button,
	Card,
	collapseOut,
	countFor,
	createExitPresence,
	IconButton,
	InboxEmpty,
	InboxError,
	type InboxFilter,
	InboxGroupCard,
	type InboxNotification,
	InboxPopover,
	InboxRow,
	InboxRowSkeleton,
	type InboxSpace,
	MarkAllReadIcon,
	matchesFilter,
	SegmentedControl,
	toast,
} from "@colibri-social/ui";
import {
	createEffect,
	createMemo,
	createSignal,
	For,
	type JSX,
	Match,
	on,
	Show,
	Switch,
} from "solid-js";
import { createStore } from "solid-js/store";
import type { AuthorDirectory } from "../../data/adapters/authors";
import { displayNameOf } from "../../data/adapters/authors";
import { skeyOf, spaceKey } from "../../data/ids";
import { useData } from "../../data/store";
import type {
	CommunityView,
	MemberView,
	NotificationView,
	RoleView,
	SpaceRef,
} from "../../data/types";
import { defineContract, slot } from "../../screen/define";
import { useStack } from "../../shell/stack";
import {
	openNotificationTarget,
	toInboxNotification,
	toInboxSpace,
} from "./inbox-adapter";
import { groupBySpace, groupSummary } from "./inbox-groups";

export type InboxArgs = Record<string, never>;

const FILTERS: { value: InboxFilter; label: string; markReadLabel: string }[] =
	[
		{ value: "all", label: "All", markReadLabel: "Mark all as read" },
		{
			value: "mentions",
			label: "Mentions",
			markReadLabel: "Mark mentions as read",
		},
		{
			value: "replies",
			label: "Replies",
			markReadLabel: "Mark replies as read",
		},
	];

const GroupExit = (props: { exiting: boolean; children: JSX.Element }) => {
	let element: HTMLDivElement | undefined;
	createEffect(
		on(
			() => props.exiting,
			(exiting) => {
				if (exiting && element) collapseOut(element);
			},
		),
	);
	return (
		<div ref={element} data-inbox-group="" class="pb-4">
			{props.children}
		</div>
	);
};

export const inbox = defineContract({
	id: "inbox",
	model: (_args: InboxArgs) => {
		const data = useData();
		const stack = useStack();
		const store = data.notifications;
		const [filter, setFilter] = createSignal<InboxFilter>("all");
		const [threadNames, setThreadNames] = createStore<Record<string, string>>(
			{},
		);
		const requestedThreads = new Set<string>();

		const communities = createMemo(
			() =>
				new Map<string, CommunityView>(
					(data.communities.value() ?? []).map((community) => [
						community.did,
						community,
					]),
				),
		);
		const spaces = createMemo(
			() =>
				new Map<string, InboxSpace>(
					[...communities().values()].map((community) => [
						spaceKey(community),
						toInboxSpace(community),
					]),
				),
		);
		const spaceOf = (community: string) => {
			const view = communities().get(community);
			return view ? data.space(view) : undefined;
		};
		const directories = createMemo(() => {
			const map = new Map<string, AuthorDirectory>();
			for (const view of communities().values()) {
				const space = data.space(view);
				map.set(view.did, {
					members: new Map<string, MemberView>(
						(space.members.value() ?? []).map((member) => [
							member.actor.did,
							member,
						]),
					),
					roles: new Map<string, RoleView>(
						(space.roles.value() ?? []).map((role) => [role.rkey, role]),
					),
				});
			}
			return map;
		});

		createEffect(() => {
			for (const view of store.items()) {
				const parent = view.channel;
				if (!view.thread || requestedThreads.has(parent)) continue;
				requestedThreads.add(parent);
				void data.source.listThreads(parent).then((threads) => {
					for (const thread of threads) {
						setThreadNames(thread.space, thread.name);
					}
				});
			}
		});

		const viewerLabel = () => {
			const viewer = data.viewer;
			return displayNameOf(viewer).split(/\s+/)[0] ?? "you";
		};

		const mapped = createMemo(() => {
			const views = store.items();
			const context = {
				viewer: data.viewer.did,
				viewerLabel: viewerLabel(),
				communities: communities(),
				directory: (community: string) => directories().get(community),
				roles: (community: string) => spaceOf(community)?.roles.value() ?? [],
				channelName: (community: string, channel: SpaceRef) =>
					spaceOf(community)?.channelBySlug(skeyOf(channel))?.name,
				threadName: (thread: SpaceRef) => threadNames[thread],
			};
			const byId = new Map<string, NotificationView>();
			const list = views.map((view) => {
				byId.set(view.id, view);
				return toInboxNotification(view, context);
			});
			return { list, byId };
		});

		const notifications = () => mapped().list;
		const pending = createMemo(() =>
			notifications().filter((entry) => !entry.read),
		);
		const presence = createExitPresence(pending, (entry) => entry.id);
		const visible = createMemo(() =>
			presence.rendered().filter((entry) => matchesFilter(entry, filter())),
		);
		const groups = createMemo(() => groupBySpace(visible(), spaces()));
		const groupIds = createMemo(
			() => groups().map((group) => group.space.id),
			undefined,
			{
				equals: (a, b) =>
					a.length === b.length && a.every((id, i) => id === b[i]),
			},
		);
		const groupFor = (id: string) =>
			groups().find((group) => group.space.id === id);

		const failed = () => toast.error("Couldn't mark as read");
		const markRead = (ids: readonly string[]) =>
			void store.markRead(ids).catch(failed);

		const open = (id: string) => {
			const view = mapped().byId.get(id);
			if (!view) return;
			markRead([id]);
			openNotificationTarget(stack, data.jumps.request, view);
		};

		const unreadIds = (match: (entry: InboxNotification) => boolean) =>
			notifications()
				.filter((entry) => !entry.read && match(entry))
				.map((entry) => entry.id);

		const markAllRead = () => void store.markAllRead().catch(failed);
		const markFilterRead = () => {
			const current = filter();
			if (current === "all") markAllRead();
			else markRead(unreadIds((entry) => matchesFilter(entry, current)));
		};

		return {
			store,
			spaceList: () => [...spaces().values()],
			unreadIds,
			filter,
			setFilter,
			notifications,
			visible,
			groups,
			groupIds,
			groupFor,
			presence,
			filterUnread: () => countFor(notifications(), filter()),
			markFilterRead,
			open,
			markRead,
			markSpaceRead: (spaceId: string) =>
				markRead(
					visible()
						.filter((entry) => entry.spaceId === spaceId && !entry.read)
						.map((entry) => entry.id),
				),
			markAllRead,
			clearInbox: () =>
				void store.clear().catch(() => toast.error("Couldn't clear Inbox")),
		};
	},
	slots: {
		Popover: slot((m) => (
			<InboxPopover
				spaces={m.spaceList()}
				notifications={m.notifications()}
				status={
					m.store.status() === "error" && m.notifications().length === 0
						? "error"
						: m.store.status() === "loading" && m.notifications().length === 0
							? "loading"
							: "ready"
				}
				onOpenNotification={m.open}
				onMarkRead={(id) => m.markRead([id])}
				onMarkAllRead={m.markAllRead}
				onClearInbox={m.clearInbox}
				onMarkCategoryRead={(category) =>
					m.markRead(m.unreadIds((entry) => matchesFilter(entry, category)))
				}
				onMarkSpaceRead={(spaceId) =>
					m.markRead(m.unreadIds((entry) => entry.spaceId === spaceId))
				}
				onRetry={() => void m.store.reload()}
			/>
		)),
		MarkRead: slot((m) => (
			<Show when={m.filterUnread() > 0}>
				<Button
					variant="tertiary"
					icon={<MarkAllReadIcon />}
					data-inbox-mark-filter-read=""
					onClick={() => m.markFilterRead()}
					class="h-11 self-end pr-4 pl-3 [&_svg]:size-4"
				>
					{FILTERS.find((entry) => entry.value === m.filter())?.markReadLabel}
				</Button>
			</Show>
		)),
		Filters: slot((m) => (
			<SegmentedControl
				aria-label="Filter notifications"
				size="sm"
				value={m.filter()}
				onChange={(value) => m.setFilter(value as InboxFilter)}
				options={FILTERS.map((entry) => ({
					value: entry.value,
					get label() {
						const count = countFor(m.notifications(), entry.value);
						return count > 0 ? `${entry.label} ${count}` : entry.label;
					},
				}))}
			/>
		)),
		Groups: slot((m) => (
			<Switch>
				<Match
					when={m.store.status() === "error" && m.notifications().length === 0}
				>
					<InboxError onRetry={() => void m.store.reload()} />
				</Match>
				<Match
					when={
						m.store.status() === "loading" && m.notifications().length === 0
					}
				>
					<div data-inbox-loading="" class="flex flex-col gap-4">
						<For each={[3, 2]}>
							{(rows) => (
								<Card tone="card" class="flex flex-col py-1">
									<For each={Array.from({ length: rows }, (_, index) => index)}>
										{(index) => (
											<InboxRowSkeleton
												space={false}
												lines={index === 0 ? 2 : 1}
											/>
										)}
									</For>
								</Card>
							)}
						</For>
					</div>
				</Match>
				<Match when={m.groups().length === 0}>
					<InboxEmpty filter={m.filter()} />
				</Match>
				<Match when={m.groups().length > 0}>
					<div class="flex flex-col">
						<For each={m.groupIds()}>
							{(id) => {
								const group = () => m.groupFor(id);
								const notifications = () => group()?.notifications ?? [];
								const unread = () =>
									notifications().some(
										(entry) => !entry.read && !m.presence.isExiting(entry.id),
									);
								const exiting = () =>
									notifications().length > 0 &&
									notifications().every((entry) =>
										m.presence.isExiting(entry.id),
									);
								return (
									<Show when={group()}>
										{(current) => (
											<GroupExit exiting={exiting()}>
												<InboxGroupCard
													name={current().space.name}
													iconSrc={current().space.iconSrc}
													summary={groupSummary(
														notifications().filter(
															(entry) => !m.presence.isExiting(entry.id),
														),
													)}
													actions={
														<Show when={unread()}>
															<IconButton
																variant="ghost"
																size="md"
																label={`Mark ${current().space.name} as read`}
																icon={<MarkAllReadIcon />}
																onClick={() => m.markSpaceRead(id)}
															/>
														</Show>
													}
												>
													<ul
														data-inbox-list=""
														class="m-0 flex list-none flex-col p-0"
													>
														<For each={notifications()}>
															{(notification) => (
																<InboxRow
																	notification={notification}
																	space={current().space}
																	showSpace={false}
																	onOpen={m.open}
																	onMarkRead={(row) => m.markRead([row])}
																	exiting={m.presence.isExiting(
																		notification.id,
																	)}
																	onExited={m.presence.release}
																	class="rounded-none border-0 border-t border-solid border-border first:border-t-0"
																/>
															)}
														</For>
													</ul>
												</InboxGroupCard>
											</GroupExit>
										)}
									</Show>
								);
							}}
						</For>
					</div>
				</Match>
			</Switch>
		)),
	},
});
