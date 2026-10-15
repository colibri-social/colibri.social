import { Dialog, useDialogContext } from "@kobalte/core/dialog";
import { CloseIcon } from "@solar-icons/solid/bold/close";
import { ArrowLeftIcon } from "@solar-icons/solid/linear/arrow-left";
import {
	createContext,
	createEffect,
	createSignal,
	For,
	type JSX,
	on,
	type ParentProps,
	Show,
	splitProps,
	useContext,
} from "solid-js";
import { cx } from "../../utils/cx";
import {
	createDirtyGuard,
	type DirtyGuard,
	DirtyGuardContext,
} from "../../utils/dirty-guard";
import { createHeightTransition } from "../../utils/height-transition";
import {
	createNestedLayers,
	isInsideNestedLayer,
	NestedLayerContext,
} from "../../utils/nested-layers";
import { createSlot } from "../../utils/slot";
import { Button, type ButtonProps } from "../Button/Button";
import { IconButton } from "../IconButton/IconButton";

export type ModalProps = ParentProps<{
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	defaultOpen?: boolean;
	modal?: boolean;
	dirty?: boolean;
	discardDescription?: JSX.Element;
}>;

type ModalGuard = {
	guard: DirtyGuard;
	description: () => JSX.Element | undefined;
};

const ModalGuardContext = createContext<ModalGuard>();

export const Modal = (props: ModalProps) => {
	const layers = createNestedLayers();
	const guard = createDirtyGuard();
	guard.register({ dirty: () => !!props.dirty });
	const [uncontrolled, setUncontrolled] = createSignal(
		props.defaultOpen ?? false,
	);
	const open = () => props.open ?? uncontrolled();
	const commit = (next: boolean) => {
		if (props.open === undefined) setUncontrolled(next);
		props.onOpenChange?.(next);
	};
	const change = (next: boolean) => {
		if (next) {
			commit(true);
			return;
		}
		guard.attempt(() => commit(false));
	};
	createEffect(
		on(open, (isOpen) => {
			if (!isOpen) guard.keep();
		}),
	);
	return (
		<Dialog
			open={open()}
			onOpenChange={change}
			modal={props.modal ?? true}
			preventScroll
		>
			<NestedLayerContext.Provider value={layers}>
				<DirtyGuardContext.Provider value={guard}>
					<ModalGuardContext.Provider
						value={{ guard, description: () => props.discardDescription }}
					>
						{props.children}
					</ModalGuardContext.Provider>
				</DirtyGuardContext.Provider>
			</NestedLayerContext.Provider>
		</Dialog>
	);
};

const DISCARD_DESCRIPTION = "Your changes won't be saved.";

export type DiscardChangesDialogProps = {
	guard: Pick<DirtyGuard, "prompting" | "description" | "discard" | "keep">;
	description?: JSX.Element;
};

export const DiscardChangesDialog = (props: DiscardChangesDialogProps) => (
	<Modal
		open={props.guard.prompting()}
		onOpenChange={(next) => {
			if (!next) props.guard.keep();
		}}
	>
		<ModalContent
			title="Discard changes?"
			description={
				props.description ?? props.guard.description() ?? DISCARD_DESCRIPTION
			}
			footer={
				<>
					<Button variant="secondary" onClick={() => props.guard.keep()}>
						Cancel
					</Button>
					<Button variant="destructive" onClick={() => props.guard.discard()}>
						Discard changes
					</Button>
				</>
			}
		/>
	</Modal>
);

const ModalDiscardPrompt = () => {
	const owner = useContext(ModalGuardContext);
	return (
		<Show when={owner}>
			{(current) => (
				<DiscardChangesDialog
					guard={current().guard}
					description={current().description()}
				/>
			)}
		</Show>
	);
};

const useNestedLayerGuards = () => {
	const layers = useContext(NestedLayerContext);
	const guard = (event: Event & { detail?: { originalEvent?: Event } }) => {
		const target = event.detail?.originalEvent?.target ?? event.target;
		if (layers?.active() || isInsideNestedLayer(target)) event.preventDefault();
	};
	return {
		get trapFocus() {
			return !layers?.active();
		},
		onInteractOutside: guard,
		onFocusOutside: guard,
		onEscapeKeyDown: (event: KeyboardEvent) => {
			if (layers?.active()) event.preventDefault();
		},
	};
};

export const ModalTrigger = Dialog.Trigger;

export const useModalClose = () => {
	const dialog = useDialogContext();
	return () => dialog.close();
};

export const ModalClose = (props: Omit<ButtonProps, "onClick">) => {
	const close = useModalClose();
	return <Button variant="secondary" {...props} onClick={close} />;
};

const ModalCloseButton = (props: { label?: string; class?: string }) => (
	<Dialog.CloseButton
		as={(closeProps: JSX.ButtonHTMLAttributes<HTMLButtonElement>) => (
			<IconButton
				{...closeProps}
				variant="ghost"
				size="md"
				label={props.label ?? "Close"}
				icon={<CloseIcon />}
				class={props.class}
			/>
		)}
	/>
);

const Overlay = () => (
	<Dialog.Overlay class="overlay-motion fixed inset-0 z-50 bg-overlay" />
);

const surface = [
	"modal-motion relative flex flex-col overflow-hidden rounded-surface border border-border bg-popover",
	"text-foreground shadow-overlay outline-none origin-center",
];

