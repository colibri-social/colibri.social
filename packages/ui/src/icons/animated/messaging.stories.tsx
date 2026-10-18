import { For, type JSX } from "solid-js";
import { expect } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { Button } from "../../components/Button/Button";
import { IconButton } from "../../components/IconButton/IconButton";
import type { AnimatedIconHandle, AnimatedIconProps } from "./AnimatedIcon";
import {
	AnimatedBellRingIcon,
	AnimatedChatRoundDotsIcon,
	AnimatedChatSquareDotsIcon,
	AnimatedCheckReadIcon,
	AnimatedCodeIcon,
	AnimatedGalleryAddIcon,
	AnimatedLikeIcon,
	AnimatedLinkIcon,
	AnimatedNotesIcon,
	AnimatedStarsIcon,
	AnimatedTextStrikethroughIcon,
	AnimatedTextUnderlineIcon,
	AnimatedThreadIcon,
	AnimatedUnlinkIcon,
} from "./messaging";

const meta = {
	title: "Icons/Messaging",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

type IconEntry = {
	label: string;
	icon: (props: AnimatedIconProps) => JSX.Element;
};

const icons: IconEntry[] = [
	{ label: "Channel", icon: AnimatedChatSquareDotsIcon },
	{ label: "Chat (dots)", icon: AnimatedChatRoundDotsIcon },
	{ label: "Upload image", icon: AnimatedGalleryAddIcon },
	{ label: "Documentation", icon: AnimatedNotesIcon },
	{ label: "Thread", icon: AnimatedThreadIcon },
	{ label: "Mark as read", icon: AnimatedCheckReadIcon },
	{ label: "Link", icon: AnimatedLinkIcon },
	{ label: "Unlink", icon: AnimatedUnlinkIcon },
	{ label: "Feedback", icon: AnimatedLikeIcon },
	{ label: "What's new", icon: AnimatedStarsIcon },
	{ label: "Underline", icon: AnimatedTextUnderlineIcon },
	{ label: "Strikethrough", icon: AnimatedTextStrikethroughIcon },
	{ label: "Code", icon: AnimatedCodeIcon },
	{ label: "Notifications", icon: AnimatedBellRingIcon },
];

export const Gallery: Story = {
	render: () => (
		<div class="flex flex-wrap gap-4">
			<For each={icons}>
				{(entry) => (
					<div class="flex w-24 flex-col items-center gap-2">
						<IconButton size="xl" label={entry.label} icon={entry.icon({})} />
						<span class="text-center text-xs text-muted-foreground">
							{entry.label}
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

export const Attention: Story = {
	render: () => {
		const handles: AnimatedIconHandle[] = [];
		return (
			<div class="flex flex-wrap gap-4">
				<For each={icons}>
					{(entry, index) => (
						<div class="flex w-24 flex-col items-center gap-2">
							<div class="flex size-12 items-center justify-center">
								{entry.icon({
									size: 32,
									ref: (handle) => {
										handles[index()] = handle;
									},
								})}
							</div>
							<Button
								variant="secondary"
								onClick={() => handles[index()]?.play()}
							>
								Play
							</Button>
							<span class="text-center text-xs text-muted-foreground">
								{entry.label}
							</span>
						</div>
					)}
				</For>
			</div>
		);
	},
};
