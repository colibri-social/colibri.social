import { CheckIcon } from "@solar-icons/solid/bold/check";
import { CloseIcon } from "@solar-icons/solid/bold/close";
import { CopyIcon } from "@solar-icons/solid/bold/copy";
import { PhoneIcon } from "@solar-icons/solid/bold/phone";
import { PipetteIcon } from "@solar-icons/solid/bold/pipette";
import { SettingsIcon } from "@solar-icons/solid/bold/settings";
import { expect, fn, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import {
	HeadphonesSlashIcon,
	MicrophoneSlashIcon,
	ThreadIcon,
} from "../../icons/custom";
import { IconButton } from "./IconButton";

const meta = {
	title: "Primitives/IconButton",
	component: IconButton,
	args: {
		label: "Settings",
		icon: <SettingsIcon />,
		onClick: fn(),
	},
	argTypes: {
		variant: {
			control: "select",
			options: ["secondary", "ghost", "primary", "destructive", "inverse"],
		},
		size: { control: "select", options: ["sm", "md", "lg", "xl"] },
	},
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Variants: Story = {
	render: () => (
		<div class="flex flex-wrap items-center gap-4">
			<IconButton label="Settings" icon={<SettingsIcon />} />
			<IconButton label="Close" variant="ghost" icon={<CloseIcon />} />
			<IconButton
				label="Copy invite link"
				variant="primary"
				size="lg"
				icon={<CopyIcon />}
			/>
			<IconButton
				label="Confirm pairing code"
				variant="primary"
				size="lg"
				icon={<CheckIcon />}
			/>
			<IconButton
				label="Pick color"
				variant="inverse"
				size="lg"
				icon={<PipetteIcon />}
			/>
			<IconButton
				label="Leave call"
				variant="destructive"
				size="xl"
				icon={<PhoneIcon />}
			/>
		</div>
	),
};

export const Sizes: Story = {
	render: () => (
		<div class="flex flex-wrap items-center gap-4">
			<IconButton label="Small" size="sm" icon={<SettingsIcon />} />
			<IconButton label="Medium" size="md" icon={<SettingsIcon />} />
			<IconButton label="Large" size="lg" icon={<SettingsIcon />} />
			<IconButton label="Extra large" size="xl" icon={<SettingsIcon />} />
		</div>
	),
};

export const CustomIcons: Story = {
	render: () => (
		<div class="flex flex-wrap items-center gap-4">
			<IconButton label="Unmute" size="xl" icon={<MicrophoneSlashIcon />} />
			<IconButton label="Undeafen" size="xl" icon={<HeadphonesSlashIcon />} />
			<IconButton label="Threads" size="xl" icon={<ThreadIcon />} />
		</div>
	),
};

export const States: Story = {
	render: () => (
		<div class="flex flex-wrap items-center gap-4">
			<IconButton label="Disabled" disabled icon={<SettingsIcon />} />
			<IconButton label="Loading" loading icon={<SettingsIcon />} />
		</div>
	),
};

export const AccessibleName: Story = {
	play: async ({ canvasElement, args }) => {
		const button = within(canvasElement).getByRole("button", {
			name: "Settings",
		});
		await userEvent.click(button);
		await expect(args.onClick).toHaveBeenCalledTimes(1);
	},
};
