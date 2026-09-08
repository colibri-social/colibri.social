import { type Component, createMemo, createSignal, For, Show } from "solid-js";
import { toast } from "somoto";
import ArrowRightIcon from "~icons/ph/arrow-right";
import ArrowUUpLeftIcon from "~icons/ph/arrow-u-up-left";
import ArrowsMergeIcon from "~icons/ph/arrows-merge";
import CaretRightIcon from "~icons/ph/caret-right";
import ChatCircleDotsIcon from "~icons/ph/chat-circle-dots";
import PlusIcon from "~icons/ph/plus";
import XIcon from "~icons/ph/x";
import { SPACE_TYPES } from "../../../../atproto/lexicons";
import {
	audienceChange,
	describeMoveBlock,
	type MovePlan,
	type MoveSubject,
	originSpace,
	planMove,
} from "../../../../atproto/thread-move";
import type { ThreadView } from "../../../../atproto/views";
import { useChannelContext } from "../../../../contexts/Channel";
import {
	useCommunityContext,
	usePermissions,
} from "../../../../contexts/Community";
import { useNotifications } from "../../../../contexts/Notifications";
import { useThreads } from "../../../../contexts/Threads";
import { useUserContext } from "../../../../contexts/User";
import { Button } from "../../../ui/Button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogPortal,
	DialogTitle,
} from "../../../ui/Dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuPortal,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "../../../ui/DropdownMenu";
import {
	TextField,
	TextFieldInput,
	TextFieldLabel,
} from "../../../ui/TextField";

type Destination =
	| { kind: "thread"; thread: ThreadView }
	| { kind: "channel"; space: string; name: string }
	| { kind: "new" };

type Target = { space: string; thread?: ThreadView };

