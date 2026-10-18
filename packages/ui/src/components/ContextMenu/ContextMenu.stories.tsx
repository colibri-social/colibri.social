import { InboxIcon } from "@solar-icons/solid/bold/inbox";
import { createSignal, For } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import { storyImages } from "../Banner/story-images";
import { CategoryHeader } from "../Channels/Category";
import { ChannelListHeader } from "../Channels/ChannelListHeader";
import { ChannelRow, VoiceChannelRow } from "../Channels/ChannelRow";
import { DropdownMenu } from "../DropdownMenu/DropdownMenu";
import { InviteTable } from "../Invite/InviteTable";
import { FIXED_NOW, inviteFixtures } from "../Invite/invite-fixtures";
import { MemberRow } from "../Members/MemberRow";
import { InviteCard } from "../Settings/Settings";
import {
	SpaceRail,
	SpaceRailAction,
	SpaceRailItem,
} from "../SpaceRail/SpaceRail";
import { CategoryContextMenu } from "./CategoryMenu";
import { ChannelContextMenu, VoiceChannelContextMenu } from "./ChannelMenu";
import { InboxContextMenu } from "./InboxMenu";
import { inviteMenuEntries } from "./InviteMenu";
import { MemberContextMenu, type MemberMenuRole } from "./MemberMenu";
import { ContextMenu, MenuItem, MenuSeparator } from "./Menu";
import { MessageContextMenu } from "./MessageMenu";
import { SpaceContextMenu } from "./SpaceMenu";
import { ThreadContextMenu } from "./ThreadMenu";

