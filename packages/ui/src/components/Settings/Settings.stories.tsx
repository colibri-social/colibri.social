import { AddIcon } from "@solar-icons/solid/bold/add";
import { CheckIcon } from "@solar-icons/solid/bold/check";
import { For, type JSX } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import { Button } from "../Button/Button";
import { NavHeader } from "../Header/NavHeader";
import { IconButton } from "../IconButton/IconButton";
import { ListGroup } from "../List/List";
import { SearchField, TextField } from "../TextField/TextField";
import {
	BridgeCard,
	BridgeSummaryCard,
	type BridgeSummaryCardProps,
	EmojiRow,
	InviteCard,
	Step,
	StepList,
} from "./Settings";

const meta = {
	title: "Surfaces/Settings cards",
	parameters: { viewport: { defaultViewport: "iphone" }, layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const emoji = (fill: string, face: string) =>
	`data:image/svg+xml,${encodeURIComponent(
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="${fill}"/><text x="12" y="17" font-size="13" text-anchor="middle" font-family="sans-serif" fill="#111">${face}</text></svg>`,
	)}`;

const tux = emoji("#ffd857", "t");
const opsec = emoji("#9c66ff", "o");

const Page = (props: {
	title: string;
	action?: Parameters<typeof NavHeader>[0]["action"];
	children: JSX.Element;
}) => (
	<div class="min-h-dvh bg-popover text-foreground">
		<NavHeader
			kind="back"
			title={props.title}
			onNavigate={() => {}}
			action={props.action}
			class="bg-popover"
		/>
		<div class="flex flex-col gap-4 p-4">{props.children}</div>
	</div>
);

const stubClipboard = () => {
	const writeText = fn(async (_value: string) => {});
	Object.defineProperty(navigator, "clipboard", {
		configurable: true,
		value: { writeText },
	});
	return writeText;
};

const inviteCopy = fn();
const inviteMenu = fn();
const bridgeMenu = fn();
const bridgeAdd = fn();
const emojiMenu = fn();

export const InviteLinks: Story = {
	render: () => {
		return (
			<Page title="Invite links">
				<For each={["kjAnf91jad92Q", "pQ7mZr2xLw4aB"]}>
					{(code) => (
						<InviteCard
							code={code}
							copyValue={`https://colibri.social/invite/${code}`}
							expires="Never"
							creator={{ handle: "timtinkers.online" }}
							uses={69}
							onCopy={inviteCopy}
							onMenu={inviteMenu}
						/>
					)}
				</For>
			</Page>
		);
	},
	play: async ({ canvasElement }) => {
		const writeText = stubClipboard();
		inviteCopy.mockClear();
		inviteMenu.mockClear();
		const canvas = within(canvasElement);

		await userEvent.click(
			canvas.getByRole("button", {
				name: "More actions for invite kjAnf91jad92Q",
			}),
		);
		await expect(inviteMenu).toHaveBeenCalledTimes(1);
		await expect(writeText).not.toHaveBeenCalled();

		await userEvent.click(
			canvas.getByRole("button", { name: /^Copy invite link kjAnf91jad92Q/ }),
		);
		await waitFor(() =>
			expect(writeText).toHaveBeenCalledWith(
				"https://colibri.social/invite/kjAnf91jad92Q",
			),
		);
		await expect(inviteCopy).toHaveBeenCalledTimes(1);
		const label = canvasElement.querySelector("[data-copied]");
		await expect(label).not.toBeNull();
		await expect(canvas.getByText("Invite link copied")).toHaveAttribute(
			"role",
			"status",
		);
		await waitFor(
			() => expect(canvasElement.querySelector("[data-copied]")).toBeNull(),
			{ timeout: 3000 },
		);
	},
};

export const InviteLinkStates: Story = {
	render: () => (
		<Page title="Invite links">
			<InviteCard
				code="pQ7mZr2xLw4aB"
				copyValue="https://colibri.social/invite/pQ7mZr2xLw4aB"
				expires="6 days"
				creator={{ handle: "entropic.software" }}
				uses="12 / 25"
				onCopy={inviteCopy}
				onMenu={inviteMenu}
			/>
			<InviteCard
				code="expiredLink01"
				copyValue="https://colibri.social/invite/expiredLink01"
				state="expired"
				expires="2 days ago"
				creator={{ handle: "birdwatcher.bsky.social" }}
				uses="3 / 10"
				onCopy={inviteCopy}
				onMenu={inviteMenu}
			/>
			<InviteCard
				code="usedUpLink777"
				copyValue="https://colibri.social/invite/usedUpLink777"
				state="used-up"
				expires="1 day"
				creator={{ handle: "timtinkers.online" }}
				uses="5 / 5"
				onCopy={inviteCopy}
				onMenu={inviteMenu}
			/>
		</Page>
	),
	play: async ({ canvasElement }) => {
		const writeText = stubClipboard();
		inviteCopy.mockClear();
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole("button", { name: /^Copy invite link pQ7mZr2xLw4aB/ }),
		).toBeInTheDocument();
		await expect(
			canvas.queryByRole("button", { name: /^Copy invite link expiredLink01/ }),
		).toBeNull();
		await expect(
			canvas.queryByRole("button", { name: /^Copy invite link usedUpLink777/ }),
		).toBeNull();
		await expect(canvas.getByText("Expired")).toBeVisible();
		await expect(canvas.getByText("Used up")).toBeVisible();
		await expect(canvas.getByText("Expired:")).toBeVisible();
		await userEvent.click(canvas.getByText("expiredLink01"));
		await expect(writeText).not.toHaveBeenCalled();
		await expect(inviteCopy).not.toHaveBeenCalled();
		await expect(
			canvas.getByRole("button", {
				name: "More actions for invite expiredLink01",
			}),
		).toBeInTheDocument();
	},
};

