import {
	type Component,
	createMemo,
	createResource,
	createSignal,
	For,
	Show,
} from "solid-js";
import { toast } from "somoto";
import ArrowsMergeIcon from "~icons/ph/arrows-merge";
import ChatCircleDotsIcon from "~icons/ph/chat-circle-dots";
import PaperPlaneRightIcon from "~icons/ph/paper-plane-right";
import { namespace } from "../../../../atproto/cache/keys";
import {
	loadCommunityChannels,
	peekCommunityCategories,
	peekCommunityChannels,
} from "../../../../atproto/channel-reference";
import { planForward, sendForward } from "../../../../atproto/forward";
import {
	compareForwardTargets,
	type ForwardTargetOption,
	forwardTargetName,
	forwardTargets,
	matchesForwardFilter,
} from "../../../../atproto/forward-targets";
import { colibri } from "../../../../atproto/lexicons";
import type { CommunityView, ThreadView } from "../../../../atproto/views";
import { useCommunityContext } from "../../../../contexts/Community";
import { useMessageContext } from "../../../../contexts/Message";
import { useThreads } from "../../../../contexts/Threads";
import { useUserContext } from "../../../../contexts/User";
import { getAppViewDid } from "../../../../utils/appview";
import { parseEmojiText } from "../../../../utils/emoji";
import { Button } from "../../../ui/Button";
import {
	Checkbox,
	CheckboxControl,
	CheckboxInput,
	CheckboxLabel,
} from "../../../ui/Checkbox";
import { ResponsiveDialog } from "../../../ui/ResponsiveDialog";
import { TextField, TextFieldInput } from "../../../ui/TextField";
import { CommunityAvatar } from "../../community/CommunityAvatar";
import { MessagePreview } from "./MessagePreview";

const THREAD_PAGE_LIMIT = 100;

const THREAD_PAGES = 5;

const descriptorOf = (community: CommunityView) => ({
	did: community.did,
	name: community.name,
	...(community.picture ? { picture: community.picture } : {}),
});

