import {
	ConfirmDialog,
	copyText,
	EmojiDrawer,
	type EmojiDrawerProps,
	EmojiPopover,
	EmojiRow,
	EmojiUploadModal,
	emojiNameFromFile,
	emojiPackShareUrl,
	ProfileImagePicker,
	toast,
	uniqueEmojiName,
} from "@colibri-social/ui";
import {
	type Component,
	createMemo,
	createSignal,
	For,
	type JSX,
	onCleanup,
	Show,
} from "solid-js";
import {
	DEFAULT_EMOJI_PROVIDER,
	EMOJI_PERMISSION,
	EmojiError,
	type EmojiPackView,
	type EmojiView,
	emojiRegistry,
} from "../../../data/emoji";
import { packTargetOf } from "../../../data/emoji/shared-pack";
import type { DataStore } from "../../../data/store";
import type { Did } from "../../../data/types";
import { usePlatform } from "../../../screen/platform";
import { afterOverlaysClose } from "../../channel/composer/media/composer-media";
import { afterClosed, EMOJI_POPOVER_SELECTOR } from "../desktop/after-closed";
import { canInSpace, useAdminSpace } from "../space-admin";

export const copyPackLink = async (packId: string) => {
	if (await copyText(emojiPackShareUrl(packTargetOf(packId))))
		toast.success("Pack link copied");
	else toast.error("The pack link couldn't be copied");
};

export const EMOJI_MAX_BYTES =
	emojiRegistry.get(DEFAULT_EMOJI_PROVIDER)?.maxImageBytes ?? 0;

export const emojiFailure = (error: unknown, fallback: string) => {
	if (error instanceof EmojiError) {
		if (error.code === "NameTaken") return "That name is already taken.";
		if (error.code === "Forbidden")
			return "You don't have permission to manage emoji here.";
		if (error.code === "UploadFailed") return "Couldn't upload the image.";
		if (error.code === "ImageTooLarge")
			return `That image is too big. Emoji can be up to ${Math.floor(EMOJI_MAX_BYTES / 1000)} KB.`;
		if (error.code === "UnsupportedImage")
			return "That file isn't a supported image. Use a PNG, WebP or GIF.";
		if (error.code === "InvalidName")
			return "Names can use lowercase letters, numbers and underscores.";
	}
	return fallback;
};

export const useEmojiAdmin = (space: string) => {
	const admin = useAdminSpace(space);
	const catalog = createMemo(() => {
		const current = admin.community();
		return current ? admin.data.emoji.catalog(current.did) : undefined;
	});
	const members = createMemo(() => {
		const current = admin.community();
		return current ? admin.data.space(current).members : undefined;
	});
	const view = () => catalog()?.value();
	const canManage = () => canInSpace(admin.community(), EMOJI_PERMISSION);
	const takenNames = createMemo(
		() => new Set((view()?.emojis ?? []).map((emoji) => emoji.name)),
	);
	const uploaderOf = (emoji: EmojiView) => {
		if (!emoji.createdBy) return undefined;
		const member = members()
			?.value()
			?.find((entry) => entry.actor.did === emoji.createdBy);
		if (!member) return undefined;
		return { handle: member.actor.handle, avatar: member.actor.avatar };
	};
	return {
		...admin,
		owner: () => admin.community()?.did,
		catalog,
		view,
		loading: () => catalog()?.loading() ?? true,
		canManage,
		takenNames,
		uploaderOf,
	};
};

export type EmojiAdmin = ReturnType<typeof useEmojiAdmin>;

export type EmojiOwner = {
	owner: () => Did | undefined;
	data: DataStore;
	takenNames: () => ReadonlySet<string>;
	uploaderOf: (
		emoji: EmojiView,
	) => { handle: string; avatar?: string } | undefined;
};

export const matchesQuery = (emoji: EmojiView, query: string) => {
	const needle = query
		.trim()
		.toLowerCase()
		.replace(/^:+|:+$/g, "");
	return !needle || emoji.name.includes(needle);
};

const focusedAnchor = () =>
	document.activeElement instanceof HTMLElement &&
	document.activeElement !== document.body
		? document.activeElement
		: undefined;

const EmojiEditor = (
	props: EmojiDrawerProps & { anchor?: HTMLElement },
): JSX.Element => {
	const platform = usePlatform();
	return (
		<Show when={platform() === "desktop"} fallback={<EmojiDrawer {...props} />}>
			<EmojiPopover {...props} />
		</Show>
	);
};

