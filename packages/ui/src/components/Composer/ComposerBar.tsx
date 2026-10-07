import { CloseIcon } from "@solar-icons/solid/bold/close";
import { PenIcon } from "@solar-icons/solid/bold/pen";
import { ReplyIcon } from "@solar-icons/solid/bold/reply";
import { type JSX, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { createSlot } from "../../utils/slot";
import { IconButton } from "../IconButton/IconButton";

export type ComposerBarTone = "info" | "warning";

const toneClass: Record<ComposerBarTone, string> = {
	info: "bg-[color-mix(in_srgb,var(--info)_8%,transparent)] [--composer-bar-accent:var(--info)]",
	warning:
		"bg-[color-mix(in_srgb,var(--warning)_8%,transparent)] [--composer-bar-accent:var(--warning)]",
};

export type ComposerBarProps = {
	open: boolean;
	tone: ComposerBarTone;
	icon: JSX.Element;
	children: JSX.Element;
	trailing?: JSX.Element;
	cancelLabel: string;
	onCancel?: () => void;
	class?: string;
};

export const ComposerBar = (props: ComposerBarProps) => {
	const icon = createSlot(() => props.icon);
	const trailing = createSlot(() => props.trailing);

	return (
		<div
			data-composer-bar=""
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
					<span class="min-w-0 flex-1 truncate text-muted-foreground">
						{props.children}
					</span>
					<Show when={trailing.has()}>{trailing()}</Show>
					<IconButton
						variant="ghost"
						size="sm"
						label={props.cancelLabel}
						icon={<CloseIcon />}
						class="text-muted-foreground enabled:hover:text-foreground"
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
	class?: string;
};

export const ReplyBar = (props: ReplyBarProps) => (
	<ComposerBar
		open={props.open}
		tone="info"
		icon={<ReplyIcon />}
		cancelLabel="Cancel reply"
		onCancel={props.onCancel}
		class={props.class}
	>
		Replying to <span class="font-semibold text-foreground">{props.name}</span>
	</ComposerBar>
);

export type EditBarProps = {
	open: boolean;
	onCancel?: () => void;
	class?: string;
};

export const EditBar = (props: EditBarProps) => (
	<ComposerBar
		open={props.open}
		tone="warning"
		icon={<PenIcon />}
		cancelLabel="Cancel editing"
		onCancel={props.onCancel}
		class={props.class}
	>
		<span class="text-foreground">Editing message</span>
	</ComposerBar>
);
