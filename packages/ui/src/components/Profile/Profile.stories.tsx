import { PenIcon } from "@solar-icons/solid/bold/pen";
import { ShieldUserIcon } from "@solar-icons/solid/bold/shield-user";
import { SledgehammerIcon } from "@solar-icons/solid/bold/sledgehammer";
import { UserMinusRoundedIcon } from "@solar-icons/solid/bold/user-minus-rounded";
import { createSignal } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { PlayTesterBadge } from "../../icons/animated/brand";
import { createRipple } from "../../utils/ripple";
import { Badge } from "../Badge/Badge";
import { Button } from "../Button/Button";
import { DeveloperModeCard } from "../DeveloperMode/DeveloperModeCard";
import { Drawer, DrawerContent, DrawerTrigger } from "../Drawer/Drawer";
import { SectionLabel } from "../List/List";
import { MessageRow } from "../Message/MessageRow";
import { NowPlayingCard, ProfileHeader, StatusBubble } from "./Profile";
import {
	ProfileContentBody,
	ProfileContentHeader,
	type ProfileData,
} from "./ProfileContent";
import {
	PROFILE_POPOVER_WIDTH,
	ProfilePopover,
	ProfilePopoverSkeleton,
} from "./ProfilePopover";

const AVATAR =
	"data:image/svg+xml;utf8," +
	encodeURIComponent(
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" fill="#8e51ff"/></svg>',
	);

const ALBUM_ART =
	"data:image/svg+xml;utf8," +
	encodeURIComponent(
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0abfc"/><stop offset="1" stop-color="#4c1d95"/></linearGradient></defs><rect width="72" height="72" fill="url(#g)"/></svg>',
	);

const LONG_STATUS =
	"This is my very long status that may go up to a certain amount of characters, and it keeps going so the bubble has to clamp it after three lines";

const BIO =
	"This is a long user description that goes on for however long the owner needs it to, up to the character limit.";

const onStatusClick = fn();
const onBubbleClick = fn();
const onAuthorAction = fn();

