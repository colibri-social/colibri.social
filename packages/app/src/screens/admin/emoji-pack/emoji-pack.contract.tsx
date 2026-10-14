import {
	Button,
	ConfirmDialog,
	EMOJI_PACK_NAME_MAX,
	ListGroup,
	SearchField,
	StatusScreen,
	TextField,
	toast,
} from "@colibri-social/ui";
import { DangerTriangleIcon } from "@solar-icons/solid/bold/danger-triangle";
import { EmojiFunnyCircleIcon } from "@solar-icons/solid/bold/emoji-funny-circle";
import { createMemo, createSignal, For, onCleanup, Show } from "solid-js";
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
	createEmojiOptions,
	createEmojiUploader,
	EmojiRows,
	emojiFailure,
	matchesQuery,
	useEmojiAdmin,
} from "../emoji/emoji-shared";

type SelectSection = { id: string; label: string; emojis: EmojiView[] };

export const packNameError = (value: string) => {
	const name = value.trim();
	if (!name) return "Give the pack a name.";
	if (name.length > EMOJI_PACK_NAME_MAX)
		return `Use at most ${EMOJI_PACK_NAME_MAX} characters.`;
	return undefined;
};

export const adminEmojiPack = defineContract({
	id: "adminEmojiPack",
	model: (args: AdminArgs) => {
		const stack = useStack();
		const admin = useEmojiAdmin(args.space);
		const creating = args.id === NEW_ENTRY || !args.id;
		const pack = createMemo<EmojiPackView | undefined>(() =>
			creating
				? undefined
				: admin.view()?.packs.find((entry) => entry.id === args.id),
		);
		const gone = () =>
			!creating && !admin.loading() && !!admin.view() && !pack();
		const [draft, setDraft] = createSignal<string>();
		const name = () => draft() ?? pack()?.name ?? "";
		const [attempted, setAttempted] = createSignal(false);
		const [selected, setSelected] = createSignal<ReadonlySet<string>>(
			new Set(),
		);
		const [query, setQuery] = createSignal("");
		const [saving, setSaving] = createSignal(false);
		const [discardOpen, setDiscardOpen] = createSignal(false);
		const [deleteOpen, setDeleteOpen] = createSignal(false);

		const toggle = (emoji: EmojiView, next: boolean) =>
			setSelected((current) => {
				const copy = new Set(current);
				if (next) copy.add(emoji.id);
				else copy.delete(emoji.id);
				return copy;
			});

		const uploader = createEmojiUploader(admin, {
			pack: () => (creating ? undefined : pack()?.id),
			packName: () => (creating ? name() || "the new pack" : pack()?.name),
			onUploaded: (emoji) => {
				if (creating) toggle(emoji, true);
			},
		});

		const options = createEmojiOptions(admin, {
			pack,
			onRemoveFromPack: async (emoji) => {
				const current = admin.community();
				const target = pack();
				if (!current || !target) return;
				try {
					await admin.data.emoji.updatePack({
						community: current.did,
						pack: target.id,
						emojis: target.emojis.filter((id) => id !== emoji.id),
					});
					toast.success(`:${emoji.name}: removed from ${target.name}`);
				} catch (error) {
					toast.error(emojiFailure(error, "Couldn't update the pack"));
				}
			},
		});

		const members = createMemo(() => {
			const view = admin.view();
			const target = pack();
			if (!view || !target) return [];
			return packEmoji(view, target).filter((emoji) =>
				matchesQuery(emoji, query()),
			);
		});

		const sections = createMemo((): SelectSection[] => {
			const view = admin.view();
			if (!view) return [];
			const filter = (list: EmojiView[]) =>
				list.filter((emoji) => matchesQuery(emoji, query()));
			return [
				{
					id: "ungrouped",
					label: "Ungrouped",
					emojis: filter(ungroupedEmoji(view)),
				},
				...view.packs.map((entry) => ({
					id: entry.id,
					label: entry.name,
					emojis: filter(packEmoji(view, entry)),
				})),
			].filter((section) => section.emojis.length > 0);
		});

		const nameError = () => (attempted() ? packNameError(name()) : undefined);
		const dirty = createMemo(() =>
			creating
				? name().trim().length > 0 || selected().size > 0
				: name().trim() !== (pack()?.name ?? ""),
		);
		const canSave = () =>
			!saving() && !packNameError(name()) && (creating || dirty());

		const depth = () =>
			stack
				.mounted()
				.findIndex(
					(layer) =>
						layer.kind === "admin" &&
						layer.page === "emoji-pack" &&
						layer.space === args.space &&
						layer.id === args.id,
				) + 1;

		onCleanup(
			stack.setPopGuard({
				get depth() {
					return depth();
				},
				blocked: () => dirty() && !saving(),
				onBlocked: () => setDiscardOpen(true),
			}),
		);

		const save = async () => {
			setAttempted(true);
			const current = admin.community();
			if (!current || packNameError(name()) || saving()) return;
			setSaving(true);
			try {
				if (creating) {
					await admin.data.emoji.createPack(current.did, name().trim(), [
						...selected(),
					]);
					toast.success(`${name().trim()} created`);
				} else {
					const target = pack();
					if (!target) return;
					await admin.data.emoji.updatePack({
						community: current.did,
						pack: target.id,
						name: name().trim(),
					});
					setDraft(undefined);
					toast.success("Pack saved");
				}
				stack.forcePop();
			} catch (error) {
				toast.error(
					emojiFailure(
						error,
						creating ? "Couldn't create the pack" : "Couldn't save the pack",
					),
				);
			} finally {
				setSaving(false);
			}
		};

		const removePack = async () => {
			const current = admin.community();
			const target = pack();
			if (!current || !target) return;
			try {
				await admin.data.emoji.removePack(current.did, target.id);
				toast.success(`${target.name} deleted`);
				stack.forcePop();
			} catch (error) {
				toast.error(emojiFailure(error, "Couldn't delete the pack"));
			}
		};

		return {
			...admin,
			creating,
			pack,
			gone,
			name,
			setName: setDraft,
			nameError,
			query,
			setQuery,
			selected,
			toggle,
			uploader,
			options,
			members,
			sections,
			saving,
			canSave,
			save,
			discardOpen,
			setDiscardOpen,
			deleteOpen,
			setDeleteOpen,
			removePack,
			back: () => stack.pop(),
			discard: () => {
				setDiscardOpen(false);
				stack.forcePop();
			},
		};
	},
	slots: {
		Header: slot((m) => (
			<AdminNavHeader
				safeTop
				kind="back"
				onNavigate={m.back}
				title={
					m.creating ? "Create new Pack" : (m.pack()?.name ?? "Emoji pack")
				}
				action={
					m.canManage() && !m.gone()
						? {
								type: "text",
								label: m.creating ? "Create" : "Save",
								onClick: () => void m.save(),
								disabled: !m.canSave(),
								loading: m.saving(),
							}
						: undefined
				}
			/>
		)),
		Unavailable: slot((m) => (
			<Show when={m.missing() || m.gone() || !m.canManage()}>
				<StatusScreen
					tone={m.missing() ? "destructive" : "neutral"}
					icon={m.missing() ? <DangerTriangleIcon /> : <EmojiFunnyCircleIcon />}
					title={
						m.missing()
							? "This Space isn't available"
							: m.gone()
								? "This pack doesn't exist anymore"
								: "You can't edit emoji packs here"
					}
					description={
						m.missing()
							? "It may have been deleted, or you're no longer a member."
							: m.gone()
								? "Someone may have deleted it."
								: "Ask someone who manages this Space to make changes."
					}
					actions={
						<Button block variant="secondary" onClick={m.back}>
							Back to emoji packs
						</Button>
					}
				/>
			</Show>
		)),
		Name: slot((m) => (
			<TextField
				label="Pack Name"
				placeholder="My Awesome Pack"
				value={m.name()}
				onChange={m.setName}
				maxLength={EMOJI_PACK_NAME_MAX}
				error={m.nameError()}
			/>
		)),
		Search: slot((m) => (
			<SearchField
				aria-label="Search emojis"
				placeholder="Search emojis"
				value={m.query()}
				onChange={m.setQuery}
			/>
		)),
		Upload: slot((m) => (
			<m.uploader.Picker>
				{(pick) => (
					<Button block onClick={pick}>
						Upload Emoji
					</Button>
				)}
			</m.uploader.Picker>
		)),
		Emojis: slot((m) => (
			<Show
				when={m.creating}
				fallback={
					<Show
						when={m.members().length > 0}
						fallback={
							<p class="m-0 py-4 text-center text-sm text-muted-foreground">
								{m.query().trim()
									? `No emoji in this pack match "${m.query().trim()}".`
									: "This pack is empty. Upload an emoji to add it here."}
							</p>
						}
					>
						<ListGroup>
							<EmojiRows
								admin={m}
								emojis={m.members()}
								onMenu={m.options.show}
							/>
						</ListGroup>
					</Show>
				}
			>
				<Show
					when={m.sections().length > 0}
					fallback={
						<p class="m-0 py-4 text-center text-sm text-muted-foreground">
							{m.query().trim()
								? `No emoji match "${m.query().trim()}".`
								: "Upload an emoji to start this pack."}
						</p>
					}
				>
					<div class="flex flex-col gap-6">
						<For each={m.sections()}>
							{(section) => (
								<ListGroup label={section.label}>
									<EmojiRows
										admin={m}
										emojis={section.emojis}
										selected={m.selected()}
										onSelectedChange={m.toggle}
									/>
								</ListGroup>
							)}
						</For>
					</div>
				</Show>
			</Show>
		)),
		Danger: slot((m) => (
			<Show when={!m.creating}>
				<Button
					variant="destructive"
					block
					onClick={() => m.setDeleteOpen(true)}
				>
					Delete Pack
				</Button>
			</Show>
		)),
		Overlays: slot((m) => (
			<>
				<m.options.Overlay />
				<ConfirmDialog
					open={m.discardOpen()}
					onOpenChange={m.setDiscardOpen}
					title="Discard changes?"
					description={
						m.creating
							? "This pack hasn't been created yet."
							: "Your changes to the pack name haven't been saved."
					}
					confirmLabel="Discard"
					tone="destructive"
					onConfirm={m.discard}
				/>
				<ConfirmDialog
					open={m.deleteOpen()}
					onOpenChange={m.setDeleteOpen}
					title={`Delete ${m.pack()?.name ?? "this pack"}?`}
					description="The emoji in it stay in this Space and move to Ungrouped unless another pack holds them."
					confirmLabel="Delete pack"
					tone="destructive"
					onConfirm={m.removePack}
				/>
			</>
		)),
	},
});
