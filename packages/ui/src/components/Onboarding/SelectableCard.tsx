import { RadioGroup as KobalteRadioGroup } from "@kobalte/core/radio-group";
import { createSignal, type JSX, Show, splitProps } from "solid-js";
import { cx } from "../../utils/cx";
import { useHaptics } from "../../utils/haptics";
import { createRipple } from "../../utils/ripple";
import { createSlot } from "../../utils/slot";

export type SelectableCardGroupProps = {
	value?: string;
	defaultValue?: string;
	onChange?: (value: string) => void;
	disabled?: boolean;
	name?: string;
	label?: JSX.Element;
	"aria-label"?: string;
	orientation?: "horizontal" | "vertical";
	class?: string;
	children: JSX.Element;
};

export const SelectableCardGroup = (props: SelectableCardGroupProps) => {
	const [local, rest] = splitProps(props, [
		"value",
		"defaultValue",
		"onChange",
		"label",
		"orientation",
		"class",
		"children",
	]);
	const haptics = useHaptics();
	const [internal, setInternal] = createSignal(local.defaultValue ?? "");
	const value = () => local.value ?? internal();
	const label = createSlot(() => local.label);

	const onChange = (next: string) => {
		if (next === value()) return;
		setInternal(next);
		local.onChange?.(next);
		haptics.selection();
	};

	return (
		<KobalteRadioGroup
			{...rest}
			value={value()}
			onChange={onChange}
			class={cx("flex flex-col gap-2", local.class)}
		>
			<Show when={label.has()}>
				<KobalteRadioGroup.Label class="text-sm font-medium text-muted-foreground">
					{label()}
				</KobalteRadioGroup.Label>
			</Show>
			<div
				data-orientation={local.orientation ?? "horizontal"}
				class={cx(
					"flex",
					local.orientation === "vertical" ? "flex-col gap-2" : "gap-4",
				)}
			>
				{local.children}
			</div>
		</KobalteRadioGroup>
	);
};

export type SelectableCardProps = {
	value: string;
	label: JSX.Element;
	description?: JSX.Element;
	layout?: "tile" | "row";
	icon?: JSX.Element;
	disabled?: boolean;
	class?: string;
};

export const SelectableCard = (props: SelectableCardProps) => {
	const icon = createSlot(() => props.icon);
	const description = createSlot(() => props.description);
	const ripple = createRipple();
	const isRow = () => props.layout === "row";

	return (
		<KobalteRadioGroup.Item
			ref={ripple}
			value={props.value}
			disabled={props.disabled}
			data-selectable-card=""
			data-layout={isRow() ? "row" : "tile"}
			class={cx(
				"group/tile ripple min-w-0 flex-1 rounded-surface bg-card text-foreground",
				"hover:bg-popover data-checked:hover:bg-card",
				"has-[:focus-visible]:shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_25%,transparent)]",
				"data-disabled:cursor-not-allowed data-disabled:opacity-50",
				props.class,
			)}
		>
			<span
				aria-hidden="true"
				data-selectable-card-fill=""
				class={cx(
					"pointer-events-none absolute inset-0 z-[-1] rounded-[inherit] bg-primary-fill opacity-0",
					"transition-opacity duration-[calc(var(--duration-color)*var(--motion-scale))]",
					"group-data-checked/tile:opacity-100 group-data-checked/tile:group-hover/tile:bg-primary-fill-highlight",
				)}
			/>
			<span aria-hidden="true" data-ripple-layer="" />
			<span
				aria-hidden="true"
				class="pointer-events-none absolute inset-0 z-[-1] rounded-[inherit] border border-border"
			/>
			<KobalteRadioGroup.ItemInput class="peer" />
			<KobalteRadioGroup.ItemLabel
				class={cx(
					"flex size-full cursor-pointer group-data-disabled/tile:cursor-not-allowed",
					isRow()
						? "flex-row items-center gap-3 px-4 py-3 text-left"
						: "flex-col items-center justify-center gap-3 p-3 text-center",
				)}
			>
				<Show when={icon.has()}>
					<span class="flex size-6 shrink-0 items-center justify-center [&>svg]:size-6">
						{icon()}
					</span>
				</Show>
				<Show
					when={isRow()}
					fallback={<span class="text-sm leading-[18px]">{props.label}</span>}
				>
					<span class="flex min-w-0 flex-col gap-0.5">
						<span class="text-sm leading-[18px] font-semibold">
							{props.label}
						</span>
						<Show when={description.has()}>
							<KobalteRadioGroup.ItemDescription
								aria-hidden="true"
								class="text-xs leading-4 text-muted-foreground group-data-checked/tile:text-current/80"
							>
								{description()}
							</KobalteRadioGroup.ItemDescription>
						</Show>
					</span>
				</Show>
			</KobalteRadioGroup.ItemLabel>
		</KobalteRadioGroup.Item>
	);
};
