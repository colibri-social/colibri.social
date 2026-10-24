import { Popover as KobaltePopover } from "@kobalte/core/popover";
import { GalleryAddIcon } from "@solar-icons/solid/bold/gallery-add";
import { MinusCircleIcon } from "@solar-icons/solid/bold/minus-circle";
import { PenIcon } from "@solar-icons/solid/bold/pen";
import { TrashBinTrashIcon } from "@solar-icons/solid/bold/trash-bin-trash";
import { ArrowLeftIcon } from "@solar-icons/solid/linear/arrow-left";
import {
	createEffect,
	createMemo,
	createSignal,
	For,
	type JSX,
	Match,
	on,
	Show,
	Switch,
} from "solid-js";
import { cx } from "../../utils/cx";
import { createDirtyGuard } from "../../utils/dirty-guard";
import { revealLayer, topLayerAttrs } from "../../utils/nested-layers";
import { usePopperOverflowPadding } from "../../utils/safe-area";
import { Button } from "../Button/Button";
import { Drawer, DrawerContent } from "../Drawer/Drawer";
import { IconButton } from "../IconButton/IconButton";
import { DestructiveRow, ListGroup, NavRow } from "../List/List";
import { DiscardChangesDialog, Modal, ModalContent } from "../Modal/Modal";
import { TextField } from "../TextField/TextField";
import {
	EMOJI_NAME_MAX,
	emojiNameError,
	normalizeEmojiName,
} from "./emoji-name";

export type EmojiDrawerView = "actions" | "rename";

export type EmojiDrawerProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	name: string;
	src: string;
	packName?: string;
	initialView?: EmojiDrawerView;
	renameTitle?: string;
	renameLabel?: string;
	takenNames?: ReadonlySet<string>;
	onRename?: (name: string) => Promise<void> | void;
	onRemoveFromPack?: () => void;
	onDelete?: () => void;
};

const EmojiHeader = (props: {
	name: string;
	src: string;
	subtitle?: string;
	onBack?: () => void;
}) => (
	<div data-emoji-drawer-header="" class="flex min-w-0 items-center gap-2">
		<Show when={props.onBack}>
			<IconButton
				variant="ghost"
				size="md"
				label="Back to emoji options"
				icon={<ArrowLeftIcon />}
				onClick={() => props.onBack?.()}
				class="-ml-1.5 [&_svg]:size-5"
			/>
		</Show>
		<img
			src={props.src}
			alt=""
			draggable={false}
			class="size-8 shrink-0 object-contain"
		/>
		<span class="flex min-w-0 flex-1 flex-col gap-0.5">
			<span class="min-w-0 truncate text-lg leading-6 font-bold">
				{`:${props.name}:`}
			</span>
			<Show when={props.subtitle}>
				{(subtitle) => (
					<span class="min-w-0 truncate text-sm text-muted-foreground">
						{subtitle()}
					</span>
				)}
			</Show>
		</span>
	</div>
);

