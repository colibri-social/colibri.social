import { isOffline } from "@colibri-social/lib";
import {
	Button,
	DestinationAction,
	DestinationChannel,
	DestinationEmpty,
	DestinationList,
	DestinationNote,
	DestinationSpace,
	DestinationThread,
	DestinationThreadSkeleton,
	ForwardPreview,
	type ForwardPreviewAttachment,
	FullScreenSheet,
	Modal,
	ModalContent,
	RichTextRenderer,
	SearchField,
	TextField,
	toast,
} from "@colibri-social/ui";
import { DangerTriangleIcon } from "@solar-icons/solid/bold/danger-triangle";
import {
	type Component,
	createEffect,
	createMemo,
	createSignal,
	For,
	type JSX,
	on,
	Show,
} from "solid-js";
import { mediaKindOf } from "../../../data/adapters/attachments";
import { displayNameOf } from "../../../data/adapters/display-name";
import { toTextValue } from "../../../data/adapters/facets";
import type { ForwardTarget as ForwardPlace } from "../../../data/adapters/forward";
import { formatAge } from "../../../data/adapters/time";
import { skeyOf } from "../../../data/ids";
import { useData } from "../../../data/store";
import type { AttachmentView, SpaceRef } from "../../../data/types";
import { usePlatform } from "../../../screen/platform";
import {
	type ForwardChannelGroup,
	type ForwardGroup,
	type ForwardTarget,
	filterForwardGroups,
	forwardChannelList,
	forwardDestinationNoun,
	forwardGroups,
	forwardTargetName,
} from "./forward-targets";
import { whenOverlaysClosed } from "./overlay-wait";

export type ForwardRequest = {
	channel: SpaceRef;
	parent?: SpaceRef;
	rkey: string;
	preview: JSX.Element | string;
};

export type ForwardPickerOptions = {
	onOpen?: (place: ForwardPlace) => void;
};

const placeOf = (target: ForwardTarget): ForwardPlace => ({
	space: target.space.did,
	channel: target.skey,
	channelType: target.channel.type,
	...(target.thread ? { thread: skeyOf(target.thread.space) } : {}),
});

const DISCARD_NOTE = "Your message won't be forwarded.";

const threadCount = (count: number) =>
	`${count} ${count === 1 ? "thread" : "threads"}`;

const previewAttachments = (
	attachments: readonly AttachmentView[] = [],
): ForwardPreviewAttachment[] =>
	attachments.map((attachment) => {
		const media = mediaKindOf(attachment.mimeType);
		const kind = media
			? media
			: attachment.mimeType.toLowerCase().startsWith("audio/")
				? "audio"
				: "file";
		return {
			kind,
			src: media === "image" || media === "gif" ? attachment.url : undefined,
			alt: attachment.alt,
			spoiler: attachment.spoiler === true,
		};
	});

