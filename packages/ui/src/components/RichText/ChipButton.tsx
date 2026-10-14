import type { JSX } from "solid-js";
import { cx } from "../../utils/cx";
import { createMenuTrigger } from "../../utils/gestures";

export type ChipButtonProps = {
	label: string;
	onClick?: (event: MouseEvent) => void;
	onMenu?: (event: Event) => void;
	class?: string;
	children: JSX.Element;
};

export const chipButtonClass =
	"inline cursor-pointer rounded-control-xs border-0 bg-transparent p-0 align-baseline font-[inherit] text-[length:inherit] text-inherit outline-none focus-ring";

export const ChipButton = (props: ChipButtonProps) => (
	<button
		type="button"
		data-chip-button=""
		data-member-menu={props.onMenu ? "" : undefined}
		ref={(element) =>
			createMenuTrigger(element, {
				enabled: () => !!props.onMenu,
				onMenu: (event) => props.onMenu?.(event),
			})
		}
		aria-label={props.label}
		class={cx(chipButtonClass, props.class)}
		onClick={(event) => {
			event.stopPropagation();
			props.onClick?.(event);
		}}
	>
		{props.children}
	</button>
);
