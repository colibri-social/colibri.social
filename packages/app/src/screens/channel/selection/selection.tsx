import {
	Button,
	Drawer,
	DrawerContent,
	ListGroup,
	MessageSelectionBar,
	Modal,
	ModalContent,
	NavRow,
	SearchField,
	TextField,
	toast,
} from "@colibri-social/ui";
import { AddCircleIcon } from "@solar-icons/solid/bold/add-circle";
import { ArrowLeftIcon } from "@solar-icons/solid/bold/arrow-left";
import { ChatRoundDotsIcon } from "@solar-icons/solid/bold/chat-round-dots";
import { HashtagIcon } from "@solar-icons/solid/bold/hashtag";
import {
	type Accessor,
	createEffect,
	createMemo,
	createSignal,
	For,
	on,
	onCleanup,
	Show,
} from "solid-js";
import { channelSlug, skeyOf } from "../../../data/ids";
import type { ChannelData, DataStore, SpaceData } from "../../../data/store";
import type {
	ChannelView,
	CommunityView,
	MessageView,
	SpaceRef,
	ThreadView,
} from "../../../data/types";
import { isChannelLayer } from "../../../shell/layers";
import type { Navigator } from "../../../shell/stack";
import { whenOverlaysClosed } from "../forward/overlay-wait";
import {
	type Audience,
	audienceChange,
	describeMoveBlock,
	moveBlock,
	movedToast,
	sharedOrigin,
} from "./move-plan";

const [activeSelections, setActiveSelections] = createSignal(0);

export const messageSelectionActive = () => activeSelections() > 0;

const THREAD_MARKER = ".channel.thread/";

export const isThreadRef = (ref: string) => ref.includes(THREAD_MARKER);

type Destination =
	| { kind: "thread"; thread: ThreadView }
	| { kind: "channel"; channel: ChannelView }
	| { kind: "new" };

export type MessageSelectionOptions = {
	data: DataStore;
	stack: Navigator;
	spaceKey: string;
	community: Accessor<CommunityView | undefined>;
	space: Accessor<SpaceData | undefined>;
	feed: Accessor<ChannelData | undefined>;
	parent: Accessor<ChannelView | undefined>;
	anchoredThreads: Accessor<ReadonlyMap<string, ThreadView>>;
	isActive: Accessor<boolean>;
	desktop?: Accessor<boolean>;
};

