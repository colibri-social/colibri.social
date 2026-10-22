import { isOffline } from "@colibri-social/lib";
import {
	Button,
	CheckboxRow,
	CollapsibleGroup,
	FullScreenSheet,
	ListGroup,
	Modal,
	ModalClose,
	ModalContent,
	NavRow,
	SearchField,
	SpaceIcon,
	TextField,
	toast,
} from "@colibri-social/ui";
import { ChatRoundDotsIcon } from "@solar-icons/solid/bold/chat-round-dots";
import { ChatSquareDotsIcon } from "@solar-icons/solid/bold/chat-square-dots";
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
import type { ForwardTarget as ForwardPlace } from "../../../data/adapters/forward";
import { formatAge } from "../../../data/adapters/time";
import { skeyOf } from "../../../data/ids";
import { useData } from "../../../data/store";
import type { SpaceRef } from "../../../data/types";
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

		const forwardButton = (block: boolean) => (
			<Button
				block={block}
				disabled={targets().length === 0}
				loading={sending()}
				onClick={() => void forward()}
			>
				<span data-forward-submit="" class="tabular-nums">
					{forwardLabel()}
				</span>
			</Button>
		);

		const previewAndSearch = () => (
			<>
				<div
					data-forward-preview=""
					class="min-w-0 overflow-hidden rounded-control bg-secondary px-3 py-2 text-sm text-muted-foreground [overflow-wrap:anywhere]"
				>
					<div class="line-clamp-3">{request()?.preview}</div>
				</div>
				<SearchField
					aria-label="Search channels and threads"
					placeholder="Search channels and threads"
					value={query()}
					onChange={setQuery}
				/>
			</>
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
											<CheckboxRow
												value={thread().key}
												checked={
													!thread().current && selected().has(thread().key)
												}
												onChange={(checked) => toggle(thread(), checked)}
												disabled={thread().current || sending()}
												leading={
													<span
														aria-hidden="true"
														class="flex size-6 items-center justify-center text-foreground [&>svg]:size-6"
													>
														<ChatRoundDotsIcon />
													</span>
												}
												label={
													<span
														data-forward-thread=""
														class="block min-w-0 truncate"
													>
														{thread().thread?.name}
													</span>
												}
												description={
													thread().current
														? "Current thread"
														: failed().has(thread().key)
															? failedNote()
															: formatAge(thread().thread?.lastActivityAt ?? "")
												}
												class="min-w-0 gap-2 pl-9"
											/>
										)}
									</Show>
								)}
							</For>
							<Show when={group().failed}>
								<NavRow
									class="pl-9"
									icon={<DangerTriangleIcon />}
									label="Couldn't load threads. Try again"
									chevron={false}
									onClick={() =>
										data.threadsOf(props.channel as SpaceRef).retry()
									}
								/>
							</Show>
							<Show when={!group().failed && group().threads.length === 0}>
								<p class="m-0 py-2.5 pr-3 pl-9 text-sm text-muted-foreground">
									{group().loading || !group().loaded
										? "Loading threads"
										: "No threads yet"}
								</p>
							</Show>
						</>
					)}
				</Show>
			);
		};

		const targetList = () => (
			<div data-forward-targets="" class="flex flex-col gap-4">
				<Show
					when={visible().length > 0}
					fallback={
						<p class="m-0 py-6 text-center text-sm text-muted-foreground">
							{groups().length === 0
								? "There are no channels you can forward to."
								: "Nothing matches your search."}
						</p>
					}
				>
					<For each={visible().map((group) => group.space.did)}>
						{(did) => (
							<Show when={visibleBySpace().get(did)}>
								{(group) => (
									<fieldset
										aria-label={`Channels in ${group().space.name}`}
										class="m-0 min-w-0 border-0 p-0"
									>
										<ListGroup
											label={
												<span class="inline-flex min-w-0 items-center gap-1.5 align-top">
													<SpaceIcon
														name={group().space.name}
														src={group().space.picture}
														size={20}
													/>
													<span class="truncate">{group().space.name}</span>
												</span>
											}
										>
											<For
												each={group().channels.map((entry) => entry.target.key)}
											>
												{(ref) => (
													<Show when={entryOf(did, ref)}>
														{(entry) => (
															<CollapsibleGroup
																icon={<ChatSquareDotsIcon />}
																label={
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
																count={
																	entry().loaded
																		? entry().threads.length
																		: undefined
																}
																expanded={isExpanded(entry())}
																onExpandedChange={(open) =>
																	setGroupExpanded(entry(), open)
																}
																checked={
																	!entry().target.current && selected().has(ref)
																}
																onSelect={() =>
																	toggle(entry().target, !selected().has(ref))
																}
																disabled={entry().target.current || sending()}
																toggleLabel={`Threads in #${entry().target.channel.name}`}
															>
																<ThreadRows did={did} channel={ref} />
															</CollapsibleGroup>
														)}
													</Show>
												)}
											</For>
										</ListGroup>
									</fieldset>
								)}
							</Show>
						)}
					</For>
				</Show>
			</div>
		);

		const noteField = () => (
			<TextField
				label="Add a message"
				placeholder="Optional"
				value={note()}
				onChange={setNote}
				maxLength={2000}
			/>
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
						description="Pick the channels or threads to share this message in."
						closeLabel="Cancel forwarding"
						footer={<div data-forward-actions="">{forwardButton(true)}</div>}
					>
						{previewAndSearch()}
						{targetList()}
						{noteField()}
					</FullScreenSheet>
				}
			>
				<Modal
					open={open()}
					onOpenChange={onOpenChange}
					dirty={unsent()}
					discardDescription={DISCARD_NOTE}
				>
					<ModalContent
						title="Forward message"
						description="Pick the channels or threads to share this message in."
						closeLabel="Cancel forwarding"
						footer={
							<>
								<ModalClose disabled={sending()}>Cancel</ModalClose>
								{forwardButton(false)}
							</>
						}
					>
						<div data-forward-modal="" class="flex min-h-0 flex-col gap-3">
							{previewAndSearch()}
							<div class="max-h-[min(360px,40dvh)] overflow-y-auto">
								{targetList()}
							</div>
							{noteField()}
						</div>
					</ModalContent>
				</Modal>
			</Show>
		);
	};

	return { open: openPicker, Sheet };
};
