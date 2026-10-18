import {
	EMOJI_PACK_NAME_MAX,
	ListGroup,
	TextField,
	toast,
} from "@colibri-social/ui";
import { createMemo, createSignal, For, Show } from "solid-js";
import {
	type EmojiCatalogView,
	type EmojiPackView,
	type EmojiView,
	packEmoji,
	ungroupedEmoji,
} from "../../../data/emoji";
import {
	createEmojiUploader,
	type EmojiOwner,
	EmojiRows,
	emojiFailure,
	matchesQuery,
} from "../emoji/emoji-shared";

export type EmojiCatalogOwner = EmojiOwner & {
	view: () => EmojiCatalogView | undefined;
	loading: () => boolean;
};

export type SelectSection = { id: string; label: string; emojis: EmojiView[] };

export const packNameError = (value: string) => {
	const name = value.trim();
	if (!name) return "Give the pack a name.";
	if (name.length > EMOJI_PACK_NAME_MAX)
		return `Use at most ${EMOJI_PACK_NAME_MAX} characters.`;
	return undefined;
};

export const createPackEditor = (
	owner: EmojiCatalogOwner,
	options: {
		packId: () => string | undefined;
		onCreated: () => void;
		onDeleted: () => void;
	},
) => {
	const creating = !options.packId();
	const pack = createMemo<EmojiPackView | undefined>(() => {
		const id = options.packId();
		return id
			? owner.view()?.packs.find((entry) => entry.id === id)
			: undefined;
	});
	const gone = () => !creating && !owner.loading() && !!owner.view() && !pack();
	const [draft, setDraft] = createSignal<string>();
	const name = () => draft() ?? pack()?.name ?? "";
	const [attempted, setAttempted] = createSignal(false);
	const [picked, setPicked] = createSignal<ReadonlySet<string>>(new Set());
	const [added, setAdded] = createSignal<readonly string[]>([]);
	const [removed, setRemoved] = createSignal<ReadonlySet<string>>(new Set());
	const [query, setQuery] = createSignal("");
	const [saving, setSaving] = createSignal(false);
	const [deleteOpen, setDeleteOpen] = createSignal(false);

	const liveMembers = () => pack()?.emojis ?? [];

	const nextMembers = createMemo(() => {
		const live = liveMembers();
		const known = new Set(owner.view()?.emojis.map((emoji) => emoji.id));
		const kept = live.filter((id) => !removed().has(id));
		return [
			...kept,
			...added().filter((id) => known.has(id) && !live.includes(id)),
		];
	});

	const selected = createMemo<ReadonlySet<string>>(() =>
		creating ? picked() : new Set(nextMembers()),
	);

	const membersChanged = createMemo(() => {
		const live = new Set(liveMembers());
		const next = nextMembers();
		return next.length !== live.size || next.some((id) => !live.has(id));
	});

	const toggle = (emoji: EmojiView, next: boolean) => {
		if (creating) {
			setPicked((current) => {
				const copy = new Set(current);
				if (next) copy.add(emoji.id);
				else copy.delete(emoji.id);
				return copy;
			});
			return;
		}
		const member = liveMembers().includes(emoji.id);
		setRemoved((current) => {
			const copy = new Set(current);
			if (member && !next) copy.add(emoji.id);
			else copy.delete(emoji.id);
			return copy;
		});
		setAdded((current) => {
			const rest = current.filter((id) => id !== emoji.id);
			return !member && next ? [...rest, emoji.id] : rest;
		});
	};

	const uploader = createEmojiUploader(owner, {
		pack: () => (creating ? undefined : pack()?.id),
		packName: () => (creating ? name() || "the new pack" : pack()?.name),
		onUploaded: (emoji) => {
			if (creating) toggle(emoji, true);
		},
	});

	const sections = createMemo((): SelectSection[] => {
		const view = owner.view();
		if (!view) return [];
		const filter = (list: EmojiView[]) =>
			list.filter((emoji) => matchesQuery(emoji, query()));
		const packSection = (entry: EmojiPackView): SelectSection => ({
			id: entry.id,
			label: entry.name,
			emojis: filter(packEmoji(view, entry)),
		});
		const editing = pack();
		return [
			...(editing ? [packSection(editing)] : []),
			{
				id: "ungrouped",
				label: "Ungrouped",
				emojis: filter(ungroupedEmoji(view)),
			},
			...view.packs
				.filter((entry) => entry.id !== editing?.id)
				.map(packSection),
		].filter((section) => section.emojis.length > 0);
	});

	const nameError = () => (attempted() ? packNameError(name()) : undefined);
	const renamed = () => name().trim() !== (pack()?.name ?? "");
	const dirty = createMemo(() =>
		creating
			? name().trim().length > 0 || selected().size > 0
			: renamed() || membersChanged(),
	);
	const canSave = () =>
		!saving() && !packNameError(name()) && (creating || dirty());

	const reset = () => {
		setDraft(undefined);
		setAttempted(false);
		setAdded([]);
		setRemoved(new Set<string>());
	};

	const save = async () => {
		setAttempted(true);
		const current = owner.owner();
		if (!current || packNameError(name()) || saving()) return;
		if (!creating && !dirty()) return;
		setSaving(true);
		try {
			if (creating) {
				await owner.data.emoji.createPack(current, name().trim(), [
					...selected(),
				]);
				toast.success(`${name().trim()} created`);
				options.onCreated();
			} else {
				const target = pack();
				if (!target) return;
				await owner.data.emoji.updatePack({
					community: current,
					pack: target.id,
					...(renamed() ? { name: name().trim() } : {}),
					...(membersChanged() ? { emojis: nextMembers() } : {}),
				});
				reset();
				toast.success("Pack saved");
			}
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
		const current = owner.owner();
		const target = pack();
		if (!current || !target) return;
		try {
			await owner.data.emoji.removePack(current, target.id);
			toast.success(`${target.name} deleted`);
			options.onDeleted();
		} catch (error) {
			toast.error(emojiFailure(error, "Couldn't delete the pack"));
		}
	};

	return {
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
		sections,
		saving,
		dirty,
		canSave,
		save,
		reset,
		deleteOpen,
		setDeleteOpen,
		removePack,
	};
};

export type PackEditor = ReturnType<typeof createPackEditor>;

export const PackNameField = (props: { editor: PackEditor }) => (
	<TextField
		label="Pack Name"
		placeholder="My Awesome Pack"
		value={props.editor.name()}
		onChange={props.editor.setName}
		maxLength={EMOJI_PACK_NAME_MAX}
		error={props.editor.nameError()}
	/>
);

const Hint = (props: { text: string }) => (
	<p class="m-0 py-4 text-center text-sm text-muted-foreground">{props.text}</p>
);

export const PackEmojis = (props: {
	owner: EmojiOwner;
	editor: PackEditor;
}) => {
	const searched = () => props.editor.query().trim();
	return (
		<Show
			when={props.editor.sections().length > 0}
			fallback={
				<Hint
					text={
						searched()
							? `No emoji match "${searched()}".`
							: props.editor.creating
								? "Upload an emoji to start this pack."
								: "Upload an emoji to add it to this pack."
					}
				/>
			}
		>
			<div class="flex flex-col gap-6">
				<For each={props.editor.sections()}>
					{(section) => (
						<ListGroup label={section.label}>
							<EmojiRows
								admin={props.owner}
								emojis={section.emojis}
								selected={props.editor.selected()}
								onSelectedChange={props.editor.toggle}
							/>
						</ListGroup>
					)}
				</For>
			</div>
		</Show>
	);
};