const meta = {
	title: "Overlays/Context menu",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const rightClick = (element: Element, at?: { x: number; y: number }) => {
	const rect = element.getBoundingClientRect();
	element.dispatchEvent(
		new MouseEvent("contextmenu", {
			bubbles: true,
			cancelable: true,
			button: 2,
			clientX: at?.x ?? rect.left + 24,
			clientY: at?.y ?? rect.top + 16,
		}),
	);
};

const onCopy = fn();
const onDelete = fn();

export const Generic: Story = {
	render: () => (
		<div class="min-h-screen bg-background p-8">
			<ContextMenu
				menu={
					<>
						<MenuItem label="Copy" onSelect={onCopy} />
						<MenuItem label="Disabled item" disabled />
						<MenuSeparator />
						<MenuItem label="Delete" tone="destructive" onSelect={onDelete} />
					</>
				}
			>
				<div
					data-testid="area"
					class="flex h-40 items-center justify-center rounded-surface border border-dashed border-border text-sm text-muted-foreground"
				>
					Right-click anywhere in this area
				</div>
			</ContextMenu>
		</div>
	),
	play: async ({ canvasElement }) => {
		onCopy.mockClear();
		onDelete.mockClear();
		const area = within(canvasElement).getByTestId("area");
		const menu = await waitFor(() => {
			if (!screen.queryByRole("menu")) rightClick(area);
			return screen.getByRole("menu");
		});
		await expect(
			await within(menu).findByRole("menuitem", { name: "Disabled item" }),
		).toHaveAttribute("aria-disabled", "true");
		await userEvent.keyboard("{ArrowDown}");
		await userEvent.keyboard("{Enter}");
		await expect(onCopy).toHaveBeenCalledTimes(1);
		await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
		await waitFor(() =>
			expect(canvasElement.closest("[aria-hidden]")).toBeNull(),
		);
	},
};

const onOpenLink = fn();
const onCopyMessageAtUri = fn();
const onShowMessageOnPdsls = fn();

const onCopyImage = fn();
const onDownloadImage = fn();

export const MessageImageMenu: Story = {
	name: "Message menu on an image",
	render: () => (
		<div class="min-h-screen bg-background p-8">
			<MessageContextMenu
				image={{ onCopy: onCopyImage, onDownload: onDownloadImage }}
				onReply={fn()}
				onCopyText={fn()}
				onDelete={fn()}
			>
				<div
					data-testid="image-message"
					class="rounded-control px-4 py-3 text-base hover:bg-card"
				>
					Right-click the image in this message.
				</div>
			</MessageContextMenu>
		</div>
	),
	play: async ({ canvasElement }) => {
		onCopyImage.mockClear();
		onDownloadImage.mockClear();
		const message = within(canvasElement).getByTestId("image-message");
		const menu = await waitFor(() => {
			if (!screen.queryByRole("menu")) rightClick(message);
			return screen.getByRole("menu");
		});
		const labels = within(menu)
			.getAllByRole("menuitem")
			.map((item) => item.textContent?.trim());
		await expect(labels).toEqual([
			"Copy image",
			"Download image",
			"Reply",
			"Copy text",
			"Delete message",
		]);
		const download = within(menu).getByRole("menuitem", {
			name: "Download image",
		});
		const reply = within(menu).getByRole("menuitem", { name: "Reply" });
		const follows = (a: Node, b: Node) =>
			!!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
		const between = Array.from(
			menu.querySelectorAll('[role="separator"], hr'),
		).filter(
			(separator) => follows(download, separator) && follows(separator, reply),
		);
		await expect(between).toHaveLength(1);
		await userEvent.keyboard("{ArrowDown}");
		await expect(document.activeElement?.textContent?.trim()).toBe(
			"Copy image",
		);
		await userEvent.keyboard("{Enter}");
		await expect(onCopyImage).toHaveBeenCalledTimes(1);
		await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
	},
};

export const MessageMenu: Story = {
	render: () => (
		<div class="min-h-screen bg-background p-8">
			<MessageContextMenu
				link={{ onOpen: onOpenLink, onCopy: fn() }}
				onEdit={fn()}
				onReply={fn()}
				onForward={fn()}
				onOpenThread={fn()}
				onSelect={fn()}
				onCopyText={fn()}
				gif={{ saved: true, onToggle: fn() }}
				onLinkPreviews={fn()}
				onViewReactions={fn()}
				developerMode
				onCopyAtUri={onCopyMessageAtUri}
				onShowOnPdsls={onShowMessageOnPdsls}
				onDelete={fn()}
			>
				<div
					data-testid="message"
					class="rounded-control px-4 py-3 text-base hover:bg-card"
				>
					Right-click this message. It has a link, a saved GIF and every action.
				</div>
			</MessageContextMenu>
		</div>
	),
	play: async ({ canvasElement }) => {
		onOpenLink.mockClear();
		const message = within(canvasElement).getByTestId("message");
		const menu = await waitFor(() => {
			if (!screen.queryByRole("menu")) rightClick(message);
			return screen.getByRole("menu");
		});
		await within(menu).findByRole("menuitem", { name: "Delete message" });
		const labels = within(menu)
			.getAllByRole("menuitem")
			.map((item) => item.textContent?.trim());
		await expect(labels).toEqual([
			"Open link",
			"Copy link",
			"Edit message",
			"Reply",
			"Forward",
			"Open thread",
			"Select messages",
			"Copy text",
			"Remove saved GIF",
			"Link previews",
			"View reactions",
			"Developer mode",
			"Delete message",
		]);
		await expect(
			within(menu).getByRole("menuitem", { name: "Delete message" }),
		).toHaveAttribute("data-tone", "destructive");
		await expectNoLayoutIssues(menu);
		onCopyMessageAtUri.mockClear();
		onShowMessageOnPdsls.mockClear();
		await userEvent.keyboard("{End}");
		await expectHighlighted(menu, "Delete message");
		await userEvent.keyboard("{ArrowUp}");
		await expectHighlighted(menu, "Developer mode");
		await userEvent.keyboard("{ArrowRight}");
		const submenu = await screen.findByRole("menu", { name: "Developer mode" });
		await expect(itemNames(submenu)).toEqual(["Copy AT-URI", "Show on PDSls"]);
		await expectNoLayoutIssues(submenu);
		await expectHighlighted(submenu, "Copy AT-URI");
		await userEvent.keyboard("{Enter}");
		await expect(onCopyMessageAtUri).toHaveBeenCalledTimes(1);
		await expect(onShowMessageOnPdsls).not.toHaveBeenCalled();
		await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
		const again = await waitFor(() => {
			if (!screen.queryByRole("menu")) rightClick(message);
			return screen.getByRole("menu");
		});
		await userEvent.click(
			within(again).getByRole("menuitem", { name: "Open link" }),
		);
		await expect(onOpenLink).toHaveBeenCalledTimes(1);
		await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
		await waitFor(() =>
			expect(canvasElement.closest("[aria-hidden]")).toBeNull(),
		);
	},
};

const spy = {
	markChannelRead: fn(),
	muteChannel: fn(),
	copyAtUri: fn(),
	copyInvite: fn(),
	deleteCategory: fn(),
	leave: fn(),
	openChat: fn(),
	clearInbox: fn(),
	markInboxRead: fn(),
};

const resetSpies = () => {
	for (const value of Object.values(spy)) value.mockClear();
};

const noop = () => {};

const railSpaces = [
	{
		id: "flock",
		name: "Colibri Social Flock",
		iconSrc: storyImages.violetIcon(),
	},
	{ id: "birds", name: "Bird watchers", iconSrc: storyImages.tealIcon() },
	{ id: "canal", name: "Canal walks", iconSrc: storyImages.amberIcon() },
];

const Sidebar = (props: {
	member?: boolean;
	developerMode?: boolean;
	inboxCount?: number;
}) => {
	const admin = () => !props.member;
	const developerMode = () => props.developerMode ?? true;
	const manage = () => (admin() ? noop : undefined);
	const [channelMuted, setChannelMuted] = createSignal(false);
	const [categoryMuted, setCategoryMuted] = createSignal(false);
	const [spaceMuted, setSpaceMuted] = createSignal(false);
	const [connected, setConnected] = createSignal(false);

	const channel = (name: string, preview: string) => (
		<ChannelContextMenu
			name={name}
			onMarkAsRead={name === "general" ? spy.markChannelRead : noop}
			muted={name === "general" && channelMuted()}
			onMutedChange={(muted) => {
				spy.muteChannel(muted);
				if (name === "general") setChannelMuted(muted);
			}}
			onStartThread={noop}
			onShowThreads={noop}
			onCopyLink={noop}
			onDuplicate={manage()}
			onEdit={manage()}
			onDelete={manage()}
			developerMode={developerMode()}
			onCopyAtUri={spy.copyAtUri}
			onShowOnPdsls={noop}
		>
			<ChannelRow
				name={name}
				platform="desktop"
				active={name === "general"}
				unread={name !== "general"}
				muted={name === "general" && channelMuted()}
				preview={{ author: "Lou", text: preview }}
				onOpenSettings={manage()}
			/>
		</ChannelContextMenu>
	);

	return (
		<div class="flex h-dvh min-w-[1040px] bg-background text-foreground">
			<SpaceRail
				platform="desktop"
				leading={
					<InboxContextMenu
						class="contents"
						count={props.inboxCount ?? 3}
						unread={props.inboxCount ?? 3}
						onClearInbox={spy.clearInbox}
						onMarkAllRead={spy.markInboxRead}
					>
						<SpaceRailAction
							label="Inbox"
							icon={<InboxIcon />}
							onClick={noop}
						/>
					</InboxContextMenu>
				}
				onCreate={noop}
				onDiscover={noop}
			>
				<For each={railSpaces}>
					{(entry, index) => (
						<SpaceContextMenu
							name={entry.name}
							class="contents"
							onInvite={noop}
							onOpenSettings={manage()}
							onOpenNotificationSettings={noop}
							onMarkAsRead={noop}
							muted={spaceMuted()}
							onMutedChange={setSpaceMuted}
							onCreateChannel={manage()}
							onCreateCategory={manage()}
							onReorderChannels={manage()}
							developerMode={developerMode()}
							onCopyAtUri={spy.copyAtUri}
							onShowOnPdsls={noop}
							onLeave={admin() ? undefined : spy.leave}
						>
							<SpaceRailItem
								name={entry.name}
								iconSrc={entry.iconSrc}
								active={index() === 0}
								onSelect={noop}
							/>
						</SpaceContextMenu>
					)}
				</For>
			</SpaceRail>
			<div class="relative flex w-72 shrink-0 flex-col overflow-y-auto rounded-tl-sheet border-0 border-r border-solid border-border bg-card">
				<ChannelListHeader
					platform="desktop"
					name="Colibri Social Flock"
					iconSrc={storyImages.violetIcon()}
					memberCount={99}
					ownerHandle="lou.gg"
					onOpenSpace={noop}
				/>
				<section aria-label="Birding" class="flex w-full flex-col gap-2 p-2">
					<CategoryContextMenu
						name="Birding"
						onMarkAsRead={noop}
						muted={categoryMuted()}
						onMutedChange={setCategoryMuted}
						onEdit={manage()}
						onCreateChannel={manage()}
						onDelete={admin() ? spy.deleteCategory : undefined}
						developerMode={developerMode()}
						onCopyAtUri={spy.copyAtUri}
					>
						<CategoryHeader
							name="Birding"
							onToggle={noop}
							onCreateChannel={manage()}
							onOpenSettings={manage()}
						/>
					</CategoryContextMenu>
					{channel("general", "Kingfisher by the bridge")}
					{channel("photos", "Heron at dawn")}
					<VoiceChannelContextMenu
						name="Birdwatch call"
						connected={connected()}
						onConnectedChange={setConnected}
						onOpenChat={spy.openChat}
						onCopyLink={noop}
						onDuplicate={manage()}
						onEdit={manage()}
						onDelete={manage()}
						developerMode={developerMode()}
						onCopyAtUri={spy.copyAtUri}
					>
						<VoiceChannelRow
							name="Birdwatch call"
							platform="desktop"
							joined={connected()}
							onOpenSettings={manage()}
						/>
					</VoiceChannelContextMenu>
				</section>
			</div>
			<main class="min-w-0 flex-1 bg-popover" />
		</div>
	);
};

const stubClipboard = () => {
	const writeText = fn(async (_value: string) => {});
	Object.defineProperty(navigator, "clipboard", {
		configurable: true,
		value: { writeText },
	});
	return writeText;
};

const InviteLinks = (props: { member?: boolean }) => (
	<div class="min-h-screen bg-background p-8 text-foreground">
		<div class="max-w-[878px]">
			<InviteTable
				invites={inviteFixtures.slice(0, 3)}
				now={FIXED_NOW}
				spaceName="Colibri Social Flock"
				onCopy={(invite) => spy.copyInvite(invite.code)}
				onShare={noop}
				onDelete={props.member ? undefined : noop}
			/>
		</div>
	</div>
);

const openMenu = async (
	trigger: Element,
	name: string,
	at?: { x: number; y: number },
) =>
	waitFor(() => {
		if (!screen.queryByRole("menu", { name })) rightClick(trigger, at);
		return screen.getByRole("menu", { name });
	});

const closeWithEscape = async () => {
	await userEvent.keyboard("{Escape}");
	await waitFor(() => expect(screen.queryByRole("menu")).toBeNull(), {
		timeout: 3000,
	});
};

const waitForClosed = () =>
	waitFor(() => expect(screen.queryByRole("menu")).toBeNull(), {
		timeout: 3000,
	});

const visibleName = (item: Element | null) => {
	if (!item) return undefined;
	const copy = item.cloneNode(true) as Element;
	for (const hidden of copy.querySelectorAll("[aria-hidden=true]"))
		hidden.remove();
	return copy.textContent?.trim();
};

const itemNames = (menu: HTMLElement) =>
	within(menu).getAllByRole("menuitem").map(visibleName);

const groupNames = (menu: HTMLElement) =>
	within(menu)
		.getAllByRole("group")
		.map((group) =>
			document
				.getElementById(group.getAttribute("aria-labelledby") ?? "")
				?.textContent?.trim(),
		)
		.filter(Boolean);

const expectHighlighted = async (menu: HTMLElement, name: string) =>
	waitFor(() =>
		expect(visibleName(menu.querySelector("[data-highlighted]"))).toBe(name),
	);

const expectInsideViewport = (element: HTMLElement) => {
	const rect = element.getBoundingClientRect();
	expect(rect.left).toBeGreaterThanOrEqual(0);
	expect(rect.top).toBeGreaterThanOrEqual(0);
	expect(rect.right).toBeLessThanOrEqual(window.innerWidth);
	expect(rect.bottom).toBeLessThanOrEqual(window.innerHeight);
};

type Canvas = ReturnType<typeof within>;

const generalRow = (canvas: Canvas) =>
	canvas.getByRole("button", { name: /^general/ });
const voiceRow = (canvas: Canvas) =>
	canvas.getByRole("button", { name: /^Birdwatch call/ });
const categoryHeader = (canvas: Canvas) =>
	canvas.getByRole("button", { name: "Birding" });
const inboxAction = (canvas: Canvas) =>
	canvas.getByRole("button", { name: "Inbox" });
const railItem = (canvas: Canvas) =>
	canvas.getByRole("button", { name: "Colibri Social Flock" });
const inviteRow = (canvasElement: HTMLElement) => {
	const row = canvasElement.querySelector('[data-table-row="kjAnf91jad92Q"]');
	if (!row) throw new Error("invite row kjAnf91jad92Q missing");
	return row;
};

const SPACE_MENU = "Colibri Social Flock, Space options";
const INVITE_MENU = "Invite kjAnf91jad92Q options";

export const ChannelMenu: Story = {
	render: () => <Sidebar />,
	play: async ({ canvasElement }) => {
		resetSpies();
		const canvas = within(canvasElement);
		const menu = await openMenu(generalRow(canvas), "general options");
		await expect(groupNames(menu)).toEqual([
			"Notifications",
			"Threads",
			"Share",
			"Manage",
		]);
		await expect(itemNames(menu)).toEqual([
			"Mark as read",
			"Start a thread",
			"Show all threads",
			"Copy channel link",
			"Duplicate",
			"Edit channel",
			"Developer mode",
			"Delete channel",
		]);
		await expect(
			within(menu).getByRole("menuitem", { name: "Delete channel" }),
		).toHaveAttribute("data-tone", "destructive");
		const mute = within(menu).getByRole("menuitemcheckbox", {
			name: "Mute channel",
		});
		await expect(mute).toHaveAttribute("aria-checked", "false");

		await userEvent.keyboard("{ArrowDown}");
		await expectHighlighted(menu, "Mark as read");
		await userEvent.keyboard("{ArrowDown}");
		await expectHighlighted(menu, "Mute channel");
		await userEvent.keyboard("{Enter}");
		await expect(spy.muteChannel).toHaveBeenCalledWith(true);
		await waitFor(() => expect(mute).toHaveAttribute("aria-checked", "true"));
		await expect(screen.getByRole("menu", { name: "general options" })).toBe(
			menu,
		);

		await userEvent.keyboard("{End}");
		await expectHighlighted(menu, "Delete channel");
		await userEvent.keyboard("{ArrowUp}");
		await expectHighlighted(menu, "Developer mode");
		await userEvent.keyboard("{ArrowRight}");
		const submenu = await screen.findByRole("menu", { name: "Developer mode" });
		await expectHighlighted(submenu, "Copy AT-URI");
		await expect(itemNames(submenu)).toEqual(["Copy AT-URI", "Show on PDSls"]);
		await userEvent.keyboard("{ArrowLeft}");
		await waitFor(() =>
			expect(screen.queryByRole("menu", { name: "Developer mode" })).toBeNull(),
		);
		await expectHighlighted(menu, "Developer mode");
		await userEvent.keyboard("{ArrowRight}");
		await screen.findByRole("menu", { name: "Developer mode" });
		await userEvent.keyboard("{Enter}");
		await expect(spy.copyAtUri).toHaveBeenCalledTimes(1);
		await waitForClosed();

		const again = await openMenu(generalRow(canvas), "general options");
		await userEvent.click(
			within(again).getByRole("menuitem", { name: "Mark as read" }),
		);
		await expect(spy.markChannelRead).toHaveBeenCalledTimes(1);
		await waitForClosed();
		await waitFor(() =>
			expect(canvasElement.closest("[aria-hidden]")).toBeNull(),
		);
	},
};

export const VoiceChannelMenu: Story = {
	render: () => <Sidebar />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const menu = await openMenu(voiceRow(canvas), "Birdwatch call options");
		await expect(groupNames(menu)).toEqual(["Voice", "Share", "Manage"]);
		await expect(itemNames(menu)).toEqual([
			"Join voice",
			"Open chat",
			"Copy channel link",
			"Duplicate",
			"Edit channel",
			"Developer mode",
			"Delete channel",
		]);
		await userEvent.click(
			within(menu).getByRole("menuitem", { name: "Join voice" }),
		);
		await waitForClosed();
		const again = await openMenu(voiceRow(canvas), "Birdwatch call options");
		await expect(
			within(again).getByRole("menuitem", { name: "Leave voice" }),
		).toBeVisible();
		spy.openChat.mockClear();
		await userEvent.click(
			within(again).getByRole("menuitem", { name: "Open chat" }),
		);
		await waitForClosed();
		await expect(spy.openChat).toHaveBeenCalledTimes(1);
	},
};

