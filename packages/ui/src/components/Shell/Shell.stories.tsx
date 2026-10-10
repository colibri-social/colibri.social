import { createSignal, For, type JSX } from "solid-js";
import { expect, fn, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { Badge } from "../Badge/Badge";
import { storyImages } from "../Banner/story-images";
import { ChannelHeader } from "../ChannelHeader/ChannelHeader";
import { AttachmentDropzone } from "../Composer/AttachmentDropzone";
import {
	AttachmentTray,
	type PendingAttachment,
} from "../Composer/AttachmentTray";
import { Composer } from "../Composer/Composer";
import { fileTransfer, fireDrag, storyFiles } from "../Composer/drag-fixtures";
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
	const [muted, setMuted] = createSignal(false);
	const [attachments, setAttachments] = createSignal<PendingAttachment[]>([]);
	const attach = (files: File[]) =>
		setAttachments((current) => [
			...current,
			...files.map((file, index) => ({
				id: `${file.name}-${current.length + index}`,
				name: file.name,
				size: file.size,
			})),
		]);
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
				header={
					<ChannelHeader
						platform="desktop"
						name="general"
						description="Everything birds, canals and the occasional sandwich"
						membersOpen={membersOpen()}
						onToggleMembers={() => setMembersOpen((open) => !open)}
						muted={muted()}
						onMutedChange={setMuted}
						onOpenThreads={() => {}}
					/>
				}
			>
				<AttachmentDropzone
					channelName="general"
					onFiles={attach}
					footer={
						<Composer
							platform="desktop"
							channelName="general"
							hasAttachments={attachments().length > 0}
							top={
								<AttachmentTray
									items={attachments()}
									max={10}
									onRemove={(id) =>
										setAttachments((current) =>
											current.filter((item) => item.id !== id),
										)
									}
								/>
							}
						/>
					}
				>
					<Messages />
				</AttachmentDropzone>
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
		const animatedIn = (name: string | RegExp) =>
			canvas
				.getByRole("button", { name })
				.querySelector("[data-animated-icon], .icon-fx");
		await expect(animatedIn("Settings")).not.toBeNull();
		await expect(animatedIn("Threads")).not.toBeNull();
		await expect(animatedIn("Mute channel")).not.toBeNull();
		await expect(animatedIn("Hide members")).not.toBeNull();
		await expect(animatedIn("Upload a file")).not.toBeNull();
		await expect(animatedIn("Send a GIF")).not.toBeNull();
		await expect(animatedIn("Add an emoji")).not.toBeNull();
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
		const sidebar = canvasElement.querySelector(
			"[data-shell-sidebar]",
		) as HTMLElement;
		const rail = canvasElement.querySelector(
			"[data-shell-rail]",
		) as HTMLElement;
		const panel = dock.firstElementChild as HTMLElement;
		const panelRect = panel.getBoundingClientRect();
		await expect(
			Math.abs(sidebar.getBoundingClientRect().bottom - panelRect.top),
		).toBeLessThanOrEqual(0.5);
		await expect(rail.getBoundingClientRect().bottom).toBeLessThanOrEqual(
			panelRect.top,
		);
		await expect(Math.round(panelRect.left - navRect.left)).toBe(16);
		await expect(Math.round(navRect.right - panelRect.right)).toBe(16);
		await expect(Math.round(navRect.bottom - panelRect.bottom)).toBe(16);
		const content = canvasElement.querySelector(
			"[data-shell-content]",
		) as HTMLElement;
		const header = canvasElement.querySelector(
			"[data-channel-header]",
		) as HTMLElement;
		const main = canvasElement.querySelector(
			"[data-shell-main]",
		) as HTMLElement;
		const membersPane = canvasElement.querySelector(
			"[data-shell-members]",
		) as HTMLElement;
		const contentRect = content.getBoundingClientRect();
		const headerRect = header.getBoundingClientRect();
		const mainRect = main.getBoundingClientRect();
		const membersRect = membersPane.getBoundingClientRect();
		await expect(Math.round(headerRect.width)).toBe(
			Math.round(contentRect.width - 1),
		);
		await expect(Math.round(membersRect.top)).toBe(Math.round(mainRect.top));
		await expect(Math.round(membersRect.bottom)).toBe(
			Math.round(mainRect.bottom),
		);
		await expect(Math.round(mainRect.top)).toBe(Math.round(headerRect.bottom));
		const contentStyle = getComputedStyle(content);
		await expect(contentStyle.borderTopWidth).toBe("1px");
		await expect(contentStyle.borderTopColor).toBe(
			getComputedStyle(sidebar).borderTopColor,
		);
		await expect(Math.round(contentRect.top)).toBe(
			Math.round(sidebar.getBoundingClientRect().top),
		);
		await expect(dockRect.top).toBeGreaterThanOrEqual(
			sidebar.getBoundingClientRect().bottom - 0.5,
		);
	},
};

