import { createSignal, For, type JSX } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import { MessageRow } from "../Message/MessageRow";
import {
	EmojiPackCard,
	type EmojiPackCardPack,
	EmojiPackCardSkeleton,
	EmojiPackCardUnavailable,
} from "./EmojiPackCard";
import { bigPack, longPack, packUrl, smallPack } from "./story-fixtures";

const meta = {
	title: "Messaging/Emoji pack card",
	parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const mobile = { viewport: { defaultViewport: "iphone" } };
const NOW = new Date("2026-10-18T14:30:00");
const AT = new Date("2026-10-18T14:02:00");

const desktop = { viewport: { defaultViewport: "responsive" } };

const followSpy = fn();

const Message = (props: {
	name?: string;
	text?: string;
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

const LiveCard = (props: {
	pack?: EmojiPackCardPack;
	platform?: "mobile" | "desktop";
	own?: boolean;
	fail?: boolean;
	class?: string;
}) => {
	const [followed, setFollowed] = createSignal(false);
	return (
		<EmojiPackCard
			pack={props.pack ?? bigPack}
			url={packUrl}
			platform={props.platform ?? "desktop"}
			own={props.own}
			followed={followed()}
			class={props.class}
			onFollowChange={async (next) => {
				followSpy(next);
				await new Promise((resolve) => setTimeout(resolve, 120));
				if (props.fail) throw new Error("offline");
				setFollowed(next);
			}}
		/>
	);
};

const Conversation = (props: { platform: "mobile" | "desktop" }) => (
	<div
		class={
			props.platform === "desktop"
				? "min-h-dvh max-w-[960px] bg-background py-4 text-foreground"
				: "min-h-dvh bg-background py-2 text-foreground"
		}
	>
		<Message
			text={`Made a pack for the server ${packUrl}`}
			attachments={<LiveCard platform={props.platform} />}
		/>
		<Message
			name="Lis"
			text="Mine is the cursed one"
			attachments={<LiveCard pack={longPack} platform={props.platform} />}
		/>
		<Message
			name="Tim"
			text="Here's mine"
			attachments={<LiveCard pack={smallPack} platform={props.platform} />}
		/>
	</div>
);

const expectConversation = async (canvasElement: HTMLElement) => {
	const cards = canvasElement.querySelectorAll<HTMLElement>(
		"[data-emoji-pack-card]",
	);
	await expect(cards.length).toBe(3);
	await waitFor(() =>
		expect(
			canvasElement.querySelectorAll("[data-emoji-more]").length,
		).toBeGreaterThan(0),
	);
	for (const card of cards) {
		await expectNoLayoutIssues(card);
		await expect(card.getBoundingClientRect().right).toBeLessThanOrEqual(
			document.documentElement.clientWidth,
		);
	}
};

export const InMessages: Story = {
	name: "In messages",
	parameters: desktop,
	render: () => <Conversation platform="desktop" />,
	play: ({ canvasElement }) => expectConversation(canvasElement),
};

export const InMessagesMobile: Story = {
	name: "In messages on mobile",
	parameters: mobile,
	render: () => <Conversation platform="mobile" />,
	play: ({ canvasElement }) => expectConversation(canvasElement),
};

const WIDTHS = [416, 280];

const StateCases = () => (
	<div class="flex min-h-dvh flex-col gap-4 bg-background p-4 text-foreground">
		<For each={WIDTHS}>
			{(width) => (
				<div data-width={width} style={{ width: `${width}px` }}>
					<LiveCard />
				</div>
			)}
		</For>
		<div style={{ width: "416px" }} data-case="own">
			<LiveCard pack={smallPack} own />
		</div>
		<div style={{ width: "416px" }} data-case="fail">
			<LiveCard pack={longPack} fail />
		</div>
	</div>
);

const expectStripFits = async (container: HTMLElement) => {
	const strip = container.querySelector<HTMLElement>("[data-emoji-strip]");
	if (!strip) throw new Error("missing strip");
	await waitFor(() =>
		expect(Number(strip.dataset.columns ?? 0)).toBeGreaterThan(0),
	);
	const columns = Number(strip.dataset.columns);
	const tiles = strip.querySelectorAll("[data-emoji-tile]");
	const more = strip.querySelector<HTMLElement>("[data-emoji-more]");
	if (!more) throw new Error("missing +n tile");
	const rows = new Set(
		[...tiles, more].map((tile) =>
			Math.round(tile.getBoundingClientRect().top),
		),
	);
	await expect(tiles.length + 1).toBe(columns * rows.size);
	await expect(more.textContent).toBe(
		`+${bigPack.emojis.length - tiles.length}`,
	);
	const stripBox = strip.getBoundingClientRect();
	const moreBox = more.getBoundingClientRect();
	await expect(moreBox.right).toBeLessThanOrEqual(stripBox.right + 0.5);
	await expect(moreBox.bottom).toBeLessThanOrEqual(stripBox.bottom + 0.5);
	return columns;
};

const playStates = async (canvasElement: HTMLElement) => {
	followSpy.mockClear();
	const canvas = within(canvasElement);
	const [wide, narrow] = WIDTHS.map(
		(width) =>
			canvasElement.querySelector<HTMLElement>(
				`[data-width="${width}"]`,
			) as HTMLElement,
	) as [HTMLElement, HTMLElement];
	const wideColumns = await expectStripFits(wide);
	const narrowColumns = await expectStripFits(narrow);
	await expect(wideColumns).toBeGreaterThan(narrowColumns);
	for (const card of canvasElement.querySelectorAll<HTMLElement>(
		"[data-emoji-pack-card]",
	))
		await expectNoLayoutIssues(card);

	const own = canvasElement.querySelector<HTMLElement>('[data-case="own"]');
	await expect(own?.querySelector("[data-own-pack]")).not.toBeNull();
	await expect(
		within(own as HTMLElement).queryByRole("button", { name: "Follow pack" }),
	).toBeNull();
	await expect(own?.querySelector("[data-emoji-more]")).toBeNull();

	const wideFollow = within(wide).getByRole("button", { name: "Follow pack" });
	await userEvent.click(wideFollow);
	await expect(followSpy).toHaveBeenCalledWith(true);
	await waitFor(() =>
		expect(
			within(wide).getByRole("button", { name: "Unfollow pack" }),
		).toBeVisible(),
	);

	const fail = canvasElement.querySelector<HTMLElement>('[data-case="fail"]');
	await userEvent.click(
		within(fail as HTMLElement).getByRole("button", { name: "Follow pack" }),
	);
	await expect(
		await within(fail as HTMLElement).findByRole("alert"),
	).toHaveTextContent("Couldn't follow this pack. Try again.");

	await userEvent.click(
		within(wide).getByRole("button", {
			name: new RegExp(`^View all ${bigPack.emojis.length} emoji`),
		}),
	);
	const dialog = await screen.findByRole("dialog", { name: bigPack.name });
	await waitFor(() => expect(dialog).toBeVisible());
	await new Promise((resolve) => setTimeout(resolve, 300));
	const grid = dialog.querySelector<HTMLElement>("[data-emoji-pack-view-all]");
	await expect(grid?.querySelectorAll("li").length).toBe(bigPack.emojis.length);
	await expect(grid?.scrollHeight).toBeGreaterThan(grid?.clientHeight ?? 0);
	await expect(within(dialog).getByText(":party_1:")).toBeInTheDocument();
	await expectNoLayoutIssues(dialog);
	await expect(
		within(dialog).getByRole("button", { name: "Unfollow pack" }),
	).toBeVisible();
	await userEvent.keyboard("{Escape}");
	await waitFor(
		() => expect(document.querySelector('[role="dialog"]')).toBeNull(),
		{
			timeout: 3000,
		},
	);
	await expect(canvas.getAllByRole("article").length).toBe(4);
};

export const States: Story = {
	name: "Widths, own pack and follow",
	parameters: desktop,
	render: () => <StateCases />,
	play: ({ canvasElement }) => playStates(canvasElement),
};

export const ViewAllDesktop: Story = {
	name: "View all on desktop",
	parameters: desktop,
	render: () => (
		<div class="min-h-dvh max-w-[960px] bg-background py-4 text-foreground">
			<Message text={packUrl} attachments={<LiveCard />} />
		</div>
	),
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getByRole("button", {
				name: new RegExp(`^View all ${bigPack.emojis.length} emoji`),
			}),
		);
		const dialog = await screen.findByRole("dialog", { name: bigPack.name });
		await waitFor(() => expect(dialog).toBeVisible());
		await new Promise((resolve) => setTimeout(resolve, 300));
		await expect(
			dialog.querySelector("[data-emoji-pack-view-all]"),
		).toHaveAttribute("data-platform", "desktop");
		await expect(dialog.querySelectorAll("li").length).toBe(
			bigPack.emojis.length,
		);
		await expectNoLayoutIssues(dialog);
		await userEvent.keyboard("{Escape}");
		await waitFor(
			() => expect(document.querySelector('[role="dialog"]')).toBeNull(),
			{ timeout: 3000 },
		);
	},
};

export const ViewAllMobile: Story = {
	name: "View all on mobile",
	parameters: mobile,
	render: () => (
		<div class="min-h-dvh bg-background py-2 text-foreground">
			<Message text={packUrl} attachments={<LiveCard platform="mobile" />} />
		</div>
	),
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(canvasElement).getByRole("button", {
				name: new RegExp(`^View all ${bigPack.emojis.length} emoji`),
			}),
		);
		const drawer = await screen.findByRole("dialog", { name: bigPack.name });
		await waitFor(() => expect(drawer).toBeVisible());
		await new Promise((resolve) => setTimeout(resolve, 500));
		await expect(
			drawer.querySelector("[data-emoji-pack-view-all]"),
		).toHaveAttribute("data-platform", "mobile");
		await expect(
			document.querySelector("[data-corvu-drawer-content]"),
		).not.toBeNull();
		await expect(drawer.querySelectorAll("li").length).toBe(
			bigPack.emojis.length,
		);
		await expectNoLayoutIssues(drawer);
		await userEvent.keyboard("{Escape}");
		await waitFor(
			() => expect(document.querySelector('[role="dialog"]')).toBeNull(),
			{
				timeout: 3000,
			},
		);
	},
};