export const CategoryMenu: Story = {
	render: () => <Sidebar />,
	play: async ({ canvasElement }) => {
		resetSpies();
		const canvas = within(canvasElement);
		const menu = await openMenu(categoryHeader(canvas), "Birding options");
		await expect(groupNames(menu)).toEqual(["Notifications", "Manage"]);
		await expect(itemNames(menu)).toEqual([
			"Mark as read",
			"Edit category",
			"Create channel",
			"Developer mode",
			"Delete category",
		]);
		await expect(
			within(menu).getByRole("menuitemcheckbox", { name: "Mute category" }),
		).toHaveAttribute("aria-checked", "false");
		const remove = within(menu).getByRole("menuitem", {
			name: "Delete category",
		});
		await expect(remove).toHaveAttribute("data-tone", "destructive");
		await userEvent.click(remove);
		await expect(spy.deleteCategory).toHaveBeenCalledTimes(1);
		await waitForClosed();
	},
};

export const SpaceMenu: Story = {
	render: () => <Sidebar />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const menu = await openMenu(railItem(canvas), SPACE_MENU);
		await expect(groupNames(menu)).toEqual([
			"Space",
			"Notifications",
			"Channels",
		]);
		await expect(itemNames(menu)).toEqual([
			"Invite people",
			"Space settings",
			"Notification settings",
			"Mark as read",
			"Create channel",
			"Create category",
			"Reorder channels",
			"Developer mode",
		]);
		const mute = within(menu).getByRole("menuitemcheckbox", {
			name: "Mute Space",
		});
		await userEvent.click(mute);
		await waitFor(() => expect(mute).toHaveAttribute("aria-checked", "true"));
		await closeWithEscape();
	},
};