const createEmojiEditor = (props: EmojiDrawerProps) => {
	const [view, setView] = createSignal<EmojiDrawerView>("actions");
	const [draft, setDraft] = createSignal("");
	const [touched, setTouched] = createSignal(false);
	const [busy, setBusy] = createSignal(false);
	const [failed, setFailed] = createSignal(false);

	const open = createMemo(() => props.open);
	createEffect(
		on(open, (isOpen) => {
			if (!isOpen) return;
			const initial = props.initialView ?? "actions";
			setView(initial);
			setDraft(props.name);
			setTouched(false);
			setBusy(false);
			setFailed(false);
		}),
	);

	const taken = () => {
		const names = new Set(props.takenNames ?? []);
		names.delete(props.name);
		return names;
	};
	const error = () =>
		touched() || draft() !== props.name
			? emojiNameError(draft(), taken())
			: undefined;
	const directRename = () => props.initialView === "rename";
	const back = (event: KeyboardEvent) => {
		if (view() === "actions" || directRename()) return;
		event.preventDefault();
		event.stopPropagation();
		setView("actions");
	};
	const run = (action?: () => void) => () => {
		props.onOpenChange(false);
		action?.();
	};
	const rename = async () => {
		setTouched(true);
		if (error() || busy()) return;
		const next = normalizeEmojiName(draft());
		if (next === props.name && !directRename()) {
			props.onOpenChange(false);
			return;
		}
		setBusy(true);
		setFailed(false);
		try {
			await props.onRename?.(next);
			props.onOpenChange(false);
		} catch {
			setFailed(true);
		} finally {
			setBusy(false);
		}
	};
	const dirty = () =>
		props.open &&
		view() === "rename" &&
		!busy() &&
		(directRename() || normalizeEmojiName(draft()) !== props.name);
	const discardDescription = () =>
		directRename()
			? "This emoji won't be uploaded."
			: "The new name won't be saved.";
	const title = () => props.renameTitle ?? "Rename emoji";
	const label = () =>
		view() === "rename" ? title() : `:${props.name}: options`;

	const header = () => (
		<EmojiHeader
			name={
				view() === "rename"
					? normalizeEmojiName(draft()) || props.name
					: props.name
			}
			src={props.src}
			subtitle={view() === "rename" ? title() : props.packName}
			onBack={
				view() === "rename" && !directRename()
					? () => setView("actions")
					: undefined
			}
		/>
	);

	const renameForm = () => (
		<form
			data-emoji-rename=""
			class="flex flex-col gap-4"
			onSubmit={(event) => {
				event.preventDefault();
				void rename();
			}}
		>
			<TextField
				label="Name"
				description="Type it between colons to use it, like :party_parrot:."
				value={draft()}
				onChange={(value) => {
					setDraft(value);
					setFailed(false);
				}}
				maxLength={EMOJI_NAME_MAX + 2}
				error={
					error() ??
					(failed() ? "Couldn't save the emoji. Try again." : undefined)
				}
			/>
			<Button type="submit" block loading={busy()} disabled={!!error()}>
				{props.renameLabel ?? "Save"}
			</Button>
		</form>
	);

	return {
		view,
		setView,
		back,
		run,
		header,
		renameForm,
		label,
		dirty,
		discardDescription,
	};
};

export const EmojiDrawer = (props: EmojiDrawerProps) => {
	const editor = createEmojiEditor(props);

	return (
		<Drawer
			open={props.open}
			onOpenChange={props.onOpenChange}
			initialFocus="content"
			dirty={editor.dirty()}
			discardDescription={editor.discardDescription()}
		>
			<DrawerContent
				aria-label={editor.label()}
				onEscapeKeyDown={editor.back}
				header={editor.header()}
			>
				<Switch>
					<Match when={editor.view() === "rename"}>{editor.renameForm()}</Match>
					<Match when={editor.view() === "actions"}>
						<Show when={props.onRename || props.onRemoveFromPack}>
							<ListGroup>
								<Show when={props.onRename}>
									<NavRow
										icon={<PenIcon />}
										label="Rename emoji"
										onClick={() => editor.setView("rename")}
									/>
								</Show>
								<Show when={props.onRemoveFromPack}>
									<NavRow
										icon={<MinusCircleIcon />}
										label="Remove from pack"
										onClick={editor.run(props.onRemoveFromPack)}
									/>
								</Show>
							</ListGroup>
						</Show>
						<Show when={props.onDelete}>
							<ListGroup>
								<DestructiveRow
									icon={<TrashBinTrashIcon />}
									label="Delete emoji"
									onClick={editor.run(props.onDelete)}
								/>
							</ListGroup>
						</Show>
					</Match>
				</Switch>
			</DrawerContent>
		</Drawer>
	);
};

export const EMOJI_POPOVER_WIDTH = 288;

const PopoverRow = (props: {
	icon: JSX.Element;
	label: string;
	tone?: "destructive";
	onClick: () => void;
}) => (
	<button
		type="button"
		data-emoji-popover-row=""
		onClick={() => props.onClick()}
		class={cx(
			"focus-ring flex h-8 w-full shrink-0 cursor-pointer items-center gap-2 rounded-control-sm border-0 bg-transparent px-2 text-left text-sm font-semibold",
			props.tone === "destructive"
				? "text-destructive hover:bg-[color-mix(in_srgb,var(--destructive)_14%,transparent)]"
				: "text-foreground hover:bg-popover-highlight",
		)}
	>
		<span
			aria-hidden="true"
			class={cx(
				"flex size-4 shrink-0 items-center justify-center [&>svg]:size-4",
				props.tone === "destructive"
					? "text-destructive"
					: "text-muted-foreground",
			)}
		>
			{props.icon}
		</span>
		<span class="min-w-0 flex-1 truncate">{props.label}</span>
	</button>
);

export type EmojiPopoverProps = EmojiDrawerProps & {
	anchor?: HTMLElement;
};

