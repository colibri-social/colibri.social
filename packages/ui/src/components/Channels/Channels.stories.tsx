import { InboxIcon } from "@solar-icons/solid/bold/inbox";
import { VolumeSmallIcon } from "@solar-icons/solid/bold/volume-small";
import { createSignal, For, type JSX } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import { AnimatedSettingsIcon } from "../../icons/animated/icons";
import {
	AnimatedProfileIcon,
	AnimatedUsersGroupTwoRoundedIcon,
} from "../../icons/animated/people";
import { AnimatedInboxIcon } from "../../icons/animated/system";
import { storyImages } from "../Banner/story-images";
import { Button } from "../Button/Button";
import { CategoryContextMenu } from "../ContextMenu/CategoryMenu";
import { ChannelContextMenu } from "../ContextMenu/ChannelMenu";
import { SpaceDrawer as SpaceDrawerComponent } from "../Space/SpaceDrawer";
import {
	SpaceRail,
	SpaceRailAction,
	SpaceRailItem,
} from "../SpaceRail/SpaceRail";
import { TabBar, TabBarItem } from "../TabBar/TabBar";
import type { VoiceParticipant } from "../Voice/shared";
import { CategoryHeader, ChannelCategory } from "./Category";
import { ChannelDrawer as ChannelDrawerComponent } from "./ChannelDrawer";
import { ChannelList, type ChannelListCategory } from "./ChannelList";
import { ChannelListHeader } from "./ChannelListHeader";
import {
	CategoryEmpty,
	ChannelRow,
	ChannelThreadRow,
	ChannelThreads,
	VoiceChannelRow,
} from "./ChannelRow";
import {
	CategoryHeaderSkeleton,
	CategorySkeleton,
	ChannelListHeaderSkeleton,
	ChannelRowSkeleton,
	VoiceChannelRowSkeleton,
} from "./ChannelSkeletons";
import type { ChannelLayout } from "./channel-layout";

