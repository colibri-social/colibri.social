import { VolumeIcon } from "@solar-icons/solid/bold/volume";
import { createSignal, type JSX } from "solid-js";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import { ChannelHeader } from "./ChannelHeader";
import { ChannelHeaderSkeleton } from "./ChannelHeaderSkeleton";
import { ChannelInfoHeader } from "./ChannelInfoHeader";

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

const onToggleMembers = fn();

const createMembersToggle = () => {
	const [open, setOpen] = createSignal(false);
	return {
		membersOpen: open,
		onToggleMembers: () => {
			onToggleMembers();
			setOpen((value) => !value);
		},
	};
};

const membersIcon = (button: HTMLElement) =>
	button.querySelector('[data-animated-icon="users-group"]');

const expectMembersToggleAnimates = async (button: HTMLElement) => {
	await expect(membersIcon(button)).not.toBeNull();
	button.dispatchEvent(
		new PointerEvent("pointerenter", { pointerType: "mouse" }),
	);
	await expect(membersIcon(button)).toHaveAttribute("data-hover");
	await waitFor(() =>
		expect(membersIcon(button)).not.toHaveAttribute("data-hover"),
	);
	button.dispatchEvent(
		new PointerEvent("pointerdown", {
			bubbles: true,
			button: 0,
			pointerType: "touch",
		}),
	);
	await expect(membersIcon(button)).toHaveAttribute("data-hover");
	button.dispatchEvent(
		new PointerEvent("pointerup", { bubbles: true, pointerType: "touch" }),
	);
};

const onMutedChange = fn();

const MutableDesktopHeader = (props: {
	name: string;
	description?: string;
}) => {
	const [muted, setMuted] = createSignal(false);
	const members = createMembersToggle();
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
			membersOpen={members.membersOpen()}
			onToggleMembers={members.onToggleMembers}
		/>
	);
};

const MobileHeaders = () => {
	const mobileMembers = createMembersToggle();
	return (
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
				membersOpen={mobileMembers.membersOpen()}
				onToggleMembers={mobileMembers.onToggleMembers}
			/>
			<ChannelHeader
				name="Lounge"
				icon={<VolumeIcon />}
				onBack={onBack}
				onOpenThreads={onOpenThreads}
				onToggleMembers={() => {}}
			/>
		</Stack>
	);
};