export const EmojiPopover = (props: EmojiPopoverProps) => {
	const editor = createEmojiEditor(props);
	const guard = createDirtyGuard();
	guard.register({ dirty: editor.dirty });
	createEffect(
		on(
			() => props.open,
			(isOpen) => {
				if (!isOpen) guard.keep();
			},
		),
	);
	const change = (next: boolean) => {
		if (next) props.onOpenChange(true);
		else guard.attempt(() => props.onOpenChange(false));
	};
	const overflowPadding = usePopperOverflowPadding(16);
	let lastRect: DOMRect | undefined;
	const anchorRect = (anchor?: HTMLElement) => {
		const rect = anchor?.isConnected
			? anchor.getBoundingClientRect()
			: undefined;
		if (rect && (rect.width > 0 || rect.height > 0)) lastRect = rect;
		return lastRect;
	};

	return (
		<KobaltePopover
			open={props.open}
			onOpenChange={change}
			anchorRef={() => props.anchor}
			getAnchorRect={anchorRect}
			placement="bottom-end"
			gutter={4}
			modal={false}
			overflowPadding={overflowPadding()}
		>
			<KobaltePopover.Portal>
				<KobaltePopover.Content
					{...topLayerAttrs}
					ref={revealLayer}
					aria-label={editor.label()}
					data-emoji-popover=""
					onEscapeKeyDown={editor.back}
					onCloseAutoFocus={(event: Event) => {
						if (!props.anchor?.isConnected) return;
						event.preventDefault();
						props.anchor.focus();
					}}
					class={cx(
						"modal-motion z-50 flex max-w-[calc(100vw-32px)] flex-col gap-3 rounded-surface border border-border bg-popover p-4 text-foreground shadow-overlay outline-none",
						"origin-(--kb-popover-content-transform-origin)",
					)}
					style={{ width: `${EMOJI_POPOVER_WIDTH}px` }}
				>
					{editor.header()}
					<Switch>
						<Match when={editor.view() === "rename"}>
							{editor.renameForm()}
						</Match>
						<Match when={editor.view() === "actions"}>
							<div class="-mx-2 -mb-2 flex flex-col">
								<Show when={props.onRename}>
									<PopoverRow
										icon={<PenIcon />}
										label="Rename emoji"
										onClick={() => editor.setView("rename")}
									/>
								</Show>
								<Show when={props.onRemoveFromPack}>
									<PopoverRow
										icon={<MinusCircleIcon />}
										label="Remove from pack"
										onClick={editor.run(props.onRemoveFromPack)}
									/>
								</Show>
								<Show
									when={
										props.onDelete && (props.onRename || props.onRemoveFromPack)
									}
								>
									<div aria-hidden="true" class="mx-2 my-1 h-px bg-border" />
								</Show>
								<Show when={props.onDelete}>
									<PopoverRow
										icon={<TrashBinTrashIcon />}
										label="Delete emoji"
										tone="destructive"
										onClick={editor.run(props.onDelete)}
									/>
								</Show>
							</div>
						</Match>
					</Switch>
				</KobaltePopover.Content>
			</KobaltePopover.Portal>
			<DiscardChangesDialog
				guard={guard}
				description={editor.discardDescription()}
			/>
		</KobaltePopover>
	);
};

export type EmojiUploadStep = "image" | "name" | "review";

const UPLOAD_STEPS: readonly { id: EmojiUploadStep; label: string }[] = [
	{ id: "image", label: "Image" },
	{ id: "name", label: "Name" },
	{ id: "review", label: "Review" },
];

export type EmojiUploadModalProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	src?: string;
	suggestedName: string;
	takenNames?: ReadonlySet<string>;
	packName?: string;
	imageHint?: string;
	onPickImage: () => void;
	onUpload: (name: string) => Promise<void> | void;
};

