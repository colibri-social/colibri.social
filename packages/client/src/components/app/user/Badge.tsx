import { type ParentComponent, Show } from "solid-js";
import { cx } from "../../../utils/cva";
import { badgeDescription } from "../../../utils/user-badges";
import {
	Popover,
	PopoverContent,
	PopoverPortal,
	PopoverTrigger,
} from "../../ui/Popover";

const BADGE_STYLE_CLASSES: Record<string, string> = {
	bot: "bg-foreground text-background",
	team: "bg-primary",
	"play-store-tester":
		"text-white rounded-full border-1 border-transparent [background:linear-gradient(90deg,color-mix(in_srgb,#ff4d4d_18%,black),color-mix(in_srgb,#ffcc00_18%,black),color-mix(in_srgb,#22c55e_18%,black),color-mix(in_srgb,#3b82f6_18%,black))_padding-box,linear-gradient(90deg,#ff4d4d,#ffcc00,#22c55e,#3b82f6)_border-box]",
	"backer-five": "bg-lime-500 text-black",
	"sponsor-twenty-five": "bg-teal-500 text-white",
	donator: "bg-fuchsia-500 text-white",
};

const DEFAULT_BADGE_CLASSES = "bg-secondary";

export const Badge: ParentComponent<{
	text: string;
	size: "lg" | "base" | "sm" | "xs";
	style: string;
	class?: string;
}> = (props) => {
	const content = () => (
		<span
			class={cx(
				"text-foreground px-1.5 rounded-sm flex shrink-0 whitespace-nowrap",
				BADGE_STYLE_CLASSES[props.style] ?? DEFAULT_BADGE_CLASSES,
			)}
		>
			<span class="w-fit">{props.children}</span>
			<span
				class="font-bold!"
				classList={{
					"text-lg": props.size === "lg",
					"text-base": props.size === "base",
					"text-sm": props.size === "sm",
					"text-[11px]": props.size === "xs",
				}}
			>
				{props.text}
			</span>
		</span>
	);

	return (
		<Show when={badgeDescription(props.style)} fallback={content()}>
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
