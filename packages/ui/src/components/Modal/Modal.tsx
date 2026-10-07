import { Dialog } from "@kobalte/core/dialog";
import { CloseIcon } from "@solar-icons/solid/bold/close";
import { type JSX, type ParentProps, Show, splitProps } from "solid-js";
import { cx } from "../../utils/cx";
import { createSlot } from "../../utils/slot";
import { IconButton } from "../IconButton/IconButton";

export type ModalProps = ParentProps<{
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	defaultOpen?: boolean;
	modal?: boolean;
}>;

export const Modal = (props: ModalProps) => (
	<Dialog
		open={props.open}
		onOpenChange={props.onOpenChange}
		defaultOpen={props.defaultOpen}
		modal={props.modal ?? true}
		preventScroll
	>
		{props.children}
	</Dialog>
);

export const ModalTrigger = Dialog.Trigger;

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

	return (
		<Dialog.Portal>
			<Overlay />
			<div class="fixed inset-0 z-50 flex items-center justify-center px-safe-offset-4 pt-safe-offset-10 pb-safe-offset-4 md:pt-safe-offset-4">
				<Dialog.Content
					{...rest}
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
						<Dialog.Description class="-mt-2 text-sm text-pretty text-muted-foreground">
							{description()}
						</Dialog.Description>
					</Show>
					{local.children}
					<Show when={footer.has()}>
						<div class="flex flex-col-reverse gap-2 md:flex-row md:justify-end [&>*]:w-full md:[&>*]:w-auto">
							{footer()}
						</div>
					</Show>
				</Dialog.Content>
			</div>
		</Dialog.Portal>
	);
};

export type LargeModalContentProps = {
	title: JSX.Element;
	sidebar: JSX.Element;
	closeLabel?: string;
	class?: string;
	children?: JSX.Element;
};

export const LargeModalContent = (props: LargeModalContentProps) => {
	const [local, rest] = splitProps(props, [
		"title",
		"sidebar",
		"closeLabel",
		"class",
		"children",
	]);

	return (
		<Dialog.Portal>
			<Overlay />
			<div class="fixed inset-0 z-50 flex items-center justify-center px-safe-offset-4 pt-safe-offset-4 pb-safe-offset-4">
				<Dialog.Content
					{...rest}
					class={cx(
						surface,
						"h-full max-h-[800px] w-full max-w-[1200px] flex-row",
						local.class,
					)}
				>
					<nav class="flex w-72 shrink-0 flex-col gap-6 overflow-y-auto bg-card p-4">
						{local.sidebar}
					</nav>
					<div class="flex min-w-0 flex-1 flex-col border-l border-border">
						<div class="flex h-12 shrink-0 items-center justify-between border-b border-border pr-2 pl-4">
							<Dialog.Title class="truncate text-base font-semibold">
								{local.title}
							</Dialog.Title>
							<ModalCloseButton label={local.closeLabel} />
						</div>
						<div class="min-h-0 flex-1 overflow-y-auto p-4">
							{local.children}
						</div>
					</div>
				</Dialog.Content>
			</div>
		</Dialog.Portal>
	);
};
