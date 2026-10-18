import { Button, ListGroup, SearchField, Skeleton } from "@colibri-social/ui";
import { EmojiFunnyCircleIcon } from "@solar-icons/solid/bold/emoji-funny-circle";
import { createMemo, createSignal, For, Show } from "solid-js";
import { packEmoji, ungroupedEmoji } from "../../../data/emoji";
import { useData } from "../../../data/store";
import type { Platform } from "../../../screen/platform";
import {
	createEmojiOptions,
	createEmojiUploader,
	EmojiRows,
	matchesQuery,
} from "../../admin/emoji/emoji-shared";
import { useSettingsNav } from "../nav";
import {
	OWN_EMOJI_DELETE_DESCRIPTION,
	ownEmoji,
	setEditingPack,
} from "./own-emoji";

export default function EmojiPacksPage(_props: { platform: Platform }) {
	const data = useData();
	const nav = useSettingsNav();
	const owner = ownEmoji(data);
	const [query, setQuery] = createSignal("");
	const uploader = createEmojiUploader(owner);
	const options = createEmojiOptions(owner, {
		deleteDescription: OWN_EMOJI_DELETE_DESCRIPTION,
	});

	const ungrouped = createMemo(() => {
		const current = owner.view();
		if (!current) return [];
		return ungroupedEmoji(current).filter((emoji) =>
			matchesQuery(emoji, query()),
		);
	});
	const packs = createMemo(() => {
		const current = owner.view();
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
		!owner.loading() &&
		(owner.view()?.emojis.length ?? 0) === 0 &&
		(owner.view()?.packs.length ?? 0) === 0;
	const noMatches = () =>
		!empty() &&
		query().trim().length > 0 &&
		ungrouped().length === 0 &&
		packs().length === 0;

	const openPack = (pack?: string) => {
		setEditingPack(pack);
		nav.open("emojiPack");
	};

	return (
		<div class="flex flex-col gap-6">
			<p class="m-0 text-sm text-muted-foreground">
				Emoji you add from Spaces or upload yourself. You can use them in any
				Space that allows emoji from elsewhere.
			</p>
			<div class="grid grid-cols-2 gap-4">
				<uploader.Picker>
					{(pick) => (
						<Button block onClick={pick}>
							Upload Emoji
						</Button>
					)}
				</uploader.Picker>
				<Button variant="secondary" block onClick={() => openPack()}>
					Create new Pack
				</Button>
			</div>
			<Show when={!empty()}>
				<SearchField
					aria-label="Search your emoji"
					placeholder="Search your emoji"
					value={query()}
					onChange={setQuery}
				/>
			</Show>
			<Show
				when={!owner.loading()}
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
							<ListGroup label="Ungrouped">
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
										aria-label={`Edit ${section.pack.name}`}
										onClick={() => openPack(section.pack.id)}
									>
										Edit Pack
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