export const InboxMenu: Story = {
	render: () => <Sidebar />,
	play: async ({ canvasElement }) => {
		resetSpies();
		const canvas = within(canvasElement);
		const menu = await openMenu(inboxAction(canvas), "Inbox options");
		await expect(itemNames(menu)).toEqual([
			"Clear Inbox",
			"Mark everything as read",
		]);
		await expect(menu.querySelectorAll('[role="menuitem"] svg').length).toBe(2);
		await expectNoLayoutIssues(menu);
		await userEvent.click(
			within(menu).getByRole("menuitem", { name: "Mark everything as read" }),
		);
		await expect(spy.markInboxRead).toHaveBeenCalledTimes(1);
		await waitForClosed();
		const again = await openMenu(inboxAction(canvas), "Inbox options");
		await userEvent.click(
			within(again).getByRole("menuitem", { name: "Clear Inbox" }),
		);
		await expect(spy.clearInbox).toHaveBeenCalledTimes(1);
		await waitForClosed();
	},
};

export const InboxMenuEmpty: Story = {
	render: () => <Sidebar inboxCount={0} />,
	play: async ({ canvasElement }) => {
		resetSpies();
		const canvas = within(canvasElement);
		const menu = await openMenu(inboxAction(canvas), "Inbox options");
		for (const name of ["Clear Inbox", "Mark everything as read"]) {
			await expect(
				within(menu).getByRole("menuitem", { name }),
			).toHaveAttribute("aria-disabled", "true");
		}
		await closeWithEscape();
		await expect(spy.clearInbox).not.toHaveBeenCalled();
		await expect(spy.markInboxRead).not.toHaveBeenCalled();
	},
};

