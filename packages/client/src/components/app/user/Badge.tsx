import { type ParentComponent, Show } from "solid-js";
import { cx } from "../../../utils/cva";
import {
	badgeAppearance,
	badgeDescription,
	badgeStyle,
	badgeText,
} from "../../../utils/user-badges";
import {
	Popover,
	PopoverContent,
	PopoverPortal,
	PopoverTrigger,
} from "../../ui/Popover";

const DEFAULT_BADGE_CLASSES = "bg-zinc-800 text-neutral-50";
const GRADIENT_BORDER_CLASSES = "rounded-full border-1 border-transparent";

export const Badge: ParentComponent<{
	val: string;
	size: "lg" | "base" | "sm" | "xs";
	class?: string;
}> = (props) => {
	const appearance = () => badgeAppearance(props.val);

	const content = () => (
		<span
			class={cx(
				"text-neutral-50 px-1.5 rounded-sm flex shrink-0 whitespace-nowrap",
				appearance() === undefined && DEFAULT_BADGE_CLASSES,
				appearance()?.variant === "gradientBorder" && GRADIENT_BORDER_CLASSES,
			)}
			style={badgeStyle(props.val)}
		>
			<span class="w-fit">{props.children}</span>
			<span
				class="font-bold!"
				classList={{
					"text-lg": props.size === "lg",
					"text-base": props.size === "base",
					"text-sm": props.size === "sm",
					"text-xs": props.size === "xs",
				}}
			>
				{badgeText(props.val)}
			</span>
		</span>
	);

	return (
		<Show when={badgeDescription(props.val)} fallback={content()}>
			{(description) => (
				<Popover placement="top" gutter={4}>
					<PopoverTrigger
						as="span"
						class={cx("cursor-pointer", props.class)}
						onClick={(e) => e.stopPropagation()}
					>
						{content()}
					</PopoverTrigger>
					<PopoverPortal>
						<PopoverContent class="w-fit max-w-64 p-0 px-3 py-1.5 text-xs">
							{description()}
						</PopoverContent>
					</PopoverPortal>
				</Popover>
			)}
		</Show>
	);
};
