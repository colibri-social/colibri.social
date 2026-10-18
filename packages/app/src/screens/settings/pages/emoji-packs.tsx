import {
	Button,
	ConfirmDialog,
	ListGroup,
	SearchField,
	Skeleton,
	toast,
} from "@colibri-social/ui";
import { EmojiFunnyCircleIcon } from "@solar-icons/solid/bold/emoji-funny-circle";
import { createMemo, createSignal, For, Show } from "solid-js";
import {
	type EmojiPackView,
	packEmoji,
	ungroupedEmoji,
} from "../../../data/emoji";
import { useData } from "../../../data/store";
import type { Platform } from "../../../screen/platform";
import {
	createEmojiOptions,
	createEmojiUploader,
	type EmojiOwner,
	EmojiRows,
	emojiFailure,
	matchesQuery,
} from "../../admin/emoji/emoji-shared";

export default function EmojiPacksPage(_props: { platform: Platform }) {
	const data = useData();
	const catalog = () => data.emoji.followed();
	const view = () => catalog().value();
	const loading = () => catalog().loading() && !view();
	const [query, setQuery] = createSignal("");
	const [removing, setRemoving] = createSignal<EmojiPackView>();

	const takenNames = createMemo(
		() => new Set((view()?.emojis ?? []).map((emoji) => emoji.name)),
	);
	const owner: EmojiOwner = {
		owner: () => data.viewer.did,
		data,
		takenNames,
		uploaderOf: () => undefined,
	};
	const uploader = createEmojiUploader(owner);
	const options = createEmojiOptions(owner, {
		deleteDescription:
			"It's removed from your emoji, and messages that use it show the plain shortcode.",
	});

	const ungrouped = createMemo(() => {
		const current = view();
		if (!current) return [];
		return ungroupedEmoji(current).filter((emoji) =>
			matchesQuery(emoji, query()),
		);
	});
	const packs = createMemo(() => {
		const current = view();
		if (!current) return [];
		const searching = query().trim().length > 0;
		return current.packs
			.map((pack) => ({
				pack,
				emojis: packEmoji(current, pack).filter((emoji) =>
					matchesQuery(emoji, query()),
				),
			}))
			.filter((section) => !searching || section.emojis.length > 0);
	});
	const empty = () =>
		!loading() &&
		(view()?.emojis.length ?? 0) === 0 &&
		(view()?.packs.length ?? 0) === 0;
	const noMatches = () =>
		!empty() &&
		query().trim().length > 0 &&
		ungrouped().length === 0 &&
		packs().length === 0;

	const removePack = async () => {
		const pack = removing();
		const current = view();
		if (!pack || !current) return;
		const elsewhere = new Set(
			current.packs
				.filter((entry) => entry.id !== pack.id)
				.flatMap((entry) => entry.emojis),
		);
		try {
			await data.emoji.removePack(data.viewer.did, pack.id);
			for (const emoji of pack.emojis) {
				if (!elsewhere.has(emoji))
					await data.emoji.remove(data.viewer.did, emoji);
			}
			toast.success(`${pack.name} removed`);
		} catch (error) {
			toast.error(emojiFailure(error, "Couldn't remove the pack"));
		}
	};

	return (
		<div class="flex flex-col gap-6">
			<p class="m-0 text-sm text-muted-foreground">
				Emoji you add from Spaces or upload yourself. You can use them in any
				Space that allows emoji from elsewhere.
			</p>
			<uploader.Picker>
				{(pick) => (
					<Button block onClick={pick}>
						Upload Emoji
					</Button>
				)}
			</uploader.Picker>
			<Show when={!empty()}>
				<SearchField
					aria-label="Search your emoji"
					placeholder="Search your emoji"
					value={query()}
					onChange={setQuery}
				/>
			</Show>
			<Show
				when={!loading()}
				fallback={
					<div class="flex flex-col gap-2" aria-busy="true">
						<Skeleton class="h-4 w-24" />
						<Skeleton class="h-20 w-full rounded-control" />
					</div>
				}
			>
				<Show when={!empty()} fallback={<EmptyEmoji />}>
					<div class="flex flex-col gap-6">
						<Show when={ungrouped().length > 0}>
							<ListGroup label="Your emoji">
								<EmojiRows
									admin={owner}
									emojis={ungrouped()}
									onMenu={options.show}
								/>
							</ListGroup>
						</Show>
						<For each={packs()}>
							{(section) => (
								<div
									data-emoji-pack={section.pack.id}
									class="flex flex-col gap-2"
								>
									<Show
										when={section.emojis.length > 0}
										fallback={
											<p class="m-0 text-sm font-medium text-muted-foreground">
												{section.pack.name}
											</p>
										}
									>
										<ListGroup label={section.pack.name}>
											<EmojiRows
												admin={owner}
												emojis={section.emojis}
												onMenu={options.show}
											/>
										</ListGroup>
									</Show>
									<Button
										variant="secondary"
										block
										aria-label={`Remove ${section.pack.name}`}
										onClick={() => setRemoving(section.pack)}
									>
										Remove Pack
									</Button>
								</div>
							)}
						</For>
						<Show when={noMatches()}>
							<p class="m-0 py-6 text-center text-sm text-muted-foreground">
								{`No emoji match "${query().trim()}".`}
							</p>
						</Show>
					</div>
				</Show>
			</Show>
			<options.Overlay />
			<ConfirmDialog
				open={!!removing()}
				onOpenChange={(next) => {
					if (!next) setRemoving(undefined);
				}}
				title={`Remove ${removing()?.name ?? ""}?`}
				description="Its emoji are removed from your emoji too, unless another of your packs has them."
				confirmLabel="Remove pack"
				tone="destructive"
				onConfirm={removePack}
			/>
		</div>
	);
}

const EmptyEmoji = () => (
	<div class="flex flex-col items-center gap-2 px-6 py-10 text-center">
		<EmojiFunnyCircleIcon class="size-10 text-muted-foreground" />
		<p class="m-0 text-base font-semibold">No emoji yet</p>
		<p class="m-0 text-sm text-muted-foreground">
			Pick a custom emoji in a message to add it, or upload your own.
		</p>
	</div>
);