const retrySpy = fn();

export const LoadingAndUnavailable: Story = {
	name: "Loading and unavailable",
	parameters: desktop,
	render: () => (
		<div class="flex min-h-dvh flex-col gap-4 bg-background p-4 text-foreground">
			<div class="flex flex-wrap items-start gap-4">
				<div class="w-[416px]">
					<EmojiPackCardSkeleton />
				</div>
				<div class="w-[416px]">
					<LiveCard pack={smallPack} />
				</div>
			</div>
			<div class="flex w-[416px] flex-col gap-4">
				<EmojiPackCardUnavailable reason="missing" />
				<EmojiPackCardUnavailable reason="failed" onRetry={retrySpy} />
			</div>
		</div>
	),
	play: async ({ canvasElement }) => {
		retrySpy.mockClear();
		const canvas = within(canvasElement);
		await expect(
			canvas.getByText("This emoji pack isn't available"),
		).toBeVisible();
		await userEvent.click(canvas.getByRole("button", { name: "Try again" }));
		await expect(retrySpy).toHaveBeenCalledOnce();
		const skeleton = canvasElement.querySelector<HTMLElement>(
			"[data-emoji-pack-card-skeleton]",
		);
		const card = canvasElement.querySelector<HTMLElement>(
			"[data-emoji-pack-card]",
		);
		if (!skeleton || !card) throw new Error("missing skeleton or card");
		await expect(
			Math.abs(
				skeleton.getBoundingClientRect().height -
					card.getBoundingClientRect().height,
			),
		).toBeLessThanOrEqual(8);
		for (const unavailable of canvasElement.querySelectorAll<HTMLElement>(
			"[data-emoji-pack-card-unavailable]",
		))
			await expectNoLayoutIssues(unavailable);
	},
};
