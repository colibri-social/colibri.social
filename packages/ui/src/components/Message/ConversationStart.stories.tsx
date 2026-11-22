import { VolumeSmallIcon } from "@solar-icons/solid/bold/volume-small";
import type { JSX } from "solid-js";
import { expect, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import { ConversationStart, ThreadStartDivider } from "./ConversationStart";
import { createListMessages } from "./message-list-fixtures";
import {
	ChannelView,
	createChannel,
	iphone,
	settled,
} from "./message-list-story-kit";

const meta = {
	title: "Messaging/Conversation start",
	parameters: iphone,
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const Frame = (props: { children: JSX.Element }) => (
	<div class="flex w-full max-w-[402px] flex-col bg-background text-foreground">
		{props.children}
	</div>
);

export const Channel: Story = {
	render: () => (
		<Frame>
			<ConversationStart
				kind="channel"
				name="general"
				description="Say hi, share what you're working on, and keep it friendly."
			/>
		</Frame>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole("heading", { name: "Welcome to #general" }),
		).toBeVisible();
		await expect(
			canvas.getByText(/This is the start of #general\./),
		).toBeVisible();
		await expectNoLayoutIssues(canvasElement.firstElementChild as HTMLElement);
	},
};

export const VoiceChannel: Story = {
	render: () => (
		<Frame>
			<ConversationStart
				kind="channel"
				name="lounge"
				icon={<VolumeSmallIcon />}
			/>
		</Frame>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole("heading", { name: "Welcome to #lounge" }),
		).toBeVisible();
		const badge = canvasElement.querySelector(
			"[data-conversation-start] > span[aria-hidden]",
		) as HTMLElement;
		await expect(badge.querySelectorAll("svg")).toHaveLength(1);
		await expectNoLayoutIssues(canvasElement.firstElementChild as HTMLElement);
	},
};

export const LongNames: Story = {
	render: () => (
		<Frame>
			<ConversationStart
				kind="channel"
				name="an-extremely-long-channel-name-that-keeps-going-without-any-breaks"
				description="Asupercalifragilisticexpialidociousdescriptionwithoutspacesthatmustwrapinsteadofoverflowing and then some regular words after it."
			/>
			<ConversationStart
				kind="thread"
				name="A thread with a remarkably long name that wraps across several lines on a phone"
			/>
		</Frame>
	),
	play: async ({ canvasElement }) => {
		await expectNoLayoutIssues(canvasElement.firstElementChild as HTMLElement);
	},
};

export const ThreadWithParent: Story = {
	render: () => (
		<Frame>
			<div class="px-4 py-2 text-sm">Parent message renders here</div>
			<ThreadStartDivider />
		</Frame>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("Start of thread")).toBeVisible();
		await expectNoLayoutIssues(canvasElement.firstElementChild as HTMLElement);
	},
};

export const AtTopOfList: Story = {
	render: () => {
		const channel = createChannel({
			source: createListMessages(6),
			paging: false,
		});
		return (
			<ChannelView
				channel={channel}
				platform="mobile"
				height="640px"
				listProps={{
					header: <ConversationStart kind="channel" name="general" />,
				}}
			/>
		);
	},
	play: async ({ canvasElement }) => {
		await settled(canvasElement);
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole("heading", { name: "Welcome to #general" }),
		).toBeVisible();
		await expectNoLayoutIssues(canvasElement.firstElementChild as HTMLElement);
	},
};
