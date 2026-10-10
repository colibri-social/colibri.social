import { For } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import {
	CategorySkeleton,
	ChannelListHeaderSkeleton,
} from "../Channels/ChannelSkeletons";
import { MessageRowSkeleton } from "../Message/MessageSkeletons";
import { AppShell } from "../Shell/AppShell";
import { SpaceRail, SpaceRailItem } from "../SpaceRail/SpaceRail";
import { TOOLTIP_OPEN_DELAY } from "../Tooltip/Tooltip";
import { createInboxStore, INBOX_NOW, inboxNotifications } from "./fixtures";
import { InboxPopover } from "./InboxPopover";
import {
	type InboxNotification,
	type InboxStatus,
	unreadCount,
} from "./inbox-data";

const meta = {
	title: "Surfaces/Inbox popover",
	parameters: {
		layout: "fullscreen",
		viewport: { defaultViewport: "desktop" },
	},
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const onOpenNotification = fn();
const onOpenSettings = fn();
const onRetry = fn();

const Scene = (props: {
	notifications?: InboxNotification[];
	status?: InboxStatus;
}) => {
	const store = createInboxStore({
		notifications: props.notifications,
		status: props.status,
	});
	return (
		<div class="h-dvh w-full bg-background">
			<AppShell
				class="h-full"
				rail={
					<SpaceRail
						platform="desktop"
						leading={
							<InboxPopover
								spaces={store.state.spaces}
								notifications={store.state.notifications}
								status={store.state.status}
								now={INBOX_NOW}
								locale="en-GB"
								onOpenNotification={(id) => {
									store.markRead(id);
									onOpenNotification(id);
								}}
								onMarkRead={store.markRead}
								onMarkAllRead={store.markAllRead}
								onMarkCategoryRead={store.markCategoryRead}
								onMarkSpaceRead={store.markSpaceRead}
								onRetry={() => {
									onRetry();
									store.setStatus("ready");
								}}
								onOpenSettings={onOpenSettings}
							/>
						}
					>
						<For each={store.state.spaces}>
							{(space, index) => (
								<SpaceRailItem
									name={space.name}
									iconSrc={space.iconSrc}
									active={index() === 0}
									unread={index() === 2}
								/>
							)}
						</For>
					</SpaceRail>
				}
				sidebar={
					<div class="flex flex-col">
						<ChannelListHeaderSkeleton platform="desktop" />
						<CategorySkeleton rows={4} />
						<CategorySkeleton rows={3} />
					</div>
				}
			>
				<div class="flex min-h-0 flex-1 flex-col justify-end gap-2 overflow-hidden pb-4">
					<MessageRowSkeleton />
					<MessageRowSkeleton />
					<MessageRowSkeleton />
				</div>
			</AppShell>
		</div>
	);
};

const railButton = (canvasElement: HTMLElement) =>
	within(canvasElement).getByRole("button", { name: "Inbox" });

const openPopover = async (canvasElement: HTMLElement) => {
	const button = railButton(canvasElement);
	await expect(button).toHaveAttribute("aria-expanded", "false");
	await expect(button).toHaveAttribute("aria-haspopup", "dialog");
	await userEvent.click(button);
	const dialog = await screen.findByRole("dialog", { name: "Inbox" });
	await waitFor(() => expect(dialog).toBeVisible());
	await expect(button).toHaveAttribute("aria-expanded", "true");
	await expect(button).toHaveAttribute("aria-controls", dialog.id);
	return { button, dialog };
};

const expectAnchored = async (dialog: HTMLElement, button: HTMLElement) => {
	const rail = button.closest("[data-space-rail]");
	await expect(rail).not.toBeNull();
	await waitFor(() => {
		const box = dialog.getBoundingClientRect();
		const railBox = (rail as HTMLElement).getBoundingClientRect();
		const buttonBox = button.getBoundingClientRect();
		expect(box.left).toBeGreaterThanOrEqual(railBox.right - 1);
		expect(box.left - buttonBox.right).toBeLessThanOrEqual(9);
		expect(Math.abs(box.top - buttonBox.top)).toBeLessThanOrEqual(1);
		expect(box.top).toBeGreaterThanOrEqual(0);
		expect(box.bottom).toBeLessThanOrEqual(window.innerHeight);
		expect(box.right).toBeLessThanOrEqual(window.innerWidth);
	});
};

const focusedCell = () =>
	(document.activeElement as HTMLElement | null)?.closest<HTMLElement>(
		"[data-inbox-cell]",
	) ?? null;

export const Default: Story = {
	render: () => <Scene />,
	play: async ({ canvasElement }) => {
		const button = railButton(canvasElement);
		const description = document.getElementById(
			button.getAttribute("aria-describedby") ?? "",
		);
		await expect(description).toHaveTextContent(
			`${unreadCount(inboxNotifications())} unread`,
		);

		const { dialog } = await openPopover(canvasElement);
		await expectAnchored(dialog, button);

		await userEvent.hover(button);
		await new Promise((resolve) =>
			setTimeout(resolve, TOOLTIP_OPEN_DELAY + 200),
		);
		await expect(screen.queryByRole("tooltip")).toBeNull();
		await userEvent.unhover(button);

		await waitFor(() =>
			expect(dialog.contains(document.activeElement)).toBe(true),
		);
		const first = focusedCell();
		await expect(first).not.toBeNull();
		await expect(first).toHaveAttribute("tabindex", "0");

		await userEvent.keyboard("{ArrowDown}");
		const second = focusedCell();
		await expect(second?.closest("[data-inbox-row]")).not.toBe(
			first?.closest("[data-inbox-row]"),
		);
		await userEvent.keyboard("{ArrowUp}");
		await expect(focusedCell()).toBe(first);
		await userEvent.keyboard("{End}");
		const rows = dialog.querySelectorAll("[data-inbox-list] [data-inbox-row]");
		await expect(focusedCell()?.closest("[data-inbox-row]")).toBe(
			rows[rows.length - 1],
		);
		await userEvent.keyboard("{Home}");
		await expect(focusedCell()).toBe(first);

		const scroller = dialog
			.querySelector("[data-inbox-list]")
			?.closest<HTMLElement>(".overflow-y-auto");
		await expect(scroller).not.toBeNull();
		if (scroller)
			await expect(scroller.scrollHeight).toBeGreaterThan(
				scroller.clientHeight,
			);

		const markAll = within(dialog).getByRole("button", {
			name: "Mark all as read",
		});
		await userEvent.click(markAll);
		await waitFor(() =>
			expect(dialog.querySelector("[data-inbox-list]")).toBeNull(),
		);
		await expect(
			within(dialog).getByText("You're all caught up"),
		).toBeInTheDocument();
		await expect(markAll).toBeDisabled();
		await expect(
			canvasElement.querySelector("[data-inbox-rail-count]"),
		).toBeNull();
		await expect(description).toHaveTextContent("No unread notifications");
		await expect(dialog.contains(document.activeElement)).toBe(true);

		await userEvent.keyboard("{Escape}");
		await waitFor(() =>
			expect(screen.queryByRole("dialog", { name: "Inbox" })).toBeNull(),
		);
		await expect(document.activeElement).toBe(button);
		await expect(button).toHaveAttribute("aria-expanded", "false");
	},
};

export const SpaceView: Story = {
	render: () => <Scene />,
	play: async ({ canvasElement }) => {
		const { dialog } = await openPopover(canvasElement);
		const views = within(dialog).getByRole("navigation", {
			name: "Inbox views",
		});
		const birds = within(views).getByRole("button", { name: /Bird watchers/ });
		await userEvent.click(birds);
		await expect(birds).toHaveAttribute("aria-current", "true");
		const markSpace = within(dialog).getByRole("button", {
			name: "Mark Space as read",
		});
		await expect(
			within(dialog).getByRole("region", {
				name: "Bird watchers notifications",
			}),
		).toBeInTheDocument();
		await userEvent.click(markSpace);
		await waitFor(() => expect(markSpace).toBeDisabled());
		await waitFor(() =>
			expect(dialog.querySelector("[data-inbox-list]")).toBeNull(),
		);
		await expect(
			within(dialog).getByText("Nothing from this Space"),
		).toBeInTheDocument();
		await expect(birds).toHaveAttribute("aria-current", "true");
		await expect(dialog.contains(document.activeElement)).toBe(true);
	},
};

const listRows = (dialog: HTMLElement) =>
	Array.from(
		dialog.querySelectorAll<HTMLElement>(
			"[data-inbox-list] [data-inbox-row]:not([data-inbox-exiting])",
		),
	);

export const MarkOneAndOpen: Story = {
	render: () => <Scene />,
	play: async ({ canvasElement }) => {
		const { button, dialog } = await openPopover(canvasElement);
		await waitFor(() => expect(focusedCell()).not.toBeNull());
		const [firstRow, secondRow, thirdRow] = listRows(dialog);
		await expect(firstRow).toBeTruthy();
		await expect(secondRow).toBeTruthy();
		await expect(thirdRow).toBeTruthy();
		if (!firstRow || !secondRow || !thirdRow) return;
		const before = listRows(dialog).length;

		await userEvent.click(
			within(firstRow).getByRole("button", { name: "Mark as read" }),
		);
		await waitFor(() => expect(firstRow.isConnected).toBe(false));
		await expect(listRows(dialog)).toHaveLength(before - 1);
		await expect(secondRow.contains(document.activeElement)).toBe(true);

		onOpenNotification.mockClear();
		secondRow.querySelector<HTMLElement>("[data-inbox-open]")?.click();
		await expect(onOpenNotification).toHaveBeenCalledWith(
			secondRow.dataset.inboxId,
		);
		await waitFor(() =>
			expect(screen.queryByRole("dialog", { name: "Inbox" })).toBeNull(),
		);
		await expect(secondRow.isConnected).toBe(false);

		await userEvent.click(button);
		const reopened = await screen.findByRole("dialog", { name: "Inbox" });
		await waitFor(() => expect(listRows(reopened)).toHaveLength(before - 2));
		const ids = listRows(reopened).map((row) => row.dataset.inboxId);
		await expect(ids).not.toContain(firstRow.dataset.inboxId);
		await expect(ids).not.toContain(secondRow.dataset.inboxId);
		await expect(ids[0]).toBe(thirdRow.dataset.inboxId);
	},
};

export const MarkCategoryRead: Story = {
	render: () => <Scene />,
	play: async ({ canvasElement }) => {
		const { dialog } = await openPopover(canvasElement);
		const views = within(dialog).getByRole("navigation", {
			name: "Inbox views",
		});
		const kinds = () => listRows(dialog).map((row) => row.dataset.inboxKind);
		const replies = kinds().filter((kind) => kind === "reply").length;
		await expect(replies).toBeGreaterThan(0);
		await expect(kinds().length).toBeGreaterThan(replies);

		await userEvent.click(
			within(views).getByRole("button", { name: "Mark mentions as read" }),
		);
		await waitFor(() =>
			expect(
				dialog.querySelectorAll(
					"[data-inbox-list] [data-inbox-row]:not([data-inbox-kind='reply'])",
				),
			).toHaveLength(0),
		);
		await expect(kinds()).toHaveLength(replies);
		await expect(
			within(views).queryByRole("button", { name: "Mark mentions as read" }),
		).toBeNull();
		await expect(dialog.contains(document.activeElement)).toBe(true);

		await userEvent.click(
			within(views).getByRole("button", { name: /^Replies/ }),
		);
		await userEvent.click(
			within(views).getByRole("button", { name: "Mark replies as read" }),
		);
		await waitFor(() =>
			expect(dialog.querySelector("[data-inbox-list]")).toBeNull(),
		);
		await expect(within(dialog).getByText("No replies")).toBeInTheDocument();
		await expect(
			within(views).queryByRole("button", { name: "Mark replies as read" }),
		).toBeNull();
		await expect(
			within(dialog).getByRole("button", { name: "Mark all as read" }),
		).toBeDisabled();
		await expect(dialog.contains(document.activeElement)).toBe(true);
	},
};

export const Empty: Story = {
	render: () => <Scene notifications={[]} />,
	play: async ({ canvasElement }) => {
		const { dialog } = await openPopover(canvasElement);
		await expect(
			within(dialog).getByText("You're all caught up"),
		).toBeInTheDocument();
		await expect(
			within(dialog).getByRole("button", { name: "Mark all as read" }),
		).toBeDisabled();
		onOpenSettings.mockClear();
		await userEvent.click(
			within(dialog).getByRole("button", {
				name: "Open notification settings",
			}),
		);
		await expect(onOpenSettings).toHaveBeenCalled();
	},
};

export const Loading: Story = {
	render: () => <Scene status="loading" />,
	play: async ({ canvasElement }) => {
		const { dialog } = await openPopover(canvasElement);
		await expect(
			within(dialog).getByRole("status", { name: "Loading notifications" }),
		).toBeInTheDocument();
		await expect(dialog.contains(document.activeElement)).toBe(true);
	},
};

export const LoadFailed: Story = {
	render: () => <Scene status="error" />,
	play: async ({ canvasElement }) => {
		const { dialog } = await openPopover(canvasElement);
		await expect(within(dialog).getByRole("alert")).toHaveTextContent(
			"Couldn't load your inbox",
		);
		onRetry.mockClear();
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Try again" }),
		);
		await expect(onRetry).toHaveBeenCalled();
		await waitFor(() =>
			expect(dialog.querySelector("[data-inbox-list]")).not.toBeNull(),
		);
	},
};