export const EmojiUploadModal = (props: EmojiUploadModalProps) => {
	const [step, setStep] = createSignal<EmojiUploadStep>("image");
	const [draft, setDraft] = createSignal("");
	const [edited, setEdited] = createSignal(false);
	const [busy, setBusy] = createSignal(false);
	const [failed, setFailed] = createSignal(false);

	createEffect(
		on(
			() => props.open,
			(isOpen) => {
				if (!isOpen) return;
				setStep("image");
				setDraft(props.suggestedName);
				setEdited(false);
				setBusy(false);
				setFailed(false);
			},
		),
	);
	createEffect(
		on(
			() => props.suggestedName,
			(name) => {
				if (!edited()) setDraft(name);
			},
		),
	);

	const index = () => UPLOAD_STEPS.findIndex((entry) => entry.id === step());
	const name = () => normalizeEmojiName(draft());
	const error = () => emojiNameError(draft(), new Set(props.takenNames ?? []));
	const canContinue = () => {
		if (step() === "image") return !!props.src;
		if (step() === "name") return !error();
		return !busy();
	};
	const next = async () => {
		if (!canContinue()) return;
		if (step() === "image") return void setStep("name");
		if (step() === "name") return void setStep("review");
		setBusy(true);
		setFailed(false);
		try {
			await props.onUpload(name());
			props.onOpenChange(false);
		} catch {
			setFailed(true);
		} finally {
			setBusy(false);
		}
	};
	const back = () => {
		if (step() === "review") setStep("name");
		else if (step() === "name") setStep("image");
	};

	return (
		<Modal
			open={props.open}
			onOpenChange={(next) => {
				if (!next && busy()) return;
				props.onOpenChange(next);
			}}
			dirty={!busy() && (step() !== "image" || edited())}
		>
			<ModalContent
				title="Upload emoji"
				class="md:w-[440px]"
				footer={
					<>
						<Show when={step() !== "image"}>
							<Button variant="secondary" disabled={busy()} onClick={back}>
								Back
							</Button>
						</Show>
						<Button
							disabled={!canContinue()}
							loading={busy()}
							onClick={() => void next()}
						>
							{step() === "review" ? "Upload emoji" : "Next"}
						</Button>
					</>
				}
			>
				<div data-emoji-upload={step()} class="flex flex-col gap-4">
					<ol
						aria-label="Steps"
						class="m-0 grid list-none grid-cols-3 gap-2 p-0"
					>
						<For each={UPLOAD_STEPS}>
							{(entry, position) => (
								<li
									aria-current={entry.id === step() ? "step" : undefined}
									class="flex min-w-0 flex-col gap-1.5"
								>
									<span
										aria-hidden="true"
										class={cx(
											"h-1 rounded-full",
											position() <= index() ? "bg-primary" : "bg-secondary",
										)}
									/>
									<span
										class={cx(
											"truncate text-xs font-semibold",
											entry.id === step()
												? "text-foreground"
												: "text-muted-foreground",
										)}
									>
										{`${position() + 1}. ${entry.label}`}
									</span>
								</li>
							)}
						</For>
					</ol>
					<Switch>
						<Match when={step() === "image"}>
							<div class="flex items-center gap-4">
								<span class="flex size-20 shrink-0 items-center justify-center rounded-control bg-secondary">
									<Show
										when={props.src}
										fallback={
											<GalleryAddIcon
												aria-hidden="true"
												class="size-8 text-muted-foreground"
											/>
										}
									>
										{(src) => (
											<img
												src={src()}
												alt="Emoji preview"
												draggable={false}
												class="size-14 object-contain"
											/>
										)}
									</Show>
								</span>
								<div class="flex min-w-0 flex-col items-start gap-2">
									<Button
										variant="secondary"
										onClick={() => props.onPickImage()}
									>
										{props.src ? "Choose a different image" : "Choose image"}
									</Button>
									<Show when={props.imageHint}>
										<p class="m-0 text-xs leading-prose text-pretty text-muted-foreground">
											{props.imageHint}
										</p>
									</Show>
								</div>
							</div>
						</Match>
						<Match when={step() === "name"}>
							<form
								data-emoji-rename=""
								onSubmit={(event) => {
									event.preventDefault();
									void next();
								}}
							>
								<TextField
									label="Name"
									description="Type it between colons to use it, like :party_parrot:."
									value={draft()}
									onChange={(value) => {
										setDraft(value);
										setEdited(true);
									}}
									maxLength={EMOJI_NAME_MAX + 2}
									error={error()}
								/>
							</form>
						</Match>
						<Match when={step() === "review"}>
							<div data-emoji-upload-review="" class="flex flex-col gap-3">
								<div class="flex min-w-0 items-center gap-3 rounded-control bg-secondary p-3">
									<Show when={props.src}>
										{(src) => (
											<img
												src={src()}
												alt=""
												draggable={false}
												class="size-8 shrink-0 object-contain"
											/>
										)}
									</Show>
									<span class="min-w-0 truncate text-base font-bold">{`:${name()}:`}</span>
								</div>
								<p class="m-0 text-sm leading-prose text-pretty text-muted-foreground">
									{props.packName
										? `It's added to ${props.packName}.`
										: "It's added to this Space without a pack."}
								</p>
								<Show when={failed()}>
									<p role="alert" class="m-0 text-sm text-destructive">
										Couldn't upload the emoji. Try again.
									</p>
								</Show>
							</div>
						</Match>
					</Switch>
				</div>
			</ModalContent>
		</Modal>
	);
};
