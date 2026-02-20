import type { ParentComponent } from "solid-js";
import {
	Tooltip,
	TooltipContent,
	TooltipPortal,
	TooltipTrigger,
} from "../shadcn-solid/Tooltip";
import { cn } from "@/utils/cn";

export const MessageAction: ParentComponent<{
	tooltipText: string;
	buttonClasses?: string;
	onClick?: ((e: MouseEvent) => void) | (() => void);
}> = (props) => {
	return (
		<Tooltip>
			<TooltipTrigger>
				<button
					type="button"
					onClick={props.onClick}
					class={cn(
						"w-8 h-8 cursor-pointer flex items-center justify-center hover:bg-muted",
						props.buttonClasses,
					)}
				>
					{props.children}
				</button>
			</TooltipTrigger>
			<TooltipPortal>
				<TooltipContent>
					<p class="m-0">{props.tooltipText}</p>
				</TooltipContent>
			</TooltipPortal>
		</Tooltip>
	);
};
