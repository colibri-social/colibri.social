import {
	Button,
	ListGroup,
	SearchField,
	Skeleton,
	StatusScreen,
} from "@colibri-social/ui";
import { DangerTriangleIcon } from "@solar-icons/solid/bold/danger-triangle";
import { EmojiFunnyCircleIcon } from "@solar-icons/solid/bold/emoji-funny-circle";
import { createMemo, createSignal, For, Show } from "solid-js";
import {
	type EmojiPackView,
	type EmojiView,
	packEmoji,
	ungroupedEmoji,
} from "../../../data/emoji";
import { defineContract, slot } from "../../../screen/define";
import { NEW_ENTRY } from "../../../shell/layers";
import type { AdminArgs } from "../../../shell/registry";
import { useStack } from "../../../shell/stack";
import { AdminNavHeader } from "../desktop/page-header";
import {
	copyPackLink,
	createEmojiOptions,
	createEmojiUploader,
	EmojiRows,
	matchesQuery,
	useEmojiAdmin,
} from "./emoji-shared";

type PackSection = { pack: EmojiPackView; emojis: EmojiView[] };

export const adminEmoji = defineContract({
	id: "adminEmoji",
	model: (args: AdminArgs) => {
		const stack = useStack();
		const admin = useEmojiAdmin(args.space);
		const [query, setQuery] = createSignal("");
		const uploader = createEmojiUploader(admin);
		const options = createEmojiOptions(admin);
		const ungrouped = createMemo(() => {
			const view = admin.view();
			if (!view) return [];
			return ungroupedEmoji(view).filter((emoji) =>
				matchesQuery(emoji, query()),
			);
		});
		const packs = createMemo((): PackSection[] => {
			const view = admin.view();
			if (!view) return [];
			const searching = query().trim().length > 0;
			return view.packs
				.map((pack) => ({
					pack,
					emojis: packEmoji(view, pack).filter((emoji) =>
						matchesQuery(emoji, query()),
					),
				}))
				.filter((section) => !searching || section.emojis.length > 0);
		});
		const empty = () =>
			!admin.loading() &&
			(admin.view()?.emojis.length ?? 0) === 0 &&
			(admin.view()?.packs.length ?? 0) === 0;
		const noMatches = () =>
			!empty() &&
			query().trim().length > 0 &&
			ungrouped().length === 0 &&
			packs().length === 0;
		const openPack = (id: string) =>
			stack.push({ kind: "admin", space: args.space, page: "emoji-pack", id });
		return {
			...admin,
			query,
			setQuery,
			uploader,
			options,
			ungrouped,
			packs,
			empty,
			noMatches,
			back: () => stack.pop(),
			createPack: () => openPack(NEW_ENTRY),
			openPack,
		};
	},
	slots: {
		Header: slot((m) => (
			<AdminNavHeader
				safeTop
				kind="back"
				onNavigate={m.back}
				title="Emoji Packs"
			/>
		)),
		Missing: slot((m) => (
			<Show when={m.missing()}>
				<StatusScreen
					tone="destructive"
					icon={<DangerTriangleIcon />}
					title="This Space isn't available"
					description="It may have been deleted, or you're no longer a member."
				/>
			</Show>
		)),
		Actions: slot((m) => (
			<Show when={m.canManage()}>
				<div class="grid grid-cols-2 gap-4">
					<m.uploader.Picker>
						{(pick) => (
							<Button block onClick={pick}>
								Upload Emoji
							</Button>
						)}
					</m.uploader.Picker>
					<Button variant="secondary" block onClick={m.createPack}>
						Create new Pack
					</Button>
				</div>
			</Show>
		)),
		Search: slot((m) => (
			<Show when={!m.empty()}>
				<SearchField
					aria-label="Search emojis"
					placeholder="Search emojis"
					value={m.query()}
					onChange={m.setQuery}
				/>
			</Show>
		)),
		List: slot((m) => (
			<Show
				when={!m.loading()}
				fallback={
					<div class="flex flex-col gap-2" aria-busy="true">
						<Skeleton class="h-4 w-24" />
						<Skeleton class="h-20 w-full rounded-control" />
					</div>
				}
			>
				<Show
					when={!m.empty()}
					fallback={<EmptyEmoji manage={m.canManage()} />}
				>
					<div class="flex flex-col gap-6">
						<Show when={m.ungrouped().length > 0}>
							<ListGroup label="Ungrouped">
								<EmojiRows
									admin={m}
									emojis={m.ungrouped()}
									onMenu={m.canManage() ? m.options.show : undefined}
								/>
							</ListGroup>
						</Show>
						<For each={m.packs()}>
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
												admin={m}
												emojis={section.emojis}
												onMenu={m.canManage() ? m.options.show : undefined}
											/>
										</ListGroup>
									</Show>
									<div
										class={
											m.canManage() ? "grid grid-cols-2 gap-2" : "flex flex-col"
										}
									>
										<Show when={m.canManage()}>
											<Button
												variant="secondary"
												block
												aria-label={`Edit ${section.pack.name}`}
												onClick={() => m.openPack(section.pack.id)}
											>
												Edit Pack
											</Button>
										</Show>
										<Button
											variant="secondary"
											block
											aria-label={`Copy link to ${section.pack.name}`}
											onClick={() => void copyPackLink(section.pack.id)}
										>
											Copy Pack Link
										</Button>
									</div>
								</div>
							)}
						</For>
						<Show when={m.noMatches()}>
							<p class="m-0 py-6 text-center text-sm text-muted-foreground">
								{`No emoji match "${m.query().trim()}".`}
							</p>
						</Show>
					</div>
				</Show>
			</Show>
		)),
		Overlays: slot((m) => <m.options.Overlay />),
	},
});

const EmptyEmoji = (props: { manage: boolean }) => (
	<div class="flex flex-col items-center gap-2 px-6 py-10 text-center">
		<EmojiFunnyCircleIcon class="size-10 text-muted-foreground" />
		<p class="m-0 text-base font-semibold">No custom emoji yet</p>
		<p class="m-0 text-sm text-muted-foreground">
			{props.manage
				? "Upload an image to give this Space its own emoji. Members can use them in messages and reactions."
				: "Members who manage this Space can upload custom emoji for everyone to use."}
		</p>
	</div>
);
