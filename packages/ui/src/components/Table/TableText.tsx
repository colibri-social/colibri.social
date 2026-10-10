import { createSignal, type JSX, Show, splitProps } from "solid-js";
import { cx } from "../../utils/cx";
import { Tooltip, TooltipContent, TooltipTrigger } from "../Tooltip/Tooltip";

export type TableTextProps = Omit<
	JSX.HTMLAttributes<HTMLSpanElement>,
	"children"
> & {
	text: string;
	detail?: string;
	children?: JSX.Element;
};

export const TableText = (props: TableTextProps) => {
	const [local, rest] = splitProps(props, [
		"text",
		"detail",
		"children",
		"class",
	]);
	const [overflowing, setOverflowing] = createSignal(false);
	const measure = (element: HTMLElement) =>
		setOverflowing(element.scrollWidth > element.clientWidth + 1);
	return (
		<Tooltip placement="top" disabled={!overflowing() && !local.detail}>
			<TooltipTrigger
				as="span"
				{...rest}
				onPointerEnter={(event: PointerEvent) =>
					measure(event.currentTarget as HTMLElement)
				}
				class={cx("block min-w-0 truncate", local.class)}
			>
				{local.children ?? local.text}
			</TooltipTrigger>
			<TooltipContent class="flex flex-col break-words">
				<Show when={overflowing() || !local.detail}>
					<span>{local.text}</span>
				</Show>
				<Show when={local.detail}>
					<span class="font-normal">{local.detail}</span>
				</Show>
			</TooltipContent>
		</Tooltip>
	);
};
