import { expect, fn, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { Radio, RadioGroup } from "./Radio";

const meta = {
	title: "Primitives/Radio",
	component: RadioGroup,
	args: {
		onChange: fn(),
		"aria-label": "Channel type",
		children: undefined,
	},
	render: (args) => (
		<RadioGroup {...args}>
			<Radio
				value="text"
				labelPosition="start"
				label="Text"
				description="Normal group chat conversations, images, and bird facts."
			/>
			<Radio
				value="voice"
				labelPosition="start"
				label="Voice"
				description="Hang out together with voice, video, and screen share."
			/>
			<Radio value="stage" labelPosition="start" label="Stage" disabled />
		</RadioGroup>
	),
} satisfies Meta<typeof RadioGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
	args: { defaultValue: "text", class: "w-full max-w-[370px]" },
};

export const Selects: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByLabelText("Voice"));
		await expect(canvas.getByLabelText("Voice")).toBeChecked();
		await expect(args.onChange).toHaveBeenLastCalledWith("voice");
	},
};

export const ArrowKeys: Story = {
	args: { defaultValue: "text" },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		canvas.getByLabelText("Text").focus();
		await userEvent.keyboard("{ArrowDown}");
		await expect(canvas.getByLabelText("Voice")).toBeChecked();
	},
};