export const createMessageSelection = (options: MessageSelectionOptions) => {
	const { data, stack } = options;
	const [keys, setKeys] = createSignal<readonly string[]>([]);
	const [pickerOpen, setPickerOpen] = createSignal(false);
	const [confirm, setConfirm] = createSignal<Destination>();
	const [confirmOpen, setConfirmOpen] = createSignal(false);
	const [newName, setNewName] = createSignal("");
	const [busy, setBusy] = createSignal(false);
	const [threads, setThreads] = createSignal<readonly ThreadView[]>([]);
	const [query, setQuery] = createSignal("");
	const desktop = () => options.desktop?.() ?? false;
	const matches = (name: string) =>
		name.toLowerCase().includes(query().trim().toLowerCase());

	const active = () => keys().length > 0;
	const here = () => options.feed()?.channel;

	const canMove = () => {
		const viewer = options.community()?.viewer;
		return !!viewer?.isOwner || !!viewer?.permissions?.includes("thread.move");
	};

	const canCreateThread = () => {
		const viewer = options.community()?.viewer;
		return (
			!!viewer?.isOwner || !!viewer?.permissions?.includes("thread.create")
		);
	};

	const selected = createMemo(() => {
		const set = new Set(keys());
		return (options.feed()?.messages() ?? []).filter((message) =>
			set.has(message.rkey),
		);
	});

	const clear = () => {
		setKeys([]);
		setPickerOpen(false);
	};

	const isSelected = (rkey: string | undefined) =>
		!!rkey && keys().includes(rkey);

	const begin = (rkey: string) => {
		if (!canMove()) return;
		rangeAnchor = rkey;
		setKeys((current) =>
			current.includes(rkey) ? current : [...current, rkey],
		);
	};

	let rangeAnchor: string | undefined;

	const toggle = (rkey: string) => {
		rangeAnchor = rkey;
		setKeys((current) =>
			current.includes(rkey)
				? current.filter((entry) => entry !== rkey)
				: [...current, rkey],
		);
	};

	const selectRange = (rkey: string) => {
		const order = (options.feed()?.messages() ?? []).map(
			(message) => message.rkey,
		);
		const from = rangeAnchor ? order.indexOf(rangeAnchor) : -1;
		const to = order.indexOf(rkey);
		if (from === -1 || to === -1) {
			toggle(rkey);
			return;
		}
		const [start, end] = from < to ? [from, to] : [to, from];
		const span = order.slice(start, end + 1);
		rangeAnchor = rkey;
		setKeys((current) => [
			...current,
			...span.filter((entry) => !current.includes(entry)),
		]);
	};

	createEffect(
		on(active, (isActive) => {
			if (!isActive) return;
			setActiveSelections((count) => count + 1);
			const depth = stack.depth();
			const release = stack.setPopGuard({
				depth,
				blocked: () => active(),
				onBlocked: clear,
			});
			const onKeyDown = (event: KeyboardEvent) => {
				if (event.key !== "Escape" || event.defaultPrevented) return;
				if (document.querySelector('[role="dialog"]')) return;
				event.preventDefault();
				clear();
			};
			window.addEventListener("keydown", onKeyDown);
			onCleanup(() => {
				release();
				window.removeEventListener("keydown", onKeyDown);
				setActiveSelections((count) => Math.max(0, count - 1));
			});
		}),
	);

	createEffect(
		on([options.isActive, here], ([isActive], previous) => {
			if (!isActive || (previous && previous[1] !== here())) clear();
		}),
	);

	createEffect(() => {
		if (!active()) return;
		if (busy()) return;
		if (selected().length === 0 && options.feed()?.ready()) clear();
	});

	const channels = createMemo(() =>
		(options.space()?.channels.value() ?? []).filter(
			(entry) => entry.type === "social.colibri.beta.channel.text",
		),
	);

	const channelByRef = (ref: string) =>
		channels().find((entry) => entry.space === ref);

	const threadByRef = (ref: string) =>
		threads().find((entry) => entry.space === ref);

	const loadThreads = async () => {
		const lists = await Promise.all(
			channels().map((entry) =>
				data.source.listThreads(entry.space).catch(() => [] as ThreadView[]),
			),
		);
		setThreads(lists.flat());
	};

	const anchored = createMemo(() =>
		selected()
			.map((message) => options.anchoredThreads().get(message.rkey))
			.filter((thread): thread is ThreadView => !!thread),
	);

	const sourceChannel = () => options.parent()?.space;

	const origin = createMemo((): Destination | undefined => {
		const current = here();
		if (!current) return undefined;
		const ref = sharedOrigin(
			selected().map((message) => message.channel),
			current,
		);
		if (!ref) return undefined;
		const thread = threadByRef(ref);
		if (thread) {
			return thread.viewer.canPost ? { kind: "thread", thread } : undefined;
		}
		const channel = channelByRef(ref);
		return channel && channel.viewer.canPost !== false
			? { kind: "channel", channel }
			: undefined;
	});

	const holds = () => {
		const list = [here(), origin() ? placeRef(origin() as Destination) : ""];
		for (const thread of anchored()) list.push(thread.space);
		return new Set(list.filter(Boolean) as string[]);
	};

	const channelName = (ref: string) => channelByRef(ref)?.name ?? "";

	const threadDestinations = createMemo(() => {
		if (anchored().length > 0) return [];
		const blocked = holds();
		return threads()
			.filter((thread) => thread.viewer.canPost && !blocked.has(thread.space))
			.sort((a, b) => {
				const byChannel = channelName(a.channel).localeCompare(
					channelName(b.channel),
				);
				return byChannel !== 0 ? byChannel : a.name.localeCompare(b.name);
			});
	});

	const channelDestinations = createMemo(() => {
		const blocked = holds();
		return channels().filter(
			(entry) => entry.viewer.canPost !== false && !blocked.has(entry.space),
		);
	});

	const offerNewThread = () => canCreateThread() && anchored().length === 0;

	const placeRef = (destination: Destination) =>
		destination.kind === "thread"
			? destination.thread.space
			: destination.kind === "channel"
				? destination.channel.space
				: "";

	const nameOf = (destination: Destination) => {
		if (destination.kind === "thread") return destination.thread.name;
		if (destination.kind === "channel") return `#${destination.channel.name}`;
		return newName().trim() || "a new thread";
	};

	const audienceOfRef = (ref: string | undefined): Audience => {
		if (!ref) return {};
		const thread = threadByRef(ref);
		const channel = channelByRef(thread?.channel ?? ref);
		return {
			visibleToRoles: channel?.visibleToRoles,
			visibleToMembers: channel?.visibleToMembers,
		};
	};

	const shift = (destination: Destination) =>
		audienceChange(
			audienceOfRef(here()),
			destination.kind === "new"
				? audienceOfRef(sourceChannel())
				: audienceOfRef(placeRef(destination)),
		);

	const openPlace = (ref: SpaceRef) => {
		const top = stack.top();
		if (!isChannelLayer(top)) return;
		const base = {
			kind: "chat" as const,
			space: options.spaceKey,
			channelType: "social.colibri.beta.channel.text",
		};
		if (isThreadRef(ref)) {
			const thread = threadByRef(ref);
			const parentRef = thread?.channel;
			const parentChannel = parentRef ? channelByRef(parentRef) : undefined;
			if (!parentChannel) return;
			const chat = { ...base, channel: channelSlug(parentChannel) };
			const layer = { ...chat, kind: "thread" as const, thread: skeyOf(ref) };
			if (top.kind === "thread") {
				if (top.channel !== chat.channel) stack.pop();
				stack.replaceTop(layer);
				return;
			}
			if (top.channel !== chat.channel) stack.replaceTop(chat);
			stack.push(layer);
			return;
		}
		const channel = channelByRef(ref);
		if (!channel) return;
		const chat = { ...base, channel: channelSlug(channel) };
		if (top.kind === "thread" || top.kind === "members") {
			stack.pop();
			if (top.channel !== chat.channel) stack.replaceTop(chat);
			return;
		}
		if (top.channel !== chat.channel) stack.replaceTop(chat);
	};

	const resolve = async (destination: Destination) => {
		if (destination.kind !== "new") return placeRef(destination) as SpaceRef;
		const name = newName().trim();
		const channel = sourceChannel();
		const community = options.community();
		if (!name || !channel || !community) return undefined;
		const created = await data.source.createThread({
			community: community.did,
			channel,
			name,
		});
		setThreads((current) => [...current, created]);
		return created.space;
	};

	const run = async (destination: Destination) => {
		const current = here();
		const messages = selected();
		const block = moveBlock(messages.length, canMove());
		if (block) {
			toast.error(describeMoveBlock(block));
			return false;
		}
		if (!current) return false;
		setBusy(true);
		try {
			const target = await resolve(destination);
			if (!target) {
				toast.error("Couldn't work out where to move those messages");
				return false;
			}
			await data.moveMessages({
				source: current,
				destination: target,
				messages,
			});
			clear();
			setConfirmOpen(false);
			setNewName("");
			toast.success(movedToast(messages.length), {
				action: { label: "View", onClick: () => openPlace(target) },
			});
			return true;
		} catch {
			toast.error("Couldn't move those messages");
			return false;
		} finally {
			setBusy(false);
		}
	};

	const choose = (destination: Destination) => {
		setPickerOpen(false);
		if (
			destination.kind === "new" ||
			shift(destination).changed ||
			anchored().length > 0
		) {
			setConfirm(destination);
			if (desktop()) void whenOverlaysClosed().then(() => setConfirmOpen(true));
			else setConfirmOpen(true);
			return;
		}
		void run(destination);
	};

	const openPicker = () => {
		const block = moveBlock(selected().length, canMove());
		if (block) {
			toast.error(describeMoveBlock(block));
			return;
		}
		void loadThreads();
		setQuery("");
		setPickerOpen(true);
	};

	const movedFrom = (message: MessageView) => {
		const current = here();
		if (!current || message.channel === current) return undefined;
		const ref = message.channel;
		const name = isThreadRef(ref)
			? (threadByRef(ref)?.name ??
				[...options.anchoredThreads().values()].find(
					(thread) => thread.space === ref,
				)?.name)
			: channelByRef(ref)
				? `#${channelByRef(ref)?.name}`
				: undefined;
		if (!name) return undefined;
		return { name, open: () => openPlace(ref) };
	};

	createEffect(() => {
		const current = here();
		if (!current || !options.isActive()) return;
		const foreign = (options.feed()?.messages() ?? []).some(
			(message) => message.channel !== current && isThreadRef(message.channel),
		);
		if (foreign && threads().length === 0) void loadThreads();
	});

	const count = () => selected().length;
	const moveTitle = () =>
		count() === 1 ? "Move this message" : `Move ${count()} messages`;

	const Bar = (props: { safeBottom?: boolean }) => (
		<MessageSelectionBar
			count={count()}
			safeBottom={props.safeBottom ?? true}
			busy={busy()}
			onMove={openPicker}
			onCancel={clear}
		/>
	);

	const destinationLabel = (thread: ThreadView) => (
		<span class="flex min-w-0 items-center gap-1">
			<span class="shrink-0 text-muted-foreground">
				{`#${channelName(thread.channel)}`}
			</span>
			<span aria-hidden="true" class="shrink-0 text-muted-foreground">
				/
			</span>
			<span class="min-w-0 truncate">{thread.name}</span>
		</span>
	);

	const visibleThreads = () =>
		threadDestinations().filter((thread) => matches(thread.name));
	const visibleChannels = () =>
		channelDestinations().filter((channel) => matches(channel.name));

	const destinations = () => (
		<>
			<Show when={offerNewThread() || origin()}>
				<ListGroup>
					<Show when={offerNewThread()}>
						<NavRow
							icon={<AddCircleIcon />}
							label="New thread"
							onClick={() => choose({ kind: "new" })}
						/>
					</Show>
					<Show when={origin()}>
						{(entry) => (
							<NavRow
								icon={<ArrowLeftIcon />}
								label={`Back to ${nameOf(entry())}`}
								onClick={() => choose(entry())}
							/>
						)}
					</Show>
				</ListGroup>
			</Show>
			<Show when={visibleThreads().length > 0}>
				<ListGroup label="Threads">
					<For each={visibleThreads()}>
						{(thread) => (
							<NavRow
								icon={<ChatRoundDotsIcon />}
								label={destinationLabel(thread)}
								onClick={() => choose({ kind: "thread", thread })}
							/>
						)}
					</For>
				</ListGroup>
			</Show>
			<Show when={visibleChannels().length > 0}>
				<ListGroup label="Channels">
					<For each={visibleChannels()}>
						{(channel) => (
							<NavRow
								icon={<HashtagIcon />}
								label={channel.name}
								onClick={() => choose({ kind: "channel", channel })}
							/>
						)}
					</For>
				</ListGroup>
			</Show>
		</>
	);

	const Sheets = () => (
		<>
			<Show when={desktop()}>
				<Modal open={pickerOpen()} onOpenChange={setPickerOpen}>
					<ModalContent title={moveTitle()}>
						<div data-move-picker="" class="flex min-h-0 flex-col gap-3">
							<SearchField
								aria-label="Search destinations"
								placeholder="Search threads and channels"
								value={query()}
								onChange={setQuery}
							/>
							<div class="flex max-h-[min(420px,50dvh)] flex-col gap-4 overflow-y-auto">
								{destinations()}
								<Show
									when={
										query().trim() &&
										visibleThreads().length === 0 &&
										visibleChannels().length === 0
									}
								>
									<p class="m-0 py-4 text-center text-sm text-muted-foreground">
										Nothing matches your search.
									</p>
								</Show>
							</div>
						</div>
					</ModalContent>
				</Modal>
			</Show>
			<Drawer
				open={pickerOpen() && !desktop()}
				onOpenChange={setPickerOpen}
				initialFocus="content"
			>
				<DrawerContent
					aria-label={moveTitle()}
					header={
						<span class="block min-w-0 truncate text-lg leading-6 font-bold">
							{moveTitle()}
						</span>
					}
				>
					{destinations()}
				</DrawerContent>
			</Drawer>
			<Modal
				open={confirmOpen()}
				onOpenChange={(open) => {
					if (!open && busy()) return;
					setConfirmOpen(open);
				}}
			>
				<Show when={confirm()}>
					{(destination) => (
						<ModalContent
							title={`${count() === 1 ? "Move this message" : `Move ${count()} messages`} to ${nameOf(destination())}?`}
							footer={
								<>
									<Button
										variant="secondary"
										disabled={busy()}
										onClick={() => setConfirmOpen(false)}
									>
										Cancel
									</Button>
									<Button
										loading={busy()}
										disabled={destination().kind === "new" && !newName().trim()}
										onClick={() => void run(destination())}
									>
										Move
									</Button>
								</>
							}
						>
							<div class="flex flex-col gap-3">
								<Show when={destination().kind === "new"}>
									<TextField
										label="Thread name"
										value={newName()}
										onChange={setNewName}
										maxLength={128}
										placeholder="Untitled thread"
									/>
								</Show>
								<Show when={shift(destination()).changed}>
									<p class="m-0 text-sm text-muted-foreground">
										{shift(destination()).toPrivate
											? "The destination is private, so people who can read them here will lose access."
											: "The destination is open to more people than this one, so more members will be able to read them."}
									</p>
								</Show>
								<Show when={anchored().length > 0}>
									<p class="m-0 text-sm text-muted-foreground">
										{anchored().length === 1
											? `The thread "${anchored()[0]?.name}" was started from one of these messages, so it moves along with it.`
											: "The threads started from these messages move along with them."}
									</p>
								</Show>
							</div>
						</ModalContent>
					)}
				</Show>
			</Modal>
		</>
	);

	return {
		active,
		count,
		canMove,
		isSelected,
		begin,
		toggle,
		selectRange,
		clear,
		movedFrom,
		Bar,
		Sheets,
	};
};

export type MessageSelection = ReturnType<typeof createMessageSelection>;
