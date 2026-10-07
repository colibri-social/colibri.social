import { UsersGroupRoundedIcon } from "@solar-icons/solid/bold/users-group-rounded";
import { createSignal, For, type JSX } from "solid-js";
import { expect, fn, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { Badge } from "../Badge/Badge";
import { storyImages } from "../Banner/story-images";
import { ChannelHeader } from "../ChannelHeader/ChannelHeader";
import { Composer } from "../Composer/Composer";
import { IconButton } from "../IconButton/IconButton";
import { fixtureMembers, fixtureRoles } from "../Members/fixtures";
import { groupMembers, MemberList } from "../Members/MemberList";
import { MessageRow } from "../Message/MessageRow";
import { AppShell } from "./AppShell";
import {
	DEFAULT_THREAD_PANE_WIDTH,
	MIN_THREAD_PANE_WIDTH,
} from "./PaneResizer";
import { UserPanel, UserPanelSkeleton } from "./UserPanel";
import { WindowBar, WindowControls } from "./WindowBar";

const meta = {
	title: "Layout/Desktop shell",
	parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const NOW = new Date("2026-10-08T14:30:00");
const onOpenProfile = fn();

const Frame = (props: { children: JSX.Element }) => (
	<div style={{ width: "1920px", height: "1080px" }}>{props.children}</div>
);

const Placeholder = (props: { label: string; class?: string }) => (
	<div
		class={`flex items-center justify-center rounded-control border border-dashed border-border text-xs text-muted-foreground ${props.class ?? ""}`}
	>
		{props.label}
	</div>
);

const Rail = () => (
	<div class="flex flex-col items-center gap-2 py-2">
		<For each={[0, 1, 2, 3, 4]}>
			{() => <div class="size-10 rounded-control-lg bg-secondary" />}
		</For>
	</div>
);

const Messages = () => (
	<div class="flex min-h-0 flex-1 flex-col justify-end overflow-y-auto pb-2">
		<MessageRow
			author={{ name: "Lou", avatarSrc: storyImages.violetIcon() }}
			badge={<Badge>Team</Badge>}
			timestamp={new Date("2026-10-08T14:02:00")}
			now={NOW}
			locale="en-GB"
		>
			Guys! I saw a kingfisher on the canal this morning!
		</MessageRow>
		<MessageRow
			author={{ name: "Kris", avatarSrc: storyImages.amberIcon() }}
			timestamp={new Date("2026-10-08T14:10:00")}
			now={NOW}
			locale="en-GB"
		>
			No way, on the stretch by the bridge?
		</MessageRow>
	</div>
);

const Shell = (props: {
	thread?: boolean;
	defaultMembersOpen?: boolean;
	onThreadWidth?: (width: number) => void;
}) => {
	const [membersOpen, setMembersOpen] = createSignal(
		props.defaultMembersOpen ?? true,
	);
	return (
		<Frame>
			<AppShell
				class="h-full"
				windowBar={
					<WindowBar
						title="Colibri Social Flock"
						iconSrc={storyImages.violetIcon()}
						controls={<WindowControls />}
					/>
				}
				rail={<Rail />}
				sidebar={
					<div class="flex flex-col gap-2 p-2">
						<Placeholder label="Space header" class="h-40" />
						<Placeholder label="Channel list" class="h-96" />
					</div>
				}
				dock={
					<UserPanel
						name="Lou"
						avatarSrc={storyImages.violetIcon()}
						presence="online"
						status="Building a nest"
						onOpenProfile={() => onOpenProfile()}
					/>
				}
				members={
					<div class="min-h-0 flex-1 overflow-y-auto">
						<MemberList groups={groupMembers(fixtureMembers(), fixtureRoles)} />
					</div>
				}
				membersOpen={membersOpen()}
				thread={
					props.thread ? (
						<Placeholder label="Thread" class="m-2 flex-1" />
					) : undefined
				}
				onThreadWidthChange={props.onThreadWidth}
			>
				<ChannelHeader
					platform="desktop"
					name="general"
					description="Everything birds, canals and the occasional sandwich"
					actions={
						<IconButton
							variant="ghost"
							size="md"
							label={membersOpen() ? "Hide members" : "Show members"}
							aria-pressed={membersOpen()}
							icon={<UsersGroupRoundedIcon />}
							onClick={() => setMembersOpen((open) => !open)}
						/>
					}
				/>
				<Messages />
				<Composer platform="desktop" channelName="general" />
			</AppShell>
		</Frame>
	);
};

export const Desktop: Story = {
	render: () => <Shell />,
	play: async ({ canvasElement }) => {
		onOpenProfile.mockClear();
		const canvas = within(canvasElement);
		await expect(
			canvasElement.querySelector("[data-shell-members]"),
		).not.toBeNull();
		await userEvent.click(canvas.getByRole("button", { name: "Hide members" }));
		await expect(
			canvasElement.querySelector("[data-shell-members]"),
		).toBeNull();
		await userEvent.click(canvas.getByRole("button", { name: "Show members" }));
		await expect(
			canvasElement.querySelector("[data-shell-members]"),
		).not.toBeNull();
		await userEvent.click(canvas.getByRole("button", { name: /^Lou/ }));
		await expect(onOpenProfile).toHaveBeenCalledTimes(1);
		const dock = canvasElement.querySelector(
			"[data-shell-dock]",
		) as HTMLElement;
		const navigation = canvasElement.querySelector(
			"[data-shell-navigation]",
		) as HTMLElement;
		const dockRect = dock.getBoundingClientRect();
		const navRect = navigation.getBoundingClientRect();
		await expect(Math.round(dockRect.left - navRect.left)).toBe(16);
		await expect(Math.round(navRect.right - dockRect.right)).toBe(17);
	},
};

export const ThreadPane: Story = {
	render: () => <Shell thread defaultMembersOpen={false} />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const pane = canvasElement.querySelector(
			"[data-shell-thread]",
		) as HTMLElement;
		const resizer = canvas.getByRole("separator", {
			name: "Resize thread panel",
		});
		await expect(pane.getBoundingClientRect().width).toBe(
			DEFAULT_THREAD_PANE_WIDTH,
		);
		resizer.focus();
		await userEvent.keyboard("{ArrowLeft}");
		await expect(pane.getBoundingClientRect().width).toBe(
			DEFAULT_THREAD_PANE_WIDTH + 16,
		);
		await userEvent.keyboard("{ArrowRight}{ArrowRight}");
		await expect(pane.getBoundingClientRect().width).toBe(
			DEFAULT_THREAD_PANE_WIDTH - 16,
		);
		for (let step = 0; step < 20; step++)
			await userEvent.keyboard("{ArrowRight}");
		await expect(pane.getBoundingClientRect().width).toBe(
			MIN_THREAD_PANE_WIDTH,
		);
		for (let step = 0; step < 60; step++)
			await userEvent.keyboard("{ArrowLeft}");
		await expect(resizer).toHaveAttribute("aria-valuenow", "720");
		await userEvent.keyboard("{Home}");
		await expect(resizer).toHaveAttribute(
			"aria-valuenow",
			String(DEFAULT_THREAD_PANE_WIDTH),
		);
	},
};

export const WindowBars: Story = {
	render: () => (
		<div class="flex w-[960px] flex-col gap-4 bg-card p-4">
			<WindowBar title="Colibri Social Flock" macInset />
			<WindowBar
				title="Colibri Social Flock"
				iconSrc={storyImages.tealIcon()}
				controls={<WindowControls />}
			/>
			<WindowBar
				title="Colibri Social Flock"
				controls={<WindowControls maximized order={["close", "minimize"]} />}
				controlsSide="left"
			/>
		</div>
	),
	play: async ({ canvasElement }) => {
		const bars =
			canvasElement.querySelectorAll<HTMLElement>("[data-window-bar]");
		const inset = bars[0]?.querySelector(
			"[data-traffic-light-inset]",
		) as HTMLElement;
		await expect(inset.getBoundingClientRect().width).toBe(72);
		await expect(
			within(bars[2] as HTMLElement).getByRole("button", { name: "Close" }),
		).toBeInTheDocument();
		const leftControls = bars[2]?.querySelector(
			"[data-window-bar-trailing]",
		) as HTMLElement;
		await expect(leftControls.getBoundingClientRect().left).toBeLessThan(
			(bars[2] as HTMLElement).getBoundingClientRect().left + 4,
		);
	},
};

export const UserPanelParity: Story = {
	render: () => (
		<div class="flex w-[312px] flex-col gap-4 bg-background p-4">
			<UserPanel name="Lou" presence="online" status="Building a nest" />
			<UserPanelSkeleton />
		</div>
	),
	play: async ({ canvasElement }) => {
		const real = canvasElement.querySelector(
			"[data-user-panel]",
		) as HTMLElement;
		const skeleton = real.nextElementSibling as HTMLElement;
		const a = real.getBoundingClientRect();
		const b = skeleton.getBoundingClientRect();
		await expect(Math.abs(a.width - b.width)).toBeLessThanOrEqual(1);
		await expect(Math.abs(a.height - b.height)).toBeLessThanOrEqual(1);
		await expect(Math.round(a.height)).toBe(56);
	},
};