export const Bridges: Story = {
	render: () => {
		return (
			<Page
				title="Bridges"
				action={{
					type: "icon",
					label: "Add bridge",
					icon: <AddIcon />,
					onClick: bridgeAdd,
				}}
			>
				<p class="m-0 text-sm text-muted-foreground">
					Bridges allow you to sync Colibri channels with other platforms. Read
					more in our{" "}
					<a
						href="https://colibri.social/docs"
						class="text-foreground underline decoration-foreground/40 underline-offset-2 hover:decoration-foreground"
					>
						documentation
					</a>
					.
				</p>
				<BridgeCard
					name="Matrix"
					verified
					service="did:web:bridge.example.social"
					bridgedWith="Lou's server"
					menuLabel="More actions for Matrix bridge"
					onMenu={bridgeMenu}
				/>
			</Page>
		);
	},
	play: async ({ canvasElement }) => {
		bridgeMenu.mockClear();
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole("button", { name: "More actions for Matrix bridge" }),
		);
		await expect(bridgeMenu).toHaveBeenCalledTimes(1);
		await expect(canvas.getByRole("img", { name: "Verified" })).toBeVisible();
	},
};

export const BridgeConnect: Story = {
	render: () => (
		<Page title="Connect to Matrix">
			<StepList>
				<Step
					title="Invite the Colibri bridge bot"
					description="To get started, invite the Colibri bridge bot to your server with the link below."
				>
					<a
						href="https://colibri.social/bridge"
						class="w-fit text-sm text-primary-highlight underline-offset-2 hover:underline"
					>
						Invite the Colibri bridge bot
					</a>
				</Step>
				<Step
					title="Get a pairing code"
					description="Next, run the /colibri connect command in any channel and copy the pairing code it gives you."
				/>
				<Step
					title="Enter the pairing code"
					description="Paste the pairing code below and select connect to link your server."
				>
					<div class="flex items-center gap-2">
						<TextField
							aria-label="Pairing code"
							placeholder="ABCDEFG123"
							class="min-w-0 flex-1"
						/>
						<IconButton
							variant="primary"
							size="lg"
							label="Connect"
							icon={<CheckIcon />}
						/>
					</div>
				</Step>
			</StepList>
		</Page>
	),
	play: async ({ canvasElement }) => {
		const list = canvasElement.querySelector("ol");
		await expect(list).not.toBeNull();
		await expect(
			within(list as HTMLElement).getAllByRole("listitem"),
		).toHaveLength(3);
	},
};

export const EmojiPacks: Story = {
	render: () => {
		const rows = () => (
			<>
				<EmojiRow
					name="tux"
					src={tux}
					uploader={{ handle: "timtinkers.online" }}
					onMenu={emojiMenu}
				/>
				<EmojiRow
					name="opsec"
					src={opsec}
					uploader={{ handle: "kris.kralsei.stream" }}
					onMenu={emojiMenu}
				/>
			</>
		);
		return (
			<Page title="My emoji packs">
				<div class="grid grid-cols-2 gap-4">
					<Button block>Upload emoji</Button>
					<Button variant="secondary" block>
						Create new pack
					</Button>
				</div>
				<SearchField aria-label="Search emojis" placeholder="Search emojis" />
				<div class="flex flex-col gap-6 pt-2">
					<ListGroup label="Ungrouped">{rows()}</ListGroup>
					<div class="flex flex-col gap-2">
						<ListGroup label="Pixelart by Lis">{rows()}</ListGroup>
						<Button variant="secondary" block>
							Edit pack
						</Button>
					</div>
					<div class="flex flex-col gap-2">
						<ListGroup label="Pixelart by Lis · by @timtinkers.online">
							{rows()}
						</ListGroup>
						<Button variant="destructive-subtle" block>
							Unfollow pack
						</Button>
					</div>
				</div>
			</Page>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getAllByRole("button", { name: "More actions for :tux:" }),
		).toHaveLength(3);
	},
};

const summaryMenu = {
	manage: fn(),
	disconnect: fn(),
};

