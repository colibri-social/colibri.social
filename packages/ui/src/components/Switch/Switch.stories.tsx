import {
	expect,
	fireEvent,
	fn,
	userEvent,
	waitFor,
	within,
} from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { Switch } from "./Switch";

const meta = {
	title: "Primitives/Switch",
	component: Switch,
	args: {
		onChange: fn(),
		"aria-label": "Make channel private",
	},
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const States: Story = {
	render: () => (
		<div class="flex items-center gap-6">
			<Switch aria-label="Off" />
			<Switch aria-label="On" defaultChecked />
			<Switch aria-label="Disabled off" disabled />
			<Switch aria-label="Disabled on" disabled defaultChecked />
		</div>
	),
};

export const WithLabel: Story = {
	args: {
		"aria-label": undefined,
		label: "Stay in sync with Bluesky?",
		description:
			"Updates to your Bluesky profile will be mirrored to your Colibri profile.",
	},
};

export const ClickToggles: Story = {
	play: async ({ canvasElement, args }) => {
		const input = within(canvasElement).getByRole("switch");
		const control = canvasElement.querySelector<HTMLElement>(
			"[data-switch-control]",
		)!;
		await userEvent.click(control);
		await expect(input).toBeChecked();
		await expect(args.onChange).toHaveBeenLastCalledWith(true);
		await userEvent.click(control);
		await expect(input).not.toBeChecked();
	},
};

export const KeyboardToggles: Story = {
	play: async ({ canvasElement, args }) => {
		const input = within(canvasElement).getByRole("switch");
		input.focus();
		await userEvent.keyboard(" ");
		await expect(input).toBeChecked();
		await expect(args.onChange).toHaveBeenCalledWith(true);
	},
};

export const DragToToggle: Story = {
	play: async ({ canvasElement, args }) => {
		const input = within(canvasElement).getByRole("switch");
		const control = canvasElement.querySelector<HTMLElement>(
			"[data-switch-control]",
		)!;
		const box = control.getBoundingClientRect();
		const y = box.top + box.height / 2;

		await fireEvent.pointerDown(control, {
			pointerId: 1,
			button: 0,
			clientX: box.left + 8,
			clientY: y,
		});
		await waitFor(() => expect(control).toHaveAttribute("data-pressed"));
		for (const step of [4, 10, 18, 26, 34]) {
			await fireEvent.pointerMove(control, {
				pointerId: 1,
				clientX: box.left + 8 + step,
				clientY: y,
			});
		}
		await fireEvent.pointerUp(control, {
			pointerId: 1,
			button: 0,
			clientX: box.left + 42,
			clientY: y,
		});
		await fireEvent.click(control);

		await expect(input).toBeChecked();
		await expect(args.onChange).toHaveBeenCalledTimes(1);
		await expect(args.onChange).toHaveBeenLastCalledWith(true);
	},
};

export const Disabled: Story = {
	args: { disabled: true },
	play: async ({ canvasElement, args }) => {
		const input = within(canvasElement).getByRole("switch");
		const control = canvasElement.querySelector<HTMLElement>(
			"[data-switch-control]",
		)!;
		await userEvent.click(control, { pointerEventsCheck: 0 });
		await expect(input).not.toBeChecked();
		await expect(args.onChange).not.toHaveBeenCalled();
	},
};