export const InviteMenu: Story = {
	render: () => <InviteLinks />,
	play: async ({ canvasElement }) => {
		resetSpies();
		const writeText = stubClipboard();
		const menu = await openMenu(inviteRow(canvasElement), INVITE_MENU);
		await expect(itemNames(menu)).toEqual([
			"Copy invite link",
			"Share invite",
			"Delete invite link",
		]);
		await expect(
			within(menu).getByRole("menuitem", { name: "Delete invite link" }),
		).toHaveAttribute("data-tone", "destructive");
		await userEvent.click(
			within(menu).getByRole("menuitem", { name: "Copy invite link" }),
		);
		await waitFor(() =>
			expect(spy.copyInvite).toHaveBeenCalledWith("kjAnf91jad92Q"),
		);
		await expect(writeText).toHaveBeenCalledWith(
			"https://colibri.social/invite/kjAnf91jad92Q",
		);
		await waitForClosed();
	},
};

export const InviteMenuMember: Story = {
	render: () => <InviteLinks member />,
	play: async ({ canvasElement }) => {
		const menu = await openMenu(inviteRow(canvasElement), INVITE_MENU);
		await expect(itemNames(menu)).toEqual(["Copy invite link", "Share invite"]);
		await closeWithEscape();
	},
};

const InviteCardMenu = () => {
	const [open, setOpen] = createSignal(false);
	return (
		<div class="min-h-screen bg-background p-4 text-foreground">
			<InviteCard
				code="kjAnf91jad92Q"
				copyValue="https://colibri.social/invite/kjAnf91jad92Q"
				expires="Never"
				creator={{ handle: "timtinkers.online" }}
				uses={69}
				onMenu={() => setOpen(true)}
			/>
			<DropdownMenu
				platform="mobile"
				label={INVITE_MENU}
				open={open()}
				onOpenChange={setOpen}
				triggerProps={{ hidden: true }}
				items={inviteMenuEntries({
					onCopyLink: () => spy.copyInvite("kjAnf91jad92Q"),
					onShare: noop,
					onDelete: noop,
				})}
			/>
		</div>
	);
};