export const Mobile: Story = {
	render: () => <MobileHeaders />,
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
		const threads = canvas.getAllByRole("button", { name: "Threads" })[0];
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
		onToggleMembers.mockClear();
		await expect(
			canvas.queryByRole("button", { name: "Show members" }),
		).toBeNull();
		const members = canvas.getByRole("button", {
			name: "kingfisher-sightings, show members",
		});
		await expect(members.querySelector("svg:last-child")).not.toBeNull();
		await userEvent.click(members);
		await expect(onToggleMembers).toHaveBeenCalledTimes(1);
		await expect(members).toHaveAccessibleName(
			"kingfisher-sightings, hide members",
		);
		await userEvent.click(members);
		await expect(members).toHaveAccessibleName(
			"kingfisher-sightings, show members",
		);
		const header = members.closest("[data-channel-header]") as HTMLElement;
		const headerBox = header.getBoundingClientRect();
		const triggerBox = members.getBoundingClientRect();
		await expect(triggerBox.height).toBeGreaterThanOrEqual(30);
		await expect(
			headerBox.bottom - 1 - triggerBox.bottom,
		).toBeGreaterThanOrEqual(4);
		await expect(members).toHaveClass("ripple");
		const restingBackground = getComputedStyle(members).backgroundColor;
		await userEvent.hover(members);
		await expect(getComputedStyle(members).backgroundColor).toBe(
			restingBackground,
		);
		await userEvent.unhover(members);
		for (const button of header.querySelectorAll<HTMLElement>(
			"[data-icon-host]",
		)) {
			const box = button.getBoundingClientRect();
			await expect(box.width).toBeGreaterThanOrEqual(44);
			await expect(box.height).toBeGreaterThanOrEqual(44);
			const centerY = box.top + box.height / 2;
			const centerX = box.left + box.width / 2;
			for (const [x, y] of [
				[box.left + 1, centerY],
				[box.right - 1, centerY],
				[centerX, box.top + 1],
				[centerX, box.bottom - 1],
			] as const) {
				const hit = document.elementFromPoint(x, y);
				await expect(hit?.closest("[data-icon-host]")).toBe(button);
			}
		}
		await expectNoLayoutIssues(header);
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
				onToggleMembers={() => {}}
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
		const toggles = canvas.getAllByRole("button", { name: "Show members" });
		await expect(toggles).toHaveLength(2);
		onToggleMembers.mockClear();
		const members = toggles[0];
		await expect(members).toHaveAttribute("aria-pressed", "false");
		await expectMembersToggleAnimates(members);
		await userEvent.click(members);
		await expect(onToggleMembers).toHaveBeenCalledTimes(1);
		await expect(members).toHaveAttribute("aria-pressed", "true");
		await expect(members).toHaveAccessibleName("Hide members");
		await userEvent.click(members);
		await expect(members).toHaveAccessibleName("Show members");
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

const onViewChange = fn();

const ViewSwitchHeader = () => {
	const [view, setView] = createSignal<"chat" | "threads">("chat");
	const members = createMembersToggle();
	return (
		<Stack>
			<div data-testid="view-frame">
				<ChannelHeader
					platform="desktop"
					name="general"
					description="Everything birds"
					view={view()}
					onViewChange={(next) => {
						onViewChange(next);
						setView(next);
					}}
					onOpenThreads={onOpenThreads}
					threadsUnread
					membersOpen={members.membersOpen()}
					onToggleMembers={members.onToggleMembers}
				/>
			</div>
			<span data-testid="view">{view()}</span>
		</Stack>
	);
};

export const DesktopViewSwitch: Story = {
	name: "Desktop view switch",
	parameters: { viewport: { defaultViewport: "responsive" } },
	render: () => <ViewSwitchHeader />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		onViewChange.mockClear();
		const group = canvas.getByRole("radiogroup", { name: "Channel view" });
		await expect(
			within(group).getByRole("radio", { name: "Chat" }),
		).toBeChecked();
		await expect(canvas.queryByRole("button", { name: /^Threads/ })).toBeNull();
		await expect(group.querySelector("[data-threads-unread]")).not.toBeNull();
		const labelsFit = () => {
			for (const label of group.querySelectorAll<HTMLElement>("label")) {
				const text = label.querySelector<HTMLElement>("span.truncate") ?? label;
				expect(text.scrollWidth).toBeLessThanOrEqual(text.clientWidth);
				expect(label.getBoundingClientRect().right).toBeLessThanOrEqual(
					group.getBoundingClientRect().right + 0.5,
				);
			}
		};
		labelsFit();
		const frame = canvasElement.querySelector<HTMLElement>(
			"[data-testid='view-frame']",
		) as HTMLElement;
		frame.style.width = "420px";
		await new Promise((resolve) => requestAnimationFrame(resolve));
		labelsFit();
		await expect(
			within(group).getByText("Threads").getBoundingClientRect().width,
		).toBeGreaterThan(30);
		frame.style.width = "";
		await userEvent.click(within(group).getByText("Threads"));
		await expect(onViewChange).toHaveBeenLastCalledWith("threads");
		await expect(canvas.getByTestId("view")).toHaveTextContent("threads");
		await userEvent.click(within(group).getByText("Chat"));
		await expect(onViewChange).toHaveBeenLastCalledWith("chat");
		const header = canvasElement.querySelector<HTMLElement>(
			"[data-channel-header='desktop']",
		);
		await expect(header?.getBoundingClientRect().height).toBe(48);
		if (header) await expectNoLayoutIssues(header);
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
						onToggleMembers={() => {}}
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

const onInfoBack = fn();
const onInfoSettings = fn();

const ChannelInfoDemo = () => {
	const [muted, setMuted] = createSignal(false);
	return (
		<div class="min-h-screen bg-popover text-foreground">
			<ChannelInfoHeader
				name="general"
				description="This is a very drawn out channel description that can be up to 255 characters long."
				onBack={onInfoBack}
				backLabel="Back to #general"
				muted={muted()}
				onMutedChange={setMuted}
				onOpenSettings={onInfoSettings}
			/>
		</div>
	);
};

export const ChannelInfoMobile: Story = {
	render: () => <ChannelInfoDemo />,
	play: async ({ canvasElement }) => {
		await expectNoLayoutIssues(canvasElement.firstElementChild as HTMLElement);
		onInfoBack.mockClear();
		onInfoSettings.mockClear();
		const canvas = within(canvasElement);
		const bar = canvasElement.querySelector(
			"[data-channel-info-bar]",
		) as HTMLElement;
		await expect(bar.getBoundingClientRect().height).toBe(44);
		for (const svg of bar.querySelectorAll("button svg")) {
			await expect(svg.getBoundingClientRect().width).toBe(20);
		}
		const name = canvasElement.querySelector(
			"[data-channel-info-name]",
		) as HTMLElement;
		await expect(getComputedStyle(name).fontSize).toBe("20px");
		await userEvent.click(
			canvas.getByRole("button", { name: "Back to #general" }),
		);
		await expect(onInfoBack).toHaveBeenCalledTimes(1);
		const bell = canvas.getByRole("button", { name: "Mute channel" });
		await userEvent.click(bell);
		await waitFor(() =>
			expect(
				canvas.getByRole("button", { name: "Unmute channel" }),
			).toHaveAttribute("aria-pressed", "true"),
		);
		await userEvent.click(
			canvas.getByRole("button", { name: "Channel settings" }),
		);
		await expect(onInfoSettings).toHaveBeenCalledTimes(1);
	},
};
