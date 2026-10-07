import { RadioGroup as KobalteRadioGroup } from "@kobalte/core/radio-group";
import { createSignal, type JSX, Show, splitProps } from "solid-js";
import { cx } from "../../utils/cx";
import { useHaptics } from "../../utils/haptics";
import {
	playKeyframes,
	popKeyframes,
	springEasing,
	springs,
} from "../../utils/motion";
import { createSlot } from "../../utils/slot";

export type RadioGroupProps = {
	value?: string;
	defaultValue?: string;
	onChange?: (value: string) => void;
	disabled?: boolean;
	name?: string;
	label?: JSX.Element;
	orientation?: "horizontal" | "vertical";
	class?: string;
	children: JSX.Element;
	"aria-label"?: string;
};

export const RadioGroup = (props: RadioGroupProps) => {
	const [local, rest] = splitProps(props, [
		"value",
		"defaultValue",
		"onChange",
		"label",
		"class",
		"children",
	]);
	const haptics = useHaptics();
	const [internal, setInternal] = createSignal(local.defaultValue ?? "");
	const value = () => local.value ?? internal();
	const groupLabel = createSlot(() => local.label);

	const onChange = (next: string) => {
		setInternal(next);
		local.onChange?.(next);
		haptics.selection();
	};

	return (
		<KobalteRadioGroup
			{...rest}
			value={value()}
			onChange={onChange}
			class={cx("flex flex-col gap-3", local.class)}
		>
			<Show when={groupLabel.has()}>
				<KobalteRadioGroup.Label class="text-sm font-medium text-muted-foreground">
					{groupLabel()}
				</KobalteRadioGroup.Label>
			</Show>
			{local.children}
		</KobalteRadioGroup>
	);
};

export type RadioProps = {
	value: string;
	disabled?: boolean;
	label?: JSX.Element;
	description?: JSX.Element;
	labelPosition?: "start" | "end";
	class?: string;
};

export const Radio = (props: RadioProps) => {
	let control: HTMLDivElement | undefined;
	let armed = false;
	const label = createSlot(() => props.label);
	const description = createSlot(() => props.description);

	const popDot = (dot: HTMLDivElement) => {
		if (!armed) return;
		const { easing, duration } = springEasing(springs.pop);
		playKeyframes(dot, [{ transform: "scale(0)" }, { transform: "scale(1)" }], {
			duration,
			easing,
			fill: "backwards",
		});
	};

	const arm = () => {
		armed = true;
		playKeyframes(control, popKeyframes, {
			duration: 260,
			easing: "cubic-bezier(0.2, 0, 0, 1)",
		});
	};

	return (
		<KobalteRadioGroup.Item
			value={props.value}
			disabled={props.disabled}
			class={cx(
				"group/radio inline-flex gap-3 data-disabled:cursor-not-allowed",
				description.has() ? "items-start" : "items-center",
				props.labelPosition === "start" && "flex-row-reverse justify-between",
				props.class,
			)}
		>
			<KobalteRadioGroup.ItemInput class="peer" onChange={arm} />
			<KobalteRadioGroup.ItemControl
				ref={control}
				class={cx(
					"relative flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full border",
					"border-control-border bg-secondary",
					"transition-[background-color,border-color,box-shadow] duration-[calc(var(--duration-color)*var(--motion-scale))]",
					"hover:border-accent",
					"data-checked:border-transparent data-checked:bg-primary data-checked:shadow-[inset_0_0_0_1px_var(--border)]",
					"peer-focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_25%,transparent)]",
					"group-data-disabled/radio:cursor-not-allowed group-data-disabled/radio:opacity-50",
				)}
			>
				<KobalteRadioGroup.ItemIndicator
					ref={popDot}
					class="size-[12.8px] rounded-full bg-white"
				/>
			</KobalteRadioGroup.ItemControl>
			<Show when={label.has() || description.has()}>
				<div class="flex min-w-0 flex-col gap-0.5">
					<Show when={label.has()}>
						<KobalteRadioGroup.ItemLabel class="cursor-pointer text-base leading-6 font-medium text-foreground group-data-disabled/radio:cursor-not-allowed">
							{label()}
						</KobalteRadioGroup.ItemLabel>
					</Show>
					<Show when={description.has()}>
						<KobalteRadioGroup.ItemDescription class="text-xs text-muted-foreground">
							{description()}
						</KobalteRadioGroup.ItemDescription>
					</Show>
				</div>
			</Show>
		</KobalteRadioGroup.Item>
	);
};