export const InviteCardDrawer: Story = {
	parameters: { viewport: { defaultViewport: "iphone" } },
	render: () => <InviteCardMenu />,
	play: async ({ canvasElement }) => {
		resetSpies();
		await userEvent.click(
			within(canvasElement).getByRole("button", {
				name: "More actions for invite kjAnf91jad92Q",
			}),
		);
		const drawer = await screen.findByRole("dialog", { name: INVITE_MENU });
		await expect(
			within(drawer)
				.getAllByRole("button")
				.map((button) => button.textContent?.trim()),
		).toEqual(["Copy invite link", "Share invite", "Delete invite link"]);
		await userEvent.click(
			within(drawer).getByRole("button", { name: "Copy invite link" }),
		);
		await expect(spy.copyInvite).toHaveBeenCalledWith("kjAnf91jad92Q");
		await waitFor(
			() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
			{ timeout: 2000 },
		);
	},
};

export const MemberPermissions: Story = {
	render: () => <Sidebar member />,
	play: async ({ canvasElement }) => {
		resetSpies();
		const canvas = within(canvasElement);
		const channel = await openMenu(generalRow(canvas), "general options");
		await expect(itemNames(channel)).toEqual([
			"Mark as read",
			"Start a thread",
			"Show all threads",
			"Copy channel link",
			"Developer mode",
		]);
		await closeWithEscape();

		const voice = await openMenu(voiceRow(canvas), "Birdwatch call options");
		await expect(itemNames(voice)).toEqual([
			"Join voice",
			"Open chat",
			"Copy channel link",
			"Developer mode",
		]);
		await closeWithEscape();

		const category = await openMenu(categoryHeader(canvas), "Birding options");
		await expect(itemNames(category)).toEqual([
			"Mark as read",
			"Developer mode",
		]);
		await closeWithEscape();

		const space = await openMenu(railItem(canvas), SPACE_MENU);
		await expect(itemNames(space)).toEqual([
			"Invite people",
			"Notification settings",
			"Mark as read",
			"Developer mode",
			"Leave Space",
		]);
		await userEvent.click(
			within(space).getByRole("menuitem", { name: "Leave Space" }),
		);
		await expect(spy.leave).toHaveBeenCalledTimes(1);
		await waitForClosed();
	},
};

export const DeveloperModeOff: Story = {
	render: () => <Sidebar developerMode={false} />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const targets: [Element, string][] = [
			[generalRow(canvas), "general options"],
			[voiceRow(canvas), "Birdwatch call options"],
			[categoryHeader(canvas), "Birding options"],
			[railItem(canvas), SPACE_MENU],
		];
		for (const [trigger, name] of targets) {
			const menu = await openMenu(trigger, name);
			const names = itemNames(menu);
			for (const hidden of ["Developer mode", "Copy AT-URI", "Show on PDSls"])
				await expect(names).not.toContain(hidden);
			await closeWithEscape();
		}
	},
};

export const ViewportEdges: Story = {
	render: () => <Sidebar />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const corners = [
			{ x: window.innerWidth - 2, y: window.innerHeight - 2 },
			{ x: 2, y: window.innerHeight - 2 },
			{ x: window.innerWidth - 2, y: 2 },
		];
		for (const at of corners) {
			const menu = await openMenu(generalRow(canvas), "general options", at);
			await waitFor(() => expectInsideViewport(menu));
			await closeWithEscape();
		}
		const menu = await openMenu(railItem(canvas), SPACE_MENU, corners[0]);
		await waitFor(() => expectInsideViewport(menu));
		await userEvent.keyboard("{End}");
		await expectHighlighted(menu, "Developer mode");
		await userEvent.keyboard("{ArrowRight}");
		const submenu = await screen.findByRole("menu", { name: "Developer mode" });
		await waitFor(() => expectInsideViewport(submenu));
		await closeWithEscape();
	},
};

