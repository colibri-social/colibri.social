import { For } from "solid-js";
import { expect, fn, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import { storyImages } from "../Banner/story-images";
import { MarkAllReadIcon } from "../ContextMenu/menu-entries";
import { IconButton } from "../IconButton/IconButton";
import { InboxGroupCard } from "./InboxGroupCard";
import { InboxRow } from "./InboxParts";
import type { InboxNotification } from "./inbox-data";

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

const markGroupRead = fn();
const markRowRead = fn();

const groupRows: InboxNotification[] = [
	{
		id: "a",
		kind: "mention",
		spaceId: "long",
		channelName: "a-channel-with-an-unreasonably-long-name-for-testing",
		threadName: "Planning the summer meetup in Hamburg",
		author: "Someone with a very long display name that keeps going",
		timestamp: new Date(2026, 9, 9, 12, 4),
		mentionLabel: "@louis",
		text: "Very long text content so the preview has to clamp after a couple of lines, and it keeps going and going without stopping at all for a while.",
		read: false,
	},
	{
		id: "b",
		kind: "reply",
		spaceId: "long",
		channelName: "general",
		author: "Mira",
		timestamp: new Date(2026, 9, 9, 11, 40),
		replyTo: "Count me in, I'll bring the stove",
		text: "Perfect, then I'll bring extra gas canisters",
		read: true,
	},
];

export const WithActionsAndRows: Story = {
	args: {
		name: "The longest Space name anyone has ever typed into Colibri",
		summary: "1 mention, 1 reply",
	},
	render: (args) => (
		<InboxGroupCard
			{...args}
			actions={
				<IconButton
					variant="ghost"
					size="md"
					label="Mark Space as read"
					icon={<MarkAllReadIcon />}
					onClick={() => markGroupRead()}
				/>
			}
		>
			<ul data-inbox-list="" class="m-0 flex list-none flex-col p-0">
				<For each={groupRows}>
					{(notification) => (
						<InboxRow
							notification={notification}
							showSpace={false}
							now={new Date(2026, 9, 9, 14, 20)}
							onOpen={() => {}}
							onMarkRead={(id) => markRowRead(id)}
							class="rounded-none"
						/>
					)}
				</For>
			</ul>
		</InboxGroupCard>
	),
	play: async ({ canvasElement }) => {
		markGroupRead.mockClear();
		markRowRead.mockClear();
		const canvas = within(canvasElement);
		await expectNoLayoutIssues(canvasElement);
		await userEvent.click(
			canvas.getByRole("button", { name: "Mark Space as read" }),
		);
		await expect(markGroupRead).toHaveBeenCalledOnce();
		const markRead = canvas.getAllByRole("button", { name: "Mark as read" });
		await expect(markRead).toHaveLength(1);
		await userEvent.click(markRead[0] as HTMLElement);
		await expect(markRowRead).toHaveBeenCalledWith("a");
	},
};
