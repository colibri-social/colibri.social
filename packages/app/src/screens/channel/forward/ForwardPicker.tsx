import { isOffline } from "@colibri-social/lib";
import {
	Button,
	CheckboxRow,
	FullScreenSheet,
	ListGroup,
	Modal,
	ModalClose,
	ModalContent,
	SearchField,
	SpaceIcon,
	TextField,
	toast,
} from "@colibri-social/ui";
import { ChatSquareDotsIcon } from "@solar-icons/solid/bold/chat-square-dots";
import {
	type Component,
	createMemo,
	createSignal,
	For,
	type JSX,
	Show,
} from "solid-js";
import { useData } from "../../../data/store";
import type { SpaceRef } from "../../../data/types";
import { usePlatform } from "../../../screen/platform";
import {
	type ForwardTarget,
	filterForwardGroups,
	forwardChannelList,
	forwardGroups,
} from "./forward-targets";
import { whenOverlaysClosed } from "./overlay-wait";

export type ForwardRequest = {
	channel: SpaceRef;
	rkey: string;
	preview: JSX.Element | string;
};

export type ForwardPickerOptions = {
	onOpenChannel?: (
		spaceDid: string,
		channelSkey: string,
		channelType: string,
	) => void;
};

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
		const [selected, setSelected] = createSignal<ReadonlySet<string>>(
			new Set(),
		);
		const [failed, setFailed] = createSignal<ReadonlySet<string>>(new Set());
		const [note, setNote] = createSignal("");
		const [sending, setSending] = createSignal(false);

		const groups = createMemo(() =>
			forwardGroups(
				(data.communities.value() ?? []).map((space) => {
					const loaded = data.space(space);
					return {
						space,
						channels: loaded.channels.value() ?? [],
						categories: loaded.categories.value() ?? [],
					};
				}),
				request()?.channel,
			),
		);
		const visible = createMemo(() => filterForwardGroups(groups(), query()));
		const targets = createMemo<ForwardTarget[]>(() => {
			const keys = selected();
			return groups()
				.flatMap((group) => group.targets)
				.filter((entry) => !entry.current && keys.has(entry.key));
		});

		const without = (set: ReadonlySet<string>, key: string) => {
			if (!set.has(key)) return set;
			const next = new Set(set);
			next.delete(key);
			return next;
		};

		const toggle = (key: string, checked: boolean) => {
			setSelected((previous) => {
				if (!checked) return without(previous, key);
				const next = new Set(previous);
				next.add(key);
				return next;
			});
			if (!checked) setFailed((previous) => without(previous, key));
		};

		const reset = () => {
			setQuery("");
			setSelected(new Set<string>());
			setFailed(new Set<string>());
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
				toast.success(`Forwarded to #${only.channel.name}`, {
					action: options.onOpenChannel
						? {
								label: "Open",
								onClick: () =>
									options.onOpenChannel?.(
										only.space.did,
										only.skey,
										only.channel.type,
									),
							}
						: undefined,
				});
				return;
			}
			toast.success(`Forwarded to ${sent.length} channels`, {
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
					to: destination.channel.space,
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
			const retry = new Set(missed.map((entry) => entry.key));
			setSelected(retry);
			setFailed(retry);
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
			return `Forward to ${count} ${count === 1 ? "channel" : "channels"}`;
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
					aria-label="Search channels"
					placeholder="Search channels"
					value={query()}
					onChange={setQuery}
				/>
			</>
		);

		const targetList = () => (
			<div data-forward-targets="" class="flex flex-col gap-4">
				<Show
					when={visible().length > 0}
					fallback={
						<p class="m-0 py-6 text-center text-sm text-muted-foreground">
							{groups().length === 0
								? "There are no channels you can forward to."
								: "No channels match your search."}
						</p>
					}
				>
					<For each={visible()}>
						{(group) => (
							<fieldset
								aria-label={`Channels in ${group.space.name}`}
								class="m-0 min-w-0 border-0 p-0"
							>
								<ListGroup
									label={
										<span class="inline-flex min-w-0 items-center gap-1.5 align-top">
											<SpaceIcon
												name={group.space.name}
												src={group.space.picture}
												size={20}
											/>
											<span class="truncate">{group.space.name}</span>
										</span>
									}
								>
									<For each={group.targets}>
										{(entry) => (
											<CheckboxRow
												value={entry.key}
												checked={!entry.current && selected().has(entry.key)}
												onChange={(checked) => toggle(entry.key, checked)}
												disabled={entry.current || sending()}
												leading={
													<span
														aria-hidden="true"
														class="flex size-6 items-center justify-center text-foreground [&>svg]:size-6"
													>
														<ChatSquareDotsIcon />
													</span>
												}
												label={
													<span
														data-forward-channel=""
														class="block min-w-0 truncate"
													>
														{entry.channel.name}
													</span>
												}
												description={
													entry.current ? (
														"Current channel"
													) : failed().has(entry.key) ? (
														<span
															data-forward-failed=""
															class="text-destructive"
														>
															Couldn't forward
														</span>
													) : (
														entry.category
													)
												}
												class="min-w-0 gap-2"
											/>
										)}
									</For>
								</ListGroup>
							</fieldset>
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
						description="Pick the channels to share this message in."
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
						description="Pick the channels to share this message in."
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