export const SelectionBar: Component = () => {
	const channel = useChannelContext();
	const community = useCommunityContext();
	const threads = useThreads();
	const notifications = useNotifications();
	const user = useUserContext();
	const { canMoveMessages, canCreateThread } = usePermissions();

	const [confirm, setConfirm] = createSignal<Destination | undefined>(
		undefined,
	);
	const [newName, setNewName] = createSignal("");
	const [busy, setBusy] = createSignal(false);

	const selection = () => channel.selection();

	const plan = createMemo<MovePlan>(() =>
		planMove(selection(), { canModerate: canMoveMessages(user.did) }),
	);

	const sourceChannel = () => {
		const space = channel.channelSpace();
		const thread = threads.bySpace(space);
		return thread?.channel ?? space;
	};

	const anchoredThreads = () =>
		selection()
			.map((message) =>
				threads.anchoredAt(message.channel, message.author.did, message.rkey),
			)
			.filter((thread): thread is ThreadView => thread !== undefined);

	const holds = () => {
		const current = plan();
		const base =
			current.kind === "blocked"
				? [channel.channelSpace()]
				: [current.source, channel.channelSpace()];
		return [...base, ...anchoredThreads().map((thread) => thread.space)];
	};

	const channelNameOf = (space: string): string =>
		community().channels.find((entry) => entry.space === space)?.name ?? "";

	const categoryNameOf = (space: string): string | undefined => {
		const rkey = community().channels.find(
			(entry) => entry.space === space,
		)?.category;
		if (rkey === undefined) return undefined;
		return community().categories.find((entry) => entry.rkey === rkey)?.name;
	};

	const sharedNames = createMemo(() => {
		const seen = new Map<string, number>();
		for (const entry of community().channels)
			seen.set(entry.name, (seen.get(entry.name) ?? 0) + 1);
		return seen;
	});

	const destinationThreads = () =>
		(anchoredThreads().length > 0 ? [] : threads.threads())
			.filter(
				(thread) => thread.viewer.canPost && !holds().includes(thread.space),
			)
			.sort((a, b) => {
				const byChannel = channelNameOf(a.channel).localeCompare(
					channelNameOf(b.channel),
				);
				return byChannel !== 0 ? byChannel : a.name.localeCompare(b.name);
			});

	const DestinationLabel: Component<{ channel: string; thread?: string }> = (
		labelProps,
	) => {
		const name = () => channelNameOf(labelProps.channel);
		const category = () =>
			(sharedNames().get(name()) ?? 0) > 1
				? categoryNameOf(labelProps.channel)
				: undefined;

		return (
			<span class="flex min-w-0 flex-row items-center gap-1">
				<Show when={category()}>
					{(label) => (
						<>
							<span class="shrink-0 truncate text-muted-foreground">
								{label()}
							</span>
							<CaretRightIcon class="size-3 shrink-0 text-muted-foreground" />
						</>
					)}
				</Show>
				<ChatCircleDotsIcon class="size-4 shrink-0" />
				<span class="truncate">{name()}</span>
				<Show when={labelProps.thread}>
					{(thread) => (
						<>
							<CaretRightIcon class="size-3 shrink-0 text-muted-foreground" />
							<ArrowsMergeIcon class="size-4 shrink-0 rotate-180" />
							<span class="truncate">{thread()}</span>
						</>
					)}
				</Show>
			</span>
		);
	};

	const otherChannels = () =>
		community().channels.filter(
			(entry) =>
				entry.type === SPACE_TYPES.channelText &&
				entry.viewer.canPost &&
				!holds().includes(entry.space),
		);

	const origin = (): Destination | undefined => {
		const space = originSpace(plan(), channel.channelSpace());
		if (space === undefined) return undefined;

		const thread = threads.bySpace(space);
		if (thread)
			return thread.viewer.canPost ? { kind: "thread", thread } : undefined;

		const entry = community().channels.find(
			(item) => item.space === space && item.viewer.canPost,
		);
		return entry
			? { kind: "channel", space: entry.space, name: entry.name }
			: undefined;
	};

	const audienceOf = (destination: Destination) => {
		if (destination.kind === "thread") {
			return {
				visibleToRoles: destination.thread.visibleToRoles,
				visibleToMembers: destination.thread.visibleToMembers,
			};
		}
		if (destination.kind === "channel") {
			const entry = community().channels.find(
				(item) => item.space === destination.space,
			);
			return {
				visibleToRoles: entry?.visibleToRoles,
				visibleToMembers: entry?.visibleToMembers,
			};
		}
		return {};
	};

	const sourceAudience = () => {
		const space = channel.channelSpace();
		const thread = threads.bySpace(space);
		if (thread) {
			return {
				visibleToRoles: thread.visibleToRoles,
				visibleToMembers: thread.visibleToMembers,
			};
		}
		const entry = community().channels.find((item) => item.space === space);
		return {
			visibleToRoles: entry?.visibleToRoles,
			visibleToMembers: entry?.visibleToMembers,
		};
	};

	const shift = (destination: Destination) =>
		audienceChange(sourceAudience(), audienceOf(destination));

	const nameOf = (destination: Destination): string => {
		if (destination.kind === "thread") return destination.thread.name;
		if (destination.kind === "channel") return destination.name;
		return newName().trim() || "a new thread";
	};

	const resolveSpace = async (
		destination: Destination,
	): Promise<Target | undefined> => {
		if (destination.kind === "thread")
			return { space: destination.thread.space, thread: destination.thread };
		if (destination.kind === "channel") return { space: destination.space };

		const name = newName().trim();
		if (!name) return undefined;
		const created = await threads.createThread({
			channel: sourceChannel(),
			name,
		});
		return created ? { space: created.space, thread: created } : undefined;
	};

	const announceMove = (
		target: Target,
		subjects: ReadonlyArray<MoveSubject>,
	) => {
		const first = subjects[0];
		const focus = {
			channel: target.thread?.channel ?? target.space,
			...(target.thread ? { thread: target.space } : {}),
			...(first ? { messageUri: first.uri } : {}),
			indexedAt: new Date().toISOString(),
		};

		toast.success(
			subjects.length === 1
				? "Message moved."
				: `${subjects.length} messages moved.`,
			{
				action: {
					label: "View",
					onClick: () => notifications.openNotification(focus),
				},
			},
		);
	};

	const run = async (destination: Destination): Promise<void> => {
		const current = plan();
		if (current.kind === "blocked") {
			toast.error(describeMoveBlock(current.reason));
			return;
		}

		setBusy(true);
		try {
			const target = await resolveSpace(destination);
			if (!target) {
				toast.error("Could not work out where to move those messages.");
				return;
			}

			const moved = await threads.moveMessages({
				source: current.source,
				destination: target.space,
				subjects: current.subjects,
			});
			if (!moved) return;
			for (const subject of current.subjects)
				channel.removeMessage(subject.uri);

			announceMove(target, current.subjects);
			channel.clearSelection();
			setConfirm(undefined);
			setNewName("");
		} finally {
			setBusy(false);
		}
	};

	const choose = (destination: Destination) => {
		if (
			destination.kind === "new" ||
			shift(destination).changed ||
			anchoredThreads().length > 0
		) {
			setConfirm(destination);
			return;
		}
		void run(destination);
	};

	const count = () => selection().length;

	return (
		<>
			<div class="flex w-full flex-row items-center gap-2 border-t border-border bg-card px-3 py-2">
				<span class="text-sm tabular-nums">
					{count() === 1
						? "1 message selected"
						: `${count()} messages selected`}
				</span>
				<div class="ml-auto flex flex-row items-center gap-2">
					<DropdownMenu placement="top-end">
						<DropdownMenuTrigger as={Button} size="sm">
							<ArrowRightIcon />
							Move to
						</DropdownMenuTrigger>
						<DropdownMenuPortal>
							<DropdownMenuContent class="max-h-80 w-64 overflow-y-auto">
								<Show
									when={
										canCreateThread(user.did) && anchoredThreads().length === 0
									}
								>
									<DropdownMenuItem onSelect={() => choose({ kind: "new" })}>
										<PlusIcon />
										<span>New thread</span>
									</DropdownMenuItem>
									<DropdownMenuSeparator />
								</Show>
								<Show when={origin()}>
									{(entry) => (
										<>
											<DropdownMenuItem onSelect={() => choose(entry())}>
												<ArrowUUpLeftIcon />
												<span class="truncate">Back to {nameOf(entry())}</span>
											</DropdownMenuItem>
											<DropdownMenuSeparator />
										</>
									)}
								</Show>
								<For each={destinationThreads()}>
									{(thread) => (
										<DropdownMenuItem
											onSelect={() => choose({ kind: "thread", thread })}
										>
											<DestinationLabel
												channel={thread.channel}
												thread={thread.name}
											/>
										</DropdownMenuItem>
									)}
								</For>
								<Show
									when={
										destinationThreads().length > 0 &&
										otherChannels().length > 0
									}
								>
									<DropdownMenuSeparator />
								</Show>
								<For each={otherChannels()}>
									{(entry) => (
										<DropdownMenuItem
											onSelect={() =>
												choose({
													kind: "channel",
													space: entry.space,
													name: entry.name,
												})
											}
										>
											<DestinationLabel channel={entry.space} />
										</DropdownMenuItem>
									)}
								</For>
							</DropdownMenuContent>
						</DropdownMenuPortal>
					</DropdownMenu>
					<Button
						size="sm"
						variant="ghost"
						aria-label="Cancel selection"
						onClick={() => channel.clearSelection()}
					>
						<XIcon />
					</Button>
				</div>
			</div>

			<Dialog
				open={confirm() !== undefined}
				onOpenChange={(open) => {
					if (!open) setConfirm(undefined);
				}}
			>
				<DialogPortal>
					<DialogContent>
						<Show when={confirm()}>
							{(destination) => (
								<>
									<DialogHeader>
										<DialogTitle>
											Move{" "}
											{count() === 1 ? "this message" : `${count()} messages`}{" "}
											to {nameOf(destination())}?
										</DialogTitle>
									</DialogHeader>
									<Show when={destination().kind === "new"}>
										<TextField class="gap-1.5">
											<TextFieldLabel>Thread name</TextFieldLabel>
											<TextFieldInput
												value={newName()}
												maxLength={128}
												placeholder="Untitled thread"
												onInput={(e) => setNewName(e.currentTarget.value)}
											/>
										</TextField>
									</Show>
									<Show when={shift(destination()).changed}>
										<p class="text-sm text-muted-foreground m-0">
											{shift(destination()).toPrivate
												? "The destination is private, so people who can read them here will lose access."
												: "The destination is open to more people than this one, so more members will be able to read them."}
										</p>
									</Show>
									<Show when={anchoredThreads().length > 0}>
										<p class="text-sm text-muted-foreground">
											{anchoredThreads().length === 1
												? `The thread "${anchoredThreads()[0].name}" was opened from one of these messages, so it moves along with it.`
												: "The threads opened from these messages move along with them."}
										</p>
									</Show>
									<DialogFooter class="flex-col gap-2 sm:flex-row">
										<Button
											class="ml-auto"
											variant="secondary"
											onClick={() => setConfirm(undefined)}
										>
											Cancel
										</Button>
										<Button
											disabled={
												busy() ||
												(destination().kind === "new" && !newName().trim())
											}
											onClick={() => void run(destination())}
										>
											Move
										</Button>
									</DialogFooter>
								</>
							)}
						</Show>
					</DialogContent>
				</DialogPortal>
			</Dialog>
		</>
	);
};
