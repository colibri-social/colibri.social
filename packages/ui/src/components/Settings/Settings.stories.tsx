import { AddIcon } from "@solar-icons/solid/bold/add";
import { CheckIcon } from "@solar-icons/solid/bold/check";
import { For, type JSX } from "solid-js";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { Button } from "../Button/Button";
import { NavHeader } from "../Header/NavHeader";
import { IconButton } from "../IconButton/IconButton";
import { ListGroup } from "../List/List";
import { SearchField, TextField } from "../TextField/TextField";
import { BridgeCard, EmojiRow, InviteCard, Step, StepList } from "./Settings";

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
				/>
				<EmojiRow
					name="opsec"
					src={opsec}
					uploader={{ handle: "kris.kralsei.stream" }}
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
