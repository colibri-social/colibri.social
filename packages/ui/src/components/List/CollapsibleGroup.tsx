import { AltArrowRightIcon } from "@solar-icons/solid/linear/alt-arrow-right";
import { createUniqueId, type JSX, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { createRipple } from "../../utils/ripple";
import { createSlot } from "../../utils/slot";

const rowHighlight = "ripple hover:bg-secondary-highlight";

const rowFocus = "outline-none focus-ring-inset";

const CHECK_PATH = "M6.4 12.8L9.6 16L17.6 8";
const CHECK_LENGTH = 16;

const CheckMark = (props: { checked: boolean }) => (
	<span
		aria-hidden="true"
		data-collapsible-group-check=""
		data-checked={props.checked ? "" : undefined}
		class={cx(
			"flex size-6 shrink-0 items-center justify-center rounded-checkbox border text-primary-foreground",
			"transition-[background-color,border-color,box-shadow] duration-[calc(var(--duration-color)*var(--motion-scale))]",
			props.checked
				? "border-transparent bg-primary shadow-[inset_0_0_0_1px_var(--border)]"
				: "border-control-border bg-secondary",
		)}
	>
		<svg
			aria-hidden="true"
			viewBox="0 0 24 24"
			class="size-6 drop-shadow-[0_0_2px_rgb(0_0_0/0.25)]"
			fill="none"
		>
			<path
				d={CHECK_PATH}
				stroke="currentColor"
				stroke-width="1.75"
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-dasharray={`${CHECK_LENGTH}px`}
				class="transition-[stroke-dashoffset] ease-(--ease-out-quick) reduced-motion:transition-none motion-reduce:transition-none"
				style={{
					"stroke-dashoffset": props.checked ? "0px" : `${CHECK_LENGTH}px`,
					"transition-duration": props.checked
						? "calc(150ms * var(--motion-scale))"
						: "calc(90ms * var(--motion-scale))",
				}}
			/>
		</svg>
	</span>
);

const nestedDividers =
	"[&>*]:border-border [&>:not([hidden])~:not([hidden])]:border-t";

export type CollapsibleGroupProps = {
	label: JSX.Element;
	icon?: JSX.Element;
	hint?: JSX.Element;
	count?: number;
	expanded: boolean;
	onExpandedChange: (expanded: boolean) => void;
	onSelect?: () => void;
	checked?: boolean;
	toggleLabel?: string;
	disabled?: boolean;
	class?: string;
	children?: JSX.Element;
};

export const CollapsibleGroup = (props: CollapsibleGroupProps) => {
	const icon = createSlot(() => props.icon);
	const label = createSlot(() => props.label);
	const hint = createSlot(() => props.hint);
	const ripple = createRipple({ disabled: () => !!props.disabled });
	const panel = createUniqueId();
	const toggle = () => props.onExpandedChange(!props.expanded);
	const select = () => (props.onSelect ? props.onSelect() : toggle());
	const checkable = () => !!props.onSelect && props.checked !== undefined;

	return (
		<div
			data-collapsible-group=""
			data-expanded={props.expanded ? "" : undefined}
			class={cx("flex w-full flex-col", props.class)}
		>
			<div class="flex h-10 w-full shrink-0 items-stretch">
				<button
					ref={ripple}
					type="button"
					data-collapsible-group-select=""
					aria-pressed={checkable() ? !!props.checked : undefined}
					aria-expanded={props.onSelect ? undefined : props.expanded}
					aria-controls={props.onSelect ? undefined : panel}
					disabled={props.disabled}
					onClick={select}
					class={cx(
						"flex min-w-0 flex-1 cursor-pointer items-center gap-2 px-3 text-left text-foreground",
						"disabled:cursor-not-allowed disabled:opacity-50",
						rowHighlight,
						rowFocus,
					)}
				>
					<Show when={icon.has()}>
						<span class="flex size-6 shrink-0 items-center justify-center [&>svg]:size-6">
							{icon()}
						</span>
					</Show>
					<span class="min-w-0 truncate text-sm font-semibold">{label()}</span>
					<Show when={hint.has()}>
						<span class="shrink-0 truncate text-xs font-medium text-muted-foreground">
							{hint()}
						</span>
					</Show>
					<span class="min-w-0 flex-1" />
					<Show when={props.count !== undefined && !props.expanded}>
						<span
							data-collapsible-group-count=""
							class="shrink-0 text-xs font-semibold text-muted-foreground tabular-nums"
						>
							{props.count}
						</span>
					</Show>
					<Show when={checkable()}>
						<CheckMark checked={!!props.checked} />
					</Show>
				</button>
				<button
					type="button"
					data-collapsible-group-toggle=""
					aria-label={props.toggleLabel}
					aria-expanded={props.expanded}
					aria-controls={panel}
					onClick={toggle}
					class={cx(
						"flex w-12 shrink-0 cursor-pointer items-center justify-center text-muted-foreground",
						"hover:bg-secondary-highlight hover:text-foreground",
						rowFocus,
					)}
				>
					<span
						class={cx(
							"flex size-4 items-center justify-center transition-transform duration-[calc(var(--duration-color)*var(--motion-scale))] motion-reduce:transition-none [&>svg]:size-4",
							props.expanded && "rotate-90",
						)}
					>
						<AltArrowRightIcon />
					</span>
				</button>
			</div>
			<div
				id={panel}
				hidden={!props.expanded}
				class={cx("flex flex-col border-t border-border", nestedDividers)}
			>
				<Show when={props.expanded}>{props.children}</Show>
			</div>
		</div>
	);
};