export const createEmojiUploader = (
	admin: EmojiOwner,
	options: {
		pack?: () => string | undefined;
		packName?: () => string | undefined;
		onUploaded?: (emoji: EmojiView) => void;
	} = {},
) => {
	const platform = usePlatform();
	const [modalOpen, setModalOpen] = createSignal(false);
	let openFile: (() => void) | undefined;
	const [file, setFile] = createSignal<File>();
	const [preview, setPreview] = createSignal<string>();
	const [suggested, setSuggested] = createSignal("");
	const [open, setOpen] = createSignal(false);
	const release = () => {
		const url = preview();
		if (url) URL.revokeObjectURL(url);
	};
	onCleanup(release);

	const accept = (next: File) => {
		release();
		setFile(next);
		setPreview(URL.createObjectURL(next));
		setSuggested(
			uniqueEmojiName(emojiNameFromFile(next.name), admin.takenNames()),
		);
		if (platform() !== "desktop") setOpen(true);
	};

	const upload = async (name: string) => {
		const current = admin.owner();
		const picked = file();
		if (!current || !picked) return;
		try {
			const emoji = await admin.data.emoji.upload({
				community: current,
				name,
				file: picked,
				pack: options.pack?.(),
			});
			toast.success(`:${emoji.name}: added`);
			options.onUploaded?.(emoji);
		} catch (error) {
			toast.error(emojiFailure(error, "Couldn't upload the emoji"));
			throw error;
		}
	};

	const Picker = (props: {
		children: (pick: (event?: MouseEvent) => void) => JSX.Element;
	}) => (
		<>
			<ProfileImagePicker
				maxBytes={EMOJI_MAX_BYTES}
				crop="emoji"
				platform={usePlatform()()}
				onFile={accept}
				onError={(message) => {
					if (message) toast.error(message);
				}}
			>
				{(pick) => {
					openFile = pick;
					return props.children(() => {
						if (platform() !== "desktop") {
							pick();
							return;
						}
						release();
						setFile(undefined);
						setPreview(undefined);
						setSuggested("");
						setModalOpen(true);
					});
				}}
			</ProfileImagePicker>
			<EmojiUploadModal
				open={modalOpen()}
				onOpenChange={setModalOpen}
				src={preview()}
				suggestedName={suggested()}
				takenNames={admin.takenNames()}
				packName={options.packName?.()}
				imageHint="Square images work best. Bigger ones are scaled down to fit."
				onPickImage={() => openFile?.()}
				onUpload={upload}
			/>
			<Show when={platform() !== "desktop" && preview()}>
				{(src) => (
					<EmojiDrawer
						open={open()}
						onOpenChange={setOpen}
						name={suggested()}
						src={src()}
						initialView="rename"
						renameTitle="Name your emoji"
						renameLabel="Upload emoji"
						takenNames={admin.takenNames()}
						onRename={upload}
					/>
				)}
			</Show>
		</>
	);

	return { Picker };
};

export const createEmojiOptions = (
	admin: EmojiOwner,
	options: {
		pack?: () => EmojiPackView | undefined;
		onRemoveFromPack?: (emoji: EmojiView) => Promise<void>;
		deleteDescription?: string;
	} = {},
) => {
	const [target, setTarget] = createSignal<EmojiView>();
	const [anchor, setAnchor] = createSignal<HTMLElement>();
	const [open, setOpen] = createSignal(false);
	const [confirming, setConfirming] = createSignal<EmojiView>();
	const platform = usePlatform();
	const whenEditorClosed = (run: () => void) => {
		if (platform() === "desktop") afterClosed(EMOJI_POPOVER_SELECTOR, run);
		else afterOverlaysClose(run);
	};

	const show = (emoji: EmojiView, event?: MouseEvent) => {
		setTarget(emoji);
		setAnchor(
			event?.currentTarget instanceof HTMLElement
				? event.currentTarget
				: focusedAnchor(),
		);
		setOpen(true);
	};

	const rename = async (name: string) => {
		const current = admin.owner();
		const emoji = target();
		if (!current || !emoji) return;
		try {
			await admin.data.emoji.rename(current, emoji.id, name);
		} catch (error) {
			toast.error(emojiFailure(error, "Couldn't rename the emoji"));
			throw error;
		}
	};

	const remove = async () => {
		const current = admin.owner();
		const emoji = confirming();
		if (!current || !emoji) return;
		try {
			await admin.data.emoji.remove(current, emoji.id);
			toast.success(`:${emoji.name}: deleted`);
		} catch (error) {
			toast.error(emojiFailure(error, "Couldn't delete the emoji"));
		}
	};

	const Overlay: Component = () => (
		<>
			<Show when={target()}>
				{(emoji) => (
					<EmojiEditor
						anchor={anchor()}
						open={open()}
						onOpenChange={setOpen}
						name={emoji().name}
						src={emoji().image}
						packName={options.pack?.()?.name}
						takenNames={admin.takenNames()}
						onRename={rename}
						onRemoveFromPack={
							options.onRemoveFromPack
								? () => {
										const removed = emoji();
										whenEditorClosed(
											() => void options.onRemoveFromPack?.(removed),
										);
									}
								: undefined
						}
						onDelete={() => {
							const doomed = emoji();
							whenEditorClosed(() => setConfirming(doomed));
						}}
					/>
				)}
			</Show>
			<ConfirmDialog
				open={!!confirming()}
				onOpenChange={(next) => {
					if (!next) setConfirming(undefined);
				}}
				title={`Delete :${confirming()?.name ?? ""}:?`}
				description={
					options.deleteDescription ??
					"It's removed from every pack in this Space, and messages that use it show the plain shortcode."
				}
				confirmLabel="Delete emoji"
				tone="destructive"
				onConfirm={remove}
			/>
		</>
	);

	return { show, Overlay };
};

export const EmojiRows = (props: {
	admin: EmojiOwner;
	emojis: readonly EmojiView[];
	onMenu?: (emoji: EmojiView, event?: MouseEvent) => void;
	selected?: ReadonlySet<string>;
	onSelectedChange?: (emoji: EmojiView, selected: boolean) => void;
}) => (
	<For each={props.emojis}>
		{(emoji) => (
			<EmojiRow
				name={emoji.name}
				src={emoji.image}
				uploader={props.admin.uploaderOf(emoji)}
				onMenu={
					props.onMenu ? (event) => props.onMenu?.(emoji, event) : undefined
				}
				selectable={!!props.selected}
				selected={props.selected?.has(emoji.id)}
				onSelectedChange={(next) => props.onSelectedChange?.(emoji, next)}
			/>
		)}
	</For>
);
