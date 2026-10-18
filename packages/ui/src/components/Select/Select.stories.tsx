import { HeadphonesRoundIcon } from "@solar-icons/solid/bold/headphones-round";
import { MicrophoneIcon } from "@solar-icons/solid/bold/microphone";
import { createSignal } from "solid-js";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { Select, type SelectOption, type SelectPlatform } from "./Select";

const meta = {
	title: "Primitives/Select",
	decorators: [
		(Story) => (
			<div class="flex min-h-[420px] max-w-sm flex-col gap-6 bg-background p-6">
				<Story />
			</div>
		),
	],
} satisfies Meta;

export default meta;
type Story = StoryObj;

const microphones: SelectOption[] = [
	{ value: "default", label: "System default", icon: () => <MicrophoneIcon /> },
	{
		value: "studio",
		label: "Studio USB microphone",
		icon: () => <MicrophoneIcon />,
	},
	{
		value: "headset",
		label: "Wireless headset",
		description: "Bluetooth, lower quality while the microphone is on.",
		icon: () => <HeadphonesRoundIcon />,
	},
	{ value: "unplugged", label: "Webcam microphone", disabled: true },
];

const DeviceSelect = (props: { platform: SelectPlatform }) => {
	const [value, setValue] = createSignal<string>();
	return (
		<>
			<Select
				platform={props.platform}
				label="Input device"
				description="Used for voice channels and calls."
				placeholder="Choose a microphone"
				options={microphones}
				value={value()}
				onChange={setValue}
				name="input-device"
			/>
			<p data-testid="value" class="text-sm text-muted-foreground">
				{value() ?? "none"}
			</p>
		</>
	);
};

export const Desktop: Story = {
	render: () => <DeviceSelect platform="desktop" />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const trigger = canvas.getByRole("button", { name: /Input device/ });
		await expect(trigger).toHaveTextContent("Choose a microphone");
		await userEvent.click(trigger);
		const listbox = await screen.findByRole("listbox");
		await expect(
			within(listbox).getByRole("option", { name: /Webcam microphone/ }),
		).toHaveAttribute("aria-disabled", "true");
		await userEvent.click(
			within(listbox).getByRole("option", { name: /Studio USB/ }),
		);
		await expect(canvas.getByTestId("value")).toHaveTextContent("studio");
		await expect(trigger).toHaveTextContent("Studio USB microphone");
		await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
		await expect(trigger.querySelectorAll("svg")).toHaveLength(2);
		await userEvent.click(trigger);
		await screen.findByRole("listbox");
		await expect(trigger.querySelectorAll("svg")).toHaveLength(2);
		await userEvent.keyboard("{Escape}");
		await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
		await expect(trigger.querySelectorAll("svg")).toHaveLength(2);
	},
};

export const DesktopKeyboard: Story = {
	render: () => <DeviceSelect platform="desktop" />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const trigger = canvas.getByRole("button", { name: /Input device/ });
		trigger.focus();
		await userEvent.keyboard("{Enter}");
		await screen.findByRole("listbox");
		await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");
		await waitFor(() =>
			expect(canvas.getByTestId("value")).toHaveTextContent("headset"),
		);
	},
};

export const Mobile: Story = {
	parameters: { viewport: { defaultViewport: "iphone" } },
	render: () => <DeviceSelect platform="mobile" />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const trigger = canvas.getByRole("button", { name: /Input device/ });
		await userEvent.click(trigger);
		const drawer = await screen.findByRole("dialog");
		await userEvent.click(
			within(drawer).getByRole("radio", { name: /Wireless headset/ }),
		);
		await expect(canvas.getByTestId("value")).toHaveTextContent("headset");
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		await expect(trigger).toHaveTextContent("Wireless headset");
		const hidden = canvasElement.querySelector<HTMLInputElement>(
			"input[name='input-device']",
		);
		await expect(hidden?.value).toBe("headset");
	},
};

export const States: Story = {
	render: () => (
		<>
			<Select
				label="Region"
				options={[
					{ value: "eu", label: "Europe" },
					{ value: "us", label: "United States" },
				]}
				defaultValue="eu"
			/>
			<Select
				label="Output device"
				placeholder="No devices found"
				options={[]}
				disabled
			/>
			<Select
				label="Bridge channel"
				placeholder="Choose a channel"
				options={[{ value: "general", label: "general" }]}
				error="Pick a channel to bridge."
			/>
		</>
	),
};