const memberSpy = {
	viewProfile: fn(),
	roleChange: fn(),
	kick: fn(),
	ban: fn(),
	copyDid: fn(),
	copyAtUri: fn(),
};

const LONG_MEMBER_NAME =
	"Bartholomew Featherstonehaugh-Wrigglesworth the Third of the Northern Marsh";

const memberRoles = (): MemberMenuRole[] => [
	{
		id: "mods",
		name: "Moderators",
		color: "#c4a7ff",
		assigned: true,
		manageable: true,
	},
	{
		id: "artists",
		name: "Artists",
		color: "#ffd857",
		assigned: false,
		manageable: true,
	},
	{
		id: "night",
		name: "Night owls who stay up far too late sketching birds",
		color: "#76c4e5",
		assigned: false,
		manageable: true,
	},
	{
		id: "admins",
		name: "Admins",
		color: "#ff7a7a",
		assigned: false,
		manageable: false,
	},
];

const MemberMenuDemo = (props: { moderator: boolean }) => {
	const [roles, setRoles] = createSignal(memberRoles());
	return (
		<div class="min-h-screen bg-background p-8">
			<div class="w-60 rounded-surface bg-card p-2">
				<MemberContextMenu
					name={LONG_MEMBER_NAME}
					onViewProfile={memberSpy.viewProfile}
					roles={props.moderator ? roles() : undefined}
					onRoleChange={
						props.moderator
							? (id, assigned) => {
									memberSpy.roleChange(id, assigned);
									setRoles((current) =>
										current.map((role) =>
											role.id === id ? { ...role, assigned } : role,
										),
									);
								}
							: undefined
					}
					onKick={props.moderator ? memberSpy.kick : undefined}
					onBan={props.moderator ? memberSpy.ban : undefined}
					onCopyDid={memberSpy.copyDid}
					developerMode
					onCopyAtUri={memberSpy.copyAtUri}
				>
					<MemberRow
						name={LONG_MEMBER_NAME}
						seed="did:plc:bartholomew"
						presence="online"
						status="Counting herons by the reeds"
					/>
				</MemberContextMenu>
			</div>
		</div>
	);
};

const memberRow = (canvas: Canvas) =>
	canvas
		.getAllByText(LONG_MEMBER_NAME)[0]
		?.closest("[data-member-row]") as Element;

const MEMBER_MENU = `${LONG_MEMBER_NAME} options`;

export const MemberMenu: Story = {
	render: () => <MemberMenuDemo moderator />,
	play: async ({ canvasElement }) => {
		for (const spy of Object.values(memberSpy)) spy.mockClear();
		const canvas = within(canvasElement);
		const menu = await openMenu(memberRow(canvas), MEMBER_MENU);
		await waitFor(() => expectInsideViewport(menu));
		await expectNoLayoutIssues(menu);
		await expect(itemNames(menu)).toEqual([
			"View profile",
			"Roles",
			`Kick ${LONG_MEMBER_NAME}`,
			`Ban ${LONG_MEMBER_NAME}`,
			"Copy DID",
			"Developer mode",
		]);
		for (const verb of ["Kick", "Ban"]) {
			const item = within(menu).getByRole("menuitem", {
				name: `${verb} ${LONG_MEMBER_NAME}`,
			});
			await expect(item).toHaveAttribute("data-tone", "destructive");
			const label = Array.from(item.querySelectorAll("span")).find((span) =>
				span.textContent?.startsWith(verb),
			) as HTMLElement;
			await expect(label.scrollWidth).toBeGreaterThan(label.clientWidth);
			await expect(label.getBoundingClientRect().right).toBeLessThanOrEqual(
				menu.getBoundingClientRect().right,
			);
		}

		await userEvent.hover(
			within(menu).getByRole("menuitem", { name: "Roles" }),
		);
		const submenu = await screen.findByRole("menu", { name: "Roles" });
		await waitFor(() => expectInsideViewport(submenu));
		await expectNoLayoutIssues(submenu);
		const artists = within(submenu).getByRole("menuitemcheckbox", {
			name: "Artists",
		});
		await expect(artists).toHaveAttribute("aria-checked", "false");
		await userEvent.click(artists);
		await expect(memberSpy.roleChange).toHaveBeenCalledWith("artists", true);
		await waitFor(() =>
			expect(
				within(screen.getByRole("menu", { name: "Roles" })).getByRole(
					"menuitemcheckbox",
					{ name: "Artists" },
				),
			).toHaveAttribute("aria-checked", "true"),
		);
		await expect(screen.getByRole("menu", { name: "Roles" })).toBe(submenu);
		await expect(
			within(submenu).getByRole("menuitemcheckbox", { name: "Admins" }),
		).toHaveAttribute("aria-disabled", "true");
		await closeWithEscape();

		const again = await openMenu(memberRow(canvas), MEMBER_MENU);
		await userEvent.click(
			within(again).getByRole("menuitem", {
				name: `Kick ${LONG_MEMBER_NAME}`,
			}),
		);
		await expect(memberSpy.kick).toHaveBeenCalledTimes(1);
		await waitForClosed();
	},
};