const meta = {
	title: "Navigation/Channel list",
	parameters: { viewport: { defaultViewport: "iphone" } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const kekEmoji = `data:image/svg+xml,${encodeURIComponent(
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#e0a458"/><text x="12" y="17" font-size="13" text-anchor="middle" font-family="sans-serif" fill="#111">k</text></svg>',
)}`;

const desktop = {
	viewport: { defaultViewport: "reset" },
	layout: "fullscreen",
};

const lou: VoiceParticipant = {
	id: "lou",
	name: "Lou",
	avatarSrc: storyImages.violetIcon(),
	speaking: true,
};
const lis: VoiceParticipant = {
	id: "lis",
	name: "Lis",
	avatarSrc: storyImages.tealIcon(),
	muted: true,
};
const tim: VoiceParticipant = {
	id: "tim",
	name: "Tim",
	avatarSrc: storyImages.amberIcon(),
	deafened: true,
};

const Channels = (props: { platform?: "mobile" | "desktop" }) => {
	const [active, setActive] = createSignal("general");
	const select = (id: string) => () => setActive(id);
	return (
		<>
			<ChannelCategory name="Hangout">
				<ChannelRow
					name="Read channel"
					platform={props.platform}
					active={active() === "read"}
					onClick={select("read")}
					preview={{ author: "Lis", text: "Hey there!" }}
				/>
				<ChannelRow
					name="General"
					platform={props.platform}
					active={active() === "general"}
					onClick={select("general")}
					unread
					preview={{
						author: "Lou",
						text: "It'll be fine :kek:",
						parts: ["It'll be fine ", { name: "kek", src: kekEmoji }],
					}}
				/>
				<ChannelRow
					name="Photos"
					platform={props.platform}
					active={active() === "photos"}
					onClick={select("photos")}
					mentions={2}
					attachment="image"
					preview={{ author: "Tim", text: "Kingfisher on the canal" }}
				/>
				<ChannelRow
					name="File sharing"
					platform={props.platform}
					active={active() === "files"}
					onClick={select("files")}
					attachment="file"
					preview={{ author: "Lis", text: "Route map for Saturday" }}
				/>
				<ChannelRow
					name="A channel with a very long name that does not fit on one line"
					platform={props.platform}
					active={active() === "long"}
					onClick={select("long")}
					muted
					private
					preview={{
						author: "Tim",
						text: "Look at this long message that runs off the edge of the screen",
					}}
				/>
			</ChannelCategory>
			<ChannelCategory name="Voice">
				<VoiceChannelRow name="Empty voice" platform={props.platform} private />
				<VoiceChannelRow
					name="Lounge"
					platform={props.platform}
					participants={[lis]}
				/>
				<VoiceChannelRow
					name="Birdwatch call"
					platform={props.platform}
					joined
					participants={[lou, tim]}
				/>
			</ChannelCategory>
		</>
	);
};

const SpacesTab = () => {
	const [space, setSpace] = createSignal("flock");
	const [tab, setTab] = createSignal("spaces");
	const spaces = [
		{
			id: "flock",
			name: "Colibri Social Flock",
			icon: storyImages.violetIcon(),
		},
		{
			id: "birds",
			name: "Bird watchers",
			icon: storyImages.tealIcon(),
			mentions: 3,
		},
		{
			id: "canal",
			name: "Canal walks",
			icon: storyImages.amberIcon(),
			unread: true,
		},
		{ id: "dev", name: "AT Protocol devs" },
	];
	return (
		<div class="flex h-dvh overflow-hidden bg-background pt-safe">
			<SpaceRail
				leading={
					<SpaceRailAction
						label="Inbox"
						icon={<InboxIcon />}
						onClick={() => {}}
					/>
				}
				onCreate={() => {}}
				onDiscover={() => {}}
			>
				<For each={spaces}>
					{(item) => (
						<SpaceRailItem
							name={item.name}
							iconSrc={item.icon}
							mentions={item.mentions}
							unread={item.unread}
							active={space() === item.id}
							onSelect={() => setSpace(item.id)}
						/>
					)}
				</For>
			</SpaceRail>
			<div class="relative min-w-0 flex-1 overflow-y-auto overscroll-contain rounded-tl-sheet bg-card pb-28">
				<ChannelListHeader
					name="Colibri Social Flock"
					iconSrc={storyImages.violetIcon()}
					memberCount={99}
					ownerHandle="lou.gg"
					onOpenSpace={() => {}}
				/>
				<div class="h-2" />
				<Channels />
			</div>
			<TabBar value={tab()} onChange={setTab}>
				<TabBarItem
					value="spaces"
					label="Spaces"
					icon={<AnimatedUsersGroupTwoRoundedIcon trigger="press" />}
				/>
				<TabBarItem
					value="inbox"
					label="Inbox"
					icon={<AnimatedInboxIcon trigger="press" />}
				/>
				<TabBarItem
					value="profile"
					label="Profile"
					icon={<AnimatedProfileIcon trigger="press" />}
				/>
				<TabBarItem
					value="settings"
					label="Settings"
					icon={<AnimatedSettingsIcon trigger="press" />}
				/>
			</TabBar>
		</div>
	);
};

export const MobileSpacesTab: Story = {
	render: () => <SpacesTab />,
};

const Panel = (props: { children: JSX.Element; class?: string }) => (
	<div class={`min-h-dvh bg-card py-2 ${props.class ?? ""}`}>
		{props.children}
	</div>
);

export const RowStates: Story = {
	render: () => (
		<Panel>
			<Channels />
		</Panel>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const rows = Array.from(
			canvasElement.querySelectorAll<HTMLElement>("[data-channel-row]"),
		);
		const byName = (name: string) =>
			rows.find((row) =>
				row.querySelector("[data-channel-name]")?.textContent?.includes(name),
			) as HTMLElement;
		const nameOf = (row: HTMLElement) =>
			row.querySelector("[data-channel-name]") as HTMLElement;

		const read = byName("Read channel");
		const unread = byName("General");
		await expect(read).toHaveAttribute("data-state", "read");
		await expect(unread).toHaveAttribute("data-state", "unread");
		await expect(nameOf(read)).toHaveClass(
			"text-muted-foreground",
			"font-medium",
		);
		await expect(nameOf(unread)).toHaveClass(
			"text-foreground",
			"font-semibold",
		);
		await expect(unread.querySelector("[data-channel-mentions]")).toBeNull();
		const emoji = unread.querySelector(
			"[data-channel-preview-emoji]",
		) as HTMLImageElement;
		await expect(emoji).toHaveAttribute("alt", ":kek:");
		const previewLine = unread.querySelector(
			"[data-channel-preview]",
		) as HTMLElement;
		await expect(previewLine).toHaveTextContent("Lou: It'll be fine");
		const emojiBox = emoji.getBoundingClientRect();
		const lineBox = previewLine.getBoundingClientRect();
		await expect(emojiBox.height).toBe(16);
		await expect(emojiBox.top).toBeGreaterThanOrEqual(lineBox.top - 1);
		await expect(emojiBox.bottom).toBeLessThanOrEqual(lineBox.bottom + 1);

		const mentioned = byName("Photos");
		await expect(
			mentioned.querySelector("[data-channel-mentions]"),
		).toHaveTextContent("2");
		await expect(
			canvas.getByRole("button", { name: /Photos.*2 mentions/ }),
		).toBeInTheDocument();

		const speaking = canvasElement.querySelector(
			"[data-voice-participant][data-speaking]",
		) as HTMLElement;
		await expect(speaking).toHaveTextContent("Lou");
		const ring = speaking.querySelector("[data-speaking-ring]") as HTMLElement;
		const ringStyle = getComputedStyle(ring);
		await expect(ringStyle.outlineColor).toBe("rgb(142, 81, 255)");
		await expect(Number.parseFloat(ringStyle.outlineWidth)).toBeLessThanOrEqual(
			1.5,
		);
		await expect(Number.parseFloat(ringStyle.outlineOffset)).toBe(1);
		const ringExtent =
			Number.parseFloat(ringStyle.outlineWidth) +
			Number.parseFloat(ringStyle.outlineOffset);
		const speakingRow = speaking.closest("[data-voice-row]") as HTMLElement;
		const rowButton = speakingRow.querySelector("button") as HTMLElement;
		const ringBox = ring.getBoundingClientRect();
		const barRight =
			(
				speakingRow.querySelector("[data-voice-participants]") as HTMLElement
			).getBoundingClientRect().left + 2;
		await expect(
			ringBox.top - ringExtent - rowButton.getBoundingClientRect().bottom,
		).toBeGreaterThanOrEqual(4);
		await expect(ringBox.left - ringExtent - barRight).toBeGreaterThanOrEqual(
			4,
		);

		const joined = canvasElement.querySelector(
			"[data-voice-row][data-joined]",
		) as HTMLElement;
		const joinedButton = joined.querySelector("button") as HTMLElement;
		await expect(joinedButton.style.backgroundImage).toContain(
			"linear-gradient",
		);
		await expect(getComputedStyle(joinedButton).borderLeftColor).toBe(
			"rgb(142, 81, 255)",
		);
		const empty = canvasElement.querySelector(
			'[data-voice-row][data-state="empty"]',
		) as HTMLElement;
		await expect(empty.querySelector("[data-voice-participants]")).toBeNull();

		const locks = Array.from(
			canvasElement.querySelectorAll<HTMLElement>("[data-channel-private]"),
		);
		await expect(locks.length).toBe(2);
		for (const lock of locks) {
			const icon = lock.closest("[data-channel-icon]") as HTMLElement;
			await expect(icon).not.toBeNull();
			const row = icon.closest(
				"[data-channel-row], [data-voice-row]",
			) as HTMLElement;
			const name = row.querySelector("[data-channel-name]") as HTMLElement;
			const lockBox = lock.getBoundingClientRect();
			const iconBox = icon.getBoundingClientRect();
			await expect(lockBox.right).toBeLessThan(
				name.getBoundingClientRect().left,
			);
			await expect(lockBox.left).toBeGreaterThan(iconBox.left);
			await expect(lockBox.top).toBeGreaterThan(iconBox.top);
		}
	},
};

const onToggle = fn();

export const CategoryCollapse: Story = {
	render: () => (
		<Panel>
			<ChannelCategory name="Hangout" onCollapsedChange={onToggle}>
				<ChannelRow name="General" preview={{ author: "Lou", text: "Hi" }} />
				<ChannelRow name="Photos" />
			</ChannelCategory>
			<ChannelCategory name="Empty category">
				<CategoryEmpty />
			</ChannelCategory>
		</Panel>
	),
	play: async ({ canvasElement }) => {
		onToggle.mockClear();
		const canvas = within(canvasElement);
		const toggle = canvas.getByRole("button", { name: "Hangout" });
		const row = canvas.getByRole("button", { name: /^General/ });
		await expect(toggle).toHaveAttribute("aria-expanded", "true");
		await expect(row).toBeVisible();
		const turn = toggle.querySelector("[data-turn]") as SVGGElement;
		await expect(turn.style.transform).toBe("rotate(90deg)");

		await userEvent.click(toggle);
		await expect(onToggle).toHaveBeenCalledWith(true);
		await expect(toggle).toHaveAttribute("aria-expanded", "false");
		await expect(turn.style.transform).toBe("rotate(0deg)");
		await waitFor(() => expect(row).not.toBeVisible(), { timeout: 2000 });
		await expect(toggle.closest("[data-category]")).toHaveAttribute(
			"data-collapsed",
		);

		await userEvent.click(toggle);
		await expect(onToggle).toHaveBeenLastCalledWith(false);
		await waitFor(() => expect(row).toBeVisible());
		await expect(canvas.getByText("This category is empty.")).toBeVisible();
	},
};

export const DesktopSidebar: Story = {
	parameters: desktop,
	render: () => (
		<div class="flex h-dvh bg-background">
			<SpaceRail
				platform="desktop"
				leading={
					<SpaceRailAction
						label="Inbox"
						icon={<InboxIcon />}
						onClick={() => {}}
					/>
				}
				onCreate={() => {}}
				onDiscover={() => {}}
			>
				<SpaceRailItem
					name="Colibri Social Flock"
					iconSrc={storyImages.violetIcon()}
					active
				/>
				<SpaceRailItem
					name="Bird watchers"
					iconSrc={storyImages.tealIcon()}
					mentions={12}
				/>
				<SpaceRailItem name="AT Protocol devs" unread />
			</SpaceRail>
			<div class="relative flex w-72 flex-col overflow-y-auto rounded-tl-sheet border-0 border-r border-solid border-border bg-card">
				<ChannelListHeader
					platform="desktop"
					name="Colibri Social Flock"
					iconSrc={storyImages.violetIcon()}
					memberCount={99}
					ownerHandle="lou.gg"
					onOpenSpace={() => {}}
					menu={{
						onInvite: () => {},
						onOpenSettings: () => {},
						onOpenNotificationSettings: () => {},
						onMarkAsRead: () => {},
						onMutedChange: () => {},
						onCreateChannel: () => {},
						onCreateCategory: () => {},
						onLeave: () => {},
					}}
				/>
				<div class="flex flex-col">
					<ChannelCategory
						name="Hangout"
						onCreateChannel={() => {}}
						onOpenSettings={() => {}}
					>
						<ChannelRow
							name="General"
							platform="desktop"
							active
							preview={{ author: "Lou", text: "Hey there!" }}
							onOpenSettings={() => {}}
						/>
						<ChannelRow
							name="Photos"
							platform="desktop"
							unread
							attachment="image"
							preview={{ author: "Tim", text: "Kingfisher on the canal" }}
							onOpenSettings={() => {}}
						/>
						<ChannelRow
							name="Announcements"
							platform="desktop"
							mentions={4}
							preview={{ author: "Lis", text: "Meetup moved to Sunday" }}
							onOpenSettings={() => {}}
						/>
						<VoiceChannelRow
							name="Birdwatch call"
							platform="desktop"
							joined
							participants={[lou, lis, tim]}
							onOpenSettings={() => {}}
						/>
					</ChannelCategory>
				</div>
			</div>
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const active = canvas.getByRole("button", { name: /^General/ });
		await expect(active).toHaveAttribute("aria-current", "page");
		await expect(
			canvas.getByRole("button", { name: "Settings for General" }),
		).toBeInTheDocument();
		await expect(
			canvas.getByRole("button", { name: "Create channel in Hangout" }),
		).toBeInTheDocument();
		const topInset = (inner: Element, outer: Element) =>
			inner.getBoundingClientRect().top - outer.getBoundingClientRect().top;
		const rightInset = (inner: Element, outer: Element) =>
			outer.getBoundingClientRect().right - inner.getBoundingClientRect().right;
		for (const row of Array.from(
			canvasElement.querySelectorAll<HTMLElement>(
				"[data-channel-row], [data-voice-row]",
			),
		)) {
			const gear = row.querySelector("[data-channel-settings]") as HTMLElement;
			const target = row.querySelector(
				":scope > a, :scope > button",
			) as HTMLElement;
			await expect(Math.abs(rightInset(gear, target) - 4)).toBeLessThanOrEqual(
				0.5,
			);
			await expect(
				Math.abs(topInset(gear, target) - rightInset(gear, target)),
			).toBeLessThanOrEqual(0.5);
		}
	},
};

const onInvite = fn();
const onLeave = fn();
const onMutedChange = fn();

export const DesktopHeaderMenu: Story = {
	parameters: desktop,
	render: () => (
		<div class="w-72 bg-background text-foreground">
			<ChannelListHeader
				platform="desktop"
				name="A Space with a rather long name that truncates"
				iconSrc={storyImages.violetIcon()}
				memberCount={99}
				menu={{
					onInvite,
					onOpenSettings: () => {},
					onOpenNotificationSettings: () => {},
					onMarkAsRead: () => {},
					muted: false,
					onMutedChange,
					onCreateChannel: () => {},
					onCreateCategory: () => {},
					onReorderChannels: () => {},
					developerMode: true,
					onCopyAtUri: () => {},
					onLeave,
				}}
			/>
		</div>
	),
	play: async ({ canvasElement }) => {
		onInvite.mockClear();
		onLeave.mockClear();
		const canvas = within(canvasElement);
		await expect(
			canvas.queryByRole("button", { name: /Invite people/ }),
		).toBeNull();
		const trigger = canvasElement.querySelector(
			"[data-space-name-button]",
		) as HTMLElement;
		const row = canvasElement.querySelector(
			"[data-space-header-row]",
		) as HTMLElement;
		const box = trigger.getBoundingClientRect();
		const rowBox = row.getBoundingClientRect();
		await expect(Math.round(box.height)).toBe(28);
		await expect(Math.round(rowBox.height)).toBe(44);
		await expect(Math.round(box.left - rowBox.left)).toBe(8);
		await expect(box.width).toBeLessThanOrEqual(rowBox.width - 16);
		const chevron = trigger.querySelector(
			"[data-space-chevron]",
		) as HTMLElement;
		await expect(getComputedStyle(chevron).rotate).toMatch(/^(none|0deg)$/);
		await userEvent.click(trigger);
		const menu = await screen.findByRole("menu", undefined, { timeout: 3000 });
		await waitFor(
			() => expect(getComputedStyle(chevron).rotate).toBe("180deg"),
			{ timeout: 3000 },
		);
		const labels = within(menu)
			.getAllByRole("menuitem")
			.map((item) => item.textContent?.trim());
		await expect(labels).toEqual([
			"Invite people",
			"Manage Space",
			"Space settings",
			"Mark as read",
			"Create channel",
			"Create category",
			"Reorder channels",
			"Developer mode",
			"Leave Space",
		]);
		await userEvent.click(
			within(menu).getByRole("menuitem", { name: "Invite people" }),
		);
		await expect(onInvite).toHaveBeenCalledTimes(1);
		await waitFor(() => expect(screen.queryByRole("menu")).toBeNull(), {
			timeout: 3000,
		});
		await userEvent.click(trigger);
		const again = await screen.findByRole("menu", undefined, { timeout: 3000 });
		await userEvent.click(
			within(again).getByRole("menuitemcheckbox", { name: "Mute Space" }),
		);
		await expect(onMutedChange).toHaveBeenCalledWith(true);
		await userEvent.keyboard("{Escape}");
		await waitFor(
			() => {
				expect(screen.queryByRole("menu")).toBeNull();
				expect(
					document.querySelector('body > div[aria-hidden="true"]'),
				).toBeNull();
			},
			{ timeout: 3000 },
		);
	},
};

type ReorderChannel = { id: string; name: string };

const reorderSpace = () => ({
	uncategorized: [] as ReorderChannel[],
	categories: [
		{
			id: "hangout",
			name: "Hangout",
			channels: [
				{ id: "general", name: "General" },
				{ id: "photos", name: "Photos" },
				{ id: "files", name: "File sharing" },
			],
		},
		{
			id: "voice",
			name: "Voice",
			channels: [{ id: "lounge", name: "Lounge" }],
		},
	] as ChannelListCategory<ReorderChannel>[],
});

const HeaderReorder = (props: {
	platform: "mobile" | "desktop";
	manage: boolean;
}) => {
	const [space, setSpace] = createSignal(reorderSpace());
	const [reordering, setReordering] = createSignal(false);
	const [muted, setMuted] = createSignal(false);
	const desktopPlatform = props.platform === "desktop";
	const applyLayout = (layout: ChannelLayout) =>
		setSpace((current) => {
			const all = new Map(
				current.categories.flatMap((category) =>
					category.channels.map((entry) => [entry.id, entry] as const),
				),
			);
			const byId = new Map(
				current.categories.map((category) => [category.id, category]),
			);
			const pick = (ids: readonly string[]) =>
				ids.flatMap((id) => {
					const entry = all.get(id);
					return entry ? [entry] : [];
				});
			return {
				uncategorized: pick(layout.uncategorized),
				categories: layout.categories.map((category) => ({
					...(byId.get(category.id) as ChannelListCategory<ReorderChannel>),
					channels: pick(category.channels),
				})),
			};
		});
	return (
		<div
			class={
				desktopPlatform
					? "h-dvh w-72 overflow-y-auto border-0 border-r border-solid border-border bg-card text-foreground"
					: "h-dvh w-full overflow-y-auto bg-card text-foreground"
			}
		>
			<ChannelListHeader
				platform={props.platform}
				name="Colibri Social Flock"
				iconSrc={storyImages.violetIcon()}
				memberCount={99}
				ownerHandle="lou.gg"
				menu={{
					onMarkAsRead: () => {},
					get muted() {
						return muted();
					},
					onMutedChange: setMuted,
					onCreateChannel: props.manage ? () => {} : undefined,
					onReorderChannels: props.manage
						? () => setReordering(true)
						: undefined,
					onLeave: () => {},
				}}
			/>
			<ChannelList
				uncategorized={space().uncategorized}
				categories={space().categories}
				getId={(entry) => entry.id}
				channelName={(entry) => entry.name}
				canReorder={props.manage}
				reorderMode={reordering()}
				onReorderModeChange={setReordering}
				onReorder={(change) => applyLayout(change.layout)}
				renderChannel={(entry) => (
					<ChannelRow
						name={entry.name}
						platform={props.platform}
						density={desktopPlatform ? "compact" : "default"}
					/>
				)}
			/>
		</div>
	);
};

const channelOrder = (root: HTMLElement, categoryId: string) =>
	Array.from(
		root.querySelectorAll<HTMLElement>(
			`[data-list-category="${categoryId}"] [data-list-node="channel"]`,
		),
		(node) => node.dataset.channelId,
	);

const openSpaceMenu = async (root: HTMLElement) => {
	await userEvent.click(
		root.querySelector("[data-space-name-button]") as HTMLElement,
	);
};

export const DesktopHeaderReorder: Story = {
	parameters: desktop,
	render: () => <HeaderReorder platform="desktop" manage />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.queryByRole("button", { name: "Reorder General" }),
		).toBeNull();
		await openSpaceMenu(canvasElement);
		const menu = await screen.findByRole("menu", undefined, { timeout: 3000 });
		await userEvent.click(
			within(menu).getByRole("menuitem", { name: "Reorder channels" }),
		);
		const handle = await canvas.findByRole("button", {
			name: "Reorder General",
		});
		await expect(handle).toBeVisible();
		await expect(
			canvas.getByRole("button", { name: "Move General up" }),
		).toBeVisible();
		const down = canvas.getByRole("button", { name: "Move General down" });
		await expect(down).toBeVisible();
		await userEvent.click(down);
		await waitFor(() =>
			expect(channelOrder(canvasElement, "hangout")).toEqual([
				"photos",
				"general",
				"files",
			]),
		);
		await userEvent.click(canvas.getByRole("button", { name: "Done" }));
		await waitFor(() =>
			expect(
				canvas.queryByRole("button", { name: "Reorder General" }),
			).toBeNull(),
		);
		await expect(canvasElement.querySelector("[data-reorder-bar]")).toBeNull();
	},
};