export const ForwardDialog: Component = () => {
	const user = useUserContext();
	const community = useCommunityContext();
	const threads = useThreads();
	const { message, forwardModalOpen, setForwardModalOpen } =
		useMessageContext();

	const currentDid = () => community().community.did;

	const [filter, setFilter] = createSignal("");
	const [selected, setSelected] = createSignal<ForwardTargetOption[]>([]);
	const [comment, setComment] = createSignal("");
	const [busy, setBusy] = createSignal(false);

	const source = () => ("hash" in message ? undefined : message);

	const local = createMemo<ForwardTargetOption[]>(() =>
		forwardTargets({
			community: descriptorOf(community().community),
			channels: community().channels,
			categories: community().categories ?? [],
			threads: threads.threads(),
		}),
	);

	const [remote] = createResource(
		() =>
			forwardModalOpen()
				? {
						communities: user.communities.filter(
							(entry) => entry.did !== currentDid(),
						),
						ns: namespace(getAppViewDid(), user.did),
					}
				: undefined,
		async ({ communities, ns }) => {
			const loaded = await Promise.all(
				communities.map(async (entry) => {
					await loadCommunityChannels(user.xrpc, entry.did, ns);

					const collected: Array<ThreadView> = [];
					let cursor: string | undefined;
					for (let page = 0; page < THREAD_PAGES; page++) {
						const res = await user.xrpc.call(colibri.thread.listThreads.main, {
							params: {
								community: entry.did,
								limit: THREAD_PAGE_LIMIT,
								cursor,
							},
						});
						if (!res.ok) break;
						collected.push(...res.data.threads);
						cursor = res.data.cursor;
						if (!cursor || res.data.threads.length === 0) break;
					}

					return forwardTargets({
						community: descriptorOf(entry),
						channels: peekCommunityChannels(entry.did),
						categories: peekCommunityCategories(entry.did),
						threads: collected,
					});
				}),
			);

			return loaded.flat();
		},
	);

	const options = createMemo(() =>
		[...local(), ...(remote() ?? [])].sort(compareForwardTargets),
	);

	const visible = createMemo(() =>
		options().filter((option) => matchesForwardFilter(option, filter())),
	);

	const isSelected = (option: ForwardTargetOption) =>
		selected().some((entry) => entry.space === option.space);

	const toggle = (option: ForwardTargetOption, checked: boolean) =>
		setSelected((current) => {
			const without = current.filter((entry) => entry.space !== option.space);
			return checked ? [...without, option] : without;
		});

	const close = () => {
		setForwardModalOpen(false);
		setFilter("");
		setSelected([]);
		setComment("");
	};

	const describe = (targets: ForwardTargetOption[]): string =>
		targets.length === 1
			? `Forwarded to ${forwardTargetName(targets[0])}.`
			: `Forwarded to ${targets.length} channels.`;

	const run = async () => {
		const original = source();
		const targets = selected();
		if (!original || targets.length === 0) return;

		setBusy(true);
		try {
			const result = await sendForward({
				plan: planForward(original),
				spaces: targets.map((target) => target.space),
				repo: user.did,
				comment: comment().trim(),
			});

			if (result.ok) {
				toast.success(describe(targets));
				close();
				return;
			}

			if (result.reason === "download") {
				toast.error("Could not copy the attachments over.");
				return;
			}

			toast.error(`Only ${result.sent} of ${result.total} forwards went out.`);
			close();
		} finally {
			setBusy(false);
		}
	};

	return (
		<ResponsiveDialog
			open={forwardModalOpen()}
			onOpenChange={(open) => {
				if (!open) close();
			}}
			title="Forward to"
			contentClass="sm:max-w-md"
		>
			<div class="flex min-h-0 flex-col gap-3">
				<p class="m-0 text-sm text-muted-foreground">
					Select where you want to share this message.
				</p>

				<TextField>
					<TextFieldInput
						value={filter()}
						placeholder="Search"
						aria-label="Search channels and threads"
						onInput={(e) => setFilter(e.currentTarget.value)}
					/>
				</TextField>

				<div class="flex max-h-64 min-h-24 flex-col gap-0.5 overflow-y-auto">
					<Show
						when={visible().length > 0}
						fallback={
							<p class="m-0 py-6 text-center text-sm text-muted-foreground">
								<Show
									when={remote.loading}
									fallback="Nothing here to forward to."
								>
									Looking for channels...
								</Show>
							</p>
						}
					>
						<For each={visible()}>
							{(option) => (
								<Checkbox
									class="flex w-full min-w-0 flex-row items-center justify-between gap-3 rounded-sm px-2 py-1.5 hover:bg-muted"
									checked={isSelected(option)}
									onChange={(checked) => toggle(option, checked)}
								>
									<CheckboxLabel class="min-w-0 gap-3">
										<span class="relative shrink-0">
											<CommunityAvatar
												community={option.community}
												class="size-9"
												fallbackClass="size-9 rounded-md bg-foreground/15 text-center text-xs font-bold leading-9"
											/>
											<span class="absolute -bottom-0.5 -left-1 flex size-4 items-center justify-center rounded-full bg-card text-muted-foreground">
												<Show
													when={option.thread}
													fallback={<ChatCircleDotsIcon class="size-2.5" />}
												>
													<ArrowsMergeIcon class="size-2.5 rotate-180" />
												</Show>
											</span>
										</span>
										<span class="flex min-w-0 flex-col gap-0.5">
											<span
												class="truncate"
												innerHTML={parseEmojiText(forwardTargetName(option))}
											/>
											<span class="truncate text-xs font-normal text-muted-foreground">
												{option.community.name}
											</span>
										</span>
									</CheckboxLabel>
									<CheckboxControl />
									<CheckboxInput />
								</Checkbox>
							)}
						</For>
					</Show>
				</div>

				<Show when={source()}>
					{(original) => <MessagePreview data={original()} />}
				</Show>

				<div class="flex flex-row items-end gap-2">
					<TextField class="min-w-0 flex-1">
						<TextFieldInput
							value={comment()}
							maxLength={2048}
							placeholder="Add an optional message..."
							aria-label="Add an optional message"
							onInput={(e) => setComment(e.currentTarget.value)}
						/>
					</TextField>
					<Button
						disabled={busy() || selected().length === 0}
						onClick={() => void run()}
					>
						Send
						<Show when={selected().length > 1}>
							<span class="tabular-nums">({selected().length})</span>
						</Show>
						<PaperPlaneRightIcon />
					</Button>
				</div>
			</div>
		</ResponsiveDialog>
	);
};
