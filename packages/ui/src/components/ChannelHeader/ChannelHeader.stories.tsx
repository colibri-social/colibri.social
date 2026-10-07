import { UsersGroupRoundedIcon } from "@solar-icons/solid/bold/users-group-rounded";
import { createSignal, type JSX } from "solid-js";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { IconButton } from "../IconButton/IconButton";
import { ChannelHeader } from "./ChannelHeader";
import { ChannelHeaderSkeleton } from "./ChannelHeaderSkeleton";

const meta = {
	title: "Messaging/Channel header",
	parameters: { viewport: { defaultViewport: "iphone" }, layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const onBack = fn();
const onOpenInfo = fn();
const onOpenThreads = fn();

const Stack = (props: { children: JSX.Element }) => (
	<div class="flex min-h-screen flex-col gap-6 bg-background text-foreground">
		{props.children}
	</div>
);

const DesktopActions = () => (
	<IconButton
		variant="ghost"
		size="md"
		label="Show member list"
		icon={<UsersGroupRoundedIcon />}
	/>
);

const onMutedChange = fn();

const MutableDesktopHeader = (props: {
	name: string;
	description?: string;
}) => {
	const [muted, setMuted] = createSignal(false);
	return (
		<ChannelHeader
			platform="desktop"
			name={props.name}
			description={props.description}
			muted={muted()}
			onMutedChange={(next) => {
				onMutedChange(next);
				setMuted(next);
			}}
			actions={<DesktopActions />}
		/>
	);
};

export const Mobile: Story = {
	render: () => (
		<Stack>
			<ChannelHeader
				name="general"
				onBack={onBack}
				onOpenInfo={onOpenInfo}
				onOpenThreads={onOpenThreads}
			/>
			<ChannelHeader
				name="kingfisher-sightings"
				description="Post your kingfisher sightings here"
				onBack={onBack}
				onOpenInfo={onOpenInfo}
				onOpenThreads={onOpenThreads}
				threadsUnread
			/>
		</Stack>
	),
	play: async ({ canvasElement }) => {
		onBack.mockClear();
		onOpenInfo.mockClear();
		onOpenThreads.mockClear();
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getAllByRole("button", { name: "Back" })[0]);
		await expect(onBack).toHaveBeenCalledTimes(1);
		await userEvent.click(
			canvas.getByRole("button", { name: "general, channel info" }),
		);
		await expect(onOpenInfo).toHaveBeenCalledTimes(1);
		const threads = canvas.getByRole("button", { name: "Threads" });
		const threadIcon = () =>
			threads.querySelector('[data-animated-icon="thread"]');
		await expect(threadIcon()).not.toBeNull();
		threads.dispatchEvent(
			new PointerEvent("pointerenter", { pointerType: "mouse" }),
		);
		await expect(threadIcon()).toHaveAttribute("data-hover");
		await waitFor(() => expect(threadIcon()).not.toHaveAttribute("data-hover"));
		threads.dispatchEvent(
			new PointerEvent("pointerdown", {
				bubbles: true,
				button: 0,
				pointerType: "touch",
			}),
		);
		await expect(threadIcon()).toHaveAttribute("data-hover");
		threads.dispatchEvent(
			new PointerEvent("pointerup", { bubbles: true, pointerType: "touch" }),
		);
		await userEvent.click(threads);
		await expect(onOpenThreads).toHaveBeenCalledTimes(1);
		await expect(
			canvas.getByRole("button", { name: "Threads, new activity" }),
		).toBeVisible();
		const headings = canvas.getAllByRole("heading", { level: 1 });
		await expect(headings[0]).toHaveTextContent("general");
		await expect(
			canvas.queryByText("Post your kingfisher sightings here"),
		).toBeNull();
	},
};

const LONG_NAME = "a-super-duper-long-channel-name-for-the-canal-walkers";

export const LongName: Story = {
	render: () => (
		<Stack>
			<ChannelHeader
				name={LONG_NAME}
				onBack={onBack}
				onOpenInfo={onOpenInfo}
				onOpenThreads={onOpenThreads}
			/>
			<ChannelHeader
				platform="desktop"
				name={LONG_NAME}
				description="This is the channel description, and it keeps going well past the edge of the header"
				actions={<DesktopActions />}
			/>
		</Stack>
	),
	play: async ({ canvasElement }) => {
		const names = Array.from(
			canvasElement.querySelectorAll<HTMLElement>(`[title="${LONG_NAME}"]`),
		);
		await expect(names).toHaveLength(2);
		for (const name of names) {
			await expect(name.scrollWidth).toBeGreaterThan(name.clientWidth);
		}
		for (const header of Array.from(
			canvasElement.querySelectorAll<HTMLElement>("[data-channel-header]"),
		)) {
			await expect(header.scrollWidth).toBeLessThanOrEqual(header.clientWidth);
		}
	},
};

export const Desktop: Story = {
	parameters: { viewport: { defaultViewport: "responsive" } },
	render: () => (
		<Stack>
			<MutableDesktopHeader
				name="Active channel"
				description="This is the channel description"
			/>
			<MutableDesktopHeader name="Read channel" />
		</Stack>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole("heading", { name: "Active channel" }),
		).toBeVisible();
		await expect(
			canvas.getByText("This is the channel description"),
		).toBeVisible();
		await expect(
			canvas.getAllByRole("button", { name: "Show member list" }),
		).toHaveLength(2);
		onMutedChange.mockClear();
		const bell = canvas.getAllByRole("button", { name: "Mute channel" })[0];
		const slash = () => bell.querySelector("[data-slashed]");
		await expect(bell).toHaveAttribute("aria-pressed", "false");
		await expect(slash()).toHaveAttribute("data-slashed", "off");
		await userEvent.click(bell);
		await expect(onMutedChange).toHaveBeenCalledTimes(1);
		await expect(onMutedChange).toHaveBeenCalledWith(true);
		await expect(bell).toHaveAttribute("aria-pressed", "true");
		await expect(bell).toHaveAccessibleName("Unmute channel");
		await expect(slash()).toHaveAttribute("data-slashed", "on");
		await waitFor(() =>
			expect(bell.querySelector("[data-animated-icon='bell']")).toHaveAttribute(
				"data-hover",
			),
		);
		await userEvent.click(bell);
		await expect(onMutedChange).toHaveBeenLastCalledWith(false);
		await expect(bell).toHaveAttribute("aria-pressed", "false");
		await expect(slash()).toHaveAttribute("data-slashed", "off");
	},
};

