import { PenIcon } from "@solar-icons/solid/bold/pen";
import { ShieldUserIcon } from "@solar-icons/solid/bold/shield-user";
import { SledgehammerIcon } from "@solar-icons/solid/bold/sledgehammer";
import { UserMinusRoundedIcon } from "@solar-icons/solid/bold/user-minus-rounded";
import { createSignal, For } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import {
	EMULATED_WINDOW_CHROME,
	emulateWindowChrome,
	expectClearOfWindowChrome,
	expectNoLayoutIssues,
} from "../../foundations/layout-test";
import { PlayTesterBadge } from "../../icons/animated/brand";
import { contrastRatio } from "../../utils/name-color";
import { createRipple } from "../../utils/ripple";
import { bouncingDotGif } from "../AnimatedImage/fixtures";
import { Avatar } from "../Avatar/Avatar";
import {
	AppBadge,
	type BadgeDefinition,
	FALLBACK_BADGE_DEFINITIONS,
	SecondaryUserBadge,
	TeamBadge,
} from "../Badge/Badge";
import { Button } from "../Button/Button";
import { DeveloperModeCard } from "../DeveloperMode/DeveloperModeCard";
import { fixturePacks } from "../EmojiPicker/fixtures";
import { SectionLabel } from "../List/List";
import { MessageRow } from "../Message/MessageRow";
import { ActivityOptInPrompt } from "./ActivityOptInPrompt";
import {
	OwnProfilePopoverFixture,
	ownProfileFixture,
} from "./own-profile-fixture";
import { PresenceDrawer as PresenceDrawerComponent } from "./PresenceDrawer";
import { NowPlayingCard, ProfileHeader, StatusBubble } from "./Profile";
import { ProfileContentHeader, type ProfileData } from "./ProfileContent";
import { ProfileDrawer as ProfileDrawerComponent } from "./ProfileDrawer";
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
const onAvatarClick = fn();
const onBubbleClick = fn();
const onAuthorAction = fn();

