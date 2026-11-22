import { createSignal, type JSX, Show } from "solid-js";
import { cx } from "../../utils/cx";
import { Popover, PopoverAnchor, PopoverContent } from "../Popover/Popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "../Tooltip/Tooltip";

export type BadgeInfoProps = {
	name: string;
	description?: string;
	label?: string;
	class?: string;
	children: JSX.Element;
};

const BadgeInfoBody = (props: { name: string; description?: string }) => (
	<span class="flex flex-col gap-0.5 text-left">
		<span class="text-xs font-bold text-foreground">{props.name}</span>
		<Show when={props.description}>
			<span class="text-xs font-medium text-muted-foreground">
				{props.description}
			</span>
		</Show>
	</span>
);

export const BadgeInfo = (props: BadgeInfoProps) => {
	const [popoverOpen, setPopoverOpen] = createSignal(false);
	let pointerType: string | undefined;
	let closedByTriggerPress = false;

	const onPointerDown = (event: PointerEvent) => {
		pointerType = event.pointerType;
		closedByTriggerPress = popoverOpen();
	};

	const onClick = (event: MouseEvent) => {
		event.stopPropagation();
		const fromMouse = pointerType === "mouse" && event.detail > 0;
		pointerType = undefined;
		if (fromMouse) return;
		if (closedByTriggerPress) {
			closedByTriggerPress = false;
			setPopoverOpen(false);
			return;
		}
		setPopoverOpen((open) => !open);
	};

	return (
		<Popover
			open={popoverOpen()}
			onOpenChange={setPopoverOpen}
			placement="top"
			gutter={6}
		>
			<PopoverAnchor as="span" class="inline-flex shrink-0">
				<Tooltip disabled={popoverOpen()} placement="top">
					<TooltipTrigger
						as="button"
						type="button"
						data-badge-info=""
						aria-label={props.label}
						aria-expanded={popoverOpen()}
						class={cx(
							"inline-flex shrink-0 cursor-default rounded-badge outline-none focus-ring",
							props.class,
						)}
						onPointerDown={onPointerDown}
						onClick={onClick}
					>
						{props.children}
					</TooltipTrigger>
					<TooltipContent class="px-2.5 py-1.5">
						<BadgeInfoBody name={props.name} description={props.description} />
					</TooltipContent>
				</Tooltip>
			</PopoverAnchor>
			<PopoverContent
				aria-label={props.name}
				class="w-fit max-w-64 rounded-control px-3 py-2"
			>
				<BadgeInfoBody name={props.name} description={props.description} />
			</PopoverContent>
		</Popover>
	);
};
