import { createSignal, For, type JSX } from "solid-js";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import { MessageRow } from "../Message/MessageRow";
import { SpaceInviteCard } from "./SpaceInviteCard";
import {
	inviteSpaceFixture,
	inviteUrlFixture,
	LONG_SPACE_DESCRIPTION,
	LONG_SPACE_NAME,
} from "./space-invite-card-fixtures";
import {
	SPACE_INVITE_CARD_COPY,
	type SpaceInviteCardSpace,
	type SpaceInviteCardState,
} from "./space-invite-card-model";

const meta = {
	title: "Messaging/Invite card",
	parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const mobile = { viewport: { defaultViewport: "iphone" } };
const desktop = { viewport: { defaultViewport: "responsive" } };
const NOW = new Date("2026-10-18T14:30:00");
const AT = new Date("2026-10-18T14:02:00");

const onJoin = fn();
const onRequestJoin = fn();
const onOpenSpace = fn();
const onRetry = fn();

const resetSpies = () => {
	onJoin.mockClear();
	onRequestJoin.mockClear();
	onOpenSpace.mockClear();
	onRetry.mockClear();
};

const Screen = (props: { children: JSX.Element; desktop?: boolean }) => (
	<div
		class={
			props.desktop
				? "min-h-dvh max-w-[960px] bg-background py-4 text-foreground"
				: "min-h-dvh bg-background py-2 text-foreground"
		}
	>
		{props.children}
	</div>
);

const Message = (props: {
	name?: string;
	text: string;
	attachments: JSX.Element;
}) => (
	<MessageRow
		author={{ name: props.name ?? "Lou" }}
		timestamp={AT}
		now={NOW}
		locale="en-GB"
		attachments={props.attachments}
	>
		{props.text}
	</MessageRow>
);

const LiveInvite = (props: {
	space?: SpaceInviteCardSpace;
	delay?: number;
}) => {
	const [space, setSpace] = createSignal(props.space ?? inviteSpaceFixture());
	const [busy, setBusy] = createSignal(false);
	const settle = (viewer: SpaceInviteCardSpace["viewer"]) => {
		setBusy(true);
		setTimeout(() => {
			setBusy(false);
			setSpace({ ...space(), viewer });
		}, props.delay ?? 600);
	};
	return (
		<SpaceInviteCard
			url={inviteUrlFixture("flock")}
			state="ready"
			space={space()}
			busy={busy()}
			onJoin={(id) => {
				onJoin(id);
				settle("member");
			}}
			onRequestJoin={(id) => {
				onRequestJoin(id);
				settle("pending");
			}}
			onOpenSpace={onOpenSpace}
		/>
	);
};

const PIXEL_GARDEN = () =>
	inviteSpaceFixture({
		id: "did:plc:pixel",
		name: "Pixel Garden",
		bannerSrc: undefined,
		description: "Pixel art, palettes, and weekly prompts.",
		memberCount: 38,
		onlineCount: undefined,
		joinMode: "approval",
	});

const Conversation = (props: { desktop?: boolean }) => (
	<Screen desktop={props.desktop}>
		<Message
			text={`Come hang out with us! ${inviteUrlFixture("flock")}`}
			attachments={<LiveInvite />}
		/>
		<Message
			name="Lis"
			text={`Mine needs approval, ${inviteUrlFixture("pixel")}`}
			attachments={<LiveInvite space={PIXEL_GARDEN()} />}
		/>
	</Screen>
);

const expectConversationLaidOut = async (canvasElement: HTMLElement) => {
	const cards =
		canvasElement.querySelectorAll<HTMLElement>("[data-invite-card]");
	await expect(cards).toHaveLength(2);
	for (const card of Array.from(cards)) {
		await expectNoLayoutIssues(card);
		await expect(card.getBoundingClientRect().right).toBeLessThanOrEqual(
			document.documentElement.clientWidth,
		);
	}
	const approval = cards[1] as HTMLElement;
	const note = approval.querySelector<HTMLElement>("[data-join-note]");
	if (!note) throw new Error("Missing approval note");
	const button = within(approval).getByRole("button", {
		name: "Request to join",
	});
	const noteBox = note.getBoundingClientRect();
	const buttonBox = button.getBoundingClientRect();
	await expect(noteBox.top).toBeGreaterThanOrEqual(buttonBox.bottom);
	const textBox = (() => {
		const range = document.createRange();
		range.selectNodeContents(note);
		return range.getBoundingClientRect();
	})();
	await expect(
		Math.abs(
			textBox.left + textBox.width / 2 - (buttonBox.left + buttonBox.width / 2),
		),
	).toBeLessThanOrEqual(1);
};

export const InMessages: Story = {
	name: "In messages",
	parameters: desktop,
	render: () => <Conversation desktop />,
	play: async ({ canvasElement }) => {
		await expectConversationLaidOut(canvasElement);
	},
};

export const InMessagesMobile: Story = {
	name: "In messages on mobile",
	parameters: mobile,
	render: () => <Conversation />,
	play: async ({ canvasElement }) => {
		await expectConversationLaidOut(canvasElement);
	},
};

type StateCase = {
	label: string;
	state: SpaceInviteCardState;
	space?: SpaceInviteCardSpace;
};

const STATE_CASES: StateCase[] = [
	{ label: "Can join", state: "ready", space: inviteSpaceFixture() },
	{
		label: "Join requires a request",
		state: "ready",
		space: inviteSpaceFixture({ joinMode: "approval" }),
	},
	{
		label: "Already a member",
		state: "ready",
		space: inviteSpaceFixture({ viewer: "member" }),
	},
	{
		label: "Request pending",
		state: "ready",
		space: inviteSpaceFixture({ joinMode: "approval", viewer: "pending" }),
	},
	{
		label: "No banner, no icon",
		state: "ready",
		space: inviteSpaceFixture({
			name: "Backyard Birders",
			iconSrc: undefined,
			bannerSrc: undefined,
			memberCount: 1,
			onlineCount: 0,
		}),
	},
	{
		label: "Long name and description",
		state: "ready",
		space: inviteSpaceFixture({
			name: LONG_SPACE_NAME,
			description: LONG_SPACE_DESCRIPTION,
			memberCount: 1_204_331,
			onlineCount: 48_210,
		}),
	},
	{ label: "Invalid", state: "invalid" },
	{ label: "Expired", state: "expired" },
	{ label: "Used up", state: "used-up" },
	{ label: "Banned", state: "banned" },
	{ label: "Loading", state: "loading" },
	{ label: "Couldn't load", state: "failed" },
];

const StatesGallery = () => (
	<Screen desktop>
		<div class="flex flex-col gap-1 px-4">
			<For each={STATE_CASES}>
				{(entry) => (
					<section
						data-state-case={entry.label}
						class="flex flex-col gap-2 py-3"
					>
						<h2 class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
							{entry.label}
						</h2>
						<SpaceInviteCard
							url={inviteUrlFixture("flock")}
							state={entry.state}
							space={entry.space}
							onJoin={onJoin}
							onRequestJoin={onRequestJoin}
							onOpenSpace={onOpenSpace}
							onRetry={onRetry}
						/>
					</section>
				)}
			</For>
		</div>
	</Screen>
);

const caseSection = (canvasElement: HTMLElement, label: string) => {
	const section = canvasElement.querySelector<HTMLElement>(
		`[data-state-case="${label}"]`,
	);
	if (!section) throw new Error(`Missing state case ${label}`);
	return section;
};

const expectStates = async (canvasElement: HTMLElement) => {
	resetSpies();
	for (const entry of STATE_CASES) {
		const section = caseSection(canvasElement, entry.label);
		const card = section.querySelector<HTMLElement>(
			"[data-invite-card], [data-invite-card-skeleton]",
		);
		if (!card) throw new Error(`Missing card for ${entry.label}`);
		await expectNoLayoutIssues(card);
	}

	const join = within(caseSection(canvasElement, "Can join")).getByRole(
		"button",
		{ name: "Join this Space" },
	);
	await userEvent.click(join);
	await expect(onJoin).toHaveBeenCalledWith("did:plc:flock");

	await userEvent.click(
		within(caseSection(canvasElement, "Join requires a request")).getByRole(
			"button",
			{ name: "Request to join" },
		),
	);
	await expect(onRequestJoin).toHaveBeenCalledOnce();

	await userEvent.click(
		within(caseSection(canvasElement, "Already a member")).getByRole("button", {
			name: "Open Space",
		}),
	);
	await expect(onOpenSpace).toHaveBeenCalledOnce();

	await expect(
		within(caseSection(canvasElement, "Request pending")).getByRole("button", {
			name: "Request pending",
		}),
	).toBeDisabled();

	for (const problem of ["invalid", "expired", "used-up", "banned"] as const) {
		const label =
			problem === "used-up"
				? "Used up"
				: problem[0].toUpperCase() + problem.slice(1);
		const section = caseSection(canvasElement, label);
		await expect(
			within(section).getByRole("article", {
				name: SPACE_INVITE_CARD_COPY[problem].title,
			}),
		).toBeVisible();
		await expect(within(section).queryByRole("button")).toBeNull();
	}

	await expect(
		within(caseSection(canvasElement, "Loading")).getByRole("status", {
			name: SPACE_INVITE_CARD_COPY.loading,
		}),
	).toBeVisible();

	await userEvent.click(
		within(caseSection(canvasElement, "Couldn't load")).getByRole("button", {
			name: SPACE_INVITE_CARD_COPY.retry,
		}),
	);
	await expect(onRetry).toHaveBeenCalledOnce();

	const long = caseSection(canvasElement, "Long name and description");
	const name = within(long).getByRole("heading", { name: LONG_SPACE_NAME });
	await expect(name.scrollWidth).toBeGreaterThan(name.clientWidth);
	await expect(getComputedStyle(name).textOverflow).toBe("ellipsis");
	const description = within(long).getByText(LONG_SPACE_DESCRIPTION);
	await expect(description.scrollHeight).toBeGreaterThan(
		description.clientHeight,
	);
	await expect(within(long).getByText("1,204,331 members")).toBeVisible();
	await expect(within(long).getByText("48,210 online")).toBeVisible();
};

export const States: Story = {
	name: "States",
	parameters: desktop,
	render: () => <StatesGallery />,
	play: async ({ canvasElement }) => expectStates(canvasElement),
};

const JoinFlow = () => (
	<Screen desktop>
		<div class="flex flex-col gap-3 px-4">
			<LiveInvite />
			<LiveInvite
				space={inviteSpaceFixture({
					id: "did:plc:pixel",
					name: "Pixel Garden",
					joinMode: "approval",
				})}
			/>
		</div>
	</Screen>
);

export const JoinPending: Story = {
	name: "Join shows pending, then opens",
	parameters: desktop,
	render: () => <JoinFlow />,
	play: async ({ canvasElement }) => {
		resetSpies();
		const [openCard, approvalCard] = Array.from(
			canvasElement.querySelectorAll<HTMLElement>("[data-invite-card]"),
		);

		const join = within(openCard).getByRole("button", {
			name: "Join this Space",
		});
		await userEvent.click(join);
		await waitFor(() => expect(join).toHaveAttribute("aria-busy", "true"));
		await expect(join).toBeDisabled();
		const open = await within(openCard).findByRole(
			"button",
			{ name: "Open Space" },
			{ timeout: 3000 },
		);
		await waitFor(() => expect(open).toHaveFocus());
		await userEvent.click(open);
		await expect(onOpenSpace).toHaveBeenLastCalledWith("did:plc:flock");

		const request = within(approvalCard).getByRole("button", {
			name: "Request to join",
		});
		await userEvent.click(request);
		await waitFor(() => expect(request).toHaveAttribute("aria-busy", "true"));
		await waitFor(
			() =>
				expect(
					within(approvalCard).getByRole("button", {
						name: "Request pending",
					}),
				).toBeDisabled(),
			{ timeout: 3000 },
		);
		await expectNoLayoutIssues(openCard);
		await expectNoLayoutIssues(approvalCard);
		await expect(onJoin).toHaveBeenCalledOnce();
		await expect(onRequestJoin).toHaveBeenCalledOnce();
	},
};