const meta = {
	title: "Surfaces/Profile",
	parameters: { viewport: { defaultViewport: "iphone" } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const EditProfileRow = () => {
	const ripple = createRipple();
	return (
		<button
			ref={ripple}
			type="button"
			class="ripple flex h-10 w-full cursor-pointer items-center gap-2 rounded-control bg-secondary px-3 text-left text-foreground outline-none hover:bg-secondary-highlight focus-ring-inset"
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
				badge={<TeamBadge size="sm" />}
				appBadge={
					<AppBadge
						name="Play Store tester"
						description="Helped test the Colibri App for the Play Store release"
						icon={<PlayTesterBadge size={16} />}
					/>
				}
				status={LONG_STATUS}
				statusEditable
				onStatusClick={() => onStatusClick()}
				onAvatarClick={() => onAvatarClick()}
				avatarLabel="Change your online status, currently Online"
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
		onAvatarClick.mockClear();
		const canvas = within(canvasElement);
		await expect(canvas.getAllByRole("heading")).toHaveLength(1);
		await expect(canvas.getByRole("heading", { name: "Lou" })).toBeVisible();
		await userEvent.click(
			canvas.getByRole("button", { name: /^Edit status:/ }),
		);
		await expect(onStatusClick).toHaveBeenCalledOnce();
		await userEvent.click(
			canvas.getByRole("button", {
				name: "Change your online status, currently Online",
			}),
		);
		await expect(onAvatarClick).toHaveBeenCalledOnce();
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
	badge: <TeamBadge size="sm" />,
	appBadge: (
		<AppBadge
			name="Play Store tester"
			description="Helped test the Colibri App for the Play Store release"
			icon={<PlayTesterBadge size={16} />}
		/>
	),
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

const ProfileDrawerDemo = (props: { loading?: boolean }) => {
	const [open, setOpen] = createSignal(true);
	return (
		<>
			<Button variant="secondary" onClick={() => setOpen(true)}>
				Open profile
			</Button>
			<ProfileDrawerComponent
				open={open()}
				onOpenChange={setOpen}
				profile={lou()}
				loading={props.loading}
			/>
		</>
	);
};

export const ProfileDrawer: Story = {
	render: () => <ProfileDrawerDemo />,
	play: async () => {
		const dialog = await screen.findByRole("dialog");
		await waitFor(() =>
			expect(
				within(dialog).getByRole("heading", { name: "Lou" }),
			).toBeVisible(),
		);
		await expect(sectionLabels(dialog)).toEqual(["Bio", "Space roles"]);
		await new Promise((resolve) => setTimeout(resolve, 400));
		await expectNoLayoutIssues(dialog);
		const nameBox = dialog
			.querySelector("[data-profile-name]")
			?.getBoundingClientRect();
		const handleBox = dialog
			.querySelector("[data-profile-meta] span")
			?.getBoundingClientRect();
		if (!nameBox || !handleBox) throw new Error("identity missing");
		await expect(handleBox.top - nameBox.bottom).toBeCloseTo(7, 1);
		const focused = document.activeElement as HTMLElement | null;
		await expect(
			!!focused && dialog.contains(focused) && focused.tagName === "BUTTON",
		).toBe(false);
	},
};

const onPresenceChange = fn();

const PresenceDrawerDemo = () => {
	const [open, setOpen] = createSignal(true);
	const [value, setValue] = createSignal<"online" | "idle" | "dnd" | "offline">(
		"online",
	);
	return (
		<div class="min-h-dvh bg-background p-4">
			<Button variant="secondary" onClick={() => setOpen(true)}>
				{`Presence: ${value()}`}
			</Button>
			<PresenceDrawerComponent
				open={open()}
				onOpenChange={setOpen}
				value={value()}
				onChange={(next) => {
					onPresenceChange(next);
					setValue(next);
				}}
			/>
		</div>
	);
};

export const PresenceDrawer: Story = {
	render: () => <PresenceDrawerDemo />,
	play: async ({ canvasElement }) => {
		onPresenceChange.mockClear();
		const dialog = await screen.findByRole("dialog", { name: "Online status" });
		const radios = await within(dialog).findAllByRole("radio");
		await expect(radios.map((radio) => radio.textContent?.trim())).toEqual([
			"Online",
			"Away",
			"Do not disturb",
			"Offline",
		]);
		await expect(
			within(dialog).getByRole("radio", { name: "Online" }),
		).toHaveAttribute("aria-checked", "true");
		await new Promise((resolve) => setTimeout(resolve, 400));
		await expectNoLayoutIssues(dialog);
		await userEvent.click(
			within(dialog).getByRole("radio", { name: "Do not disturb" }),
		);
		await expect(onPresenceChange).toHaveBeenCalledWith("dnd");
		await waitFor(() =>
			expect(
				screen.queryByRole("dialog", { name: "Online status" }),
			).toBeNull(),
		);
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Presence: dnd" }),
		);
		const reopened = await screen.findByRole("dialog", {
			name: "Online status",
		});
		await expect(
			within(reopened).getByRole("radio", { name: "Do not disturb" }),
		).toHaveAttribute("aria-checked", "true");
		await userEvent.click(
			within(reopened).getByRole("radio", { name: "Do not disturb" }),
		);
		await expect(onPresenceChange).toHaveBeenCalledTimes(1);
	},
};

export const ProfileDrawerLoading: Story = {
	render: () => <ProfileDrawerDemo loading />,
	play: async () => {
		const dialog = await screen.findByRole("dialog", {
			name: "Loading profile",
		});
		await expect(
			dialog.querySelector("[data-profile-popover-skeleton]"),
		).not.toBeNull();
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
					badge={<TeamBadge size="sm" />}
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
		await waitFor(() => expect(popover).toHaveFocus());
		const nameBox = popover
			.querySelector("[data-profile-name]")
			?.getBoundingClientRect();
		const handleBox = popover
			.querySelector("[data-profile-meta] span")
			?.getBoundingClientRect();
		if (!nameBox || !handleBox) throw new Error("identity missing");
		await expect(handleBox.top - nameBox.bottom).toBeCloseTo(3.5, 0);
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

const toHex = (rgb: string) => {
	const parts = rgb.match(/\d+/g)?.slice(0, 3).map(Number) ?? [];
	return `#${parts.map((part) => part.toString(16).padStart(2, "0")).join("")}`;
};

export const PopoverDarkNameColor: Story = {
	parameters: desktop,
	render: () => (
		<div class="flex min-h-[720px] w-full justify-end bg-background p-4">
			<ProfilePopover
				profile={lou({ accentColor: "#0b0b10", actions: [] })}
				triggerLabel="Lou, dark name color"
				as="button"
			>
				<span class="text-sm text-foreground">Dark name color</span>
			</ProfilePopover>
		</div>
	),
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getByRole("button", {
				name: "Lou, dark name color",
			}),
		);
		const popover = await screen.findByRole("dialog", {
			name: "Lou's profile",
		});
		const name = popover.querySelector<HTMLElement>("[data-profile-name]");
		await expect(name).not.toBeNull();
		const color = toHex(getComputedStyle(name as HTMLElement).color);
		await expect(color).not.toBe("#0b0b10");
		await expect(contrastRatio(color, "#171717")).toBeGreaterThanOrEqual(4.5);
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

export const EmojiOnlyStatus: Story = {
	render: () => (
		<div class="flex w-[266px] flex-col gap-3">
			<StatusBubble emoji="🍜" />
			<StatusBubble customEmoji={fixturePacks[0].emojis[2]} />
			<StatusBubble customEmoji={fixturePacks[0].emojis[0]}>
				Compiling kernels
			</StatusBubble>
		</div>
	),
	play: async ({ canvasElement }) => {
		const bubbles = canvasElement.querySelectorAll<HTMLElement>(
			"[data-status-bubble]",
		);
		await expect(bubbles).toHaveLength(3);
		await expect(
			bubbles[0]?.querySelector('[data-emoji="unicode"]'),
		).toHaveTextContent("🍜");
		await expect(
			bubbles[1]?.querySelector('[data-emoji="custom"]'),
		).toHaveAttribute("alt", ":colibri:");
		await expect(
			bubbles[2]?.querySelector("[data-status-text]"),
		).toHaveTextContent("Compiling kernels");
		await expectNoLayoutIssues(canvasElement);
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

export const StatusWhileOffline: Story = {
	render: () => (
		<div class="flex w-[360px] flex-col gap-6 bg-background pb-4 text-foreground">
			<article data-testid="offline-hidden" aria-label="Ola, offline">
				<ProfileHeader
					displayName="Ola"
					handle="ola.bsky.social"
					avatarColor="#525252"
					presence="offline"
					statusEmoji="🛶"
					status="Out on the water"
				/>
			</article>
			<article
				data-testid="offline-shown"
				aria-label="Pim, offline with status shown"
			>
				<ProfileHeader
					displayName="Pim"
					handle="pim.bsky.social"
					avatarColor="#525252"
					presence="offline"
					statusEmoji="🌴"
					status="Back on Monday"
					statusShowWhileOffline
				/>
			</article>
			<article data-testid="own-offline" aria-label="Your profile, offline">
				<ProfileHeader
					displayName="Lou"
					handle="lou.gg"
					avatarSrc={AVATAR}
					presence="offline"
					statusEmoji="🐦"
					status="Building a nest"
					statusEditable
				/>
			</article>
		</div>
	),
	play: async ({ canvasElement }) => {
		const bubble = (id: string) =>
			within(canvasElement)
				.getByTestId(id)
				.querySelector("[data-status-bubble]");
		await expect(bubble("offline-hidden")).toBeNull();
		await expect(bubble("offline-shown")).not.toBeNull();
		await expect(bubble("own-offline")).not.toBeNull();
	},
};

export const PopoverOwnProfileUnderWindowChrome: Story = {
	name: "Popover own profile under window chrome",
	parameters: desktop,
	render: () => (
		<div class="fixed bottom-1 left-1 w-[312px]">
			<OwnProfilePopoverFixture />
		</div>
	),
	play: async ({ canvasElement }) => {
		const restore = emulateWindowChrome();
		try {
			const trigger = within(canvasElement).getByRole("button", {
				name: /^Lou/,
			});
			await userEvent.click(trigger);
			const popover = await screen.findByRole("dialog", {
				name: "Your profile",
			});
			await waitFor(() =>
				expect(popover.getBoundingClientRect().left).toBe(16),
			);
			await expect(popover.getBoundingClientRect().top).toBeGreaterThanOrEqual(
				EMULATED_WINDOW_CHROME + 16,
			);
			await expectClearOfWindowChrome(document.body);
		} finally {
			restore();
		}
	},
};

export const PopoverOwnProfile: Story = {
	name: "Popover own profile",
	parameters: desktop,
	render: () => (
		<div class="flex min-h-[760px] w-[720px] flex-col justify-end bg-background p-4">
			<div class="w-[312px]">
				<OwnProfilePopoverFixture
					profile={ownProfileFixture({
						actions: [
							{ label: "Kick Lou", tone: "destructive", quick: true },
							{ label: "Ban Lou", tone: "destructive", quick: true },
						],
					})}
				/>
			</div>
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const trigger = canvas.getByRole("button", { name: /^Lou/ });
		await userEvent.click(trigger);
		const popover = await screen.findByRole("dialog", { name: "Your profile" });
		await expect(trigger).toHaveAttribute("aria-expanded", "true");
		await expect(popover.offsetWidth).toBe(PROFILE_POPOVER_WIDTH);
		await expect(popover.getBoundingClientRect().bottom).toBeLessThanOrEqual(
			trigger.getBoundingClientRect().top,
		);
		await expect(popover.querySelector("[data-banner]")).not.toBeNull();
		await waitFor(() =>
			expect(
				within(popover).getByRole("heading", { name: "Lou" }),
			).toBeVisible(),
		);
		await expect(sectionLabels(popover)).toEqual(["Bio", "Space roles"]);
		await expect(
			popover.querySelector("[data-profile-quick-actions]"),
		).toBeNull();
		await expect(
			within(popover).queryByRole("button", { name: /^(Kick|Ban) Lou$/ }),
		).toBeNull();
		const body = popover.querySelector("[data-profile-body]");
		const footer = popover.querySelector("[data-profile-footer]");
		await expect(body?.lastElementChild).toBe(footer);
		const card = footer?.querySelector<HTMLElement>(".bg-secondary");
		if (!card) throw new Error("action card missing");
		await expect(getComputedStyle(card).backgroundColor).not.toBe(
			getComputedStyle(popover).backgroundColor,
		);
		const rows = Array.from(card.children) as HTMLElement[];
		await expect(rows.map((row) => row.textContent?.trim())).toEqual([
			"Online",
			"Edit profile",
			"Edit status",
		]);
		await expect(getComputedStyle(rows[1] as HTMLElement).borderTopWidth).toBe(
			"1px",
		);
		const bio = popover.querySelector('[data-profile-section="Bio"] p');
		if (!(bio instanceof HTMLElement)) throw new Error("bio missing");
		const probe = document.createElement("span");
		probe.style.color = "var(--foreground)";
		popover.append(probe);
		await expect(getComputedStyle(bio).color).toBe(
			getComputedStyle(probe).color,
		);
		probe.remove();
		const statusRow = within(popover).getByRole("button", {
			name: /^Online status/,
		});
		await userEvent.hover(statusRow);
		const menu = await screen.findByRole("menu", { name: /^Online status/ });
		await expect(menu.getBoundingClientRect().left).toBeGreaterThanOrEqual(
			popover.getBoundingClientRect().right,
		);
		await userEvent.click(
			within(menu).getByRole("menuitemradio", { name: /Do not disturb/ }),
		);
		await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
		await expect(statusRow).toHaveAccessibleName(
			"Online status: Do not disturb",
		);
		await expectNoLayoutIssues(card);
		statusRow.focus();
		await userEvent.keyboard("{ArrowRight}");
		const keyed = await screen.findByRole("menu", { name: /^Online status/ });
		await waitFor(() =>
			expect(document.activeElement).toBe(
				within(keyed).getAllByRole("menuitemradio")[0],
			),
		);
		await userEvent.keyboard("{ArrowLeft}");
		await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
		await waitFor(() => expect(document.activeElement).toBe(statusRow));
		await userEvent.keyboard("{Escape}");
		await waitFor(() =>
			expect(screen.queryByRole("dialog", { name: "Your profile" })).toBeNull(),
		);
		await waitFor(() => expect(document.activeElement).toBe(trigger));
	},
};

export const PopoverSelfHidesModeration: Story = {
	name: "Popover self hides moderation",
	parameters: desktop,
	render: () => {
		const [open, setOpen] = createSignal(false);
		let anchor: HTMLElement | undefined;
		return (
			<div class="min-h-[720px] w-[720px] bg-background py-6 pl-[360px]">
				<button
					type="button"
					onClick={(event) => {
						anchor = event.currentTarget;
						setOpen(true);
					}}
				>
					Open my profile
				</button>
				<ProfilePopover
					profile={lou({ self: true })}
					anchor={() => anchor}
					open={open()}
					onOpenChange={setOpen}
					placement="left-start"
				/>
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getByRole("button", { name: "Open my profile" }),
		);
		const popover = await screen.findByRole("dialog", {
			name: "Lou's profile",
		});
		await expect(
			popover.querySelector("[data-profile-quick-actions]"),
		).toBeNull();
		await expect(
			within(popover).queryByRole("button", { name: /^(Kick|Ban) Lou$/ }),
		).toBeNull();
		await expect(sectionLabels(popover)).toEqual(["Bio", "Space roles"]);
	},
};

const StaysPutDemo = () => {
	const [open, setOpen] = createSignal(false);
	const [pushed, setPushed] = createSignal(false);
	const [anchor, setAnchor] = createSignal<HTMLElement>();
	const [rect, setRect] = createSignal<DOMRect>();
	return (
		<div class="flex min-h-[720px] w-full justify-end bg-background">
			<div class="w-60 border-l border-border bg-card p-2">
				<Button variant="secondary" onClick={() => setPushed(true)}>
					Push rows down
				</Button>
				{pushed() ? <div data-pushed="" class="h-32" /> : null}
				<button
					type="button"
					data-anchor-row=""
					class="mt-40 block w-full rounded-control-sm p-2 text-left"
					onClick={(event) => {
						setAnchor(event.currentTarget);
						setRect(event.currentTarget.getBoundingClientRect());
						setOpen(true);
					}}
				>
					Lou
				</button>
				<ProfilePopover
					open={open()}
					onOpenChange={setOpen}
					anchor={anchor}
					anchorRect={rect}
					profile={{
						displayName: "Lou",
						handle: "lou.gg",
						avatarSeed: "did:plc:lou",
						presence: "online",
					}}
				/>
			</div>
		</div>
	);
};

export const PopoverStaysPut: Story = {
	name: "Popover stays where it opened",
	parameters: desktop,
	render: () => <StaysPutDemo />,
	play: async ({ canvasElement }) => {
		const row = canvasElement.querySelector("[data-anchor-row]") as HTMLElement;
		await userEvent.click(row);
		const popover = await screen.findByRole("dialog", {
			name: "Lou's profile",
		});
		await new Promise((resolve) => setTimeout(resolve, 400));
		const before = popover.getBoundingClientRect();
		const rowBefore = row.getBoundingClientRect();
		const push = within(canvasElement).getByRole("button", {
			name: "Push rows down",
		});
		push.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		await waitFor(() =>
			expect(row.getBoundingClientRect().top).toBeGreaterThan(
				rowBefore.top + 100,
			),
		);
		await new Promise((resolve) => setTimeout(resolve, 200));
		const after = popover.getBoundingClientRect();
		await expect(before.top).toBeGreaterThan(100);
		await expect(after.top).toBeCloseTo(before.top, 0);
		await expect(after.left).toBeCloseTo(before.left, 0);
		await expect(screen.getByRole("dialog", { name: "Lou's profile" })).toBe(
			popover,
		);
	},
};

const SCROLL_ROWS = Array.from(
	{ length: 40 },
	(_, index) => `Member ${index + 1}`,
);

const ScrollingListDemo = () => {
	const [open, setOpen] = createSignal(false);
	const [anchor, setAnchor] = createSignal<HTMLElement>();
	const [rect, setRect] = createSignal<DOMRect>();
	return (
		<div class="flex min-h-[720px] w-full justify-end bg-background">
			<div
				data-scroll-list=""
				class="h-[480px] w-60 overflow-y-auto border-l border-border bg-card p-2"
			>
				{SCROLL_ROWS.map((name) => (
					<button
						type="button"
						data-scroll-row={name}
						class="block h-11 w-full rounded-control-sm px-2 text-left"
						onClick={(event) => {
							setAnchor(event.currentTarget);
							setRect(event.currentTarget.getBoundingClientRect());
							setOpen(true);
						}}
					>
						{name}
					</button>
				))}
			</div>
			<ProfilePopover
				open={open()}
				onOpenChange={setOpen}
				anchor={anchor}
				anchorRect={rect}
				placement="left-start"
				profile={{
					displayName: "Lou",
					handle: "lou.gg",
					avatarSeed: "did:plc:lou",
					presence: "online",
				}}
			/>
		</div>
	);
};

export const PopoverFollowsScroll: Story = {
	name: "Popover follows a scrolling list",
	parameters: desktop,
	render: () => <ScrollingListDemo />,
	play: async ({ canvasElement }) => {
		const list = canvasElement.querySelector(
			"[data-scroll-list]",
		) as HTMLElement;
		const row = canvasElement.querySelector(
			'[data-scroll-row="Member 6"]',
		) as HTMLElement;
		await userEvent.click(row);
		const popover = await screen.findByRole("dialog", {
			name: "Lou's profile",
		});
		await new Promise((resolve) => setTimeout(resolve, 400));
		const wheel = new WheelEvent("wheel", {
			deltaY: 40,
			bubbles: true,
			cancelable: true,
		});
		await expect(list.dispatchEvent(wheel)).toBe(true);
		await expect(document.body.style.overflow).not.toBe("hidden");
		const before = popover.getBoundingClientRect();
		const rowBefore = row.getBoundingClientRect();
		list.scrollTop = 60;
		await waitFor(() =>
			expect(row.getBoundingClientRect().top).toBeCloseTo(
				rowBefore.top - 60,
				0,
			),
		);
		await waitFor(() =>
			expect(popover.getBoundingClientRect().top).toBeCloseTo(
				before.top - 60,
				0,
			),
		);
		await expect(screen.getByRole("dialog", { name: "Lou's profile" })).toBe(
			popover,
		);
		list.scrollTop = 1000;
		await waitFor(
			() =>
				expect(
					screen.queryByRole("dialog", { name: "Lou's profile" }),
				).toBeNull(),
			{ timeout: 3000 },
		);
	},
};

const TOGGLE_MEMBERS = ["Lou", "Mia"];

const AnchorToggleDemo = () => {
	const [member, setMember] = createSignal<string>();
	const [anchor, setAnchor] = createSignal<HTMLElement>();
	return (
		<div class="flex min-h-[720px] w-full justify-end bg-background">
			<div class="flex w-60 flex-col gap-1 border-l border-border bg-card p-2">
				{TOGGLE_MEMBERS.map((name) => (
					<button
						type="button"
						data-toggle-row={name}
						class="block w-full rounded-control-sm p-2 text-left"
						onClick={(event) => {
							setAnchor(event.currentTarget);
							setMember(name);
						}}
					>
						{name}
					</button>
				))}
				<ProfilePopover
					open={!!member()}
					onOpenChange={(open) => {
						if (!open) setMember(undefined);
					}}
					anchor={anchor}
					profile={{
						displayName: member() ?? "",
						handle: "member.colibri.social",
						avatarSeed: "did:plc:member",
						presence: "online",
					}}
				/>
			</div>
		</div>
	);
};

export const PopoverAnchorToggles: Story = {
	name: "Popover toggles from its anchor",
	parameters: desktop,
	render: () => <AnchorToggleDemo />,
	play: async ({ canvasElement, step }) => {
		const row = (name: string) =>
			canvasElement.querySelector<HTMLElement>(
				`[data-toggle-row="${name}"]`,
			) as HTMLElement;
		const openPopover = () =>
			document.querySelector<HTMLElement>(
				"[data-profile-popover][data-expanded]",
			);
		const settle = () => new Promise((resolve) => setTimeout(resolve, 300));

		await step("The same row closes the open popover", async () => {
			await userEvent.click(row("Lou"));
			await screen.findByRole("dialog", { name: "Lou's profile" });
			await userEvent.click(row("Lou"));
			await waitFor(() => expect(openPopover()).toBeNull());
			await settle();
			await expect(openPopover()).toBeNull();
		});

		await step("The row opens it again after closing", async () => {
			await userEvent.click(row("Lou"));
			await waitFor(() =>
				expect(openPopover()).toHaveAccessibleName("Lou's profile"),
			);
		});

		await step("A different row switches the popover", async () => {
			await userEvent.click(row("Mia"));
			await waitFor(() =>
				expect(openPopover()).toHaveAccessibleName("Mia's profile"),
			);
			await settle();
			await expect(openPopover()).toHaveAccessibleName("Mia's profile");
		});

		await step("The new row closes it", async () => {
			await userEvent.click(row("Mia"));
			await waitFor(() => expect(openPopover()).toBeNull());
			await settle();
			await expect(openPopover()).toBeNull();
		});
	},
};

const avatarState = (root: ParentNode | null | undefined) =>
	root
		?.querySelector<HTMLElement>("[data-avatar-image] img")
		?.getAttribute("data-animated-image");

const withReducedMotion = async (run: () => Promise<void>) => {
	const root = document.documentElement;
	const previous = root.dataset.reducedMotion;
	root.dataset.reducedMotion = "true";
	try {
		await run();
	} finally {
		root.dataset.reducedMotion = previous ?? "false";
	}
};

export const PopoverPlaysAvatar: Story = {
	name: "Popover plays an animated avatar",
	parameters: desktop,
	render: () => (
		<div class="flex min-h-[720px] w-full items-start justify-end gap-4 bg-background p-4">
			<span data-testid="outside">
				<Avatar name="Lou" size="xl" src={bouncingDotGif} />
			</span>
			<ProfilePopover
				profile={lou({ avatarSrc: bouncingDotGif })}
				triggerLabel="Lou"
				as="button"
			>
				<span class="text-sm text-foreground">Lou</span>
			</ProfilePopover>
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const outside = canvasElement.querySelector('[data-testid="outside"]');
		const popoverAvatar = () =>
			document.querySelector("[data-profile-popover] [data-profile-avatar]");
		await waitFor(() => expect(avatarState(outside)).toBe("hidden"), {
			timeout: 3000,
		});

		await userEvent.click(canvas.getByRole("button", { name: "Lou" }));
		await screen.findByRole("dialog", { name: "Lou's profile" });
		await waitFor(
			() => {
				const image = popoverAvatar()?.querySelector("img");
				expect(image?.complete && image.naturalWidth > 0).toBe(true);
			},
			{ timeout: 3000 },
		);
		await new Promise((resolve) => setTimeout(resolve, 100));
		await expect(avatarState(popoverAvatar())).toBe("playing");
		await expect(avatarState(outside)).toBe("hidden");

		await userEvent.keyboard("{Escape}");
		await waitFor(() => expect(popoverAvatar()).toBeNull());

		await withReducedMotion(async () => {
			await userEvent.click(canvas.getByRole("button", { name: "Lou" }));
			await screen.findByRole("dialog", { name: "Lou's profile" });
			await waitFor(() => expect(avatarState(popoverAvatar())).toBe("hidden"), {
				timeout: 3000,
			});
			await userEvent.keyboard("{Escape}");
			await waitFor(() => expect(popoverAvatar()).toBeNull());
		});
	},
};

const onActivityOpen = fn();

export const NowPlayingKinds: Story = {
	render: () => (
		<div class="flex w-full max-w-sm flex-col gap-4">
			<NowPlayingCard
				kind="listening"
				label="Listening to rocksky.app"
				source="rocksky.app"
				title="Manual Drive 1991"
				artist="DUSQK"
				href="https://rocksky.app"
				onOpen={(event) => {
					event.preventDefault();
					onActivityOpen();
				}}
			/>
			<NowPlayingCard
				kind="playing"
				label="Playing"
				source="steam"
				title="Celeste"
				artist="Chapter 7"
				tone="secondary"
			/>
			<NowPlayingCard
				kind="streaming"
				label="Streaming on twitch.tv"
				source="twitch.tv"
				title="Painting birds live"
			/>
		</div>
	),
	play: async ({ canvasElement }) => {
		onActivityOpen.mockClear();
		const canvas = within(canvasElement);
		const cards = Array.from(
			canvasElement.querySelectorAll<HTMLElement>("[data-now-playing]"),
		);
		await expect(cards.map((card) => card.dataset.nowPlaying)).toEqual([
			"listening",
			"playing",
			"streaming",
		]);
		await expect(cards[1]).toHaveTextContent(/^Playing/);
		await expect(cards[2]).toHaveTextContent(/^Streaming on twitch\.tv/);
		await expect(
			cards[1]?.querySelector('[data-activity-icon="playing"]'),
		).not.toBeNull();
		await expect(cards[1]?.tagName).toBe("DIV");
		const link = canvas.getByRole("link");
		await expect(link).toHaveAccessibleName(
			/Listening to rocksky\.app.*Manual Drive 1991.*DUSQK/,
		);
		await userEvent.click(link);
		await expect(onActivityOpen).toHaveBeenCalledTimes(1);
	},
};

const onEnableActivity = fn();
const onDismissActivity = fn();

export const ActivityPrompt: Story = {
	render: () => {
		const [dismissed, setDismissed] = createSignal(false);
		return (
			<div class="flex flex-col gap-6">
				<div class="w-[360px] bg-background p-4">
					<ActivityOptInPrompt
						provider="teal.fm"
						tone="card"
						dismissed={dismissed()}
						onEnable={onEnableActivity}
						onDismiss={() => {
							onDismissActivity();
							setDismissed(true);
						}}
					/>
				</div>
				<div class="w-[320px] bg-popover p-4" data-testid="busy">
					<ActivityOptInPrompt provider="atradio.fm" tone="secondary" busy />
				</div>
			</div>
		);
	},
	play: async ({ canvasElement, step }) => {
		onEnableActivity.mockClear();
		onDismissActivity.mockClear();
		const canvas = within(canvasElement);
		const prompt = canvasElement.querySelector<HTMLElement>(
			'[data-activity-prompt="teal.fm"]',
		) as HTMLElement;

		await step("Shows the detected service", async () => {
			await expect(prompt).toHaveTextContent(
				"Let others see what you're listening to on teal.fm.",
			);
			await expect(
				within(prompt).getByRole("img", { name: "teal.fm" }),
			).toBeVisible();
			const buttons = within(prompt).getAllByRole("button");
			const [enable, dismiss] = buttons.map((button) =>
				button.getBoundingClientRect(),
			);
			await expect(enable?.top).toBe(dismiss?.top);
			await expect(enable?.width).toBeCloseTo(dismiss?.width ?? 0, 0);
			await expect(prompt.scrollWidth).toBeLessThanOrEqual(prompt.clientWidth);
		});

		await step("A busy prompt blocks both actions", async () => {
			const busy = within(canvas.getByTestId("busy"));
			for (const button of busy.getAllByRole("button")) {
				await expect(button).toBeDisabled();
			}
		});

		await step("Turning on calls back", async () => {
			await userEvent.click(
				within(prompt).getByRole("button", { name: "Turn on" }),
			);
			await expect(onEnableActivity).toHaveBeenCalledTimes(1);
		});

		await step("Hiding leaves a pointer to the settings", async () => {
			await userEvent.click(
				within(prompt).getByRole("button", { name: "Hide" }),
			);
			await expect(onDismissActivity).toHaveBeenCalledTimes(1);
			await waitFor(() =>
				expect(
					canvasElement.querySelector('[data-activity-prompt="dismissed"]'),
				).toHaveTextContent("You can turn this on any time in Chat settings."),
			);
			await expect(
				canvasElement.querySelector('[data-activity-prompt="teal.fm"]'),
			).toBeNull();
		});
	},
};

const fallbackBadge = (identifier: string) =>
	FALLBACK_BADGE_DEFINITIONS.find(
		(entry) => entry.identifier === identifier,
	) as BadgeDefinition;

const EARLY_BIRD: BadgeDefinition = {
	identifier: "early-bird",
	name: "EARLY BIRD",
	description: "Joined Colibri in its first month",
};

const BadgedHeader = (props: { secondary: BadgeDefinition[] }) => (
	<div class="w-[360px] bg-popover pb-4 text-foreground">
		<ProfileHeader
			displayName="Lou"
			handle="lou.gg"
			avatarSrc={AVATAR}
			presence="online"
			badge={<TeamBadge size="sm" />}
			appBadge={
				<span class="flex shrink-0 items-center gap-1">
					<For each={props.secondary}>
						{(definition) => <SecondaryUserBadge definition={definition} />}
					</For>
				</span>
			}
		/>
	</div>
);

export const IconBadges: Story = {
	render: () => (
		<BadgedHeader
			secondary={[
				fallbackBadge("play-store-tester"),
				fallbackBadge("sponsor-twenty-five"),
				fallbackBadge("backer-five"),
			]}
		/>
	),
	play: async ({ canvasElement }) => {
		const meta = canvasElement.querySelector<HTMLElement>(
			"[data-profile-meta]",
		) as HTMLElement;
		await expect(
			canvasElement.querySelectorAll("[data-user-badge]").length,
		).toBe(1);
		await expect(
			canvasElement
				.querySelector('[data-user-badge="team"]')
				?.closest("[data-profile-meta]"),
		).toBeNull();
		const icons = Array.from(
			meta.querySelectorAll<HTMLElement>("[data-app-badge]"),
		);
		await expect(icons).toHaveLength(3);
		await expect(
			within(meta).getByRole("button", { name: "$5 BACKER" }),
		).toBeVisible();
		const money = meta.querySelectorAll<SVGElement>(
			'[data-badge-icon="hand-money"]',
		);
		await expect(money).toHaveLength(2);
		await expect(getComputedStyle(money[1] as Element).color).toBe(
			"rgb(34, 211, 238)",
		);
		const tester = meta.querySelector('[data-badge-icon="play-tester"]');
		await expect(tester).not.toBeNull();
		await expect(tester?.querySelectorAll("linearGradient stop")).toHaveLength(
			4,
		);
		await expect(meta.scrollWidth).toBeLessThanOrEqual(meta.clientWidth);
	},
};

export const UnmappedSecondaryBadge: Story = {
	render: () => (
		<BadgedHeader secondary={[fallbackBadge("supporter-ten"), EARLY_BIRD]} />
	),
	play: async ({ canvasElement }) => {
		const meta = canvasElement.querySelector<HTMLElement>(
			"[data-profile-meta]",
		) as HTMLElement;
		await expect(meta.querySelectorAll("[data-app-badge]")).toHaveLength(2);
		await expect(meta.querySelector("[data-user-badge]")).toBeNull();
		await expect(
			meta.querySelector('[data-badge-icon="medal"]'),
		).not.toBeNull();
		await expect(
			within(meta).getByRole("button", { name: "EARLY BIRD" }),
		).toBeVisible();
		await expect(meta.scrollWidth).toBeLessThanOrEqual(meta.clientWidth);
	},
};

const MULTI_LANGUAGE_PRONOUNS = "she/her, sie/ihr, elle";
const OVERLONG_PRONOUNS =
	"she/her, sie/ihr, elle, ella, zij/haar, hon/henne, lei/la, hen/hen, ona/jej, ela/dela";

const expectMetaFlowsCleanly = async (meta: HTMLElement) => {
	const clip = meta.getBoundingClientRect();
	const inset = Number.parseFloat(getComputedStyle(meta).paddingLeft);
	const contentLeft = clip.left + inset;
	const contentRight = clip.right - inset;
	await expect(meta.scrollWidth).toBeLessThanOrEqual(meta.clientWidth);
	const items = Array.from(
		meta.querySelectorAll<HTMLElement>("[data-profile-meta-item]"),
	);
	let previousTop: number | undefined;
	for (const item of items) {
		const top = Math.round(item.getBoundingClientRect().top);
		const lineStart = previousTop === undefined || top > previousTop;
		previousTop = top;
		const dot = item
			.querySelector("[data-profile-meta-dot] > *")
			?.getBoundingClientRect();
		const content = (
			item.lastElementChild as HTMLElement
		).getBoundingClientRect();
		if (!dot) throw new Error("separator missing");
		if (lineStart) {
			await expect(dot.right).toBeLessThanOrEqual(clip.left);
			await expect(Math.round(content.left)).toBe(Math.round(contentLeft));
		} else {
			await expect(dot.left).toBeGreaterThanOrEqual(contentLeft);
		}
		await expect(content.right).toBeLessThanOrEqual(contentRight + 0.5);
	}
	const pronouns = meta.querySelector<HTMLElement>("[data-profile-pronouns]");
	if (pronouns) {
		await expect(pronouns.scrollWidth).toBeLessThanOrEqual(
			pronouns.clientWidth,
		);
	}
	return items;
};

export const PopoverLongPronouns: Story = {
	parameters: desktop,
	render: () => (
		<div class="flex min-h-[720px] w-full justify-end bg-background p-4">
			<ProfilePopover
				profile={lou({
					handle: "lou.colibri.social",
					pronouns: MULTI_LANGUAGE_PRONOUNS,
					bannerColor: "linear-gradient(135deg, #a579ff, #4dd4c6)",
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
		const meta = await waitFor(() => {
			const found = popover.querySelector<HTMLElement>("[data-profile-meta]");
			if (!found) throw new Error("meta missing");
			return found;
		});
		await waitFor(() =>
			expect(within(meta).getByText(MULTI_LANGUAGE_PRONOUNS)).toBeVisible(),
		);
		await expect(within(meta).getByText("@lou.colibri.social")).toBeVisible();
		const items = await expectMetaFlowsCleanly(meta);
		await expect(items).toHaveLength(4);
		await expectNoLayoutIssues(popover);
	},
};

export const HeaderLongPronouns: Story = {
	render: () => (
		<div class="-m-4 flex min-h-dvh flex-col gap-6 bg-background pb-16">
			<For
				each={[
					{ handle: "lou.gg", pronouns: "he/him" },
					{ handle: "lou.gg", pronouns: MULTI_LANGUAGE_PRONOUNS },
					{
						handle: "lou-has-a-long-handle.colibri.social",
						pronouns: MULTI_LANGUAGE_PRONOUNS,
					},
					{ handle: "lou.gg", pronouns: OVERLONG_PRONOUNS },
				]}
			>
				{(variant) => (
					<article>
						<ProfileHeader
							displayName="Lou"
							handle={variant.handle}
							pronouns={variant.pronouns}
							avatarSrc={AVATAR}
							bannerColor="linear-gradient(135deg, #a579ff, #4dd4c6)"
							presence="online"
							links={[
								{
									label: "View on Bluesky",
									href: "https://bsky.app/profile/lou.gg",
									icon: <BlueskyLinkIcon />,
								},
							]}
							appBadge={
								<AppBadge
									name="Play Store tester"
									description="Helped test the Colibri App for the Play Store release"
									icon={<PlayTesterBadge size={16} />}
								/>
							}
							surface="background"
						/>
					</article>
				)}
			</For>
		</div>
	),
	play: async ({ canvasElement }) => {
		const metas = Array.from(
			canvasElement.querySelectorAll<HTMLElement>("[data-profile-meta]"),
		);
		await expect(metas).toHaveLength(4);
		const lines = [];
		for (const meta of metas) {
			const items = await expectMetaFlowsCleanly(meta);
			lines.push(
				new Set(
					items.map((item) => Math.round(item.getBoundingClientRect().top)),
				).size,
			);
		}
		await expect(lines[0]).toBe(1);
		await expect(lines[3]).toBeGreaterThan(1);
		const overlong = metas[3]?.querySelector<HTMLElement>(
			"[data-profile-pronouns]",
		);
		await expect(overlong?.getBoundingClientRect().height).toBeGreaterThan(18);
		await expectNoLayoutIssues(canvasElement);
	},
};
