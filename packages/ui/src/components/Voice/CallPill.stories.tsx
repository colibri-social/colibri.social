import { HashtagIcon } from "@solar-icons/solid/bold/hashtag";
import { InboxIcon } from "@solar-icons/solid/bold/inbox";
import { SettingsIcon } from "@solar-icons/solid/bold/settings";
import { UserCircleIcon } from "@solar-icons/solid/bold/user-circle";
import { UsersGroupTwoRoundedIcon } from "@solar-icons/solid/bold/users-group-two-rounded";
import { VolumeLoudIcon } from "@solar-icons/solid/bold/volume-loud";
import { createSignal, For, type JSX } from "solid-js";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { HapticsProvider } from "../../utils/haptics";
import { storyImages } from "../Banner/story-images";
import { ChannelHeader } from "../ChannelHeader/ChannelHeader";
import { Composer } from "../Composer/Composer";
import { MessageRow } from "../Message/MessageRow";
import { TabBar } from "../TabBar/TabBar";
import { CallPill } from "./CallPill";
import type { VoiceParticipant } from "./shared";

const meta = {
	title: "Voice/Call pill",
	parameters: { viewport: { defaultViewport: "iphone" }, layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const NOW = new Date("2026-10-08T14:30:00");
const AT = new Date("2026-10-08T14:12:00");

const haptics = { impact: fn(), selection: fn(), notification: fn() };
const onLeave = fn();
const onOpenCall = fn();

const participants: VoiceParticipant[] = [
	{
		id: "lou",
		name: "Lou",
		avatarSrc: storyImages.violetIcon(),
		speaking: true,
	},
	{ id: "lis", name: "Lis", avatarSrc: storyImages.tealIcon() },
	{ id: "tim", name: "Tim", avatarSrc: storyImages.amberIcon() },
	{ id: "kris", name: "Kris" },
];

type Insets = { top: number; bottom: number; left: number; right: number };

const insetStyle = (insets: Insets): JSX.CSSProperties => ({
	"--safe-area-top": `${insets.top}px`,
	"--safe-area-bottom": `${insets.bottom}px`,
	"--safe-area-left": `${insets.left}px`,
	"--safe-area-right": `${insets.right}px`,
});

const PORTRAIT: Insets = { top: 62, bottom: 34, left: 0, right: 0 };
const LANDSCAPE: Insets = { top: 0, bottom: 21, left: 59, right: 59 };

const Phone = (props: {
	label: string;
	width: number;
	height: number;
	insets: Insets;
	children: JSX.Element;
}) => (
	<figure class="m-0 flex flex-col gap-2">
		<figcaption class="text-sm font-medium text-muted-foreground">
			{props.label}
		</figcaption>
		<div
			data-phone={props.label}
			class="relative overflow-hidden rounded-surface border border-border bg-background text-foreground"
			style={{
				width: `${props.width}px`,
				height: `${props.height}px`,
				transform: "translateZ(0)",
				...insetStyle(props.insets),
			}}
		>
			{props.children}
		</div>
	</figure>
);

const LiveCallPill = (props: {
	avoidTop?: number;
	defaultExpanded?: boolean;
}) => {
	const [muted, setMuted] = createSignal(false);
	const [deafened, setDeafened] = createSignal(false);
	return (
		<CallPill
			contained
			participants={participants}
			channelName="Hangout"
			spaceName="Colibri Social Flock"
			startedAt={Date.now() - 724_000}
			muted={muted()}
			deafened={deafened()}
			defaultExpanded={props.defaultExpanded}
			avoidTop={props.avoidTop}
			onToggleMute={() => setMuted((value) => !value)}
			onToggleDeafen={() => setDeafened((value) => !value)}
			onOpenCall={onOpenCall}
			onLeave={onLeave}
		/>
	);
};

const channelRows = [
	{ name: "general", voice: false },
	{ name: "announcements", voice: false },
	{ name: "Hangout", voice: true },
	{ name: "dev-talk", voice: false },
];

const SpacesScreen = (props: { overlay?: JSX.Element; label?: string }) => (
	<div class="flex h-full flex-col pt-safe-offset-12 px-safe">
		<p class="m-0 px-4 pb-2 text-xl font-bold">Colibri Social Flock</p>
		<ul class="m-0 flex list-none flex-col gap-1 p-2">
			<For each={channelRows}>
				{(row) => (
					<li class="flex h-10 items-center gap-2 rounded-control-sm px-2 text-base font-semibold text-muted-foreground [&_svg]:size-4">
						{row.voice ? <VolumeLoudIcon /> : <HashtagIcon />}
						{row.name}
					</li>
				)}
			</For>
		</ul>
		<TabBar
			class="absolute"
			label={props.label ?? "Main"}
			value="spaces"
			items={[
				{
					value: "spaces",
					label: "Spaces",
					icon: <UsersGroupTwoRoundedIcon />,
				},
				{ value: "inbox", label: "Inbox", icon: <InboxIcon /> },
				{ value: "profile", label: "Profile", icon: <UserCircleIcon /> },
				{ value: "settings", label: "Settings", icon: <SettingsIcon /> },
			]}
		/>
		{props.overlay}
	</div>
);

const ChannelScreen = (props: { overlay?: JSX.Element }) => (
	<div class="flex h-full flex-col">
		<ChannelHeader
			name="general"
			safeTop
			onBack={() => {}}
			onOpenInfo={() => {}}
			onOpenThreads={() => {}}
		/>
		<div class="min-h-0 flex-1 overflow-y-auto py-2">
			<MessageRow
				author={{ name: "Lou", avatarSrc: storyImages.violetIcon() }}
				timestamp={AT}
				now={NOW}
				locale="en-GB"
				platform="mobile"
			>
				Hop into Hangout if you want to pair on the call pill.
			</MessageRow>
		</div>
		<Composer channelName="general" safeBottom />
		{props.overlay}
	</div>
);

const Board = (props: { children: JSX.Element }) => (
	<HapticsProvider haptics={haptics}>
		<div class="flex min-h-dvh flex-col gap-6 bg-popover p-4 text-foreground">
			{props.children}
		</div>
	</HapticsProvider>
);

const phone = (canvasElement: HTMLElement, label: string) =>
	canvasElement.querySelector(`[data-phone="${label}"]`) as HTMLElement;

const pillOf = (frame: HTMLElement) =>
	frame.querySelector("[data-call-pill]") as HTMLElement;

const assertInside = async (inner: DOMRect, frame: DOMRect, insets: Insets) => {
	await expect(inner.left).toBeGreaterThanOrEqual(
		frame.left + insets.left - 0.5,
	);
	await expect(inner.right).toBeLessThanOrEqual(
		frame.right - insets.right + 0.5,
	);
	await expect(inner.top).toBeGreaterThanOrEqual(frame.top + insets.top - 0.5);
	await expect(inner.bottom).toBeLessThanOrEqual(
		frame.bottom - insets.bottom + 0.5,
	);
};

const settle = () =>
	new Promise<void>((resolve) => {
		const pill = document.querySelectorAll("[data-call-pill]");
		Promise.all(
			[...pill].flatMap((element) =>
				element.getAnimations().map((animation) => animation.finished),
			),
		).then(
			() => resolve(),
			() => resolve(),
		);
	});

export const Screens: Story = {
	render: () => (
		<Board>
			<Phone label="Spaces tab" width={402} height={720} insets={PORTRAIT}>
				<SpacesScreen overlay={<LiveCallPill />} />
			</Phone>
			<Phone label="Channel" width={402} height={720} insets={PORTRAIT}>
				<ChannelScreen overlay={<LiveCallPill avoidTop={48} />} />
			</Phone>
			<Phone label="Narrow" width={320} height={640} insets={PORTRAIT}>
				<ChannelScreen
					overlay={<LiveCallPill avoidTop={48} defaultExpanded />}
				/>
			</Phone>
			<Phone label="Landscape" width={874} height={402} insets={LANDSCAPE}>
				<SpacesScreen
					label="Main, landscape"
					overlay={<LiveCallPill defaultExpanded />}
				/>
			</Phone>
		</Board>
	),
	play: async ({ canvasElement }) => {
		onLeave.mockClear();
		const narrow = phone(canvasElement, "Narrow");
		const narrowPill = pillOf(narrow);
		await expect(narrowPill).toHaveAttribute("data-expanded");
		await assertInside(
			narrowPill.getBoundingClientRect(),
			narrow.getBoundingClientRect(),
			PORTRAIT,
		);
		for (const button of within(narrowPill).getAllByRole("button")) {
			await assertInside(
				button.getBoundingClientRect(),
				narrow.getBoundingClientRect(),
				PORTRAIT,
			);
		}

		const landscape = phone(canvasElement, "Landscape");
		const landscapePill = pillOf(landscape);
		await assertInside(
			landscapePill.getBoundingClientRect(),
			landscape.getBoundingClientRect(),
			LANDSCAPE,
		);
		const spaces = phone(canvasElement, "Spaces tab");
		const collapsed = pillOf(spaces);
		await expect(collapsed).not.toHaveAttribute("data-expanded");
		await assertInside(
			collapsed.getBoundingClientRect(),
			spaces.getBoundingClientRect(),
			PORTRAIT,
		);
		const channel = phone(canvasElement, "Channel");
		const channelPill = pillOf(channel);
		const back = within(channel).getByRole("button", { name: "Back" });
		await expect(channelPill.getBoundingClientRect().left).toBeGreaterThan(
			back.getBoundingClientRect().right,
		);
		await userEvent.click(
			within(channel).getByRole("button", {
				name: /Hangout call.*show call controls/,
			}),
		);
		await expect(channelPill).toHaveAttribute("data-expanded");
		await settle();
		const header = channel.querySelector(
			"[data-channel-header]",
		) as HTMLElement;
		await expect(
			channelPill.getBoundingClientRect().top,
		).toBeGreaterThanOrEqual(header.getBoundingClientRect().bottom - 0.5);
		await assertInside(
			channelPill.getBoundingClientRect(),
			channel.getBoundingClientRect(),
			PORTRAIT,
		);
		await userEvent.click(
			within(channel).getByRole("button", { name: "Leave call" }),
		);
		await expect(onLeave).toHaveBeenCalledTimes(1);
		await userEvent.click(
			within(channel).getByRole("button", { name: "Hide call controls" }),
		);
		await expect(channelPill).not.toHaveAttribute("data-expanded");
	},
};

export const ExpandAndCollapse: Story = {
	render: () => (
		<Board>
			<Phone label="Interactive" width={320} height={560} insets={PORTRAIT}>
				<SpacesScreen overlay={<LiveCallPill />} />
			</Phone>
		</Board>
	),
	play: async ({ canvasElement }) => {
		const frame = phone(canvasElement, "Interactive");
		const pill = pillOf(frame);
		const canvas = within(frame);
		await expect(
			canvas.getByRole("button", { name: /Lou is speaking/ }),
		).toBeInTheDocument();
		await userEvent.click(
			canvas.getByRole("button", { name: /show call controls/ }),
		);
		await expect(pill).toHaveAttribute("data-expanded");
		await settle();
		await assertInside(
			pill.getBoundingClientRect(),
			frame.getBoundingClientRect(),
			PORTRAIT,
		);
		const mute = canvas.getByRole("button", { name: "Mute" });
		await userEvent.click(mute);
		await expect(
			canvas.getByRole("button", { name: "Unmute" }),
		).toHaveAttribute("aria-pressed", "true");
		await userEvent.click(
			canvas.getByText("Colibri Social Flock", { selector: "p" }),
		);
		await waitFor(() => expect(pill).not.toHaveAttribute("data-expanded"));

		await userEvent.click(
			canvas.getByRole("button", { name: /show call controls/ }),
		);
		await expect(pill).toHaveAttribute("data-expanded");
		await userEvent.keyboard("{Escape}");
		await waitFor(() => expect(pill).not.toHaveAttribute("data-expanded"));

		await userEvent.click(
			canvas.getByRole("button", { name: /show call controls/ }),
		);
		await settle();
		const box = pill.getBoundingClientRect();
		const x = box.left + box.width / 2;
		const y = box.top + box.height / 2;
		const swipe = (type: string, clientY: number) =>
			pill.dispatchEvent(
				new PointerEvent(type, {
					bubbles: true,
					pointerType: "touch",
					pointerId: 7,
					isPrimary: true,
					clientX: x,
					clientY,
				}),
			);
		swipe("pointerdown", y);
		swipe("pointermove", y - 12);
		swipe("pointermove", y - 40);
		swipe("pointerup", y - 40);
		await waitFor(() => expect(pill).not.toHaveAttribute("data-expanded"));
	},
};