export const MobileHeaderReorder: Story = {
	render: () => <HeaderReorder platform="mobile" manage />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await openSpaceMenu(canvasElement);
		const drawer = await screen.findByRole("dialog", undefined, {
			timeout: 3000,
		});
		const mute = within(drawer).getByRole("switch", { name: "Mute Space" });
		const muteRow = mute.closest("[data-list-toggle-row]");
		if (!muteRow) throw new Error("Missing Mute Space row");
		await expect(
			muteRow.querySelector("[data-toggle-row-icon] svg"),
		).toBeInstanceOf(SVGElement);
		await expect(mute).toHaveAttribute("aria-checked", "false");
		await userEvent.click(mute);
		await waitFor(() => expect(mute).toHaveAttribute("aria-checked", "true"));
		await expect(mute).toBeChecked();
		await userEvent.click(mute);
		await waitFor(() => expect(mute).toHaveAttribute("aria-checked", "false"));
		await expect(mute).not.toBeChecked();
		await expect(mute.isConnected).toBe(true);
		await userEvent.click(
			within(drawer).getByRole("button", { name: "Reorder channels" }),
		);
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), {
			timeout: 3000,
		});
		const handle = await canvas.findByRole("button", {
			name: "Reorder Photos",
		});
		await expect(getComputedStyle(handle).touchAction).toBe("none");
		await expect(
			canvas.getByRole("button", { name: "Move Photos up" }),
		).toBeInTheDocument();
		const row = canvasElement.querySelector(
			'[data-channel-id="photos"] [data-channel-row]',
		) as HTMLElement;
		await expect(row.closest("[inert]")).not.toBeNull();
		await userEvent.click(canvas.getByRole("button", { name: "Done" }));
		await waitFor(() =>
			expect(
				canvas.queryByRole("button", { name: "Reorder Photos" }),
			).toBeNull(),
		);
	},
};

