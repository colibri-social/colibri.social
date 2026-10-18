import { Select as KobalteSelect } from "@kobalte/core/select";
import { AltArrowDownIcon } from "@solar-icons/solid/linear/alt-arrow-down";
import { CheckIcon } from "@solar-icons/solid/linear/check";
import { createSignal, createUniqueId, For, type JSX, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { motionScale } from "../../utils/motion";
import { usePopperOverflowPadding } from "../../utils/safe-area";
import { createSlot } from "../../utils/slot";
import { menuContentClass } from "../ContextMenu/Menu";
import { Drawer, DrawerContent } from "../Drawer/Drawer";
import { RadioRow, RadioRowGroup } from "../List/List";

export type SelectPlatform = "mobile" | "desktop";

export type SelectOption = {
	value: string;
	label: string;
	description?: string;
	icon?: () => JSX.Element;
	disabled?: boolean;
};

export type SelectProps = {
	platform?: SelectPlatform;
	options: SelectOption[];
	value?: string;
	defaultValue?: string;
	onChange?: (value: string) => void;
	placeholder?: string;
	label?: JSX.Element;
	description?: JSX.Element;
	error?: JSX.Element;
	disabled?: boolean;
	required?: boolean;
	name?: string;
	class?: string;
	"aria-label"?: string;
};

export const selectTriggerClass = [
	"group/trigger flex h-10 w-full min-w-0 cursor-pointer items-center gap-2 rounded-control border border-border bg-secondary px-3 text-left text-base font-semibold text-foreground outline-none",
	"hover:bg-secondary-highlight",
	"transition-[border-color,box-shadow] duration-[calc(var(--duration-color)*var(--motion-scale))]",
	"focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_25%,transparent)]",
	"data-invalid:border-destructive data-invalid:focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--destructive)_25%,transparent)]",
	"disabled:cursor-not-allowed disabled:opacity-50 data-disabled:cursor-not-allowed data-disabled:opacity-50",
];

const labelClass = "text-sm font-medium text-muted-foreground";
const descriptionClass = "text-xs text-muted-foreground";
const errorClass = "text-xs font-medium text-destructive";

const OptionIcon = (props: { icon?: () => JSX.Element }) => (
	<Show when={props.icon}>
		{(icon) => (
			<span
				aria-hidden="true"
				class="flex size-5 shrink-0 items-center justify-center text-muted-foreground [&>svg]:size-5"
			>
				{icon()()}
			</span>
		)}
	</Show>
);

const TriggerValue = (props: {
	option?: SelectOption;
	placeholder?: string;
}) => (
	<Show
		when={props.option}
		fallback={
			<span class="min-w-0 flex-1 truncate text-muted-foreground">
				{props.placeholder}
			</span>
		}
	>
		{(option) => (
			<>
				<OptionIcon icon={option().icon} />
				<span class="min-w-0 flex-1 truncate">{option().label}</span>
			</>
		)}
	</Show>
);

const Chevron = () => (
	<AltArrowDownIcon
		aria-hidden="true"
		class="size-4 shrink-0 text-muted-foreground transition-transform duration-[calc(200ms*var(--motion-scale))] ease-(--ease-out-quick) group-aria-expanded/trigger:rotate-180 group-data-expanded/trigger:rotate-180"
	/>
);

const DesktopSelect = (
	props: SelectProps & {
		current: () => string | undefined;
		commit: (value: string) => void;
	},
) => {
	const overflowPadding = usePopperOverflowPadding();
	const label = createSlot(() => props.label);
	const description = createSlot(() => props.description);
	const error = createSlot(() => props.error);
	const selected = () =>
		props.options.find((option) => option.value === props.current()) ?? null;

	return (
		<KobalteSelect<SelectOption>
			options={props.options}
			optionValue="value"
			optionTextValue="label"
			optionDisabled="disabled"
			value={selected()}
			onChange={(option) => {
				if (option) props.commit(option.value);
			}}
			placeholder={props.placeholder}
			disabled={props.disabled}
			required={props.required}
			validationState={error.has() ? "invalid" : "valid"}
			disallowEmptySelection
			sameWidth
			gutter={6}
			placement="bottom-start"
			overflowPadding={overflowPadding()}
			class={cx("flex w-full flex-col gap-2", props.class)}
			itemComponent={(itemProps) => (
				<KobalteSelect.Item
					item={itemProps.item}
					class={cx(
						"flex min-h-8 w-full cursor-pointer items-center gap-2 rounded-control-sm px-2 py-1.5 text-left text-sm font-semibold text-foreground outline-none select-none",
						"data-highlighted:bg-popover-highlight data-disabled:cursor-not-allowed data-disabled:opacity-50",
					)}
				>
					<OptionIcon icon={itemProps.item.rawValue.icon} />
					<span class="flex min-w-0 flex-1 flex-col">
						<KobalteSelect.ItemLabel class="truncate">
							{itemProps.item.rawValue.label}
						</KobalteSelect.ItemLabel>
						<Show when={itemProps.item.rawValue.description}>
							<KobalteSelect.ItemDescription class="text-xs font-medium text-pretty text-muted-foreground">
								{itemProps.item.rawValue.description}
							</KobalteSelect.ItemDescription>
						</Show>
					</span>
					<KobalteSelect.ItemIndicator class="ml-auto flex size-4 shrink-0 items-center justify-center text-primary-highlight [&>svg]:size-4">
						<CheckIcon />
					</KobalteSelect.ItemIndicator>
				</KobalteSelect.Item>
			)}
		>
			<Show when={label.has()}>
				<KobalteSelect.Label class={labelClass}>{label()}</KobalteSelect.Label>
			</Show>
			<Show when={props.name}>
				<input type="hidden" name={props.name} value={props.current() ?? ""} />
			</Show>
			<KobalteSelect.Trigger
				aria-label={props["aria-label"]}
				class={cx(selectTriggerClass)}
			>
				<KobalteSelect.Value<SelectOption> class="flex min-w-0 flex-1 items-center gap-2">
					{(state) => (
						<TriggerValue
							option={state.selectedOption()}
							placeholder={props.placeholder}
						/>
					)}
				</KobalteSelect.Value>
				<Chevron />
			</KobalteSelect.Trigger>
			<Show when={description.has() && !error.has()}>
				<KobalteSelect.Description class={descriptionClass}>
					{description()}
				</KobalteSelect.Description>
			</Show>
			<KobalteSelect.ErrorMessage class={errorClass}>
				{error()}
			</KobalteSelect.ErrorMessage>
			<KobalteSelect.Portal>
				<KobalteSelect.Content
					data-kb-top-layer=""
					class={cx(
						menuContentClass,
						"min-w-0 origin-(--kb-select-content-transform-origin)",
						"data-closed:animate-[ui-fade-out_calc(var(--duration-exit)*var(--motion-scale))_var(--ease-exit)_both]",
					)}
				>
					<KobalteSelect.Listbox class="flex max-h-[min(320px,var(--kb-popper-content-available-height))] flex-col overflow-y-auto outline-none" />
				</KobalteSelect.Content>
			</KobalteSelect.Portal>
		</KobalteSelect>
	);
};

const MobileSelect = (
	props: SelectProps & {
		current: () => string | undefined;
		commit: (value: string) => void;
	},
) => {
	const id = createUniqueId();
	const labelId = `${id}-label`;
	const valueId = `${id}-value`;
	const descriptionId = `${id}-description`;
	const errorId = `${id}-error`;
	const [open, setOpen] = createSignal(false);
	const label = createSlot(() => props.label);
	const description = createSlot(() => props.description);
	const error = createSlot(() => props.error);
	const selected = () =>
		props.options.find((option) => option.value === props.current());
	const describedBy = () =>
		[
			error.has() ? errorId : undefined,
			description.has() && !error.has() ? descriptionId : undefined,
		]
			.filter(Boolean)
			.join(" ") || undefined;

	return (
		<div class={cx("flex w-full flex-col gap-2", props.class)}>
			<Show when={label.has()}>
				<span id={labelId} class={labelClass}>
					{label()}
				</span>
			</Show>
			<button
				type="button"
				disabled={props.disabled}
				aria-haspopup="dialog"
				aria-expanded={open()}
				aria-label={label.has() ? undefined : props["aria-label"]}
				aria-labelledby={label.has() ? `${labelId} ${valueId}` : undefined}
				aria-describedby={describedBy()}
				aria-invalid={error.has() ? "true" : undefined}
				data-invalid={error.has() ? "" : undefined}
				onClick={() => setOpen(true)}
				class={cx(selectTriggerClass)}
			>
				<span id={valueId} class="flex min-w-0 flex-1 items-center gap-2">
					<TriggerValue option={selected()} placeholder={props.placeholder} />
				</span>
				<Chevron />
			</button>
			<Show when={props.name}>
				<input type="hidden" name={props.name} value={props.current() ?? ""} />
			</Show>
			<Show when={description.has() && !error.has()}>
				<span id={descriptionId} class={descriptionClass}>
					{description()}
				</span>
			</Show>
			<Show when={error.has()}>
				<span id={errorId} class={errorClass}>
					{error()}
				</span>
			</Show>
			<Drawer open={open()} onOpenChange={setOpen}>
				<DrawerContent
					title={typeof props.label === "string" ? props.label : undefined}
					aria-label={
						typeof props.label === "string" ? undefined : props["aria-label"]
					}
				>
					<RadioRowGroup
						aria-label={props["aria-label"]}
						value={props.current()}
						onChange={(value) => {
							props.commit(value);
							setTimeout(() => setOpen(false), 120 * motionScale());
						}}
					>
						<For each={props.options}>
							{(option) => (
								<RadioRow
									value={option.value}
									title={option.label}
									description={option.description}
									icon={option.icon?.()}
									disabled={option.disabled}
								/>
							)}
						</For>
					</RadioRowGroup>
				</DrawerContent>
			</Drawer>
		</div>
	);
};

export const Select = (props: SelectProps) => {
	const [internal, setInternal] = createSignal(props.defaultValue);
	const current = () => (props.value !== undefined ? props.value : internal());
	const commit = (value: string) => {
		setInternal(value);
		props.onChange?.(value);
	};
	return (
		<Show
			when={props.platform === "mobile"}
			fallback={<DesktopSelect {...props} current={current} commit={commit} />}
		>
			<MobileSelect {...props} current={current} commit={commit} />
		</Show>
	);
};
