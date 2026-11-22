import { BellIcon } from "@solar-icons/solid/bold/bell";
import { ShareIcon } from "@solar-icons/solid/bold/share";
import { expect, fn, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { Button } from "./Button";

const meta = {
	title: "Primitives/Button",
	component: Button,
	args: {
		children: "Button",
		variant: "primary",
		onClick: fn(),
	},
	argTypes: {
		variant: {
			control: "select",
			options: [
				"primary",
				"secondary",
				"tertiary",
				"destructive",
				"destructive-subtle",
			],
		},
	},
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Variants: Story = {
	render: () => (
		<div class="flex flex-wrap items-center gap-4">
			<Button variant="primary">Primary</Button>
			<Button variant="secondary">Secondary</Button>
			<Button variant="tertiary">Tertiary</Button>
			<Button variant="destructive-subtle">Transfer ownership</Button>
			<Button variant="destructive">Delete Space</Button>
		</div>
	),
};

export const WithIcon: Story = {
	render: () => (
		<div class="flex flex-wrap items-center gap-4">
			<Button icon={<BellIcon />}>Enable notifications</Button>
			<Button variant="secondary" icon={<ShareIcon />}>
				Share invite
			</Button>
		</div>
	),
};

export const Disabled: Story = {
	render: () => (
		<div class="flex flex-wrap items-center gap-4">
			<Button disabled>Primary</Button>
			<Button variant="secondary" disabled>
				Secondary
			</Button>
			<Button variant="tertiary" disabled>
				Tertiary
			</Button>
			<Button variant="destructive-subtle" disabled>
				Transfer ownership
			</Button>
			<Button variant="destructive" disabled>
				Delete Space
			</Button>
		</div>
	),
};

export const Loading: Story = {
	args: { loading: true, children: "Join this Space" },
	play: async ({ canvasElement, args }) => {
		const button = within(canvasElement).getByRole("button", {
			name: "Join this Space",
		});
		await expect(button).toHaveAttribute("aria-busy", "true");
		await userEvent.click(button);
		await expect(args.onClick).not.toHaveBeenCalled();
	},
};

export const Block: Story = {
	parameters: { viewport: { defaultViewport: "iphone" } },
	render: () => (
		<div class="flex w-full max-w-[370px] flex-col gap-3">
			<Button block>Create Space</Button>
			<Button block variant="destructive">
				Delete channel
			</Button>
		</div>
	),
};

export const PressFeedback: Story = {
	args: { children: "Hold me" },
	play: async ({ canvasElement, args }) => {
		const button = within(canvasElement).getByRole("button", {
			name: "Hold me",
		});
		const user = userEvent.setup();
		await user.pointer({ keys: "[MouseLeft>]", target: button });
		await expect(button).toHaveAttribute("data-pressed");
		await user.pointer({ keys: "[/MouseLeft]", target: button });
		await expect(args.onClick).toHaveBeenCalledTimes(1);
		await new Promise((resolve) => setTimeout(resolve, 120));
		await expect(button).not.toHaveAttribute("data-pressed");
	},
};

export const KeyboardPress: Story = {
	args: { children: "Press with keyboard" },
	play: async ({ canvasElement, args }) => {
		const button = within(canvasElement).getByRole("button");
		button.focus();
		await userEvent.keyboard("{Enter}");
		await expect(args.onClick).toHaveBeenCalledTimes(1);
	},
};