export const HeaderMenuWithoutManage: Story = {
	parameters: desktop,
	render: () => <HeaderReorder platform="desktop" manage={false} />,
	play: async ({ canvasElement }) => {
		await openSpaceMenu(canvasElement);
		const menu = await screen.findByRole("menu", undefined, { timeout: 3000 });
		await expect(
			within(menu).getByRole("menuitem", { name: "Mark as read" }),
		).toBeInTheDocument();
		await expect(
			within(menu).queryByRole("menuitem", { name: "Reorder channels" }),
		).toBeNull();
		await userEvent.keyboard("{Escape}");
		await waitFor(() => expect(screen.queryByRole("menu")).toBeNull(), {
			timeout: 3000,
		});
	},
};

export const CompactList: Story = {
	parameters: desktop,
	render: () => (
		<div class="flex h-dvh bg-background">
			<div class="flex w-72 flex-col gap-0.5 overflow-y-auto border-0 border-r border-solid border-border bg-card p-2">
				<ChannelCategory name="Hangout">
					<ChannelRow
						name="General"
						platform="desktop"
						density="compact"
						active
						preview={{ author: "Lou", text: "Hey there!" }}
						onOpenSettings={() => {}}
					/>
					<ChannelRow
						name="Photos"
						platform="desktop"
						density="compact"
						unread
						attachment="image"
						preview={{ author: "Tim", text: "Kingfisher on the canal" }}
						onOpenSettings={() => {}}
					/>
					<ChannelRow
						name="Announcements"
						platform="desktop"
						density="compact"
						mentions={4}
						onOpenSettings={() => {}}
					/>
					<ChannelRow
						name="Read channel"
						platform="desktop"
						density="compact"
						onOpenSettings={() => {}}
					/>
					<VoiceChannelRow
						name="Birdwatch call"
						platform="desktop"
						joined
						participants={[lou, lis]}
						onOpenSettings={() => {}}
					/>
				</ChannelCategory>
			</div>
		</div>
	),
	play: async ({ canvasElement }) => {
		const rows = Array.from(
			canvasElement.querySelectorAll<HTMLElement>(
				'[data-channel-row][data-density="compact"]',
			),
		);
		await expect(rows.length).toBe(4);
		for (const row of rows) {
			await expect(row.querySelector("[data-channel-preview]")).toBeNull();
			await expect(row.getBoundingClientRect().height).toBe(40);
		}
	},
};

const SpaceDrawerDemo = () => {
	const [open, setOpen] = createSignal(false);
	const [muted, setMuted] = createSignal(false);
	return (
		<div class="min-h-dvh bg-background">
			<ChannelListHeader
				name="Colibri Social Flock"
				iconSrc={storyImages.violetIcon()}
				memberCount={99}
				ownerHandle="lou.gg"
				description="A cozy corner for people who build things on the AT Protocol."
				developer={{
					copyLabel: "Copy DID",
					copyValue: "did:plc:colibrisocialflock",
					pdslsHref: "https://pdsls.dev/at://did:plc:colibrisocialflock",
				}}
				menu={{
					onInvite: () => {},
					onOpenNotificationSettings: () => {},
					onOpenSettings: () => {},
					onMarkAsRead: () => {},
					get muted() {
						return muted();
					},
					onMutedChange: setMuted,
					onCreateChannel: () => {},
					onCreateCategory: () => {},
					onReorderChannels: () => {},
					onLeave: () => {},
					developerMode: true,
				}}
			/>
			<div class="p-4">
				<Button variant="secondary" onClick={() => setOpen(true)}>
					Open Space
				</Button>
			</div>
			<SpaceDrawerComponent
				open={open()}
				onOpenChange={setOpen}
				name="Colibri Social Flock"
				iconSrc={storyImages.violetIcon()}
				memberCount={99}
				ownerHandle="lou.gg"
				description="A cozy corner for people who build things on the AT Protocol."
				onInvite={() => {}}
				onOpenNotificationSettings={() => {}}
				onOpenSettings={() => {}}
				onMarkAsRead={() => {}}
				muted={muted()}
				onMutedChange={setMuted}
				onCreateChannel={() => {}}
				onCreateCategory={() => {}}
				onReorderChannels={() => {}}
				onLeave={() => {}}
				developerMode
				developer={{
					copyLabel: "Copy DID",
					copyValue: "did:plc:colibrisocialflock",
					pdslsHref: "https://pdsls.dev/at://did:plc:colibrisocialflock",
				}}
			/>
		</div>
	);
};

export const SpaceDrawer: Story = {
	parameters: { viewport: { defaultViewport: "iphone" } },
	render: () => <SpaceDrawerDemo />,
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getByRole("button", {
				name: "Colibri Social Flock, Space options",
			}),
		);
		const dialog = await screen.findByRole("dialog");
		await waitFor(() =>
			expect(
				within(dialog).getByRole("button", { name: "Invite" }),
			).toBeVisible(),
		);
		await new Promise((resolve) => setTimeout(resolve, 400));
		await expectNoLayoutIssues(dialog);
		const labels = Array.from(
			dialog.querySelectorAll<HTMLElement>("button, [role=switch], label"),
		).map((element) => element.textContent?.trim());
		await expect(labels.indexOf("Create channel")).toBeLessThan(
			labels.indexOf("Create category"),
		);
		for (const row of ["Mark as read", "Create channel", "Reorder channels"]) {
			const button = within(dialog).getByRole("button", { name: row });
			await expect(button.querySelector("svg")).not.toBeNull();
		}
		await expect(within(dialog).getByText("Mute Space")).toBeInTheDocument();
		await expect(
			within(dialog).getByRole("button", { name: "Leave Space" }),
		).toBeInTheDocument();
	},
};

const MemberSpaceDrawerDemo = () => {
	const [open, setOpen] = createSignal(false);
	const [muted, setMuted] = createSignal(false);
	return (
		<div class="min-h-dvh bg-background p-4">
			<Button variant="secondary" onClick={() => setOpen(true)}>
				Hold Space
			</Button>
			<SpaceDrawerComponent
				open={open()}
				onOpenChange={setOpen}
				name="Night Owls Art Club for Late Sketchers and Insomniac Painters"
				iconSrc={storyImages.violetIcon()}
				memberCount={500}
				description="Late night sketching, critique threads and the occasional speedpaint."
				onOpenNotificationSettings={() => {}}
				onMarkAsRead={() => {}}
				muted={muted()}
				onMutedChange={setMuted}
				onLeave={() => {}}
			/>
		</div>
	);
};

export const SpaceDrawerForMembers: Story = {
	parameters: { viewport: { defaultViewport: "iphone" } },
	render: () => <MemberSpaceDrawerDemo />,
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Hold Space" }),
		);
		const dialog = await screen.findByRole("dialog");
		const row = await within(dialog).findByRole("button", {
			name: "Space settings",
		});
		await new Promise((resolve) => setTimeout(resolve, 400));
		await expectNoLayoutIssues(dialog);
		await expect(
			within(dialog).queryByRole("button", { name: "Notifications" }),
		).toBeNull();
		const group = row.parentElement;
		await expect(
			group?.contains(
				within(dialog).getByRole("button", { name: "Mark as read" }),
			),
		).toBe(true);
	},
};

const removeChannel = fn();

const ChannelDrawerDemo = (props: { name: string; deletable?: boolean }) => {
	const [open, setOpen] = createSignal(false);
	const [muted, setMuted] = createSignal(false);
	return (
		<div class="min-h-dvh bg-background p-4">
			<Button variant="secondary" onClick={() => setOpen(true)}>
				Hold general
			</Button>
			<ChannelDrawerComponent
				open={open()}
				onOpenChange={setOpen}
				name={props.name}
				onMarkAsRead={() => {}}
				muted={muted()}
				onMutedChange={setMuted}
				onStartThread={() => {}}
				onShowThreads={() => {}}
				onCopyLink={() => {}}
				onDuplicate={() => {}}
				onEdit={() => {}}
				onDelete={props.deletable ? removeChannel : undefined}
				developerMode
				developer={{
					copyLabel: "Copy AT-URI",
					copyValue:
						"at://did:plc:colibrisocialflock/space/social.colibri.beta.channel.text/general",
				}}
			/>
		</div>
	);
};

const openChannelDrawer = async (canvasElement: HTMLElement, name: string) => {
	await waitFor(() =>
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
	);
	await waitFor(() =>
		expect(getComputedStyle(document.body).pointerEvents).not.toBe("none"),
	);
	await userEvent.click(
		within(canvasElement).getByRole("button", { name: "Hold general" }),
	);
	const dialog = await screen.findByRole("dialog", {
		name: `${name} options`,
	});
	await waitFor(() => expect(dialog).toBeVisible());
	await new Promise((resolve) => setTimeout(resolve, 400));
	return dialog;
};

