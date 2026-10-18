import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { Avatar } from "../Avatar/Avatar";
import { Checkbox } from "./Checkbox";

const meta = {
	title: "Primitives/Checkbox",
	component: Checkbox,
	args: {
		onChange: fn(),
		"aria-label": "Select role",
	},
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const States: Story = {
	render: () => (
		<div class="flex items-center gap-6">
			<Checkbox aria-label="Unchecked" />
			<Checkbox aria-label="Checked" defaultChecked />
			<Checkbox aria-label="Disabled" disabled />
			<Checkbox aria-label="Disabled checked" disabled defaultChecked />
		</div>
	),
};

export const ConsentStatement: Story = {
	args: {
		"aria-label": undefined,
		label: "I understand that this action cannot be undone",
	},
};

export const ListSelection: Story = {
	parameters: { viewport: { defaultViewport: "iphone" } },
	render: () => (
		<div class="flex w-full max-w-[370px] flex-col gap-4">
			{["Alice", "Bob"].map((name) => (
				<Checkbox
					labelPosition="start"
					class="w-full items-center"
					label={
						<span class="flex items-center gap-3">
							<Avatar name={name} presence="online" />
							{name}
						</span>
					}
				/>
			))}
		</div>
	),
};

export const Toggles: Story = {
	play: async ({ canvasElement, args }) => {
		const checkbox = within(canvasElement).getByRole("checkbox");
		const check = canvasElement.querySelector("svg path") as SVGPathElement;
		await expect(getComputedStyle(check).strokeDashoffset).toBe("16px");
		await userEvent.click(checkbox);
		await expect(checkbox).toBeChecked();
		await expect(args.onChange).toHaveBeenLastCalledWith(true);
		await waitFor(() =>
			expect(getComputedStyle(check).strokeDashoffset).toBe("0px"),
		);
		await userEvent.keyboard(" ");
		await expect(checkbox).not.toBeChecked();
	},
};