const meta = {
	title: "Surfaces/Profile",
	parameters: { viewport: { defaultViewport: "iphone" } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const TeamBadge = () => <Badge class="h-5 text-sm">Team</Badge>;

const EditProfileRow = () => {
	const ripple = createRipple();
	return (
		<button
			ref={ripple}
			type="button"
			class="ripple flex h-10 w-full cursor-pointer items-center gap-2 rounded-control bg-secondary px-3 text-left text-foreground outline-none hover:bg-secondary-highlight focus-visible:shadow-[inset_0_0_0_2px_var(--primary)]"
		>
			<span class="flex size-6 items-center justify-center [&>svg]:size-6">
				<PenIcon />
			</span>
			<span class="text-sm font-semibold">Edit profile</span>
		</button>
	);
};

export const ProfileTab: Story = {
	render: () => (
		<div class="-m-4 min-h-dvh bg-background pb-16">
			<ProfileHeader
				displayName="Lou"
				handle="lou.gg"
				pronouns="he/him"
				avatarSrc={AVATAR}
				presence="online"
				badge={<TeamBadge />}
				appBadge={<PlayTesterBadge size={16} />}
				status={LONG_STATUS}
				statusEditable
				onStatusClick={() => onStatusClick()}
				surface="background"
				headingLevel={1}
			/>
			<div class="flex flex-col gap-4 px-4 pt-4">
				<EditProfileRow />
				<NowPlayingCard
					source="teal.fm"
					title="Manual Drive 1991"
					artist="DUSQK"
					album="Manual Drive 1991"
					artSrc={ALBUM_ART}
					tone="card"
					href="https://teal.fm"
				/>
				<section class="flex flex-col gap-2">
					<SectionLabel label="Bio" />
					<p class="m-0 text-base text-muted-foreground">{BIO}</p>
				</section>
				<DeveloperModeCard
					copyLabel="Copy DID"
					copyValue="did:plc:loulougg"
					pdslsHref="https://pdsls.dev/at://did:plc:loulougg"
				/>
			</div>
		</div>
	),
	play: async ({ canvasElement }) => {
		onStatusClick.mockClear();
		const canvas = within(canvasElement);
		await expect(canvas.getAllByRole("heading")).toHaveLength(1);
		await expect(canvas.getByRole("heading", { name: "Lou" })).toBeVisible();
		await userEvent.click(
			canvas.getByRole("button", { name: /^Edit status:/ }),
		);
		await expect(onStatusClick).toHaveBeenCalledOnce();
		const bubble = canvasElement.querySelector<HTMLElement>(
			"[data-status-bubble]",
		);
		const row = bubble?.parentElement;
		if (!bubble || !row) throw new Error("status bubble missing");
		await expect(
			row.getBoundingClientRect().right - bubble.getBoundingClientRect().right,
		).toBeLessThanOrEqual(17);
		const link = canvas.getByRole("link", { name: /Manual Drive 1991/ });
		await expect(link).toHaveAccessibleName(/Listening to teal\.fm/);
	},
};

const BlueskyLinkIcon = () => (
	<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
		<path d="M5.2 3.4C7.7 5.3 10.4 9 11.4 11.1c1-2.1 3.7-5.8 6.2-7.7 1.8-1.4 4.8-2.4 4.8.9 0 .7-.4 5.5-.6 6.3-.8 2.8-3.6 3.5-6.1 3.1 4.4.7 5.5 3.2 3.1 5.7-4.6 4.7-6.6-1.2-7.1-2.7l-.3-.6-.3.6c-.5 1.5-2.5 7.4-7.1 2.7-2.4-2.5-1.3-5 3.1-5.7-2.5.4-5.3-.3-6.1-3.1C.6 9.8.2 5 .2 4.3c0-3.3 3-2.3 5-.9z" />
	</svg>
);

const lou = (overrides: Partial<ProfileData> = {}): ProfileData => ({
	displayName: "Lou",
	handle: "lou.gg",
	pronouns: "he/him",
	avatarSrc: AVATAR,
	presence: "online",
	badge: <TeamBadge />,
	appBadge: <PlayTesterBadge size={16} />,
	links: [
		{
			label: "View on Bluesky",
			href: "https://bsky.app/profile/lou.gg",
			icon: <BlueskyLinkIcon />,
		},
	],
	nowPlaying: [
		{
			source: "teal.fm",
			title: "Manual Drive 1991",
			artist: "DUSQK",
			album: "Manual Drive 1991",
			artSrc: ALBUM_ART,
		},
	],
	bio: BIO,
	roles: [
		{
			name: "Role name",
			icon: <ShieldUserIcon style={{ color: "#5cc8ff" }} />,
		},
		{ name: "Bird watcher", color: "#4ade80" },
	],
	actionsLabel: "Moderator actions",
	actions: [
		{
			label: "Kick Lou",
			icon: <UserMinusRoundedIcon />,
			tone: "destructive",
			quick: true,
		},
		{
			label: "Ban Lou",
			icon: <SledgehammerIcon />,
			tone: "destructive",
			quick: true,
		},
	],
	developer: {
		copyValue: "did:plc:loulougg",
		pdslsHref: "https://pdsls.dev/at://did:plc:loulougg",
	},
	...overrides,
});

const sectionLabels = (root: ParentNode) =>
	Array.from(root.querySelectorAll("[data-profile-section]")).map((section) =>
		section.getAttribute("data-profile-section"),
	);

export const ProfileDrawer: Story = {
	render: () => {
		const profile = lou();
		return (
			<Drawer initialOpen>
				<DrawerTrigger as={Button} variant="secondary">
					Open profile
				</DrawerTrigger>
				<DrawerContent
					aria-label="Lou's profile"
					header={<ProfileContentHeader profile={profile} surface="popover" />}
				>
					<ProfileContentBody
						profile={profile}
						surface="popover"
						class="-mt-2"
					/>
				</DrawerContent>
			</Drawer>
		);
	},
	play: async () => {
		const dialog = await screen.findByRole("dialog");
		await waitFor(() =>
			expect(
				within(dialog).getByRole("heading", { name: "Lou" }),
			).toBeVisible(),
		);
		await expect(sectionLabels(dialog)).toEqual(["Bio", "Space roles"]);
	},
};

const desktop = { viewport: { defaultViewport: "responsive" } };

const NOW = new Date("2026-10-08T14:30:00");
const AT = new Date("2026-10-08T14:02:00");

export const PopoverFromAuthor: Story = {
	parameters: desktop,
	render: () => {
		const [open, setOpen] = createSignal(false);
		let anchor: HTMLElement | undefined;
		return (
			<div class="min-h-[720px] w-[720px] bg-background py-6 pl-[360px]">
				<MessageRow
					author={{ name: "Lou", avatarSrc: AVATAR }}
					badge={<TeamBadge />}
					timestamp={AT}
					now={NOW}
					locale="en-GB"
					onAuthorClick={(event) => {
						anchor = event.currentTarget as HTMLElement;
						setOpen(true);
					}}
				>
					I have walked that path for years and never once have I seen one.
				</MessageRow>
				<ProfilePopover
					profile={lou()}
					anchor={() => anchor}
					open={open()}
					onOpenChange={setOpen}
					placement="left-start"
					onAction={(action) => onAuthorAction(action.label)}
				/>
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const author = canvas.getAllByRole("button", { name: /Lou/ })[0];
		if (!author) throw new Error("author trigger missing");
		await userEvent.click(author);
		const popover = await screen.findByRole("dialog", {
			name: "Lou's profile",
		});
		await waitFor(() =>
			expect(
				within(popover).getByRole("heading", { name: "Lou" }),
			).toBeVisible(),
		);
		await expect(sectionLabels(popover)).toEqual(["Bio", "Space roles"]);
		await expect(popover.offsetWidth).toBe(PROFILE_POPOVER_WIDTH);
		const banner = popover.querySelector("[data-banner]");
		if (!banner) throw new Error("banner missing");
		const quick = popover.querySelector<HTMLElement>(
			"[data-profile-quick-actions]",
		);
		if (!quick) throw new Error("quick actions missing");
		const kick = within(quick).getByRole("button", { name: "Kick Lou" });
		const ban = within(quick).getByRole("button", { name: "Ban Lou" });
		await waitFor(() => {
			const area = banner.getBoundingClientRect();
			const midX = area.left + area.width / 2;
			const midY = area.top + area.height / 2;
			for (const button of [kick, ban]) {
				const rect = button.getBoundingClientRect();
				expect(rect.left).toBeGreaterThanOrEqual(midX);
				expect(rect.right).toBeLessThanOrEqual(area.right);
				expect(rect.top).toBeGreaterThanOrEqual(area.top);
				expect(rect.bottom).toBeLessThanOrEqual(midY);
			}
		});
		const actionButtons = within(popover).getAllByRole("button", {
			name: /^(Kick|Ban) Lou$/,
		});
		await expect(actionButtons).toHaveLength(4);
		for (const button of actionButtons) {
			await expect(button.querySelector("svg")).not.toBeNull();
		}
		await userEvent.keyboard("{Escape}");
		await waitFor(() =>
			expect(
				screen.queryByRole("dialog", { name: "Lou's profile" }),
			).toBeNull(),
		);
		await waitFor(() => expect(author).toHaveFocus());

		onAuthorAction.mockClear();
		await userEvent.click(author);
		const reopened = await screen.findByRole("dialog", {
			name: "Lou's profile",
		});
		const reopenedQuick = await waitFor(() => {
			const element = reopened.querySelector<HTMLElement>(
				"[data-profile-quick-actions]",
			);
			if (!element) throw new Error("quick actions missing");
			return element;
		});
		await userEvent.click(
			within(reopenedQuick).getByRole("button", { name: "Kick Lou" }),
		);
		await expect(onAuthorAction).toHaveBeenCalledTimes(1);
		await expect(onAuthorAction).toHaveBeenCalledWith("Kick Lou");
		await waitFor(() =>
			expect(
				screen.queryByRole("dialog", { name: "Lou's profile" }),
			).toBeNull(),
		);
	},
};

const MemberStandIn = () => (
	<span class="flex h-12 w-full items-center gap-2 rounded-control-sm px-2 hover:bg-card">
		<span
			aria-hidden="true"
			class="size-8 shrink-0 rounded-full"
			style={{ background: "#8e51ff" }}
		/>
		<span class="flex min-w-0 flex-col text-left">
			<span class="truncate text-sm font-semibold text-foreground">Lou</span>
			<span class="truncate text-xs text-muted-foreground">
				Building a nest!
			</span>
		</span>
	</span>
);

export const PopoverFromMemberRow: Story = {
	parameters: desktop,
	render: () => (
		<div class="flex min-h-[720px] w-full justify-end bg-background">
			<div class="w-60 border-l border-border bg-card p-2">
				<ProfilePopover
					profile={lou({ status: "Building a nest!", statusEmoji: "🪺" })}
					triggerClass="block w-full rounded-control-sm data-expanded:[&>span]:bg-secondary"
				>
					<MemberStandIn />
				</ProfilePopover>
			</div>
		</div>
	),
	play: async ({ canvasElement }) => {
		const trigger = within(canvasElement).getByRole("button", {
			name: /^Lou/,
		});
		await userEvent.click(trigger);
		const popover = await screen.findByRole("dialog", {
			name: "Lou's profile",
		});
		await waitFor(() =>
			expect(
				within(popover).getByRole("heading", { name: "Lou" }),
			).toBeVisible(),
		);
		const popoverRect = popover.getBoundingClientRect();
		await expect(popoverRect.right).toBeLessThanOrEqual(
			trigger.getBoundingClientRect().left,
		);
		const bubble = popover.querySelector<HTMLElement>("[data-status-bubble]");
		if (!bubble) throw new Error("status bubble missing");
		await expect(bubble.querySelector("[data-status-emoji]")).not.toBeNull();
		const header = bubble.parentElement?.getBoundingClientRect();
		if (!header) throw new Error("status row missing");
		await expect(bubble.getBoundingClientRect().width).toBeLessThan(
			(header.right - bubble.getBoundingClientRect().left) * 0.8,
		);
		await userEvent.keyboard("{Escape}");
		await waitFor(() => expect(trigger).toHaveFocus());
	},
};

export const PopoverLoading: Story = {
	parameters: desktop,
	render: () => (
		<div class="flex min-h-[720px] w-full justify-end bg-background p-4">
			<ProfilePopover loading defaultOpen triggerLabel="Lou" as="button">
				<span class="text-sm text-foreground">Lou</span>
			</ProfilePopover>
		</div>
	),
	play: async () => {
		const popover = await screen.findByRole("dialog", {
			name: "Loading profile",
		});
		await expect(
			popover.querySelector("[data-profile-popover-skeleton]"),
		).not.toBeNull();
	},
};

export const PopoverLongBio: Story = {
	parameters: desktop,
	render: () => (
		<div class="flex min-h-[720px] w-full justify-end bg-background p-4">
			<ProfilePopover
				profile={lou({
					bio: Array.from({ length: 8 }, () => BIO).join(" "),
				})}
				defaultOpen
				triggerLabel="Lou"
				as="button"
			>
				<span class="text-sm text-foreground">Lou</span>
			</ProfilePopover>
		</div>
	),
	play: async () => {
		const popover = await screen.findByRole("dialog", {
			name: "Lou's profile",
		});
		const scroller = popover.firstElementChild as HTMLElement;
		await waitFor(() =>
			expect(popover.getBoundingClientRect().height).toBeLessThanOrEqual(
				window.innerHeight,
			),
		);
		await expect(getComputedStyle(scroller).overflowY).toBe("auto");
	},
};

export const PopoverNoBanner: Story = {
	parameters: desktop,
	render: () => (
		<div class="flex min-h-[720px] w-full justify-end gap-4 bg-background p-4">
			<ProfilePopover
				profile={lou({
					accentColor: "#c4b5fd",
					actions: [],
					developer: undefined,
				})}
				triggerLabel="Lou, avatar tint"
				as="button"
			>
				<span class="text-sm text-foreground">Avatar tint</span>
			</ProfilePopover>
			<ProfilePopover
				profile={lou({
					displayName: "Lis",
					handle: "lis.example",
					bannerColor: "linear-gradient(135deg, #f472b6, #8e51ff)",
					actions: [],
				})}
				triggerLabel="Lis, theme gradient"
				as="button"
			>
				<span class="text-sm text-foreground">Theme gradient</span>
			</ProfilePopover>
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole("button", { name: "Lis, theme gradient" }),
		);
		const popover = await screen.findByRole("dialog", {
			name: "Lis's profile",
		});
		await waitFor(() =>
			expect(popover.querySelector("[data-banner]")).toHaveAttribute(
				"data-fill",
				"color",
			),
		);
	},
};

export const PopoverSkeletonParity: Story = {
	parameters: desktop,
	render: () => (
		<div class="flex items-start gap-4 bg-background p-4">
			<div data-testid="loaded" class="w-90 bg-popover">
				<ProfileContentHeader
					profile={lou({ actions: [] })}
					surface="popover"
				/>
			</div>
			<div data-testid="skeleton" class="w-90 bg-popover">
				<ProfilePopoverSkeleton />
			</div>
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const loaded = canvas.getByTestId("loaded")
			.firstElementChild as HTMLElement;
		const skeleton = canvas
			.getByTestId("skeleton")
			.querySelector<HTMLElement>("[data-profile-popover-skeleton] > div");
		if (!skeleton) throw new Error("skeleton header missing");
		const a = loaded.getBoundingClientRect();
		const b = skeleton.getBoundingClientRect();
		await expect(Math.abs(a.width - b.width)).toBeLessThanOrEqual(1);
		await expect(Math.abs(a.height - b.height)).toBeLessThanOrEqual(1);
	},
};

export const StatusBubbles: Story = {
	render: () => (
		<div class="flex w-[266px] flex-col gap-3">
			<StatusBubble>Building a nest!</StatusBubble>
			<StatusBubble editable onClick={() => onBubbleClick()}>
				{LONG_STATUS}
			</StatusBubble>
		</div>
	),
	play: async ({ canvasElement }) => {
		onBubbleClick.mockClear();
		const canvas = within(canvasElement);
		const button = canvas.getByRole("button", { name: /^Edit status:/ });
		await userEvent.click(button);
		await expect(onBubbleClick).toHaveBeenCalledOnce();
		const text = button.querySelector<HTMLElement>("[data-status-text]");
		if (!text) throw new Error("status text missing");
		await expect(text.scrollHeight).toBeGreaterThan(text.clientHeight);
		await expect(text.clientHeight).toBeLessThanOrEqual(18 * 3);
	},
};

export const NowPlaying: Story = {
	render: () => (
		<div class="flex w-full max-w-sm flex-col gap-4">
			<NowPlayingCard
				source="teal.fm"
				title="Manual Drive 1991"
				artist="DUSQK"
				album="Manual Drive 1991"
				artSrc={ALBUM_ART}
				href="https://teal.fm"
			/>
			<NowPlayingCard
				source="teal.fm"
				title="A track title long enough to need truncating at the edge"
				artist="An artist with a long name"
				tone="secondary"
			/>
		</div>
	),
	play: async ({ canvasElement }) => {
		const link = within(canvasElement).getByRole("link");
		await expect(link).toHaveAccessibleName(
			/Listening to teal\.fm.*Manual Drive 1991.*DUSQK/,
		);
	},
};
