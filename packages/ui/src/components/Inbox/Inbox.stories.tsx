import { For } from "solid-js";
import { expect, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { storyImages } from "../Banner/story-images";
import { InboxGroupCard } from "./InboxGroupCard";

const meta = {
	title: "Surfaces/Inbox card",
	component: InboxGroupCard,
	parameters: { viewport: { defaultViewport: "iphone" } },
	decorators: [
		(Story) => (
			<div class="flex min-h-screen flex-col gap-4 bg-background p-4">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof InboxGroupCard>;

export default meta;
type Story = StoryObj<typeof meta>;

const Placeholder = (props: { lines: number }) => (
	<div data-placeholder-row="" class="flex flex-col gap-2 px-3 py-3">
		<div class="h-3 w-32 rounded-badge bg-secondary" />
		<For each={Array.from({ length: props.lines })}>
			{() => <div class="h-3 w-full rounded-badge bg-secondary" />}
		</For>
	</div>
);

export const Mentions: Story = {
	args: {
		name: "Colibri Social Flock",
		iconSrc: storyImages.violetIcon(),
		summary: "2 mentions",
	},
	render: (args) => (
		<InboxGroupCard {...args}>
			<Placeholder lines={1} />
			<Placeholder lines={3} />
		</InboxGroupCard>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole("heading", { name: "Colibri Social Flock" }),
		).toBeInTheDocument();
		await expect(
			canvasElement.querySelectorAll("[data-placeholder-row]"),
		).toHaveLength(2);
		await expect(
			canvasElement.querySelectorAll('[aria-hidden="true"].h-px'),
		).toHaveLength(2);
	},
};

export const LongName: Story = {
	args: {
		name: "The longest Space name anyone has ever typed into Colibri",
		summary: "1 reply",
	},
	render: (args) => (
		<InboxGroupCard {...args}>
			<Placeholder lines={2} />
		</InboxGroupCard>
	),
};
