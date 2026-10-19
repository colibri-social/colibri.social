import { CloseIcon } from "@solar-icons/solid/bold/close";
import { PenIcon } from "@solar-icons/solid/bold/pen";
import { ReplyIcon } from "@solar-icons/solid/bold/reply";
import { type JSX, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { createExitHold } from "../../utils/exit-hold";
import { createSlot } from "../../utils/slot";
import { IconButton } from "../IconButton/IconButton";

export type ComposerBarTone = "info" | "warning" | "primary";

const toneClass: Record<ComposerBarTone, string> = {
	info: "bg-[color-mix(in_srgb,var(--info)_8%,transparent)] [--composer-bar-accent:var(--info)]",
	warning:
		"bg-[color-mix(in_srgb,var(--warning)_8%,transparent)] [--composer-bar-accent:var(--warning)]",
	primary:
		"bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] [--composer-bar-accent:var(--primary-highlight)]",
};

export type ComposerBarProps = {
	open: boolean;
	tone: ComposerBarTone;
	icon: JSX.Element;
	children: JSX.Element;
	trailing?: JSX.Element;
	cancelLabel: string;
	onCancel?: () => void;
	onClick?: () => void;
	kind?: string;
	class?: string;
	ref?: (element: HTMLDivElement) => void;
};

export const ComposerBar = (props: ComposerBarProps) => {
	const icon = createSlot(() => props.icon);
	const trailing = createSlot(() => props.trailing);
	const content = createSlot(() => props.children);

	return (
		<div
			ref={(element) => props.ref?.(element)}
			data-composer-bar={props.kind ?? ""}
			data-open={props.open || undefined}
			inert={!props.open}
			aria-hidden={props.open ? undefined : "true"}
			class={cx(
				"grid grid-rows-[0fr] opacity-0 data-open:grid-rows-[1fr] data-open:opacity-100",
				"transition-[grid-template-rows,opacity] duration-[calc(var(--duration-overlay-in,320ms)*var(--motion-scale))] ease-[var(--ease-overlay-in,var(--ease-out-quick))]",
				"motion-reduce:transition-none reduced-motion:transition-none",
				props.class,
			)}
		>
			<div class="min-h-0 overflow-hidden">
				<div
					class={cx(
						"flex h-10 items-center gap-2 border-b border-border pr-1 pl-3 text-sm",
						toneClass[props.tone],
					)}
				>
					<span class="flex size-4 shrink-0 items-center justify-center text-(--composer-bar-accent) [&>svg]:size-4">
						{icon()}
					</span>
					<Show
						when={props.onClick}
						fallback={
							<span
								data-layout-clip=""
								class="min-w-0 flex-1 truncate text-muted-foreground"
							>
								{content()}
							</span>
						}
					>
						{(onClick) => (
							<button
								type="button"
								data-composer-bar-action=""
								onClick={() => onClick()()}
								class="flex h-full min-w-0 flex-1 cursor-pointer items-center rounded-control-xs text-left text-muted-foreground outline-none hover:text-foreground focus-ring-inset"
							>
								<span data-layout-clip="" class="min-w-0 flex-1 truncate">
									{content()}
								</span>
							</button>
						)}
					</Show>
					<Show when={trailing.has()}>{trailing()}</Show>
					<IconButton
						variant="ghost"
						size="sm"
						label={props.cancelLabel}
						icon={<CloseIcon />}
						class="text-muted-foreground not-aria-disabled:hover:text-foreground"
						onClick={() => props.onCancel?.()}
					/>
				</div>
			</div>
		</div>
	);
};

export type ReplyBarProps = {
	open: boolean;
	name: JSX.Element;
	onCancel?: () => void;
	onClick?: () => void;
	class?: string;
};

export const ReplyBar = (props: ReplyBarProps) => {
	const name = createExitHold(
		() => props.name,
		() => props.open,
	);
	return (
		<ComposerBar
			ref={name.settle}
			open={props.open}
			tone="info"
			kind="reply"
			icon={<ReplyIcon />}
			cancelLabel="Cancel reply"
			onCancel={props.onCancel}
			onClick={props.onClick}
			class={props.class}
		>
			Replying to{" "}
			<span class="font-semibold text-foreground">{name.value()}</span>
		</ComposerBar>
	);
};

export type EditBarProps = {
	open: boolean;
	preview?: JSX.Element;
	onCancel?: () => void;
	class?: string;
};

export const EditBar = (props: EditBarProps) => {
	const shown = createExitHold(
		() => props.preview,
		() => props.open,
	);
	const preview = createSlot(() => shown.value());
	return (
		<ComposerBar
			ref={shown.settle}
			open={props.open}
			tone="primary"
			kind="edit"
			icon={<PenIcon />}
			cancelLabel="Cancel editing"
			onCancel={props.onCancel}
			class={props.class}
		>
			<span data-edit-bar="" class="text-foreground">
				Editing message
			</span>
			<Show when={preview.has()}>
				<span class="text-muted-foreground"> · {preview()}</span>
			</Show>
		</ComposerBar>
	);
};
