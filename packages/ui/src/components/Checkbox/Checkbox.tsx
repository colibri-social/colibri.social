import { Checkbox as KobalteCheckbox } from "@kobalte/core/checkbox";
import { createSignal, type JSX, Show, splitProps } from "solid-js";
import { cx } from "../../utils/cx";
import { useHaptics } from "../../utils/haptics";
import { playKeyframes, popKeyframes } from "../../utils/motion";
import { createSlot } from "../../utils/slot";

const CHECK_PATH = "M6.4 12.8L9.6 16L17.6 8";
const CHECK_LENGTH = 16;

export type CheckboxProps = {
	checked?: boolean;
	defaultChecked?: boolean;
	onChange?: (checked: boolean) => void;
	disabled?: boolean;
	label?: JSX.Element;
	description?: JSX.Element;
	labelPosition?: "start" | "end";
	name?: string;
	value?: string;
	id?: string;
	class?: string;
	"aria-label"?: string;
};

export const Checkbox = (props: CheckboxProps) => {
	const [local, rest] = splitProps(props, [
		"checked",
		"defaultChecked",
		"onChange",
		"label",
		"description",
		"labelPosition",
		"class",
		"aria-label",
	]);
	const haptics = useHaptics();
	const [internal, setInternal] = createSignal(local.defaultChecked ?? false);
	const checked = () => local.checked ?? internal();
	let control: HTMLDivElement | undefined;
	const label = createSlot(() => local.label);
	const description = createSlot(() => local.description);

	const onChange = (next: boolean) => {
		setInternal(next);
		local.onChange?.(next);
		haptics.selection();
		playKeyframes(control, popKeyframes, {
			duration: 260,
			easing: "cubic-bezier(0.2, 0, 0, 1)",
		});
	};

	return (
		<KobalteCheckbox
			{...rest}
			checked={checked()}
			onChange={onChange}
			class={cx(
				"group/checkbox inline-flex gap-3 data-disabled:cursor-not-allowed",
				description.has() ? "items-start" : "items-center",
				local.labelPosition === "start" && "flex-row-reverse justify-between",
				local.class,
			)}
		>
			<KobalteCheckbox.Input class="peer" aria-label={local["aria-label"]} />
			<KobalteCheckbox.Control
				ref={control}
				class={cx(
					"relative flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-checkbox border",
					"border-control-border bg-secondary text-primary-foreground",
					"transition-[background-color,border-color,box-shadow] duration-[calc(var(--duration-color)*var(--motion-scale))]",
					"hover:border-accent",
					"data-checked:border-transparent data-checked:bg-primary data-checked:shadow-[inset_0_0_0_1px_var(--border)]",
					"peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary peer-focus-visible:outline-solid",
					"group-data-disabled/checkbox:cursor-not-allowed group-data-disabled/checkbox:opacity-50",
				)}
			>
				<KobalteCheckbox.Indicator
					forceMount
					class="flex items-center justify-center"
				>
					<svg
						viewBox="0 0 24 24"
						class="size-6 drop-shadow-[0_0_2px_rgb(0_0_0/0.25)]"
						fill="none"
						aria-hidden="true"
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
								"stroke-dashoffset": checked() ? "0px" : `${CHECK_LENGTH}px`,
								"transition-duration": checked()
									? "calc(150ms * var(--motion-scale))"
									: "calc(90ms * var(--motion-scale))",
							}}
						/>
					</svg>
				</KobalteCheckbox.Indicator>
			</KobalteCheckbox.Control>
			<Show when={label.has() || description.has()}>
				<div class="flex min-w-0 flex-col gap-0.5">
					<Show when={label.has()}>
						<KobalteCheckbox.Label class="cursor-pointer text-base leading-6 font-medium text-foreground group-data-disabled/checkbox:cursor-not-allowed">
							{label()}
						</KobalteCheckbox.Label>
					</Show>
					<Show when={description.has()}>
						<KobalteCheckbox.Description class="text-xs text-muted-foreground">
							{description()}
						</KobalteCheckbox.Description>
					</Show>
				</div>
			</Show>
		</KobalteCheckbox>
	);
};
