import { CheckIcon } from "@solar-icons/solid/bold/check";
import { CloseIcon } from "@solar-icons/solid/bold/close";
import { CopyIcon } from "@solar-icons/solid/bold/copy";
import { PhoneIcon } from "@solar-icons/solid/bold/phone";
import { PipetteIcon } from "@solar-icons/solid/bold/pipette";
import { SettingsIcon } from "@solar-icons/solid/bold/settings";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
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

export const LabelTooltip: Story = {
	render: () => (
		<div class="flex items-center gap-4 p-12">
			<IconButton label="Settings" icon={<SettingsIcon />} />
			<IconButton
				label="Mute"
				tooltip="Mute your microphone for everyone"
				icon={<MicrophoneSlashIcon />}
			/>
			<IconButton label="Copy" tooltip={false} icon={<CopyIcon />} />
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const settings = canvas.getByRole("button", { name: "Settings" });
		await expect(settings).not.toHaveAttribute("title");
		await userEvent.hover(settings);
		await waitFor(
			() => expect(screen.getByRole("tooltip")).toHaveTextContent("Settings"),
			{ timeout: 2000 },
		);
		await userEvent.unhover(settings);
		const mute = canvas.getByRole("button", { name: "Mute" });
		await userEvent.hover(mute);
		await waitFor(
			() =>
				expect(screen.getByRole("tooltip")).toHaveTextContent(
					"Mute your microphone for everyone",
				),
			{ timeout: 2000 },
		);
		await userEvent.unhover(mute);
		await waitFor(() =>
			expect(screen.queryByRole("tooltip")).not.toBeInTheDocument(),
		);
		const copy = canvas.getByRole("button", { name: "Copy" });
		await userEvent.hover(copy);
		await new Promise((resolve) => setTimeout(resolve, 900));
		await expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
		await userEvent.unhover(copy);
	},
};

const disabledClick = fn();
const disabledSubmit = fn();

export const DisabledTooltip: Story = {
	render: () => (
		<form
			class="flex items-center gap-4 p-12"
			onSubmit={(event) => {
				event.preventDefault();
				disabledSubmit();
			}}
		>
			<input aria-label="Message" />
			<IconButton
				type="submit"
				label="Muted by a moderator"
				disabled
				icon={<MicrophoneSlashIcon />}
				onClick={disabledClick}
			/>
		</form>
	),
	play: async ({ canvasElement }) => {
		disabledClick.mockClear();
		disabledSubmit.mockClear();
		const canvas = within(canvasElement);
		const button = canvas.getByRole("button", {
			name: "Muted by a moderator",
		});
		await expect(button).toHaveAttribute("aria-disabled", "true");
		await expect(button).not.toHaveAttribute("disabled");

		await userEvent.hover(button);
		await waitFor(
			() =>
				expect(screen.getByRole("tooltip")).toHaveTextContent(
					"Muted by a moderator",
				),
			{ timeout: 2000 },
		);
		await userEvent.click(button);
		await expect(disabledClick).not.toHaveBeenCalled();
		await expect(disabledSubmit).not.toHaveBeenCalled();
		await userEvent.unhover(button);
		await waitFor(() =>
			expect(screen.queryByRole("tooltip")).not.toBeInTheDocument(),
		);

		const input = canvas.getByRole("textbox", { name: "Message" });
		await userEvent.click(input);
		await userEvent.tab();
		await expect(button).toHaveFocus();
		await waitFor(
			() =>
				expect(screen.getByRole("tooltip")).toHaveTextContent(
					"Muted by a moderator",
				),
			{ timeout: 2000 },
		);
		await userEvent.keyboard("{Enter}");
		await userEvent.keyboard(" ");
		await expect(disabledClick).not.toHaveBeenCalled();
		await expect(disabledSubmit).not.toHaveBeenCalled();
		await expect(button).not.toHaveAttribute("data-pressed");

		await userEvent.click(input);
		await userEvent.keyboard("{Enter}");
		await expect(disabledSubmit).not.toHaveBeenCalled();
	},
};
