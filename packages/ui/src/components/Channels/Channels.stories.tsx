import { BellIcon } from "@solar-icons/solid/bold/bell";
import { ChecklistMinimalisticIcon } from "@solar-icons/solid/bold/checklist-minimalistic";
import { InboxIcon } from "@solar-icons/solid/bold/inbox";
import { LogoutIcon } from "@solar-icons/solid/bold/logout";
import { SettingsIcon } from "@solar-icons/solid/bold/settings";
import { UserPlusIcon } from "@solar-icons/solid/bold/user-plus";
import { createSignal, For, type JSX } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { AnimatedSettingsIcon } from "../../icons/animated/icons";
import {
	AnimatedProfileIcon,
	AnimatedUsersGroupTwoRoundedIcon,
} from "../../icons/animated/people";
import { AnimatedInboxIcon } from "../../icons/animated/system";
import { storyImages } from "../Banner/story-images";
import { Button } from "../Button/Button";
import { DeveloperModeCard } from "../DeveloperMode/DeveloperModeCard";
import { Drawer, DrawerContent, DrawerTrigger } from "../Drawer/Drawer";
import { DestructiveRow, ListGroup, NavRow } from "../List/List";
import { SpaceProfileHeader } from "../Space/SpaceProfileHeader";
import {
	SpaceRail,
	SpaceRailAction,
	SpaceRailItem,
} from "../SpaceRail/SpaceRail";
import { TabBar, TabBarItem } from "../TabBar/TabBar";
import type { VoiceParticipant } from "../Voice/shared";
import { CategoryHeader, ChannelCategory } from "./Category";
import {
	ActionTile,
	ActionTiles,
	ChannelListHeader,
} from "./ChannelListHeader";
import { CategoryEmpty, ChannelRow, VoiceChannelRow } from "./ChannelRow";
import {
	CategoryHeaderSkeleton,
	CategorySkeleton,
	ChannelListHeaderSkeleton,
	ChannelRowSkeleton,
	VoiceChannelRowSkeleton,
} from "./ChannelSkeletons";

const meta = {
	title: "Navigation/Channel list",
	parameters: { viewport: { defaultViewport: "iphone" } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

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
					preview={{ author: "Lou", text: "Read this message, please!" }}
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
				<VoiceChannelRow name="Empty voice" platform={props.platform} />
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
			<SpaceRail onCreate={() => {}} onDiscover={() => {}}>
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
			await expect(row.getBoundingClientRect().height).toBe(32);
		}
	},
};

export const SpaceDrawer: Story = {
	render: () => (
		<div class="min-h-dvh bg-background p-4">
			<Drawer>
				<DrawerTrigger as={Button} variant="secondary">
					Open Space
				</DrawerTrigger>
				<DrawerContent
					aria-label="Colibri Social Flock"
					header={
						<SpaceProfileHeader
							name="Colibri Social Flock"
							iconSrc={storyImages.violetIcon()}
							memberCount={99}
							ownerHandle="lou.gg"
							description="A cozy corner for people who build things on the AT Protocol."
						/>
					}
				>
					<ActionTiles>
						<ActionTile icon={<UserPlusIcon />} label="Invite" />
						<ActionTile icon={<BellIcon />} label="Notifications" />
						<ActionTile icon={<SettingsIcon />} label="Settings" />
					</ActionTiles>
					<ListGroup>
						<NavRow icon={<ChecklistMinimalisticIcon />} label="Mark as read" />
						<NavRow label="Show members" />
					</ListGroup>
					<ListGroup>
						<NavRow label="Create category" />
						<NavRow label="Create channel" />
					</ListGroup>
					<ListGroup>
						<DestructiveRow icon={<LogoutIcon />} label="Leave Space" />
					</ListGroup>
					<DeveloperModeCard
						copyLabel="Copy DID"
						copyValue="did:plc:colibrisocialflock"
						pdslsHref="https://pdsls.dev/at://did:plc:colibrisocialflock"
					/>
				</DrawerContent>
			</Drawer>
		</div>
	),
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Open Space" }),
		);
		const dialog = await screen.findByRole("dialog");
		await waitFor(() =>
			expect(
				within(dialog).getByRole("button", { name: "Invite" }),
			).toBeVisible(),
		);
		await expect(
			within(dialog).getByRole("button", { name: "Leave Space" }),
		).toBeInTheDocument();
	},
};

export const Skeletons: Story = {
	render: () => (
		<Panel class="flex flex-col gap-4">
			<div data-pair="header" class="flex flex-col gap-2">
				<ChannelListHeaderSkeleton />
				<ChannelListHeader
					name="Colibri Social Flock"
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