export const ChannelDrawer: Story = {
	parameters: { viewport: { defaultViewport: "iphone" } },
	render: () => <ChannelDrawerDemo name="general" />,
	play: async ({ canvasElement }) => {
		const dialog = await openChannelDrawer(canvasElement, "general");
		await expectNoLayoutIssues(dialog);
		const header = dialog.querySelector(
			"[data-channel-drawer-header]",
		) as HTMLElement;
		await expect(
			Math.round(
				header.getBoundingClientRect().left -
					dialog.getBoundingClientRect().left,
			),
		).toBe(16);
		const groups = Array.from(dialog.querySelectorAll("section")).map((group) =>
			Array.from(group.querySelectorAll("button")).map((button) =>
				button.textContent?.trim(),
			),
		);
		await expect(groups.slice(0, 2)).toEqual([
			[
				"Mark as read",
				"Mute channel",
				"Start a thread",
				"Show all threads",
				"Copy channel link",
			],
			["Duplicate", "Edit channel"],
		]);
		for (const row of groups.slice(0, 2).flat()) {
			const button = within(dialog).getByRole("button", { name: row });
			await expect(button.querySelector("svg")).not.toBeNull();
			await expect(button.querySelectorAll("svg").length).toBe(1);
		}
		await expect(
			within(dialog).getByRole("link", { name: "Show on PDSls" }),
		).toHaveAttribute(
			"href",
			"https://pdsls.dev/at://did:plc:colibrisocialflock/space/social.colibri.beta.channel.text/general",
		);
		await expect(
			within(dialog).queryByRole("button", { name: "Delete channel" }),
		).toBeNull();
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Mute channel" }),
		);
		const reopened = await openChannelDrawer(canvasElement, "general");
		await expect(
			within(reopened).getByRole("button", { name: "Unmute channel" }),
		).toBeInTheDocument();
	},
};

export const ChannelDrawerWithDelete: Story = {
	parameters: { viewport: { defaultViewport: "iphone" } },
	render: () => <ChannelDrawerDemo name="general" deletable />,
	play: async ({ canvasElement }) => {
		removeChannel.mockClear();
		const dialog = await openChannelDrawer(canvasElement, "general");
		await expectNoLayoutIssues(dialog);
		const groups = Array.from(dialog.querySelectorAll("section")).map((group) =>
			Array.from(group.querySelectorAll("button")).map((button) =>
				button.textContent?.trim(),
			),
		);
		await expect(groups[2]).toEqual(["Delete channel"]);
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Delete channel" }),
		);
		await expect(removeChannel).toHaveBeenCalledOnce();
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
		);
	},
};

export const ChannelDrawerLongName: Story = {
	parameters: { viewport: { defaultViewport: "iphone" } },
	render: () => (
		<ChannelDrawerDemo name="super-duper-long-channel-name-that-is-probably-too-long-for-the-app" />
	),
	play: async ({ canvasElement }) => {
		const dialog = await openChannelDrawer(
			canvasElement,
			"super-duper-long-channel-name-that-is-probably-too-long-for-the-app",
		);
		await expectNoLayoutIssues(dialog);
		await expect(
			within(dialog).getByRole("link", { name: "Show on PDSls" }),
		).toBeVisible();
	},
};

const joinVoice = fn();
const openChat = fn();

const VoiceChannelDrawerDemo = () => {
	const [open, setOpen] = createSignal(false);
	const [inCall, setInCall] = createSignal(false);
	return (
		<div class="min-h-dvh bg-background p-4">
			<Button variant="secondary" onClick={() => setOpen(true)}>
				Hold general
			</Button>
			<ChannelDrawerComponent
				open={open()}
				onOpenChange={setOpen}
				name="lounge"
				icon={<VolumeSmallIcon />}
				onJoinVoice={() => {
					joinVoice();
					setInCall(true);
				}}
				onOpenCall={inCall() ? () => {} : undefined}
				onOpenChat={openChat}
				onCopyLink={() => {}}
				onDuplicate={() => {}}
				onEdit={() => {}}
				developerMode
				developer={{
					copyLabel: "Copy AT-URI",
					copyValue:
						"at://did:plc:colibrisocialflock/space/social.colibri.beta.channel.voice/lounge",
				}}
			/>
		</div>
	);
};

export const VoiceChannelDrawer: Story = {
	parameters: { viewport: { defaultViewport: "iphone" } },
	render: () => <VoiceChannelDrawerDemo />,
	play: async ({ canvasElement }) => {
		joinVoice.mockClear();
		openChat.mockClear();
		const dialog = await openChannelDrawer(canvasElement, "lounge");
		await expectNoLayoutIssues(dialog);
		const groups = Array.from(dialog.querySelectorAll("section")).map((group) =>
			Array.from(group.querySelectorAll("button")).map((button) =>
				button.textContent?.trim(),
			),
		);
		await expect(groups.slice(0, 3)).toEqual([
			["Join voice", "Open chat"],
			["Copy channel link"],
			["Duplicate", "Edit channel"],
		]);
		await expect(
			within(dialog).queryByRole("button", { name: "Mark as read" }),
		).toBeNull();
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Join voice" }),
		);
		await expect(joinVoice).toHaveBeenCalledTimes(1);
		const reopened = await openChannelDrawer(canvasElement, "lounge");
		await expect(
			within(reopened).getByRole("button", { name: "Open call" }),
		).toBeInTheDocument();
		await expect(
			within(reopened).queryByRole("button", { name: "Join voice" }),
		).toBeNull();
		await userEvent.click(
			within(reopened).getByRole("button", { name: "Open chat" }),
		);
		await expect(openChat).toHaveBeenCalledTimes(1);
	},
};

export const MobileActiveRow: Story = {
	parameters: { viewport: { defaultViewport: "iphone" } },
	render: () => (
		<Panel class="flex flex-col gap-1 px-2">
			<ChannelRow name="general" active />
			<ChannelRow name="design" />
		</Panel>
	),
	play: async ({ canvasElement }) => {
		const [active, idle] = Array.from(
			canvasElement.querySelectorAll<HTMLElement>("[data-channel-row] > *"),
		);
		if (!active || !idle) throw new Error("Missing rows");
		await expect(getComputedStyle(active).backgroundColor).toBe(
			"rgb(38, 38, 38)",
		);
		await expect(getComputedStyle(idle).backgroundColor).toBe(
			"rgba(0, 0, 0, 0)",
		);
		const name = idle.querySelector("[data-channel-name]") as HTMLElement;
		await expect(getComputedStyle(name).color).toBe("rgb(161, 161, 161)");
	},
};

const openThread = fn();

const NestedThreads = (props: { platform: "mobile" | "desktop" }) => (
	<ChannelCategory name="Hangout">
		<div class="flex min-w-0 flex-col gap-0.5">
			<ChannelRow
				name="general"
				platform={props.platform}
				unread
				preview={{ author: "Lou", text: "Who is coming on Saturday?" }}
			/>
			<ChannelThreads>
				<ChannelThreadRow
					name="Saturday route planning and the ferry timetable for the islands"
					platform={props.platform}
					unread
					onClick={openThread}
				/>
				<ChannelThreadRow
					name="Kingfisher sightings"
					platform={props.platform}
					mentions={2}
				/>
				<ChannelThreadRow
					name="Quiet thread"
					platform={props.platform}
					muted
					private
				/>
				<ChannelThreadRow name="Open thread" platform={props.platform} active />
			</ChannelThreads>
		</div>
		<ChannelRow name="photos" platform={props.platform} />
	</ChannelCategory>
);

const checkNestedThreads = async (canvasElement: HTMLElement) => {
	openThread.mockClear();
	const rows = Array.from(
		canvasElement.querySelectorAll<HTMLElement>("[data-channel-thread]"),
	);
	await expect(rows.map((row) => row.dataset.state)).toEqual([
		"unread",
		"mentions",
		"read",
		"read",
	]);
	await expect(rows[0]?.querySelector("[data-thread-unread]")).not.toBeNull();
	await expect(
		rows[1]?.querySelector("[data-thread-mentions]"),
	).toHaveTextContent("2");
	await expect(rows[2]).toHaveAttribute("data-muted");
	const channel = canvasElement.querySelector(
		"[data-channel-row] [data-channel-name]",
	) as HTMLElement;
	const firstName = rows[0]?.querySelector("[data-thread-name]") as HTMLElement;
	await expect(firstName.getBoundingClientRect().left).toBeGreaterThan(
		channel.getBoundingClientRect().left,
	);
	for (const row of rows) {
		const box = row.getBoundingClientRect();
		await expect(box.right).toBeLessThanOrEqual(
			(canvasElement.firstElementChild as HTMLElement).getBoundingClientRect()
				.right + 0.5,
		);
	}
	await expect(firstName.scrollWidth).toBeGreaterThan(firstName.clientWidth);
	await userEvent.click(
		within(canvasElement).getByRole("button", {
			name: /^Saturday route planning/,
		}),
	);
	await expect(openThread).toHaveBeenCalledOnce();
	await expect(
		within(canvasElement).getByRole("button", {
			name: /Kingfisher sightings.*2 mentions/,
		}),
	).toBeInTheDocument();
	await expect(
		within(canvasElement).getByRole("button", { name: /^Open thread/ }),
	).toHaveAttribute("aria-current", "page");
	await expect(
		canvasElement.querySelectorAll('[aria-current="page"]'),
	).toHaveLength(1);
	await expect(
		canvasElement.querySelector("[data-channel-row]"),
	).not.toHaveAttribute("data-active");
};