export type ModalContentProps = {
	title: JSX.Element;
	description?: JSX.Element;
	footer?: JSX.Element;
	closeLabel?: string;
	class?: string;
	children?: JSX.Element;
	onCloseAutoFocus?: (event: Event) => void;
};

export const ModalContent = (props: ModalContentProps) => {
	const [local, rest] = splitProps(props, [
		"title",
		"description",
		"footer",
		"closeLabel",
		"class",
		"children",
	]);
	const description = createSlot(() => local.description);
	const footer = createSlot(() => local.footer);
	const heightTransition = createHeightTransition();
	const guards = useNestedLayerGuards();

	return (
		<Dialog.Portal>
			<Overlay />
			<div class="fixed inset-0 z-50 flex items-center justify-center px-safe-offset-4 pt-overlay-offset-10 pb-safe-offset-4 md:pt-overlay-offset-4">
				<Dialog.Content
					{...rest}
					{...guards}
					ref={heightTransition}
					class={cx(surface, "w-full gap-4 p-4 md:w-[360px]", local.class)}
				>
					<div class="flex min-h-6 items-start justify-between gap-3">
						<Dialog.Title class="pt-px text-xl leading-tight font-semibold text-balance">
							{local.title}
						</Dialog.Title>
						<ModalCloseButton
							label={local.closeLabel}
							class="-mt-[9px] -mr-[9px]"
						/>
					</div>
					<Show when={description.has()}>
						<Dialog.Description class="-mt-2 text-sm leading-prose text-pretty text-muted-foreground">
							{description()}
						</Dialog.Description>
					</Show>
					{local.children}
					<Show when={footer.has()}>
						<div class="flex flex-col-reverse gap-2 md:flex-row md:justify-end [&>*]:w-full md:[&>*]:w-auto">
							{footer()}
						</div>
					</Show>
					<ModalDiscardPrompt />
				</Dialog.Content>
			</div>
		</Dialog.Portal>
	);
};

export type ModalTrailItem = {
	label: JSX.Element;
	onSelect?: () => void;
};

export type LargeModalContentProps = {
	title: JSX.Element;
	trail?: ModalTrailItem[];
	onBack?: () => void;
	backLabel?: string;
	sidebar?: JSX.Element;
	closeLabel?: string;
	class?: string;
	children?: JSX.Element;
};

export const LargeModalContent = (props: LargeModalContentProps) => {
	const [local, rest] = splitProps(props, [
		"title",
		"trail",
		"onBack",
		"backLabel",
		"sidebar",
		"closeLabel",
		"class",
		"children",
	]);
	const guards = useNestedLayerGuards();
	const sidebar = createSlot(() => local.sidebar);

	return (
		<Dialog.Portal>
			<Overlay />
			<div class="fixed inset-0 z-50 flex items-center justify-center px-safe-offset-4 pt-overlay-offset-4 pb-safe-offset-4">
				<Dialog.Content
					{...rest}
					{...guards}
					class={cx(
						surface,
						"h-full max-h-[800px] w-full max-w-[1200px] flex-row",
						local.class,
					)}
				>
					<Show when={sidebar.has()}>
						<nav class="flex w-72 shrink-0 flex-col gap-6 overflow-y-auto bg-card p-4">
							{sidebar()}
						</nav>
					</Show>
					<div
						data-modal-main=""
						class={cx(
							"flex min-w-0 flex-1 flex-col",
							sidebar.has() && "border-l border-border",
						)}
					>
						<div
							class={cx(
								"flex h-12 shrink-0 items-center gap-2 border-b border-border pr-2",
								local.onBack ? "pl-2" : "pl-4",
							)}
						>
							<Show when={local.onBack}>
								<IconButton
									variant="ghost"
									size="md"
									label={local.backLabel ?? "Back"}
									icon={<ArrowLeftIcon />}
									data-modal-back=""
									onClick={() => local.onBack?.()}
								/>
							</Show>
							<Show
								when={local.trail?.length}
								fallback={
									<Dialog.Title class="min-w-0 flex-1 truncate text-base font-semibold">
										{local.title}
									</Dialog.Title>
								}
							>
								<nav aria-label="Breadcrumb" class="flex min-w-0 flex-1">
									<ol class="m-0 flex min-w-0 list-none items-center gap-1.5 p-0">
										<For each={local.trail}>
											{(item) => (
												<li
													data-modal-trail=""
													class="flex min-w-0 shrink items-center gap-1.5 text-base text-muted-foreground"
												>
													<Show
														when={item.onSelect}
														fallback={
															<span class="truncate">{item.label}</span>
														}
													>
														{(select) => (
															<button
																type="button"
																onClick={() => select()()}
																class="focus-ring cursor-pointer truncate rounded-control-sm border-0 bg-transparent p-0 text-base text-muted-foreground hover:text-foreground"
															>
																{item.label}
															</button>
														)}
													</Show>
													<span aria-hidden="true">/</span>
												</li>
											)}
										</For>
										<li class="flex min-w-0 shrink-[0.5] items-center">
											<Dialog.Title
												aria-current="page"
												class="truncate text-base font-semibold"
											>
												{local.title}
											</Dialog.Title>
										</li>
									</ol>
								</nav>
							</Show>
							<ModalCloseButton label={local.closeLabel} />
						</div>
						<div class="min-h-0 flex-1 overflow-y-auto p-4">
							{local.children}
						</div>
					</div>
					<ModalDiscardPrompt />
				</Dialog.Content>
			</div>
		</Dialog.Portal>
	);
};
