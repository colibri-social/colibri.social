import { createSignal, For, type JSX } from "solid-js";
import { expect } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { IconButton } from "../../components/IconButton/IconButton";
import {
	AnimatedAddIcon,
	AnimatedCaretIcon,
	AnimatedDownloadIcon,
	AnimatedMaximizeIcon,
	AnimatedTransferHorizontalIcon,
	AnimatedTransferVerticalIcon,
	AnimatedUploadIcon,
} from "./navigation";

const meta = {
	title: "Icons/Navigation",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const icons: { label: string; icon: () => JSX.Element }[] = [
	{ label: "Caret", icon: () => <AnimatedCaretIcon /> },
	{ label: "Add", icon: () => <AnimatedAddIcon /> },
	{ label: "Maximize", icon: () => <AnimatedMaximizeIcon /> },
	{
		label: "Transfer horizontal",
		icon: () => <AnimatedTransferHorizontalIcon />,
	},
	{ label: "Transfer vertical", icon: () => <AnimatedTransferVerticalIcon /> },
	{ label: "Upload", icon: () => <AnimatedUploadIcon /> },
	{ label: "Download", icon: () => <AnimatedDownloadIcon /> },
];

export const Gallery: Story = {
	render: () => (
		<div class="flex flex-wrap gap-4">
			<For each={icons}>
				{(item) => (
					<div class="flex w-28 flex-col items-center gap-2">
						<IconButton size="xl" label={item.label} icon={item.icon()} />
						<span class="text-center text-xs text-muted-foreground">
							{item.label}
						</span>
					</div>
				)}
			</For>
		</div>
	),
	play: async ({ canvasElement }) => {
		await expect(
			canvasElement.querySelectorAll("[data-animated-icon]"),
		).toHaveLength(icons.length);
	},
};

export const CaretToggle: Story = {
	render: () => {
		const [open, setOpen] = createSignal(false);
		return (
			<IconButton
				size="xl"
				variant="ghost"
				label={open() ? "Collapse category" : "Expand category"}
				aria-expanded={open()}
				onClick={() => setOpen(!open())}
				icon={<AnimatedCaretIcon open={open()} />}
			/>
		);
	},
};