export const Skeletons: Story = {
	render: () => (
		<Stack>
			<ChannelHeaderSkeleton />
			<ChannelHeaderSkeleton platform="desktop" />
		</Stack>
	),
};

export const SizeParity: Story = {
	render: () => (
		<Stack>
			<div data-pair-group="">
				<div data-pair="real">
					<ChannelHeader
						name="general"
						onBack={onBack}
						onOpenInfo={onOpenInfo}
						onOpenThreads={onOpenThreads}
					/>
				</div>
				<div data-pair="skeleton">
					<ChannelHeaderSkeleton />
				</div>
			</div>
			<div data-pair-group="">
				<div data-pair="real">
					<ChannelHeader
						platform="desktop"
						name="Active channel"
						description="This is the channel description"
						actions={<DesktopActions />}
					/>
				</div>
				<div data-pair="skeleton">
					<ChannelHeaderSkeleton platform="desktop" />
				</div>
			</div>
		</Stack>
	),
	play: async ({ canvasElement }) => {
		const groups =
			canvasElement.querySelectorAll<HTMLElement>("[data-pair-group]");
		for (const [index, group] of Array.from(groups).entries()) {
			const box = (kind: string) =>
				group
					.querySelector(`[data-pair=${kind}]`)
					?.firstElementChild?.getBoundingClientRect();
			const real = box("real");
			const skeleton = box("skeleton");
			await expect({
				index,
				width: Math.round(skeleton?.width ?? -1),
				height: Math.round(skeleton?.height ?? -1),
			}).toEqual({
				index,
				width: Math.round(real?.width ?? -2),
				height: Math.round(real?.height ?? -2),
			});
		}
	},
};