const summaryCards: Omit<BridgeSummaryCardProps, "menuItems">[] = [
	{
		name: "Night Owls Art Club",
		platform: "Matrix",
		handle: "matrix-bridge.colibri.social",
		verified: true,
		channels: ["general", "critique", "gifs", "showcase", "archive"],
		status: { tone: "active", label: "Relaying" },
		mirrorModeration: true,
	},
	{
		name: "The extraordinarily long named workspace for weekend trail runners and friends",
		platform: "Slack",
		handle: "a-very-long-bridge-operator-handle.example.social",
		channels: [
			"planning-and-logistics-for-the-autumn-season",
			"routes",
			"gear",
			"carpools",
			"photos",
			"race-results",
			"injuries-and-recovery",
			"off-topic",
		],
		status: { tone: "warning", label: "Paused" },
		mirrorModeration: false,
	},
	{
		name: "Colibri HQ",
		platform: "IRC",
		handle: "irc.colibri.social",
		channels: ["dev"],
		status: { tone: "error", label: "History import failed" },
		mirrorModeration: false,
	},
	{
		name: "Fresh link",
		platform: "Matrix",
		handle: "matrix-bridge.colibri.social",
		channels: [],
		status: { tone: "active", label: "Relaying" },
	},
];

export const BridgeSummaryGrid: Story = {
	name: "Bridge summary grid",
	parameters: { viewport: { defaultViewport: "responsive" } },
	render: () => (
		<div class="min-h-dvh bg-popover p-6 text-foreground">
			<ul
				data-bridge-summary-grid=""
				class="m-0 mx-auto grid max-w-3xl list-none grid-cols-2 gap-4 p-0"
			>
				<For each={summaryCards}>
					{(card) => (
						<li class="flex min-w-0">
							<BridgeSummaryCard
								{...card}
								class="flex-1"
								menuItems={[
									{
										kind: "item",
										label: "Manage bridge",
										onSelect: () => summaryMenu.manage(card.name),
									},
									{
										kind: "item",
										label: "Disconnect bridge",
										tone: "destructive",
										onSelect: () => summaryMenu.disconnect(card.name),
									},
								]}
							/>
						</li>
					)}
				</For>
			</ul>
		</div>
	),
	play: async ({ canvasElement }) => {
		summaryMenu.manage.mockClear();
		summaryMenu.disconnect.mockClear();
		const grid = canvasElement.querySelector(
			"[data-bridge-summary-grid]",
		) as HTMLElement;
		await expectNoLayoutIssues(grid);
		const cards = Array.from(
			grid.querySelectorAll<HTMLElement>("[data-bridge-summary]"),
		);
		await expect(cards).toHaveLength(4);
		const [first, long, failed, empty] = cards as [
			HTMLElement,
			HTMLElement,
			HTMLElement,
			HTMLElement,
		];
		await expect(first.getBoundingClientRect().height).toBe(
			long.getBoundingClientRect().height,
		);
		await expect(
			within(first).getByText("Matrix bridge by matrix-bridge.colibri.social"),
		).toBeInTheDocument();
		await expect(
			within(first).getByRole("img", { name: "Verified" }),
		).toBeVisible();
		await expect(within(first).getAllByRole("listitem")).toHaveLength(4);
		await expect(
			first.querySelector("[data-bridge-channels-more]")?.textContent,
		).toBe("+2");
		await expect(
			long
				.querySelector("[data-bridge-channels-more]")
				?.getAttribute("aria-label"),
		).toBe(
			"5 more: carpools, photos, race-results, injuries-and-recovery, off-topic",
		);
		await expect(
			first
				.querySelector("[data-bridge-status]")
				?.getAttribute("data-bridge-status"),
		).toBe("active");
		await expect(
			long
				.querySelector("[data-bridge-status]")
				?.getAttribute("data-bridge-status"),
		).toBe("warning");
		await expect(
			within(failed).getByText("History import failed"),
		).toBeVisible();
		await expect(
			within(long).getByText("Mirror moderation: off"),
		).toBeVisible();
		await expect(
			within(empty).getByText("No channels linked yet"),
		).toBeVisible();
		const tile = empty.querySelector("[data-space-icon]") as HTMLElement;
		await expect(getComputedStyle(tile).backgroundColor).not.toBe(
			getComputedStyle(empty).backgroundColor,
		);
		await expect(getComputedStyle(tile).color).toBe(
			getComputedStyle(empty).color,
		);
		await expect(
			within(empty).queryByText(/Mirror moderation/),
		).not.toBeInTheDocument();
		const chip = within(long)
			.getByText("planning-and-logistics-for-the-autumn-season")
			.closest("[data-bridge-channel]") as HTMLElement;
		await expect(chip.getBoundingClientRect().right).toBeLessThanOrEqual(
			long.getBoundingClientRect().right,
		);
		await userEvent.click(
			within(first).getByRole("button", {
				name: "More actions for Night Owls Art Club bridge",
			}),
		);
		const menu = await screen.findByRole("menu");
		await expect(
			within(menu)
				.getAllByRole("menuitem")
				.map((item) => item.textContent?.trim()),
		).toEqual(["Manage bridge", "Disconnect bridge"]);
		await userEvent.click(
			within(menu).getByRole("menuitem", { name: "Disconnect bridge" }),
		);
		await expect(summaryMenu.disconnect).toHaveBeenCalledWith(
			"Night Owls Art Club",
		);
		await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
	},
};