export const MemberMenuRegularMember: Story = {
	render: () => <MemberMenuDemo moderator={false} />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const menu = await openMenu(memberRow(canvas), MEMBER_MENU);
		await expect(itemNames(menu)).toEqual([
			"View profile",
			"Copy DID",
			"Developer mode",
		]);
		await closeWithEscape();
	},
};

const threadSpy = {
	follow: fn(),
	rename: fn(),
	move: fn(),
	remove: fn(),
};

const LONG_THREAD_NAME =
	"Kingfisher sightings along the river path behind the old mill";

export const ThreadMenu: Story = {
	render: () => (
		<div class="min-h-screen bg-background p-8">
			<ThreadContextMenu
				name={LONG_THREAD_NAME}
				following={false}
				onFollowingChange={threadSpy.follow}
				muted={false}
				onMutedChange={() => {}}
				onMarkAsRead={() => {}}
				onCopyLink={() => {}}
				onRename={threadSpy.rename}
				onMove={threadSpy.move}
				onDelete={threadSpy.remove}
			>
				<button type="button" class="w-64 truncate text-left">
					{LONG_THREAD_NAME}
				</button>
			</ThreadContextMenu>
		</div>
	),
	play: async ({ canvasElement }) => {
		for (const spy of Object.values(threadSpy)) spy.mockClear();
		const canvas = within(canvasElement);
		const menu = await openMenu(
			canvas.getByRole("button", { name: LONG_THREAD_NAME }),
			`${LONG_THREAD_NAME} options`,
		);
		await waitFor(() => expectInsideViewport(menu));
		await expectNoLayoutIssues(menu);
		await expect(itemNames(menu)).toEqual([
			"Mark as read",
			"Copy thread link",
			"Rename thread",
			"Move to channel",
			"Delete thread",
		]);
		await expect(
			within(menu).getByRole("menuitemcheckbox", { name: /Follow thread/ }),
		).toBeInTheDocument();
		await userEvent.click(
			within(menu).getByRole("menuitem", { name: "Delete thread" }),
		);
		await expect(threadSpy.remove).toHaveBeenCalledTimes(1);
	},
};

const onTargetClick = fn();

export const PressTargetCloses: Story = {
	name: "Press on the target closes",
	render: () => (
		<div class="min-h-screen bg-background p-8">
			<ContextMenu
				aria-label="Target options"
				menu={<MenuItem label="Copy" onSelect={onCopy} />}
			>
				<button
					type="button"
					data-testid="target"
					onClick={onTargetClick}
					class="flex h-40 w-full items-center justify-center rounded-surface border border-dashed border-border text-sm text-muted-foreground"
				>
					Right-click, then click here
				</button>
			</ContextMenu>
		</div>
	),
	play: async ({ canvasElement }) => {
		onTargetClick.mockClear();
		onCopy.mockClear();
		const target = within(canvasElement).getByTestId("target");
		await openMenu(target, "Target options");
		await userEvent.click(target);
		await waitFor(() =>
			expect(screen.queryByRole("menu", { name: "Target options" })).toBeNull(),
		);
		await expect(onTargetClick).not.toHaveBeenCalled();
		await expect(onCopy).not.toHaveBeenCalled();
		await userEvent.click(target);
		await expect(onTargetClick).toHaveBeenCalledTimes(1);
		await openMenu(target, "Target options");
		await userEvent.click(canvasElement.firstElementChild as HTMLElement);
		await waitFor(() =>
			expect(screen.queryByRole("menu", { name: "Target options" })).toBeNull(),
		);
	},
};

export const OneMenuAtATime: Story = {
	name: "One menu at a time",
	render: () => (
		<div class="flex min-h-screen flex-col gap-4 bg-background p-8">
			<MessageContextMenu onReply={fn()} onCopyText={fn()} onDelete={fn()}>
				<div
					data-testid="first-message"
					class="rounded-control px-4 py-3 text-base hover:bg-card"
				>
					Right-click this message first.
				</div>
			</MessageContextMenu>
			<ThreadContextMenu
				name={LONG_THREAD_NAME}
				following={false}
				muted={false}
				onMarkAsRead={() => {}}
				onCopyLink={() => {}}
			>
				<button type="button" class="w-64 truncate text-left">
					{LONG_THREAD_NAME}
				</button>
			</ThreadContextMenu>
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const messageMenu = await openMenu(
			canvas.getByTestId("first-message"),
			"Message options",
		);
		await expectNoLayoutIssues(messageMenu);
		const threadMenu = await openMenu(
			canvas.getByRole("button", { name: LONG_THREAD_NAME }),
			`${LONG_THREAD_NAME} options`,
		);
		await waitFor(() =>
			expect(document.querySelectorAll('[role="menu"]')).toHaveLength(1),
		);
		await expect(document.querySelector('[role="menu"]')).toBe(threadMenu);
		await expectNoLayoutIssues(threadMenu);
		await closeWithEscape();
		const reopened = await openMenu(
			canvas.getByTestId("first-message"),
			"Message options",
		);
		await waitFor(() =>
			expect(document.querySelectorAll('[role="menu"]')).toHaveLength(1),
		);
		await expect(document.querySelector('[role="menu"]')).toBe(reopened);
	},
};
