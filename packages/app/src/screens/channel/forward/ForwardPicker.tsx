import {
	Button,
	FullScreenSheet,
	Modal,
	ModalContent,
	RadioRow,
	RadioRowGroup,
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
		const [selected, setSelected] = createSignal<string>();
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
		const target = createMemo<ForwardTarget | undefined>(() => {
			const key = selected();
			if (!key) return undefined;
			for (const group of groups()) {
				const found = group.targets.find((entry) => entry.key === key);
				if (found) return found;
			}
			return undefined;
		});

		const reset = () => {
			setQuery("");
			setSelected(undefined);
			setNote("");
			setSending(false);
		};

		const onOpenChange = (next: boolean) => {
			if (sending()) return;
			setOpen(next);
			if (!next) reset();
		};

		const forward = async () => {
			const current = request();
			const destination = target();
			if (!current || !destination || sending()) return;
			setSending(true);
			try {
				const text = note().trim();
				await data.source.forwardMessage({
					from: current.channel,
					rkey: current.rkey,
					to: destination.channel.space,
					...(text ? { text } : {}),
				});
				setSending(false);
				setOpen(false);
				reset();
				toast.success(`Forwarded to #${destination.channel.name}`, {
					action: options.onOpenChannel
						? {
								label: "Open",
								onClick: () =>
									options.onOpenChannel?.(
										destination.space.did,
										destination.skey,
										destination.channel.type,
									),
							}
						: undefined,
				});
			} catch {
				setSending(false);
				toast.error("Couldn't forward this message. Try again.");
			}
		};

		const forwardButton = (block: boolean) => (
			<Button
				block={block}
				disabled={!target()}
				loading={sending()}
				onClick={() => void forward()}
			>
				Forward
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
							<RadioRowGroup
								aria-label={`Channels in ${group.space.name}`}
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
								value={
									group.targets.some((entry) => entry.key === selected())
										? selected()
										: ""
								}
								onChange={setSelected}
							>
								<For each={group.targets}>
									{(entry) => (
										<RadioRow
											value={entry.key}
											disabled={entry.current}
											icon={<ChatSquareDotsIcon />}
											title={
												<span
													data-forward-channel=""
													class="block min-w-0 truncate"
												>
													{entry.channel.name}
												</span>
											}
											description={
												entry.current ? "Current channel" : entry.category
											}
											class="min-w-0"
										/>
									)}
								</For>
							</RadioRowGroup>
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
						title="Forward message"
						description="Pick a channel to share this message in."
						closeLabel="Cancel forwarding"
						footer={<div data-forward-actions="">{forwardButton(true)}</div>}
					>
						{previewAndSearch()}
						{targetList()}
						{noteField()}
					</FullScreenSheet>
				}
			>
				<Modal open={open()} onOpenChange={onOpenChange}>
					<ModalContent
						title="Forward message"
						description="Pick a channel to share this message in."
						closeLabel="Cancel forwarding"
						footer={
							<>
								<Button
									variant="secondary"
									disabled={sending()}
									onClick={() => onOpenChange(false)}
								>
									Cancel
								</Button>
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