export const NestedThreadsMobile: Story = {
	render: () => (
		<Panel class="px-0">
			<NestedThreads platform="mobile" />
		</Panel>
	),
	play: async ({ canvasElement }) => {
		await checkNestedThreads(canvasElement);
		const row = canvasElement.querySelector(
			"[data-channel-thread] > *",
		) as HTMLElement;
		await expect(Math.round(row.getBoundingClientRect().height)).toBe(40);
	},
};

export const NestedThreadsDesktop: Story = {
	parameters: desktop,
	render: () => (
		<div class="w-72 bg-background py-2 text-foreground">
			<NestedThreads platform="desktop" />
		</div>
	),
	play: async ({ canvasElement }) => {
		await checkNestedThreads(canvasElement);
		const row = canvasElement.querySelector(
			"[data-channel-thread] > *",
		) as HTMLElement;
		await expect(Math.round(row.getBoundingClientRect().height)).toBe(32);
	},
};

const openParticipant = fn();

export const VoiceParticipants: Story = {
	render: () => {
		const [speaking, setSpeaking] = createSignal(false);
		const [joined, setJoined] = createSignal(false);
		const people = (): VoiceParticipant[] => [
			{ ...lis, speaking: speaking() },
			{ ...tim },
			{ id: "did:plc:loading", name: "did:plc:loading", pending: true },
		];
		return (
			<Panel class="flex flex-col gap-2 px-2">
				<Button variant="secondary" onClick={() => setSpeaking((on) => !on)}>
					Toggle speaking
				</Button>
				<Button variant="secondary" onClick={() => setJoined((on) => !on)}>
					Toggle joined
				</Button>
				<VoiceChannelRow
					name="Birdwatch call"
					joined={joined()}
					participants={people()}
					onOpenParticipant={openParticipant}
				/>
			</Panel>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const list = canvas.getByRole("list", { name: "In Birdwatch call" });
		const pending = list.querySelector("[data-pending]");
		await expect(
			pending?.querySelector("[data-voice-participant-skeleton]"),
		).not.toBeNull();
		await expect(list.textContent).not.toContain("did:plc:loading");
		const image = () =>
			list.querySelector<HTMLImageElement>(
				"[data-voice-participant]:first-child img",
			);
		const before = image();
		await expect(before).not.toBeNull();
		const first = () =>
			list.querySelector("[data-voice-participant]:first-child");
		await userEvent.click(
			canvas.getByRole("button", { name: "Toggle speaking" }),
		);
		await new Promise((resolve) => setTimeout(resolve, 50));
		await expect(first()).not.toHaveAttribute("data-speaking");
		await expect(
			list.querySelector("[data-speaking-ring][class*='outline-primary']"),
		).toBeNull();
		await expect(list.textContent).not.toContain("speaking");
		await userEvent.click(
			canvas.getByRole("button", { name: "Toggle joined" }),
		);
		await waitFor(() => expect(first()).toHaveAttribute("data-speaking"));
		await expect(image()).toBe(before);
		await userEvent.click(within(list).getByRole("button", { name: /Lis/ }));
		await expect(openParticipant).toHaveBeenCalledWith("lis");
		await expectNoLayoutIssues(list as HTMLElement);
	},
};

export const StreamingParticipants: Story = {
	render: () => (
		<Panel class="flex w-[280px] flex-col gap-2 px-2">
			<VoiceChannelRow
				name="Birdwatch call"
				participants={[
					{ ...lou, speaking: false, streaming: true },
					{
						...lis,
						name: "Lis with a display name long enough to truncate",
						streaming: true,
					},
					tim,
				]}
				onOpenParticipant={openParticipant}
			/>
		</Panel>
	),
	play: async ({ canvasElement }) => {
		const list = within(canvasElement).getByRole("list", {
			name: "In Birdwatch call",
		});
		const rows = [
			...list.querySelectorAll<HTMLElement>("[data-voice-participant]"),
		];
		await expect(
			rows[0]?.querySelector("[data-voice-streaming]"),
		).not.toBeNull();
		await expect(rows[2]?.querySelector("[data-voice-streaming]")).toBeNull();
		await expect(
			within(list).getByRole("button", { name: /^Lou.*, live$/ }),
		).toBeVisible();
		const muted = within(rows[1] as HTMLElement).getByRole("img", {
			name: "Muted",
		});
		const indicator = rows[1]?.querySelector(
			"[data-voice-streaming]",
		) as HTMLElement;
		await expect(indicator.getBoundingClientRect().right).toBeLessThanOrEqual(
			muted.getBoundingClientRect().left,
		);
		const heights = rows.map((row) =>
			Math.round(row.getBoundingClientRect().height),
		);
		await expect(new Set(heights).size).toBe(1);
		await expectNoLayoutIssues(list);
	},
};

export const Skeletons: Story = {
	render: () => (
		<Panel class="flex flex-col gap-4">
			<div data-pair="header" class="flex flex-col gap-2">
				<ChannelListHeaderSkeleton />
				<ChannelListHeader
					name="Colibri Social Flock"
					bannerSrc={storyImages.sunsetBanner()}
					memberCount={99}
					ownerHandle="lou.gg"
				/>
			</div>
			<div data-pair="text" class="flex flex-col gap-2 px-2">
				<ChannelRowSkeleton />
				<ChannelRow name="General" preview={{ author: "Lou", text: "Hey" }} />
			</div>
			<div data-pair="compact" class="flex flex-col gap-2 px-2">
				<ChannelRowSkeleton density="compact" />
				<ChannelRow
					name="General"
					density="compact"
					preview={{ author: "Lou", text: "Hey" }}
				/>
			</div>
			<div data-pair="voice" class="flex flex-col gap-2 px-2">
				<VoiceChannelRowSkeleton participants={2} />
				<VoiceChannelRow name="Birdwatch call" participants={[lis, tim]} />
			</div>
			<div data-pair="category" class="flex flex-col gap-2">
				<CategorySkeleton rows={2} />
				<ChannelCategory name="Hangout">
					<ChannelRow name="General" preview={{ author: "Lou", text: "Hey" }} />
					<ChannelRow name="Photos" preview={{ author: "Lis", text: "Look" }} />
				</ChannelCategory>
			</div>
			<div data-pair="category-no-preview" class="flex flex-col gap-2">
				<CategorySkeleton rows={2} preview={false} />
				<ChannelCategory name="Quiet corner">
					<ChannelRow name="General" />
					<ChannelRow name="Photos" />
				</ChannelCategory>
			</div>
			<div data-pair="category-compact" class="flex flex-col gap-2">
				<CategorySkeleton rows={2} density="compact" platform="desktop" />
				<ChannelCategory name="Compact corner" density="compact">
					<ChannelRow name="General" density="compact" platform="desktop" />
					<ChannelRow name="Photos" density="compact" platform="desktop" />
				</ChannelCategory>
			</div>
			<div data-pair="category-header" class="flex flex-col gap-2 px-2">
				<CategoryHeaderSkeleton />
				<CategoryHeader name="Hangout" />
			</div>
		</Panel>
	),
	play: async ({ canvasElement }) => {
		for (const pair of [
			"header",
			"text",
			"compact",
			"voice",
			"category",
			"category-no-preview",
			"category-compact",
			"category-header",
		]) {
			const box = canvasElement.querySelector(
				`[data-pair="${pair}"]`,
			) as HTMLElement;
			const [skeleton, real] = Array.from(box.children) as HTMLElement[];
			const a = (skeleton as HTMLElement).getBoundingClientRect();
			const b = (real as HTMLElement).getBoundingClientRect();
			await expect(Math.abs(a.width - b.width)).toBeLessThanOrEqual(1);
			await expect(Math.abs(a.height - b.height)).toBeLessThanOrEqual(1);
		}
	},
};

export const CategoryRightClick: Story = {
	name: "Category right-click menu",
	parameters: desktop,
	render: () => {
		const [muted, setMuted] = createSignal(false);
		return (
			<div class="h-dvh w-72 overflow-y-auto border-0 border-r border-solid border-border bg-card text-foreground">
				<ChannelList
					uncategorized={reorderSpace().uncategorized}
					categories={reorderSpace().categories}
					getId={(entry) => entry.id}
					channelName={(entry) => entry.name}
					wrapCategoryHeader={(id, header) => (
						<CategoryContextMenu
							name={id === "voice" ? "Voice" : "Hangout"}
							muted={muted()}
							onMutedChange={setMuted}
							onMarkAsRead={() => {}}
						>
							{header}
						</CategoryContextMenu>
					)}
					renderChannel={(entry) => (
						<ChannelRow
							name={entry.name}
							platform="desktop"
							density="compact"
						/>
					)}
				/>
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		const header = canvasElement.querySelector(
			'[data-list-category="hangout"] [data-category-header]',
		) as HTMLElement;
		const rect = header.getBoundingClientRect();
		header.dispatchEvent(
			new MouseEvent("contextmenu", {
				bubbles: true,
				cancelable: true,
				button: 2,
				clientX: rect.left + 24,
				clientY: rect.top + 8,
			}),
		);
		const menu = await screen.findByRole("menu", { name: "Hangout options" });
		const mute = within(menu).getByRole("menuitemcheckbox", { name: /Mute/ });
		await userEvent.click(mute);
		await waitFor(() => expect(mute).toHaveAttribute("aria-checked", "true"));
		await userEvent.keyboard("{Escape}");
		await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
		const row = within(canvasElement).getByText("General");
		row.dispatchEvent(
			new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
		);
		await expect(screen.queryByRole("menu")).toBeNull();
		await userEvent.click(
			within(header).getByRole("button", { name: "Hangout" }),
		);
		await waitFor(() =>
			expect(
				canvasElement
					.querySelector('[data-list-category="hangout"] [data-category]')
					?.hasAttribute("data-collapsed"),
			).toBe(true),
		);
	},
};

const LONG_OWNER = "bartholomew.the.heron.watcher.bsky.social";

export const HeaderChips: Story = {
	name: "Header member and owner chips",
	parameters: desktop,
	render: () => (
		<div class="flex gap-6 bg-background text-foreground">
			<div data-header-frame="long" class="w-72 bg-card">
				<ChannelListHeader
					platform="desktop"
					name="Colibri Social Flock"
					iconSrc={storyImages.violetIcon()}
					memberCount={1240}
					ownerHandle={LONG_OWNER}
				/>
			</div>
			<div data-header-frame="short" class="w-72 bg-card">
				<ChannelListHeader
					platform="desktop"
					name="Colibri Social Flock"
					iconSrc={storyImages.violetIcon()}
					memberCount={99}
					ownerHandle="lou.gg"
				/>
			</div>
			<div data-header-frame="mobile" class="w-[338px] bg-card">
				<ChannelListHeader
					platform="mobile"
					name="Colibri Social Flock"
					iconSrc={storyImages.violetIcon()}
					memberCount={1240}
					ownerHandle={LONG_OWNER}
				/>
			</div>
		</div>
	),
	play: async ({ canvasElement }) => {
		const chipsIn = (frame: string) => {
			const root = canvasElement.querySelector(
				`[data-header-frame="${frame}"]`,
			) as HTMLElement;
			const row = root.querySelector("[data-space-chips]") as HTMLElement;
			const [members, owner] = Array.from(row.children) as HTMLElement[];
			if (!members || !owner) throw new Error("chips missing");
			return { root, row, members, owner };
		};
		for (const frame of ["long", "mobile"]) {
			const { root, row, members, owner } = chipsIn(frame);
			await expect(members.textContent?.trim()).toBe("1,240 members");
			await expect(owner.textContent?.trim()).toBe(`Owner @${LONG_OWNER}`);
			const first = members.getBoundingClientRect();
			const second = owner.getBoundingClientRect();
			await expect(second.top).toBeGreaterThanOrEqual(first.bottom);
			await expect(Math.round(second.top - first.bottom)).toBe(
				Math.round(Number.parseFloat(getComputedStyle(row).rowGap)),
			);
			await expect(second.left).toBe(first.left);
			await expect(second.right).toBeLessThanOrEqual(
				row.getBoundingClientRect().right + 0.5,
			);
			const label = owner.querySelector(".truncate") as HTMLElement;
			await expect(label.scrollWidth).toBeGreaterThan(label.clientWidth);
			await expect(owner).not.toHaveAttribute("title");
			await userEvent.hover(label);
			await waitFor(
				() =>
					expect(screen.getByRole("tooltip")).toHaveTextContent(
						`Owner @${LONG_OWNER}`,
					),
				{ timeout: 2000 },
			);
			await userEvent.unhover(label);
			await waitFor(() =>
				expect(screen.queryByRole("tooltip")).not.toBeInTheDocument(),
			);
			await expectNoLayoutIssues(root);
		}
		const { root, members, owner } = chipsIn("short");
		await expect(owner.textContent?.trim()).toBe("Owner @lou.gg");
		await expect(Math.round(owner.getBoundingClientRect().top)).toBe(
			Math.round(members.getBoundingClientRect().top),
		);
		await expect(owner.textContent).not.toContain("By");
		await expectNoLayoutIssues(root);
	},
};

const hoverBackground = (element: Element) => {
	for (const sheet of Array.from(document.styleSheets)) {
		let rules: CSSRuleList;
		try {
			rules = sheet.cssRules;
		} catch {
			continue;
		}
		const queue = Array.from(rules);
		while (queue.length > 0) {
			const rule = queue.shift();
			if (rule && "cssRules" in rule && !(rule instanceof CSSStyleRule)) {
				queue.push(...Array.from((rule as CSSGroupingRule).cssRules));
				continue;
			}
			if (!(rule instanceof CSSStyleRule)) continue;
			if (!rule.selectorText.includes(":hover")) continue;
			const background = rule.style.backgroundColor;
			if (!background) continue;
			const selector = rule.selectorText.replaceAll(":hover", "");
			try {
				if (element.matches(selector)) return background;
			} catch {}
		}
	}
	return undefined;
};

const heroFrames = [
	{ id: "bright", bannerColor: "linear-gradient(135deg, #fef3c7, #ffffff)" },
	{ id: "dark", bannerColor: "#050505" },
	{ id: "image", bannerSrc: storyImages.sunsetBanner() },
	{ id: "none" },
] as const;

export const DesktopBannerHeader: Story = {
	name: "Desktop banner behind the Space name",
	parameters: desktop,
	render: () => (
		<div class="flex flex-wrap gap-6 bg-background p-4 text-foreground">
			<For each={heroFrames}>
				{(frame) => (
					<div data-hero-frame={frame.id} class="w-72 bg-card">
						<ChannelListHeader
							platform="desktop"
							name="Colibri Social Flock"
							bannerColor={
								"bannerColor" in frame ? frame.bannerColor : undefined
							}
							bannerSrc={"bannerSrc" in frame ? frame.bannerSrc : undefined}
							memberCount={99}
							ownerHandle="lou.gg"
							menu={{ onMarkAsRead: () => {}, onLeave: () => {} }}
						/>
					</div>
				)}
			</For>
		</div>
	),
	play: async ({ canvasElement }) => {
		for (const frame of heroFrames) {
			const root = canvasElement.querySelector(
				`[data-hero-frame="${frame.id}"]`,
			) as HTMLElement;
			const banner = root.querySelector("[data-banner]") as HTMLElement | null;
			const row = root.querySelector("[data-space-header-row]") as HTMLElement;
			const name = root.querySelector("[data-space-name]") as HTMLElement;
			const chevron = root.querySelector("[data-space-chevron]") as HTMLElement;
			const trigger = root.querySelector(
				"[data-space-name-button]",
			) as HTMLElement;
			const withBanner = "bannerSrc" in frame && !!frame.bannerSrc;
			const rootTop = root.getBoundingClientRect().top;
			await expect(row.getBoundingClientRect().top).toBe(rootTop);
			await expect(getComputedStyle(row).backdropFilter).toMatch(/^(none|)$/);
			await expect(getComputedStyle(trigger).backdropFilter).toMatch(
				/^(none|)$/,
			);
			if (withBanner) {
				if (!banner) throw new Error(`missing banner in ${frame.id}`);
				await expect(banner.getBoundingClientRect().top).toBe(rootTop);
				await expect(row.dataset.overlay).toBe("");
				await expect(getComputedStyle(row).backgroundColor).toBe(
					"rgba(0, 0, 0, 0)",
				);
				await expect(getComputedStyle(name).textShadow).not.toBe("none");
				await expect(getComputedStyle(chevron).filter).toContain("drop-shadow");
				await expect(getComputedStyle(banner).borderTopLeftRadius).toBe("0px");
				await expect(root.querySelector("[data-space-scrim]")).not.toBeNull();
				await expect(root.querySelector("[data-banner-flush]")).not.toBeNull();
			} else {
				await expect(banner).toBeNull();
				await expect(
					root.querySelector("[data-banner-placeholder]"),
				).toBeNull();
				await expect(row.dataset.overlay).toBeUndefined();
				await expect(getComputedStyle(row).backgroundColor).not.toBe(
					"rgba(0, 0, 0, 0)",
				);
				await expect(getComputedStyle(name).textShadow).toBe("none");
				await expect(root.querySelector("[data-banner-flush]")).toBeNull();
			}
			await expect(hoverBackground(trigger)).toBeTruthy();
			const box = trigger.getBoundingClientRect();
			const hit = document.elementFromPoint(
				box.left + box.width / 2,
				box.top + box.height / 2,
			);
			await expect(!!hit && trigger.contains(hit)).toBe(true);
			await expectNoLayoutIssues(root);
		}
	},
};

const scrollChannels = Array.from({ length: 30 }, (_, index) => ({
	id: `scroll-${index}`,
	name: `channel-${index + 1}`,
}));

export const DesktopBannerHeaderScroll: Story = {
	name: "Desktop banner header while scrolling",
	parameters: desktop,
	render: () => (
		<div class="flex gap-6 bg-background p-4 text-foreground">
			<For each={["banner", "none"] as const}>
				{(variant) => (
					<div
						data-scroll-frame={variant}
						class="h-[420px] w-72 overflow-y-auto bg-background"
					>
						<ChannelListHeader
							platform="desktop"
							name="Colibri Social Flock"
							bannerSrc={
								variant === "banner" ? storyImages.sunsetBanner() : undefined
							}
							memberCount={99}
							ownerHandle="lou.gg"
							menu={{ onMarkAsRead: () => {}, onLeave: () => {} }}
						/>
						<For each={scrollChannels}>
							{(channel) => (
								<div class="flex h-9 items-center px-4 text-sm text-muted-foreground">
									# {channel.name}
								</div>
							)}
						</For>
					</div>
				)}
			</For>
		</div>
	),
	play: async ({ canvasElement }) => {
		const frame = (variant: string) =>
			canvasElement.querySelector(
				`[data-scroll-frame="${variant}"]`,
			) as HTMLElement;
		const rowOf = (root: HTMLElement) =>
			root.querySelector("[data-space-header-row]") as HTMLElement;
		const settle = () =>
			new Promise((resolve) =>
				requestAnimationFrame(() => requestAnimationFrame(resolve)),
			);

		const withBanner = frame("banner");
		const row = rowOf(withBanner);
		await expect(row.querySelector("[data-space-invite]")).toBeNull();
		await expect(row.dataset.overlay).toBe("");
		await expect(row.dataset.scrolled).toBeUndefined();
		const name = row.querySelector("[data-space-name-button]") as HTMLElement;
		const center = name.getBoundingClientRect();
		const top = document.elementFromPoint(
			center.left + center.width / 2,
			center.top + center.height / 2,
		);
		await expect(!!top && name.contains(top)).toBe(true);

		withBanner.scrollTop = 40;
		await settle();
		await expect(row.getBoundingClientRect().top).toBe(
			withBanner.getBoundingClientRect().top,
		);
		await expect(row.dataset.overlay).toBe("");
		const hero = withBanner.querySelector("[data-space-hero]") as HTMLElement;
		await expect(hero.getBoundingClientRect().top).toBeLessThan(
			row.getBoundingClientRect().top,
		);

		withBanner.scrollTop = 400;
		await settle();
		await waitFor(() => expect(row.dataset.scrolled).toBe(""));
		await expect(row.dataset.overlay).toBeUndefined();
		await expect(row.getBoundingClientRect().top).toBe(
			withBanner.getBoundingClientRect().top,
		);
		await waitFor(() =>
			expect(getComputedStyle(row).boxShadow).toContain("inset"),
		);
		await waitFor(() =>
			expect(getComputedStyle(row).backgroundColor).not.toBe(
				"rgba(0, 0, 0, 0)",
			),
		);
		await expect(getComputedStyle(row).backdropFilter).toMatch(/^(none|)$/);

		withBanner.scrollTop = 0;
		await settle();
		await waitFor(() => expect(row.dataset.scrolled).toBeUndefined());
		await expect(row.dataset.overlay).toBe("");

		const plain = frame("none");
		const plainRow = rowOf(plain);
		await expect(plain.querySelector("[data-banner]")).toBeNull();
		await expect(plainRow.dataset.scrolled).toBeUndefined();
		plain.scrollTop = 120;
		await settle();
		await waitFor(() => expect(plainRow.dataset.scrolled).toBe(""));
		await expect(plainRow.getBoundingClientRect().top).toBe(
			plain.getBoundingClientRect().top,
		);
		await expectNoLayoutIssues(canvasElement);
	},
};

const widthChannels = [
	{ id: "short", name: "hi", preview: "ok" },
	{ id: "mid", name: "general", preview: "Kingfisher by the bridge" },
	{
		id: "long",
		name: "a-very-long-channel-name-that-keeps-going",
		preview:
			"This preview is far longer than the sidebar could ever show in one line of text",
	},
];

export const DesktopRowWidths: Story = {
	name: "Desktop rows fill the list",
	parameters: desktop,
	render: () => (
		<div class="h-dvh w-72 overflow-y-auto bg-card text-foreground">
			<ChannelList
				categories={[{ id: "talk", name: "Talk", channels: widthChannels }]}
				uncategorized={widthChannels.map((entry) => ({
					...entry,
					id: `${entry.id}-loose`,
				}))}
				getId={(entry) => entry.id}
				channelName={(entry) => entry.name}
				renderChannel={(entry) => (
					<ChannelContextMenu name={entry.name} onCopyLink={() => {}}>
						<ChannelRow
							name={entry.name}
							platform="desktop"
							unread
							preview={{ author: "Lou", text: entry.preview }}
							attachment={entry.id === "mid" ? "image" : undefined}
						/>
					</ChannelContextMenu>
				)}
			/>
		</div>
	),
	play: async ({ canvasElement }) => {
		const slots = Array.from(
			canvasElement.querySelectorAll<HTMLElement>("[data-channel-slot]"),
		);
		await expect(slots).toHaveLength(6);
		const width = slots[0]?.getBoundingClientRect().width ?? 0;
		await expect(width).toBeGreaterThan(200);
		for (const slot of slots) {
			const row = slot.querySelector("[data-channel-row]") as HTMLElement;
			await expect(slot.getBoundingClientRect().width).toBe(width);
			await expect(row.getBoundingClientRect().width).toBe(width);
			const preview = row.querySelector(
				"[data-channel-preview]",
			) as HTMLElement;
			await expect(preview.getBoundingClientRect().right).toBeLessThanOrEqual(
				row.getBoundingClientRect().right,
			);
			await expect(getComputedStyle(preview).textOverflow).toBe("ellipsis");
		}
		const long = Array.from(
			canvasElement.querySelectorAll<HTMLElement>("[data-channel-preview]"),
		).find((preview) => preview.textContent?.includes("far longer"));
		if (!long) throw new Error("long preview missing");
		await expect(long.scrollWidth).toBeGreaterThan(long.clientWidth);
		await expectNoLayoutIssues(canvasElement);
	},
};

const openVoiceChat = fn();
const openVoiceRow = fn();

export const DesktopVoiceRowActions: Story = {
	name: "Desktop voice row actions",
	parameters: desktop,
	render: () => (
		<div class="w-72 bg-card px-2 py-2 text-foreground">
			<VoiceChannelRow
				name="a-very-long-voice-channel-name-that-keeps-going"
				platform="desktop"
				private
				participants={[lis]}
				onClick={openVoiceRow}
				onOpenChat={openVoiceChat}
				onOpenSettings={() => {}}
			/>
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const chat = canvas.getByRole("button", {
			name: "Open chat for a-very-long-voice-channel-name-that-keeps-going",
		});
		const settings = canvas.getByRole("button", {
			name: "Settings for a-very-long-voice-channel-name-that-keeps-going",
		});
		await expect(getComputedStyle(chat).opacity).toBe("0");
		await expect(getComputedStyle(settings).opacity).toBe("0");
		const chatBox = chat.getBoundingClientRect();
		const settingsBox = settings.getBoundingClientRect();
		await expect(Math.round(chatBox.top)).toBe(Math.round(settingsBox.top));
		await expect(chatBox.right).toBeLessThanOrEqual(settingsBox.left);
		const name = canvasElement.querySelector(
			"[data-channel-name]",
		) as HTMLElement;
		await expect(name.getBoundingClientRect().right).toBeLessThanOrEqual(
			chatBox.left,
		);
		await expect(name.scrollWidth).toBeGreaterThan(name.clientWidth);
		chat.focus();
		await expect(getComputedStyle(chat).opacity).toBe("1");
		await userEvent.click(chat);
		await expect(openVoiceChat).toHaveBeenCalledTimes(1);
		await expect(openVoiceRow).not.toHaveBeenCalled();
		await expectNoLayoutIssues(canvasElement);
	},
};