export const createForwardPicker = (options: ForwardPickerOptions = {}) => {
	const [request, setRequest] = createSignal<ForwardRequest>();
	const [open, setOpen] = createSignal(false);

	let ticket = 0;

	const openPicker = (next: ForwardRequest) => {
		setRequest(next);
		const current = ++ticket;
		void whenOverlaysClosed().then(() => {
			if (current === ticket) setOpen(true);
		});
	};

	const Sheet: Component = () => {
		const data = useData();
		const platform = usePlatform();
		const desktop = () => platform() === "desktop";
		const [query, setQuery] = createSignal("");
		const [selected, setSelected] = createSignal<
			ReadonlyMap<string, ForwardTarget>
		>(new Map());
		const [failed, setFailed] = createSignal<ReadonlySet<string>>(new Set());
		const [note, setNote] = createSignal("");
		const [sending, setSending] = createSignal(false);
		const [expanded, setExpanded] = createSignal<ReadonlyMap<string, boolean>>(
			new Map(),
		);
		const [requested, setRequested] = createSignal<ReadonlySet<string>>(
			new Set(),
		);

		const searching = () => query().trim().replace(/^#/, "").length > 0;
		const home = () => request()?.parent ?? request()?.channel;
		const fromSpace = () => {
			const ref = request()?.channel;
			return ref?.slice("at://".length, ref.indexOf("/space/"));
		};
		const wantsThreads = (ref: SpaceRef, space: string) =>
			ref === home() ||
			requested().has(ref) ||
			(searching() && space === fromSpace());

		createEffect(
			on(query, () => setExpanded(new Map<string, boolean>()), {
				defer: true,
			}),
		);

		const groups = createMemo(() =>
			forwardGroups(
				(data.communities.value() ?? []).map((space) => {
					const loaded = data.space(space);
					return {
						space,
						channels: loaded.channels.value() ?? [],
						categories: loaded.categories.value() ?? [],
						threads: (channel) => {
							if (!wantsThreads(channel.space, space.did)) {
								const cached = data.cachedThreads(channel.space);
								return cached ? { value: cached } : undefined;
							}
							const load = data.threadsOf(channel.space);
							return {
								value: load.value(),
								loading: load.loading(),
								failed: !!load.error(),
							};
						},
					};
				}),
				request()?.channel,
			),
		);
		const visible = createMemo(() => filterForwardGroups(groups(), query()));
		const visibleBySpace = createMemo(
			() =>
				new Map<string, ForwardGroup>(
					visible().map((group) => [group.space.did, group]),
				),
		);
		const entryOf = (did: string, ref: string) =>
			visibleBySpace()
				.get(did)
				?.channels.find((entry) => entry.target.key === ref);
		const threadOf = (entry: ForwardChannelGroup, ref: string) =>
			entry.threads.find((thread) => thread.key === ref);

		const listOrder = createMemo(
			() =>
				new Map(
					groups()
						.flatMap((group) => group.channels)
						.flatMap((entry) => [entry.target, ...entry.threads])
						.map((target, index) => [target.key as string, index]),
				),
		);
		const targets = createMemo<ForwardTarget[]>(() => {
			const order = listOrder();
			const rank = (target: ForwardTarget) =>
				order.get(target.key) ?? Number.MAX_SAFE_INTEGER;
			return [...selected().values()]
				.filter((entry) => !entry.current)
				.sort((a, b) => rank(a) - rank(b));
		});

		const isExpanded = (entry: ForwardChannelGroup) =>
			expanded().get(entry.target.key) ??
			(searching() ? entry.threadMatch : entry.target.key === home());

		const setGroupExpanded = (entry: ForwardChannelGroup, open: boolean) => {
			const ref = entry.target.key;
			setExpanded((current) => new Map(current).set(ref, open));
			if (open && !requested().has(ref)) {
				setRequested((current) => new Set(current).add(ref));
				const load = data.threadsOf(ref);
				if (load.error()) load.retry();
			}
		};

		const without = <T,>(set: ReadonlySet<T>, key: T) => {
			if (!set.has(key)) return set;
			const next = new Set(set);
			next.delete(key);
			return next;
		};

		const toggle = (target: ForwardTarget, checked: boolean) => {
			setSelected((previous) => {
				const next = new Map(previous);
				if (checked) next.set(target.key, target);
				else next.delete(target.key);
				return next;
			});
			if (!checked) setFailed((previous) => without(previous, target.key));
		};

		const reset = () => {
			setQuery("");
			setSelected(new Map<string, ForwardTarget>());
			setFailed(new Set<string>());
			setExpanded(new Map<string, boolean>());
			setRequested(new Set<string>());
			setNote("");
			setSending(false);
		};

		const unsent = () => !sending() && note().trim().length > 0;

		const onOpenChange = (next: boolean) => {
			if (sending()) return;
			setOpen(next);
			if (!next) reset();
		};

		const announceSent = (sent: readonly ForwardTarget[]) => {
			const [only] = sent;
			if (sent.length === 1 && only) {
				toast.success(`Forwarded to ${forwardTargetName(only)}`, {
					action: options.onOpen
						? {
								label: "View",
								onClick: () => options.onOpen?.(placeOf(only)),
							}
						: undefined,
				});
				return;
			}
			toast.success(`Forwarded to ${forwardDestinationNoun(sent)}`, {
				description: forwardChannelList(sent),
			});
		};

		const forward = async () => {
			const current = request();
			const destinations = targets();
			if (!current || destinations.length === 0 || sending()) return;
			setSending(true);
			const text = note().trim();
			const queued = destinations.map((destination) =>
				data.forward({
					from: current.channel,
					rkey: current.rkey,
					to: destination.key,
					...(text ? { text } : {}),
				}),
			);
			if (isOffline()) {
				setSending(false);
				setOpen(false);
				reset();
				toast.success("Your forward sends when you're back online");
				void Promise.allSettled(queued).then((late) => {
					if (late.some((result) => result.status === "rejected"))
						toast.error("A forward couldn't be sent", {
							description: "Open the message and forward it again.",
						});
				});
				return;
			}
			const results = await Promise.allSettled(queued);
			setSending(false);
			const sent = destinations.filter(
				(_, index) => results[index]?.status === "fulfilled",
			);
			const missed = destinations.filter(
				(_, index) => results[index]?.status !== "fulfilled",
			);
			if (missed.length === 0) {
				setOpen(false);
				reset();
				announceSent(sent);
				return;
			}
			setSelected(new Map(missed.map((entry) => [entry.key, entry])));
			setFailed(new Set(missed.map((entry) => entry.key)));
			toast.error(`Couldn't forward to ${forwardChannelList(missed)}`, {
				description:
					sent.length > 0
						? `Forwarded to ${forwardChannelList(sent)}. The rest stay selected so you can try again.`
						: "They stay selected so you can try again.",
			});
		};

		const forwardLabel = () => {
			const count = targets().length;
			if (count === 0) return "Forward";
			return `Forward to ${forwardDestinationNoun(targets())}`;
		};

		const forwardButton = () => (
			<Button
				disabled={targets().length === 0}
				loading={sending()}
				onClick={() => void forward()}
				class="shrink-0"
			>
				<span data-forward-submit="" class="tabular-nums">
					{forwardLabel()}
				</span>
			</Button>
		);

		const message = createMemo(() => {
			const current = request();
			return current
				? data.peekMessage(current.channel, current.rkey)
				: undefined;
		});

		const previewBody = () => {
			const found = message();
			if (!found) return request()?.preview;
			return found.text.trim() ? (
				<RichTextRenderer
					value={toTextValue(found.text, found.facets)}
					platform={platform()}
				/>
			) : undefined;
		};

		const previewCard = () => (
			<ForwardPreview
				author={displayNameOf(message()?.author)}
				avatarSrc={message()?.author.avatar}
				seed={message()?.author.did}
				timestamp={message()?.createdAt}
				attachments={previewAttachments(message()?.attachments)}
			>
				{previewBody()}
			</ForwardPreview>
		);

		const footer = () => (
			<div data-forward-actions="" class="flex min-w-0 flex-col gap-3">
				{previewCard()}
				<div class="flex min-w-0 items-center gap-2">
					<TextField
						aria-label="Add a message"
						placeholder="Add a message"
						value={note()}
						onChange={setNote}
						maxLength={2000}
						disabled={sending()}
						class="min-w-0 flex-1"
					/>
					{forwardButton()}
				</div>
			</div>
		);

		const search = (sticky: boolean) => (
			<div
				class={
					sticky ? "sticky top-0 z-10 -mx-4 bg-popover px-4 pb-1" : undefined
				}
			>
				<SearchField
					aria-label="Search channels and threads"
					placeholder="Search channels and threads"
					value={query()}
					onChange={setQuery}
				/>
			</div>
		);

		const failedNote = () => (
			<span data-forward-failed="" class="text-destructive">
				Couldn't forward
			</span>
		);

		const ThreadRows = (props: { did: string; channel: string }) => {
			const entry = () => entryOf(props.did, props.channel);
			return (
				<Show when={entry()}>
					{(group) => (
						<>
							<For each={group().threads.map((thread) => thread.key)}>
								{(ref) => (
									<Show when={threadOf(group(), ref)}>
										{(thread) => (
											<DestinationThread
												value={thread().key}
												name={
													<span data-forward-thread="">
														{thread().thread?.name}
													</span>
												}
												hint={
													thread().current
														? "Current thread"
														: failed().has(thread().key)
															? failedNote()
															: undefined
												}
												meta={formatAge(thread().thread?.lastActivityAt ?? "")}
												checked={
													!thread().current && selected().has(thread().key)
												}
												onCheckedChange={(checked) => toggle(thread(), checked)}
												disabled={thread().current || sending()}
											/>
										)}
									</Show>
								)}
							</For>
							<Show when={group().failed}>
								<DestinationAction
									tone="muted"
									icon={<DangerTriangleIcon />}
									label="Couldn't load threads. Try again"
									onClick={() =>
										data.threadsOf(props.channel as SpaceRef).retry()
									}
								/>
							</Show>
							<Show when={!group().failed && group().threads.length === 0}>
								<Show
									when={group().loading || !group().loaded}
									fallback={<DestinationNote>No threads yet</DestinationNote>}
								>
									<DestinationThreadSkeleton />
								</Show>
							</Show>
						</>
					)}
				</Show>
			);
		};

		const targetList = () => (
			<DestinationList mode="multi" platform={desktop() ? "desktop" : "mobile"}>
				<Show
					when={visible().length > 0}
					fallback={
						<DestinationEmpty>
							{groups().length === 0
								? "There are no channels you can forward to."
								: "Nothing matches your search."}
						</DestinationEmpty>
					}
				>
					<For each={visible().map((group) => group.space.did)}>
						{(did) => (
							<Show when={visibleBySpace().get(did)}>
								{(group) => (
									<DestinationSpace
										name={group().space.name}
										iconSrc={group().space.picture}
									>
										<For
											each={group().channels.map((entry) => entry.target.key)}
										>
											{(ref) => (
												<Show when={entryOf(did, ref)}>
													{(entry) => (
														<DestinationChannel
															value={ref}
															name={
																<span data-forward-channel="">
																	{entry().target.channel.name}
																</span>
															}
															hint={
																entry().target.current
																	? "Current channel"
																	: failed().has(ref)
																		? failedNote()
																		: entry().target.category
															}
															meta={
																entry().loaded && entry().threads.length > 0
																	? threadCount(entry().threads.length)
																	: undefined
															}
															expanded={isExpanded(entry())}
															onExpandedChange={(open) =>
																setGroupExpanded(entry(), open)
															}
															checked={
																!entry().target.current && selected().has(ref)
															}
															onCheckedChange={(checked) =>
																toggle(entry().target, checked)
															}
															disabled={entry().target.current || sending()}
															toggleLabel={`Threads in #${entry().target.channel.name}`}
														>
															<ThreadRows did={did} channel={ref} />
														</DestinationChannel>
													)}
												</Show>
											)}
										</For>
									</DestinationSpace>
								)}
							</Show>
						)}
					</For>
				</Show>
			</DestinationList>
		);

		return (
			<Show
				when={desktop()}
				fallback={
					<FullScreenSheet
						open={open()}
						onOpenChange={onOpenChange}
						dirty={unsent()}
						discardDescription={DISCARD_NOTE}
						title="Forward message"
						closeLabel="Cancel forwarding"
						footer={footer()}
					>
						<div data-forward-sheet="" class="flex flex-col gap-3">
							{search(true)}
							{targetList()}
						</div>
					</FullScreenSheet>
				}
			>
				<Modal
					open={open()}
					onOpenChange={onOpenChange}
					dirty={unsent()}
					discardDescription={DISCARD_NOTE}
				>
					<ModalContent title="Forward message" closeLabel="Cancel forwarding">
						<div data-forward-modal="" class="flex min-h-0 flex-col gap-3">
							{search(false)}
							<div class="-mx-4 max-h-[min(400px,45dvh)] overflow-y-auto border-0 border-y border-solid border-border px-2 py-2">
								{targetList()}
							</div>
							{footer()}
						</div>
					</ModalContent>
				</Modal>
			</Show>
		);
	};

	return { open: openPicker, Sheet };
};
