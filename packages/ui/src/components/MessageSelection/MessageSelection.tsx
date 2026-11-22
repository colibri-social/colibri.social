import { ArrowRightIcon } from "@solar-icons/solid/bold/arrow-right";
import { CheckIcon } from "@solar-icons/solid/bold/check";
import { CloseIcon } from "@solar-icons/solid/bold/close";
import { type JSX, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { useHaptics } from "../../utils/haptics";
import { Button } from "../Button/Button";
import { IconButton } from "../IconButton/IconButton";

export type MessageSelectFrameProps = {
	selecting: boolean;
	selected: boolean;
	onToggle: (event: MouseEvent) => void;
	disabled?: boolean;
	label?: string;
	children: JSX.Element;
	class?: string;
};

export const MessageSelectFrame = (props: MessageSelectFrameProps) => {
	const haptics = useHaptics();
	const selected = () => props.selecting && props.selected;
	return (
		<div
			data-message-select=""
			data-selecting={props.selecting ? "" : undefined}
			data-selected={selected() ? "" : undefined}
			class={cx(
				"relative transition-[padding-left,background-color] duration-[calc(150ms*var(--motion-scale))] ease-(--ease-out-quick)",
				"motion-reduce:transition-none reduced-motion:transition-none",
				props.selecting && "pl-10",
				selected() && "bg-primary/10",
				props.class,
			)}
		>
			{props.children}
			<Show when={props.selecting}>
				<button
					type="button"
					data-message-select-toggle=""
					data-gesture="own"
					aria-pressed={props.selected}
					aria-label={props.label ?? "Select message"}
					disabled={props.disabled}
					onClick={(event) => {
						haptics.selection();
						props.onToggle(event);
					}}
					class="absolute inset-0 flex cursor-pointer items-center border-0 bg-transparent pl-3 outline-none focus-ring-inset disabled:cursor-default"
				>
					<span
						aria-hidden="true"
						class={cx(
							"flex size-6 shrink-0 items-center justify-center rounded-checkbox border [&>svg]:size-4",
							"transition-[background-color,border-color] duration-[calc(var(--duration-color)*var(--motion-scale))]",
							props.selected
								? "border-transparent bg-primary text-primary-foreground"
								: "border-control-border bg-secondary",
							props.disabled && "opacity-40",
						)}
					>
						<Show when={props.selected}>
							<CheckIcon />
						</Show>
					</span>
				</button>
			</Show>
		</div>
	);
};

export const selectionCountLabel = (count: number) =>
	count === 1 ? "1 message selected" : `${count} messages selected`;

export type MessageSelectionBarProps = {
	count: number;
	onMove: () => void;
	onCancel: () => void;
	moveLabel?: string;
	busy?: boolean;
	safeBottom?: boolean;
	class?: string;
};

export const MessageSelectionBar = (props: MessageSelectionBarProps) => (
	<div
		role="toolbar"
		aria-label="Selected messages"
		data-message-selection-bar=""
		class={cx(
			"flex w-full min-w-0 items-center gap-2 border-0 border-t border-solid border-border bg-card px-3 py-2",
			props.safeBottom && "px-safe-offset-3 pb-safe-offset-2",
			props.class,
		)}
	>
		<IconButton
			variant="ghost"
			size="md"
			label="Cancel selection"
			icon={<CloseIcon />}
			onClick={() => props.onCancel()}
		/>
		<span
			aria-live="polite"
			class="min-w-0 flex-1 truncate text-sm font-medium tabular-nums"
		>
			{selectionCountLabel(props.count)}
		</span>
		<Button
			icon={<ArrowRightIcon />}
			disabled={props.count === 0}
			loading={props.busy}
			onClick={() => props.onMove()}
		>
			{props.moveLabel ?? "Move to"}
		</Button>
	</div>
);

export type MovedFromLineProps = {
	name: string;
	onOpen?: () => void;
	class?: string;
};

export const MovedFromLine = (props: MovedFromLineProps) => (
	<Show
		when={props.onOpen}
		fallback={
			<span
				data-moved-from=""
				class={cx(
					"flex min-w-0 items-center gap-1 text-xs text-muted-foreground [&>svg]:size-3 [&>svg]:shrink-0",
					props.class,
				)}
			>
				<ArrowRightIcon />
				<span class="min-w-0 truncate">{`Moved from ${props.name}`}</span>
			</span>
		}
	>
		{(onOpen) => (
			<button
				type="button"
				data-moved-from=""
				onClick={() => onOpen()()}
				class={cx(
					"flex max-w-full min-w-0 cursor-pointer items-center gap-1 self-start rounded-badge border-0 bg-transparent p-0 text-left text-xs text-muted-foreground outline-none hover:text-foreground focus-ring [&>svg]:size-3 [&>svg]:shrink-0",
					props.class,
				)}
			>
				<ArrowRightIcon />
				<span class="min-w-0 truncate">{`Moved from ${props.name}`}</span>
			</button>
		)}
	</Show>
);
