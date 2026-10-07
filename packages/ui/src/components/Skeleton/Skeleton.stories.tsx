import { SettingsIcon } from "@solar-icons/solid/bold/settings";
import { createSignal, For, type JSX } from "solid-js";
import { expect, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { Avatar } from "../Avatar/Avatar";
import { Banner } from "../Banner/Banner";
import { InboxGroupCard } from "../Inbox/InboxGroupCard";
import { CheckboxRow, ListGroup, NavRow, ToggleRow } from "../List/List";
import { MessagePreview } from "../Message/MessagePreview";
import {
	NowPlayingCard,
	ProfileHeader,
	StatusBubble,
} from "../Profile/Profile";
import { BridgeCard, EmojiRow, InviteCard } from "../Settings/Settings";
import { SpaceCard } from "../Space/SpaceCard";
import { SpaceIcon } from "../Space/SpaceIcon";
import { SpaceProfileHeader } from "../Space/SpaceProfileHeader";
import { Switch } from "../Switch/Switch";
import {
	AvatarSkeleton,
	Loadable,
	Skeleton,
	SkeletonCircle,
	SkeletonGroup,
	SkeletonText,
} from "./Skeleton";
import {
	BannerSkeleton,
	BridgeCardSkeleton,
	CheckboxRowSkeleton,
	ChipSkeleton,
	EmojiRowSkeleton,
	InboxGroupCardSkeleton,
	InviteCardSkeleton,
	NavRowSkeleton,
	NowPlayingCardSkeleton,
	ProfileHeaderSkeleton,
	SpaceCardSkeleton,
	SpaceIconSkeleton,
	SpaceProfileHeaderSkeleton,
	StatusBubbleSkeleton,
	ToggleRowSkeleton,
} from "./Skeletons";

const PREVIEW_TIME = new Date(2026, 9, 7, 9, 41);

const meta = {
	title: "Foundations/Skeleton",
	parameters: { viewport: { defaultViewport: "iphone" }, layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const DESCRIPTION =
	"A cozy corner for people who build things on the AT Protocol. Share projects, ask questions, and hang out in voice on Fridays, plus a weekly show and tell.";

const emoji = `data:image/svg+xml,${encodeURIComponent(
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#ffd857"/></svg>`,
)}`;

const Section = (props: { title: string; children: JSX.Element }) => (
	<section class="flex flex-col gap-2">
		<h2 class="text-sm font-medium text-muted-foreground">{props.title}</h2>
		{props.children}
	</section>
);

const Swap = (props: {
	title: string;
	skeleton: JSX.Element;
	children: JSX.Element;
}) => {
	const [loaded, setLoaded] = createSignal(false);
	return (
		<Section title={props.title}>
			<Switch
				checked={loaded()}
				onChange={setLoaded}
				label="Loaded"
				class="self-start"
			/>
			<Loadable loading={!loaded()} skeleton={props.skeleton}>
				{props.children}
			</Loadable>
		</Section>
	);
};

export const Primitives: Story = {
	render: () => (
		<div class="flex min-h-dvh flex-col gap-6 bg-background p-4 text-foreground">
			<Section title="Blocks and text">
				<SkeletonGroup class="flex flex-col gap-3 rounded-surface border border-border bg-card p-3">
					<Skeleton class="h-10 w-full rounded-control" />
					<SkeletonText size="2xl" width="50%" />
					<SkeletonText size="base" lines={3} />
					<SkeletonText size="xs" lines={2} />
				</SkeletonGroup>
			</Section>
			<Section title="On a Secondary card">
				<div class="flex flex-col gap-3 rounded-control-lg border border-border bg-secondary p-3">
					<SkeletonText size="lg" width="40%" />
					<SkeletonText size="sm" lines={2} />
				</div>
			</Section>
			<Section title="Avatars, icons and chips">
				<div class="flex flex-wrap items-center gap-3">
					<For each={["xs", "sm", "md", "lg", "xl"] as const}>
						{(size) => <AvatarSkeleton size={size} />}
					</For>
					<AvatarSkeleton size="lg" shape="square" />
					<SkeletonCircle size={32} />
					<SpaceIconSkeleton />
					<SpaceIconSkeleton size={64} />
					<ChipSkeleton />
				</div>
			</Section>
			<Section title="Banners">
				<BannerSkeleton ratio="user" class="rounded-surface" />
				<BannerSkeleton ratio="space" class="rounded-surface" />
			</Section>
		</div>
	),
};

export const Swaps: Story = {
	render: () => (
		<div class="flex min-h-dvh flex-col gap-8 bg-background p-4 text-foreground">
			<Swap title="Space card" skeleton={<SpaceCardSkeleton />}>
				<SpaceCard
					name="Colibri Social Flock"
					memberCount={180}
					description={DESCRIPTION}
					onClick={() => {}}
				/>
			</Swap>
			<Swap title="Inbox card" skeleton={<InboxGroupCardSkeleton />}>
				<InboxGroupCard name="Awesome Space" summary="2 mentions">
					<MessagePreview author="Username" timestamp={PREVIEW_TIME}>
						Text content for the message!
					</MessagePreview>
					<MessagePreview author="Lou" timestamp={PREVIEW_TIME}>
						Very long text content for the message. Previews never show more
						than three rows, so this one gets clamped once it runs past the
						third line of text in the card.
					</MessagePreview>
				</InboxGroupCard>
			</Swap>
			<Swap title="Profile header" skeleton={<ProfileHeaderSkeleton status />}>
				<ProfileHeader
					displayName="Lou"
					handle="lou.gg"
					pronouns="he/him"
					presence="online"
					status="Building a nest!"
				/>
			</Swap>
			<Swap title="Status bubble" skeleton={<StatusBubbleSkeleton lines={1} />}>
				<StatusBubble>Building a nest!</StatusBubble>
			</Swap>
			<Swap title="Now playing" skeleton={<NowPlayingCardSkeleton />}>
				<NowPlayingCard
					source="teal.fm"
					title="Manual Drive 1991"
					artist="DUSQK"
					album="Manual Drive 1991"
				/>
			</Swap>
			<div class="-mx-4 flex flex-col gap-8 bg-popover p-4">
				<Swap
					title="Space drawer header"
					skeleton={<SpaceProfileHeaderSkeleton />}
				>
					<SpaceProfileHeader
						name="Colibri Social Flock"
						memberCount={20}
						ownerHandle="lou.gg"
						description={DESCRIPTION}
						actions={<span class="block h-9 rounded-control bg-primary" />}
					/>
				</Swap>
				<Swap title="Invite card" skeleton={<InviteCardSkeleton />}>
					<InviteCard
						code="kjAnf91jad92Q"
						copyValue="https://colibri.social/invite/kjAnf91jad92Q"
						expires="Never"
						creator={{ handle: "timtinkers.online" }}
						uses="69"
					/>
				</Swap>
				<Swap title="Bridge card" skeleton={<BridgeCardSkeleton />}>
					<BridgeCard
						name="Matrix"
						verified
						service="did:web:bridge.example.social"
						bridgedWith="Lou's room"
					/>
				</Swap>
				<Swap
					title="Rows"
					skeleton={
						<ListGroup>
							<NavRowSkeleton value />
							<ToggleRowSkeleton />
							<CheckboxRowSkeleton />
							<EmojiRowSkeleton />
						</ListGroup>
					}
				>
					<ListGroup>
						<NavRow icon={<SettingsIcon />} label="Appearance" value="Dark" />
						<ToggleRow
							title="Make channel private"
							description="Only selected roles can see it"
						/>
						<CheckboxRow
							label="Lou"
							leading={<Avatar size="md" name="Lou" />}
						/>
						<EmojiRow
							name="tux"
							src={emoji}
							uploader={{ handle: "timtinkers.online" }}
						/>
					</ListGroup>
				</Swap>
			</div>
		</div>
	),
};

export const DiscoveryFeedLoading: Story = {
	render: () => (
		<SkeletonGroup
			label="Loading Spaces"
			class="flex min-h-dvh flex-col gap-4 bg-background p-4 text-foreground"
		>
			<h1 class="text-2xl font-extrabold">Discovery feed</h1>
			<SpaceCardSkeleton />
			<SpaceCardSkeleton descriptionLines={2} />
			<SpaceCardSkeleton />
		</SkeletonGroup>
	),
};

export const ProfileTabLoading: Story = {
	render: () => (
		<SkeletonGroup
			label="Loading profile"
			class="flex min-h-dvh flex-col gap-4 bg-background pb-4 text-foreground"
		>
			<ProfileHeaderSkeleton status />
			<div class="flex flex-col gap-4 px-4">
				<Skeleton class="h-10 w-full rounded-control" />
				<NowPlayingCardSkeleton />
				<div class="flex flex-col gap-2">
					<SkeletonText size="sm" width={28} />
					<SkeletonText size="base" lines={3} />
				</div>
			</div>
		</SkeletonGroup>
	),
};

export const InviteLinksLoading: Story = {
	render: () => (
		<SkeletonGroup
			label="Loading invite links"
			class="flex min-h-dvh flex-col gap-4 bg-popover p-4 text-foreground"
		>
			<h1 class="text-xl font-bold">Invite links</h1>
			<InviteCardSkeleton />
			<InviteCardSkeleton />
		</SkeletonGroup>
	),
};

const LoadableHarness = () => {
	const [loading, setLoading] = createSignal(true);
	return (
		<div class="flex min-h-dvh flex-col gap-4 bg-background p-4 text-foreground">
			<button type="button" onClick={() => setLoading(false)}>
				Finish loading
			</button>
			<Loadable
				loading={loading()}
				skeleton={<SpaceCardSkeleton />}
				label="Loading Space"
			>
				<SpaceCard
					name="Colibri Social Flock"
					memberCount={180}
					description={DESCRIPTION}
				/>
			</Loadable>
		</div>
	);
};

export const LoadableHandover: Story = {
	render: () => <LoadableHarness />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const root = canvasElement.querySelector<HTMLElement>("[data-loadable]");
		await expect(root).toHaveAttribute("aria-busy", "true");
		await expect(root).toHaveAttribute("data-phase", "waiting");
		const skeleton = () =>
			canvasElement.querySelector<HTMLElement>("[data-loadable-skeleton]");
		await expect(skeleton()?.style.opacity).toBe("0");
		await waitFor(() => expect(root).toHaveAttribute("data-phase", "skeleton"));
		await expect(skeleton()?.style.opacity).toBe("1");
		await userEvent.click(
			canvas.getByRole("button", { name: "Finish loading" }),
		);
		await expect(root).not.toHaveAttribute("aria-busy");
		await expect(
			canvas.getByText("Colibri Social Flock", { selector: "span" }),
		).toBeInTheDocument();
		await waitFor(() => expect(skeleton()).toBeNull());
	},
};

const FastHarness = () => {
	const [loading, setLoading] = createSignal(true);
	setTimeout(() => setLoading(false), 40);
	return (
		<div class="bg-background p-4 text-foreground">
			<Loadable loading={loading()} skeleton={<NavRowSkeleton />}>
				<NavRow label="Appearance" />
			</Loadable>
		</div>
	);
};

export const FastLoadNeverFlashes: Story = {
	render: () => <FastHarness />,
	play: async ({ canvasElement }) => {
		const root = canvasElement.querySelector<HTMLElement>("[data-loadable]");
		await waitFor(() => expect(root).toHaveAttribute("data-phase", "content"));
		await expect(
			canvasElement.querySelector("[data-loadable-skeleton]"),
		).toBeNull();
		await expect(
			canvasElement.querySelector("[data-loadable-content]"),
		).not.toHaveAttribute("data-entering");
	},
};

const Pair = (props: { real: JSX.Element; skeleton: JSX.Element }) => (
	<div class="flex flex-col gap-4">
		<div data-pair="real">{props.real}</div>
		<div data-pair="skeleton">{props.skeleton}</div>
	</div>
);

const expectSameBox = async (root: HTMLElement, pair: number) => {
	const group = root.querySelectorAll<HTMLElement>("[data-pair-group]")[pair];
	const box = (kind: string) =>
		group
			?.querySelector(`[data-pair=${kind}]`)
			?.firstElementChild?.getBoundingClientRect();
	const real = box("real");
	const skeleton = box("skeleton");
	await expect(real && skeleton).toBeTruthy();
	if (!real || !skeleton) return;
	await expect({
		pair,
		width: Math.round(skeleton.width),
		height: Math.round(skeleton.height),
	}).toEqual({
		pair,
		width: Math.round(real.width),
		height: Math.round(real.height),
	});
};

export const SizeParity: Story = {
	render: () => (
		<div class="flex flex-col gap-8 bg-popover p-4 text-foreground">
			<div data-pair-group="">
				<Pair
					real={
						<SpaceCard
							name="Colibri Social Flock"
							memberCount={180}
							description={DESCRIPTION}
						/>
					}
					skeleton={<SpaceCardSkeleton />}
				/>
			</div>
			<div data-pair-group="">
				<Pair
					real={
						<InviteCard
							code="kjAnf91jad92Q"
							copyValue="https://colibri.social/invite/kjAnf91jad92Q"
							expires="Never"
							creator={{ handle: "timtinkers.online" }}
							uses="69"
						/>
					}
					skeleton={<InviteCardSkeleton />}
				/>
			</div>
			<div data-pair-group="">
				<Pair
					real={
						<NavRow icon={<SettingsIcon />} label="Appearance" value="Dark" />
					}
					skeleton={<NavRowSkeleton value />}
				/>
			</div>
			<div data-pair-group="">
				<Pair
					real={
						<ProfileHeader
							displayName="Lou"
							handle="lou.gg"
							pronouns="he/him"
							presence="online"
							status="Building a nest!"
							surface="popover"
						/>
					}
					skeleton={<ProfileHeaderSkeleton status surface="popover" />}
				/>
			</div>
			<div data-pair-group="">
				<Pair
					real={
						<BridgeCard
							name="Matrix"
							verified
							service="did:web:bridge.example.social"
							bridgedWith="Lou's room"
						/>
					}
					skeleton={<BridgeCardSkeleton />}
				/>
			</div>
			<div data-pair-group="">
				<Pair
					real={
						<NowPlayingCard
							source="teal.fm"
							title="Manual Drive 1991"
							artist="DUSQK"
							album="Manual Drive 1991"
						/>
					}
					skeleton={<NowPlayingCardSkeleton />}
				/>
			</div>
			<div data-pair-group="">
				<Pair
					real={
						<ToggleRow
							title="Make channel private"
							description="Only selected roles can see it"
						/>
					}
					skeleton={<ToggleRowSkeleton />}
				/>
			</div>
			<div data-pair-group="">
				<Pair
					real={
						<CheckboxRow
							label="Lou"
							leading={<Avatar size="md" name="Lou" />}
						/>
					}
					skeleton={<CheckboxRowSkeleton />}
				/>
			</div>
			<div data-pair-group="">
				<Pair
					real={
						<EmojiRow
							name="tux"
							src={emoji}
							uploader={{ handle: "timtinkers.online" }}
						/>
					}
					skeleton={<EmojiRowSkeleton />}
				/>
			</div>
			<div data-pair-group="">
				<Pair
					real={
						<SpaceProfileHeader
							name="Colibri Social Flock"
							memberCount={20}
							ownerHandle="lou.gg"
							description="Builders hang out here."
							actions={<span class="block h-9 rounded-control bg-primary" />}
						/>
					}
					skeleton={<SpaceProfileHeaderSkeleton descriptionLines={1} />}
				/>
			</div>
			<div data-pair-group="">
				<Pair
					real={
						<InboxGroupCard name="Awesome Space" summary="2 mentions">
							<MessagePreview author="Username" timestamp={PREVIEW_TIME}>
								Short mention
							</MessagePreview>
							<MessagePreview author="Lou" timestamp={PREVIEW_TIME}>
								Another one
							</MessagePreview>
						</InboxGroupCard>
					}
					skeleton={<InboxGroupCardSkeleton lines={[1, 1]} />}
				/>
			</div>
			<div data-pair-group="">
				<Pair
					real={<SpaceIcon name="Colibri" />}
					skeleton={<SpaceIconSkeleton />}
				/>
			</div>
			<div data-pair-group="">
				<Pair
					real={<Banner ratio="user" />}
					skeleton={<BannerSkeleton ratio="user" />}
				/>
			</div>
		</div>
	),
	play: async ({ canvasElement }) => {
		const groups = canvasElement.querySelectorAll("[data-pair-group]").length;
		for (let index = 0; index < groups; index += 1) {
			await expectSameBox(canvasElement, index);
		}
	},
};
