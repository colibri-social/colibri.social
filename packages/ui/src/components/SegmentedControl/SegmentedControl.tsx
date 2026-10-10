import { SegmentedControl as KobalteSegmentedControl } from "@kobalte/core/segmented-control";
import { For, type JSX, splitProps } from "solid-js";
import { cx } from "../../utils/cx";

export type SegmentedControlOption = {
	value: string;
	label: JSX.Element;
	icon?: JSX.Element;
	disabled?: boolean;
};

export type SegmentedControlSize = "sm" | "md";

export type SegmentedControlProps = {
	options: SegmentedControlOption[];
	value?: string;
	defaultValue?: string;
	onChange?: (value: string) => void;
	size?: SegmentedControlSize;
	disabled?: boolean;
	name?: string;
	class?: string;
	"aria-label"?: string;
};

const rootSize: Record<SegmentedControlSize, string> = {
	sm: "h-8 rounded-control-sm",
	md: "h-10 rounded-control",
};

const indicatorRadius: Record<SegmentedControlSize, string> = {
	sm: "rounded-control-xs",
	md: "rounded-control-sm",
};

export const SegmentedControl = (props: SegmentedControlProps) => {
	const [local, rest] = splitProps(props, ["options", "size", "class"]);
	const size = () => local.size ?? "md";

	return (
		<KobalteSegmentedControl
			{...rest}
			data-segmented-control=""
			class={cx(
				"relative flex w-full shrink-0 items-stretch bg-secondary p-0.5 select-none",
				"data-[disabled]:opacity-50",
				rootSize[size()],
				local.class,
			)}
		>
			<KobalteSegmentedControl.Indicator
				class={cx(
					"absolute top-0.5 left-0.5 bg-accent shadow-[0_1px_2px_var(--shadow-color)] light:bg-card",
					"transition-[transform,width] duration-[calc(220ms*var(--motion-scale))] ease-(--ease-out-quick) data-[resizing=true]:transition-none",
					indicatorRadius[size()],
				)}
			/>
			<For each={local.options}>
				{(option) => (
					<KobalteSegmentedControl.Item
						value={option.value}
						disabled={option.disabled}
						class="relative flex min-w-0 flex-1"
					>
						<KobalteSegmentedControl.ItemInput class="peer sr-only" />
						<KobalteSegmentedControl.ItemLabel
							class={cx(
								"flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 truncate px-3 text-sm font-semibold text-muted-foreground",
								"hover:text-foreground data-[checked]:text-foreground",
								"data-[disabled]:cursor-not-allowed",
								"peer-focus-ring-inset [&_svg]:size-4 [&_svg]:shrink-0",
								indicatorRadius[size()],
							)}
						>
							{option.icon}
							<span class="truncate">{option.label}</span>
						</KobalteSegmentedControl.ItemLabel>
					</KobalteSegmentedControl.Item>
				)}
			</For>
		</KobalteSegmentedControl>
	);
};
