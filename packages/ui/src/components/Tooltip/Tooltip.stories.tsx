import { BellIcon } from "@solar-icons/solid/bold/bell";
import { MagnifierIcon } from "@solar-icons/solid/bold/magnifier";
import { PinIcon } from "@solar-icons/solid/bold/pin";
import { SettingsIcon } from "@solar-icons/solid/bold/settings";
import { UsersGroupRoundedIcon } from "@solar-icons/solid/bold/users-group-rounded";
import { For, type JSX } from "solid-js";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { IconButton } from "../IconButton/IconButton";
import {
	Tooltip,
	TooltipContent,
	type TooltipPlacement,
	TooltipTrigger,
} from "./Tooltip";

const meta = {
	title: "Overlays/Tooltip",
	component: Tooltip,
	decorators: [
		(Story) => (
			<div class="flex min-h-[320px] items-center justify-center bg-background p-8">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

const IconTip = (props: {
	label: string;
	icon: JSX.Element;
	placement?: TooltipPlacement;
	defaultOpen?: boolean;
}) => (
	<Tooltip placement={props.placement} defaultOpen={props.defaultOpen}>
		<TooltipTrigger
			as={IconButton}
			variant="ghost"
			label={props.label}
			icon={props.icon}
		/>
		<TooltipContent>{props.label}</TooltipContent>
	</Tooltip>
);

const PLACEMENTS: TooltipPlacement[] = ["top", "right", "bottom", "left"];

export const Placements: Story = {
	render: () => (
		<div class="grid grid-cols-2 gap-x-32 gap-y-20">
			<For each={PLACEMENTS}>
				{(placement) => (
					<IconTip
						label={`Placed ${placement}`}
						icon={<PinIcon />}
						placement={placement}
						defaultOpen
					/>
				)}
			</For>
		</div>
	),
	play: async () => {
		await waitFor(() =>
			expect(document.querySelectorAll("[data-tooltip]")).toHaveLength(4),
		);
		const arrow = document.querySelector("[data-tooltip-arrow]");
		await expect(arrow).not.toBeNull();
	},
};

export const DelayGroup: Story = {
	render: () => (
		<div class="flex items-center gap-1 rounded-control-lg border border-border bg-popover p-1">
			<IconTip label="Search" icon={<MagnifierIcon />} placement="bottom" />
			<IconTip label="Notifications" icon={<BellIcon />} placement="bottom" />
			<IconTip
				label="Members"
				icon={<UsersGroupRoundedIcon />}
				placement="bottom"
			/>
			<IconTip
				label="Channel settings"
				icon={<SettingsIcon />}
				placement="bottom"
			/>
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const search = canvas.getByRole("button", { name: "Search" });
		const members = canvas.getByRole("button", { name: "Members" });
		await userEvent.hover(search);
		await expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
		const first = await screen.findByRole("tooltip", {}, { timeout: 2000 });
		await expect(first).toHaveTextContent("Search");
		await expect(first).not.toHaveAttribute("data-instant");
		await userEvent.unhover(search);
		await userEvent.hover(members);
		await waitFor(() =>
			expect(screen.getByRole("tooltip")).toHaveTextContent("Members"),
		);
		await expect(screen.getByRole("tooltip")).toHaveAttribute("data-instant");
		await userEvent.unhover(members);
		await waitFor(() =>
			expect(screen.queryByRole("tooltip")).not.toBeInTheDocument(),
		);
	},
};

export const LongText: Story = {
	render: () => (
		<Tooltip placement="top" defaultOpen>
			<TooltipTrigger
				as={IconButton}
				variant="secondary"
				label="Connection details"
				icon={<SettingsIcon />}
			/>
			<TooltipContent>
				Voice is connected through the nearest region. Latency stays under 40 ms
				for most members of this Space.
			</TooltipContent>
		</Tooltip>
	),
	play: async () => {
		const tooltip = await screen.findByRole("tooltip");
		await expect(tooltip.getBoundingClientRect().width).toBeLessThanOrEqual(
			256,
		);
	},
};

const firePointerEnter = (element: Element, pointerType: string) => {
	element.dispatchEvent(
		new PointerEvent("pointerenter", { pointerType, bubbles: false }),
	);
	element.dispatchEvent(
		new PointerEvent("pointerover", { pointerType, bubbles: true }),
	);
};

export const TouchSuppressed: Story = {
	render: () => <IconTip label="Pinned messages" icon={<PinIcon />} />,
	play: async ({ canvasElement }) => {
		const trigger = within(canvasElement).getByRole("button", {
			name: "Pinned messages",
		});
		firePointerEnter(trigger, "touch");
		firePointerEnter(trigger, "pen");
		await new Promise((resolve) => setTimeout(resolve, 900));
		await expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
		await userEvent.hover(trigger);
		await screen.findByRole("tooltip", {}, { timeout: 2000 });
		await userEvent.unhover(trigger);
	},
};