export const DropFilesToAttach: Story = {
	render: () => <Shell />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const overlay = canvasElement.querySelector(
			"[data-attachment-dropzone-overlay]",
		) as HTMLElement;
		const main = canvasElement.querySelector(
			"[data-shell-main]",
		) as HTMLElement;
		const composer = canvasElement.querySelector(
			"[data-composer]",
		) as HTMLElement;
		const message = canvasElement.querySelector(
			"[data-message]",
		) as HTMLElement;
		const transfer = fileTransfer(...storyFiles());
		fireDrag(message, "dragenter", transfer);
		await expect(overlay).toHaveAttribute("data-visible");
		await expect(
			within(overlay).getByText("Upload to #general"),
		).toBeInTheDocument();
		const overlayRect = overlay.getBoundingClientRect();
		await expect(overlayRect.top).toBeGreaterThanOrEqual(
			main.getBoundingClientRect().top,
		);
		await expect(overlayRect.bottom).toBeLessThanOrEqual(
			composer.getBoundingClientRect().top,
		);
		fireDrag(message, "drop", transfer);
		await expect(overlay).not.toHaveAttribute("data-visible");
		await expect(canvas.getByText("2/10 attachments")).toBeInTheDocument();
		await expect(
			canvas.getByRole("button", { name: "Remove crow-notes.pdf" }),
		).toBeInTheDocument();
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
			<WindowBar
				title="Colibri Social Flock"
				iconSrc={storyImages.violetIcon()}
				macInset
			/>
			<WindowBar
				title="Colibri Social Flock"
				iconSrc={storyImages.tealIcon()}
				controls={<WindowControls />}
			/>
			<WindowBar
				title="Colibri Social Flock"
				iconSrc={storyImages.tealIcon()}
				controls={<WindowControls maximized />}
			/>
		</div>
	),
	play: async ({ canvasElement }) => {
		const bars = Array.from(
			canvasElement.querySelectorAll<HTMLElement>("[data-window-bar]"),
		);
		const mac = bars[0] as HTMLElement;
		const inset = mac.querySelector(
			"[data-traffic-light-inset]",
		) as HTMLElement;
		await expect(inset.getBoundingClientRect().width).toBe(72);
		await expect(inset.getBoundingClientRect().left).toBeLessThan(
			mac.getBoundingClientRect().left + 16,
		);
		await expect(within(mac).queryByRole("button")).toBeNull();
		for (const bar of bars.slice(1)) {
			const box = bar.getBoundingClientRect();
			const close = within(bar).getByRole("button", { name: "Close" });
			const controls = bar.querySelector(
				"[data-window-bar-trailing]",
			) as HTMLElement;
			await expect(Math.round(controls.getBoundingClientRect().right)).toBe(
				Math.round(box.right),
			);
			await expect(close.getBoundingClientRect().right).toBeCloseTo(
				box.right,
				0,
			);
			for (const button of within(bar).getAllByRole("button")) {
				await expect(button.getBoundingClientRect().left).toBeGreaterThan(
					box.left + box.width / 2,
				);
			}
		}
		for (const bar of bars) {
			const icon = bar.querySelector("img, canvas") as HTMLElement;
			await expect(icon).not.toBeNull();
		}
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
		const profile = real.querySelector(
			"[data-user-panel-profile]",
		) as HTMLElement;
		const avatar = profile.firstElementChild as HTMLElement;
		const box = profile.getBoundingClientRect();
		const face = avatar.getBoundingClientRect();
		const top = face.top - box.top;
		await expect(Math.round(face.width)).toBe(32);
		await expect(
			Math.abs(top - (box.bottom - face.bottom)),
		).toBeLessThanOrEqual(1);
		await expect(Math.abs(top - (face.left - box.left))).toBeLessThanOrEqual(1);
		const text = avatar.nextElementSibling as HTMLElement;
		await expect(
			Math.round(text.getBoundingClientRect().left - face.right),
		).toBe(8);
	},
};
