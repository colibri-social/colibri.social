import { type Component, createMemo, createSignal, For, Show } from "solid-js";
import { toast } from "somoto";
import ArrowRightIcon from "~icons/ph/arrow-right";
import ArrowUUpLeftIcon from "~icons/ph/arrow-u-up-left";
import ArrowsMergeIcon from "~icons/ph/arrows-merge";
import CaretRightIcon from "~icons/ph/caret-right";
import ChatCircleDotsIcon from "~icons/ph/chat-circle-dots";
import PlusIcon from "~icons/ph/plus";
import XIcon from "~icons/ph/x";
import {
	asDid,
	asRecordKey,
	asSpaceRef,
	COLLECTIONS,
	SPACE_TYPES,
} from "../../../../atproto/lexicons";
import { buildMessageRecord } from "../../../../atproto/message-record";
import {
	enqueueSpaceCreate,
	enqueueSpaceDelete,
} from "../../../../atproto/outbox/outbox";
import { nextTid } from "../../../../atproto/outbox/tid";
import {
	audienceChange,
	describeMoveBlock,
	type MovePlan,
	planMove,
} from "../../../../atproto/thread-move";
import type {
	MessageRecord,
	MessageView,
	ThreadView,
} from "../../../../atproto/views";
import { useChannelContext } from "../../../../contexts/Channel";
import {
	useCommunityContext,
	usePermissions,
} from "../../../../contexts/Community";
import { useThreads } from "../../../../contexts/Threads";
import { useUserContext } from "../../../../contexts/User";
import { classifyThrown } from "../../../../errors/classify";
import { createLogger } from "../../../../utils/logger";
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

const log = createLogger("thread-move");

type Destination =
	| { kind: "thread"; thread: ThreadView }
	| { kind: "channel"; space: string; name: string }
	| { kind: "new" };

export const SelectionBar: Component = () => {
	const channel = useChannelContext();
	const community = useCommunityContext();
	const threads = useThreads();
	const user = useUserContext();
	const { canMoveMessages, canCreateThread } = usePermissions();

	const [confirm, setConfirm] = createSignal<Destination | undefined>(
		undefined,
	);
	const [newName, setNewName] = createSignal("");
	const [busy, setBusy] = createSignal(false);

	const selection = () => channel.selection();

	const plan = createMemo<MovePlan>(() =>
		planMove(selection(), {
			actor: user.did,
			canModerate: canMoveMessages(user.did),
		}),
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

	const homeChannel = () => {
		const current = plan();
		if (current.kind !== "moderate") return undefined;
		if (current.source === channel.channelSpace()) return undefined;
		return community().channels.find(
			(entry) => entry.space === current.source && entry.viewer.canPost,
		);
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

	const readRecord = async (
		message: MessageView,
	): Promise<MessageRecord | undefined> => {
		try {
			const current = await user.atproto.agent.com.atproto.space.getRecord({
				space: message.channel,
				repo: user.did,
				collection: COLLECTIONS.message,
				rkey: message.rkey,
			});
			return current.data.value as MessageRecord;
		} catch (err) {
			log.error("could not read the message being moved", {
				code: classifyThrown(err, { method: "space.getRecord" }).code,
			});
			return undefined;
		}
	};

	const rewriteInto = async (
		space: string,
		messages: ReadonlyArray<MessageView>,
	): Promise<boolean> => {
		for (const message of messages) {
			const existing = await readRecord(message);
			if (!existing) return false;

			const rkey = nextTid();
			const group = `move:${rkey}`;
			const carried = threads.anchoredAt(
				message.channel,
				message.author.did,
				message.rkey,
			);
			const record = buildMessageRecord({
				text: existing.text,
				facets: existing.facets,
				createdAt: existing.createdAt,
				updatedAt: existing.updatedAt,
				attachments: existing.attachments,
				suppressedEmbeds: existing.suppressedEmbeds,
			});
			await enqueueSpaceCreate(space, user.did, COLLECTIONS.message, record, {
				rkey,
				group,
				label: "Failed to move message.",
			});
			await enqueueSpaceDelete(
				message.channel,
				user.did,
				COLLECTIONS.message,
				message.rkey,
				{ group, label: "Failed to move message." },
			);
			if (carried) {
				await threads.repointThread(carried.space, space, {
					space: asSpaceRef(space),
					did: asDid(user.did),
					rkey: asRecordKey(rkey),
				});
			}
			channel.removeMessage(message.uri);
		}
		return true;
	};

	const resolveSpace = async (
		destination: Destination,
	): Promise<string | undefined> => {
		if (destination.kind === "thread") return destination.thread.space;
		if (destination.kind === "channel") return destination.space;

		const name = newName().trim();
		if (!name) return undefined;
		const created = await threads.createThread({
			channel: sourceChannel(),
			name,
		});
		return created?.space;
	};

	const run = async (destination: Destination): Promise<void> => {
		const current = plan();
		if (current.kind === "blocked") {
			toast.error(describeMoveBlock(current.reason));
			return;
		}

		setBusy(true);
		try {
			const space = await resolveSpace(destination);
			if (!space) {
				toast.error("Could not work out where to move those messages.");
				return;
			}

			if (current.kind === "rewrite") {
				if (!(await rewriteInto(space, selection()))) {
					toast.error("Failed to move messages.");
					return;
				}
			} else {
				const moved = await threads.moveMessages({
					source: current.source,
					destination: space,
					subjects: current.subjects,
				});
				if (!moved) return;
				for (const subject of current.subjects)
					channel.removeMessage(subject.uri);
			}

			toast.success(
				selection().length === 1
					? "Message moved."
					: `${selection().length} messages moved.`,
			);
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
								<Show when={homeChannel()}>
									{(entry) => (
										<>
											<DropdownMenuItem
												onSelect={() =>
													choose({
														kind: "channel",
														space: entry().space,
														name: entry().name,
													})
												}
											>
												<ArrowUUpLeftIcon />
												<span class="truncate">Back to {entry().name}</span>
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
									<Show when={plan().kind === "rewrite"}>
										<p class="text-sm text-muted-foreground m-0">
											Reactions and replies will be dropped.
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
