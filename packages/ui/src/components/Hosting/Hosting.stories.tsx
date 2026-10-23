import { createSignal, type JSX, Show } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import { storyImages } from "../Banner/story-images";
import { Button } from "../Button/Button";
import { ChannelListHeader } from "../Channels/ChannelListHeader";
import { ImageUploadTile } from "../Onboarding/ImageUploadTile";
import { SpaceRail, SpaceRailItem } from "../SpaceRail/SpaceRail";
import { TextField } from "../TextField/TextField";
import { HostConnected } from "./HostConnected";
import {
	type HostingMode,
	HostingPicker,
	hostingSubmitLabel,
} from "./HostingPicker";
import { type HostingState, HostingStatus } from "./HostingStatus";
import {
	HAND_OVER_MINUTES,
	type HostCheckState,
	HostMove,
	type HostMoveStep,
	pdsMooverUrl,
} from "./HostMove";
import {
	HostSetup,
	type HostSetupError,
	type HostSetupStep,
} from "./HostSetup";
import { hostSignInAttention } from "./SpaceAttention";

const meta = {
	title: "Surfaces/Space hosting",
	parameters: { viewport: { defaultViewport: "iphone" } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const desktop = { viewport: { defaultViewport: "reset" } };

const SPACE = "Night Owls";
const ACCOUNT = "nightowls.example.com";
const COLIBRI_ACCOUNT = "nightowls-x7k2.spaces-alpha.colibri.social";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const onOpenSignIn = fn();
const onOpenMoover = fn();
const onOpenSpace = fn();
const onSignIn = fn();

const Surface = (props: { children: JSX.Element; class?: string }) => (
	<div
		class={`flex min-h-dvh flex-col bg-popover p-4 text-foreground ${props.class ?? ""}`}
	>
		{props.children}
	</div>
);

type CreateArgs = { outcome: "success" | HostSetupError };

const CreateSpaceMock = (props: CreateArgs) => {
	const [mode, setMode] = createSignal<HostingMode>("colibri");
	const [name, setName] = createSignal(SPACE);
	const [account, setAccount] = createSignal("");
	const [accountError, setAccountError] = createSignal<string>();
	const [step, setStep] = createSignal<HostSetupStep>();
	const [error, setError] = createSignal<HostSetupError>();
	const [created, setCreated] = createSignal(false);

	const reset = () => {
		setStep(undefined);
		setError(undefined);
	};

	const run = async () => {
		setError(undefined);
		setStep("signIn");
		onOpenSignIn(account());
		await wait(1200);
		if (props.outcome === "cancelled" || props.outcome === "wrongAccount") {
			setError(props.outcome);
			return;
		}
		setStep("checkingServer");
		await wait(900);
		if (props.outcome !== "success") {
			setError(props.outcome);
			return;
		}
		setStep("creating");
		await wait(900);
		setStep("done");
	};

	const submit = () => {
		if (mode() === "colibri") {
			setCreated(true);
			return;
		}
		if (!account().trim()) {
			setAccountError("Enter the account you want to use.");
			return;
		}
		setAccountError(undefined);
		void run();
	};

	return (
		<Surface class="gap-6">
			<h1 class="m-0 font-bold text-xl">Create a Space</h1>
			<Show
				when={step() || error()}
				fallback={
					<Show
						when={!created()}
						fallback={
							<p role="status" class="m-0 text-sm">
								Created {name()} on Colibri.
							</p>
						}
					>
						<div class="flex flex-col items-center gap-6">
							<ImageUploadTile
								label="Upload Space icon"
								onFileChange={() => {}}
							/>
							<TextField
								label="Space name"
								value={name()}
								onChange={setName}
								class="w-full"
							/>
							<HostingPicker
								mode={mode()}
								onModeChange={(next) => {
									setMode(next);
									setAccountError(undefined);
								}}
								account={account()}
								onAccountChange={setAccount}
								accountError={accountError()}
							/>
							<Button block onClick={submit}>
								{hostingSubmitLabel(mode())}
							</Button>
						</div>
					</Show>
				}
			>
				<HostSetup
					spaceName={name()}
					account={account()}
					server="example.com"
					signedInAs="alex.example.com"
					step={step()}
					error={error()}
					onReopenSignIn={() => onOpenSignIn(account())}
					onBack={reset}
					onRetry={() => void run()}
					onUseAnotherAccount={() => {
						reset();
						setAccount("");
					}}
					onUseColibri={() => {
						reset();
						setMode("colibri");
					}}
					onOpenExisting={() => onOpenSpace("existing")}
					onOpenSpace={() => onOpenSpace(name())}
				/>
			</Show>
		</Surface>
	);
};

export const CreateWithColibri: StoryObj<CreateArgs> = {
	args: { outcome: "success" },
	render: (args) => <CreateSpaceMock {...args} />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("Hosted by Colibri")).toBeVisible();
		await expect(
			canvas.queryByRole("textbox", { name: "Account" }),
		).not.toBeInTheDocument();
		await expect(
			canvas.getByRole("button", { name: "Create Space" }),
		).toBeVisible();
		await expectNoLayoutIssues(canvasElement);
	},
};

const chooseOwnAccount = async (canvasElement: HTMLElement) => {
	const canvas = within(canvasElement);
	await userEvent.click(
		canvas.getByRole("button", { name: "Change who hosts this Space" }),
	);
	await userEvent.click(await screen.findByText("Use an account I own"));
	await waitFor(() =>
		expect(canvas.getByRole("textbox", { name: "Account" })).toBeVisible(),
	);
};

export const CreateWithOwnAccount: StoryObj<CreateArgs> = {
	args: { outcome: "success" },
	argTypes: {
		outcome: {
			control: "select",
			options: [
				"success",
				"wrongAccount",
				"spacesUnsupported",
				"alreadyHosts",
				"cancelled",
			],
		},
	},
	render: (args) => <CreateSpaceMock {...args} />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await chooseOwnAccount(canvasElement);
		await expect(canvas.getByText("Hosted on your account")).toBeVisible();
		await userEvent.click(
			canvas.getByRole("button", { name: "Sign in and create" }),
		);
		await expect(
			await canvas.findByText("Enter the account you want to use."),
		).toBeVisible();
		await userEvent.type(
			canvas.getByRole("textbox", { name: "Account" }),
			ACCOUNT,
		);
		await userEvent.click(
			canvas.getByRole("button", { name: "Sign in and create" }),
		);
		await expect(onOpenSignIn).toHaveBeenCalledWith(ACCOUNT);
		await expect(
			await canvas.findByText("Waiting for you to sign in"),
		).toBeVisible();
		await waitFor(
			() =>
				expect(
					canvas.getByRole("button", { name: "Open Space" }),
				).toBeVisible(),
			{ timeout: 5000 },
		);
		await expectNoLayoutIssues(canvasElement);
	},
};

const SetupFrame = (props: {
	step?: HostSetupStep;
	error?: HostSetupError;
}) => (
	<Surface>
		<HostSetup
			spaceName={SPACE}
			account={ACCOUNT}
			server="example.com"
			signedInAs="alex.example.com"
			step={props.step}
			error={props.error}
			onReopenSignIn={onOpenSignIn}
			onOpenSpace={onOpenSpace}
			onOpenExisting={() => {}}
		/>
	</Surface>
);

const setupStory = (
	props: { step?: HostSetupStep; error?: HostSetupError },
	heading: string | RegExp,
): Story => ({
	render: () => <SetupFrame {...props} />,
	play: async ({ canvasElement }) => {
		await expect(within(canvasElement).getByText(heading)).toBeVisible();
		await expectNoLayoutIssues(canvasElement);
	},
});

export const SetupWaitingForSignIn = setupStory(
	{ step: "signIn" },
	"Waiting for you to sign in",
);
export const SetupCheckingServer = setupStory(
	{ step: "checkingServer" },
	"Checking the server",
);
export const SetupCreating = setupStory(
	{ step: "creating" },
	"Creating channels and roles",
);
export const SetupDone = setupStory({ step: "done" }, "Setting up Night Owls");
export const ErrorWrongAccount = setupStory(
	{ error: "wrongAccount" },
	"You signed in as a different account",
);
export const ErrorSpacesUnsupported = setupStory(
	{ error: "spacesUnsupported" },
	"This server can't host Spaces yet",
);
export const ErrorAlreadyHosts = setupStory(
	{ error: "alreadyHosts" },
	"This account already has a Space",
);
export const ErrorFailed = setupStory(
	{ error: "failed" },
	"Colibri couldn't set up the Space",
);
export const ErrorCancelled = setupStory(
	{ error: "cancelled" },
	"Sign-in was cancelled",
);

export const ConnectedReturnPage: Story = {
	render: () => (
		<div class="flex min-h-dvh items-center justify-center bg-background p-4 text-foreground">
			<HostConnected
				spaceName={SPACE}
				iconSrc={storyImages.tealIcon()}
				account={ACCOUNT}
				server="example.com"
				onOpen={onOpenSpace}
			/>
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole("heading", { name: "Colibri is connected" }),
		).toBeVisible();
		await userEvent.click(canvas.getByRole("button", { name: "Open Colibri" }));
		await expect(onOpenSpace).toHaveBeenCalled();
		await expectNoLayoutIssues(canvasElement);
	},
};

const StatusMock = (props: { state: HostingState; move?: boolean }) => {
	const [state, setState] = createSignal(props.state);
	const [busy, setBusy] = createSignal(false);
	return (
		<Surface class="items-center">
			<div class="w-full max-w-2xl">
				<HostingStatus
					state={state()}
					spaceName={SPACE}
					account={state() === "colibri" ? COLIBRI_ACCOUNT : ACCOUNT}
					server={
						state() === "colibri"
							? "spaces-alpha.colibri.social"
							: "example.com"
					}
					connectedBy="lou.gg"
					connectedSince="Oct 23, 2026"
					lastCheck="2 minutes ago"
					expiredOn="Oct 21, 2026"
					busy={busy()}
					onSignIn={async () => {
						onSignIn();
						setBusy(true);
						await wait(800);
						setBusy(false);
						setState("connected");
					}}
					onMove={props.move === false ? undefined : () => {}}
				/>
			</div>
		</Surface>
	);
};

export const StatusHostedByColibri: Story = {
	render: () => <StatusMock state="colibri" />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("Managed for you")).toBeVisible();
		await expect(
			canvas.getByRole("button", { name: "Move to another server" }),
		).toBeVisible();
		await expectNoLayoutIssues(canvasElement);
	},
};

export const StatusOwnAccount: Story = {
	parameters: desktop,
	render: () => <StatusMock state="connected" />,
	play: async ({ canvasElement }) => {
		await expect(within(canvasElement).getByText("Connected")).toBeVisible();
		await expectNoLayoutIssues(canvasElement);
	},
};

export const StatusNeedsSignIn: Story = {
	parameters: desktop,
	render: () => <StatusMock state="needsSignIn" />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByRole("alert")).toHaveTextContent(
			"Sign in again to keep Night Owls running",
		);
		await userEvent.click(
			canvas.getByRole("button", { name: `Sign in as ${ACCOUNT}` }),
		);
		await expect(onSignIn).toHaveBeenCalled();
		await waitFor(() => expect(canvas.getByText("Connected")).toBeVisible());
		await expectNoLayoutIssues(canvasElement);
	},
};

const menuActions = {
	onInvite: () => {},
	onOpenSettings: () => {},
	onOpenNotificationSettings: () => {},
	onMarkAsRead: () => {},
	onMutedChange: () => {},
	onLeave: () => {},
};

const AttentionShell = (props: { platform: "mobile" | "desktop" }) => {
	const [attention, setAttention] = createSignal(true);
	return (
		<div class="flex h-dvh bg-background text-foreground">
			<SpaceRail platform={props.platform}>
				<SpaceRailItem
					name={SPACE}
					iconSrc={storyImages.tealIcon()}
					attention={attention()}
					active
				/>
				<SpaceRailItem
					name="Bird watchers"
					iconSrc={storyImages.violetIcon()}
					mentions={3}
				/>
			</SpaceRail>
			<div class="relative flex w-72 flex-col overflow-y-auto rounded-tl-sheet border-0 border-r border-solid border-border bg-card">
				<ChannelListHeader
					platform={props.platform}
					name={SPACE}
					iconSrc={storyImages.tealIcon()}
					memberCount={42}
					ownerHandle="lou.gg"
					menu={menuActions}
					attention={
						attention()
							? hostSignInAttention(SPACE, ACCOUNT, () => {
									onSignIn();
									setAttention(false);
								})
							: undefined
					}
				/>
			</div>
		</div>
	);
};

export const AttentionDesktop: Story = {
	parameters: desktop,
	render: () => <AttentionShell platform="desktop" />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole("button", { name: `${SPACE}, needs your attention` }),
		).toBeVisible();
		const trigger = canvas.getByRole("button", {
			name: `${SPACE}, Space options, needs your attention`,
		});
		await expect(
			trigger.querySelector("[data-space-attention]"),
		).not.toBeNull();
		await userEvent.click(trigger);
		const notice = await screen.findByText(`Sign in to keep ${SPACE} running`);
		await expect(notice).toBeVisible();
		await expect(
			screen.getByText(new RegExp(`Sign in as ${ACCOUNT}, the account`)),
		).toBeVisible();
		await userEvent.click(
			screen.getByRole("button", { name: `Sign in as ${ACCOUNT}` }),
		);
		await expect(onSignIn).toHaveBeenCalled();
		await waitFor(() =>
			expect(
				canvas.getByRole("button", { name: `${SPACE}, Space options` }),
			).toBeVisible(),
		);
		await expect(
			canvasElement.querySelector("[data-rail-attention]"),
		).toBeNull();
	},
};

export const AttentionMobile: Story = {
	render: () => <AttentionShell platform="mobile" />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole("button", {
				name: `${SPACE}, Space options, needs your attention`,
			}),
		);
		await expect(
			await screen.findByText(`Sign in to keep ${SPACE} running`),
		).toBeVisible();
	},
};

type MoveArgs = { restoreAvailable: boolean; minutesLeft?: number };

const MoveMock = (props: MoveArgs & { start?: HostMoveStep }) => {
	const [step, setStep] = createSignal<HostMoveStep>(props.start ?? 1);
	const [server, setServer] = createSignal(
		props.start && props.start !== 1 ? "pds.example.com" : "",
	);
	const [check, setCheck] = createSignal<HostCheckState>(
		props.start && props.start !== 1 ? "supported" : "idle",
	);
	const [email, setEmail] = createSignal("lou@example.com");
	const [password, setPassword] = createSignal<string | undefined>(
		props.start && props.start !== 1 && props.start !== 2
			? "tR8v-qK2m-Wz9p-Lx4c-Hn7d"
			: undefined,
	);
	const [busy, setBusy] = createSignal(false);
	const [expiresAt, setExpiresAt] = createSignal<number | undefined>(
		props.start === 3
			? Date.now() + (props.minutesLeft ?? HAND_OVER_MINUTES) * 60_000
			: undefined,
	);

	return (
		<Surface class="items-center">
			<div class="flex w-full max-w-2xl flex-col gap-4">
				<h1 class="m-0 font-bold text-xl">Move to another server</h1>
				<p class="m-0 text-muted-foreground text-sm leading-prose">
					{SPACE} keeps its members, channels and history. You'll use PDS
					MOOver, a free tool, to copy the account. Colibri helps before and
					after.
				</p>
				<HostMove
					spaceName={SPACE}
					account={COLIBRI_ACCOUNT}
					step={step()}
					server={server()}
					onServerChange={(value) => {
						setServer(value);
						setCheck("idle");
					}}
					check={check()}
					onCheck={async () => {
						setCheck("checking");
						await wait(700);
						setCheck(
							server().trim().endsWith("bsky.social")
								? "unsupported"
								: "supported",
						);
					}}
					onContinue={() => setStep(2)}
					onChangeServer={() => {
						setStep(1);
						setCheck("idle");
						setPassword(undefined);
					}}
					email={email()}
					onEmailChange={setEmail}
					password={password()}
					passwordExpiresAt={expiresAt()}
					onHandOver={async () => {
						await wait(600);
						setPassword("tR8v-qK2m-Wz9p-Lx4c-Hn7d");
						setExpiresAt(Date.now() + HAND_OVER_MINUTES * 60_000);
						setStep(3);
					}}
					onRestartHandOver={() => {
						setPassword(undefined);
						setExpiresAt(undefined);
						setStep(2);
					}}
					onOpenMoover={() => onOpenMoover(pdsMooverUrl(server()))}
					onMoved={() => setStep(4)}
					reconnectBusy={busy()}
					onReconnect={async () => {
						setBusy(true);
						await wait(800);
						setBusy(false);
						setStep(5);
						if (props.restoreAvailable) {
							await wait(1500);
							setStep("done");
						}
					}}
					restoreAvailable={props.restoreAvailable}
					onBackToHosting={() => {}}
				/>
			</div>
		</Surface>
	);
};

export const MoveFlow: StoryObj<MoveArgs> = {
	parameters: desktop,
	args: { restoreAvailable: false },
	render: (args) => <MoveMock {...args} />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const field = canvas.getByRole("textbox", { name: "New server" });
		await userEvent.type(field, "bsky.social");
		await userEvent.click(canvas.getByRole("button", { name: "Check" }));
		await expect(
			await canvas.findByText(/can't host Spaces yet/),
		).toBeVisible();
		await userEvent.clear(field);
		await userEvent.type(field, "pds.example.com");
		await userEvent.click(canvas.getByRole("button", { name: "Check" }));
		await userEvent.click(
			await canvas.findByRole("button", { name: "Continue" }),
		);
		await userEvent.click(
			canvas.getByRole("button", { name: "Get the password" }),
		);
		await userEvent.click(
			await screen.findByRole("button", { name: "Hand over" }),
		);
		await waitFor(() =>
			expect(
				canvas.getByRole("button", { name: "Copy password" }),
			).toBeVisible(),
		);
		await waitFor(() =>
			expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
		);
		await waitFor(() =>
			expect(getComputedStyle(document.body).pointerEvents).not.toBe("none"),
		);
		await userEvent.click(
			canvas.getByRole("button", { name: "Open PDS MOOver" }),
		);
		await expect(onOpenMoover).toHaveBeenCalledWith(
			"https://pdsmoover.com/moover/pds.example.com",
		);
		await userEvent.click(
			canvas.getByRole("button", { name: "I've moved it" }),
		);
		await userEvent.click(
			canvas.getByRole("button", { name: "Sign in on pds.example.com" }),
		);
		await waitFor(() =>
			expect(
				canvasElement.querySelector('[data-move-step="5"]'),
			).toHaveAttribute("data-state", "active"),
		);
		await expect(canvas.getByText("Coming later")).toBeVisible();
		await expectNoLayoutIssues(canvasElement);
	},
};

export const MoveFlowMobile: StoryObj<MoveArgs> = {
	args: { restoreAvailable: false },
	render: (args) => <MoveMock {...args} />,
	play: async ({ canvasElement }) => {
		await expect(
			within(canvasElement).getByRole("textbox", { name: "New server" }),
		).toBeVisible();
		await expectNoLayoutIssues(canvasElement);
	},
};

export const MoveAtPdsMoover: StoryObj<MoveArgs> = {
	parameters: desktop,
	args: { restoreAvailable: false, minutesLeft: 58 },
	render: (args) => <MoveMock {...args} start={3} />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole("button", { name: "Copy password" }),
		).toBeVisible();
		await expect(
			canvas.getByRole("button", { name: "Open PDS MOOver" }),
		).toBeVisible();
		await expectNoLayoutIssues(canvasElement);
	},
};

export const MovePasswordExpiringSoon: StoryObj<MoveArgs> = {
	parameters: desktop,
	args: { restoreAvailable: false, minutesLeft: 5 },
	render: (args) => <MoveMock {...args} start={3} />,
	play: async ({ canvasElement }) => {
		await expect(
			canvasElement.querySelector('[data-password-expiry="soon"]'),
		).toHaveTextContent("This password stops working in 5 minutes");
		await expectNoLayoutIssues(canvasElement);
	},
};

export const MovePasswordExpired: StoryObj<MoveArgs> = {
	parameters: desktop,
	args: { restoreAvailable: false, minutesLeft: -1 },
	render: (args) => <MoveMock {...args} start={3} />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByRole("alert")).toHaveTextContent(
			"The password expired",
		);
		await expect(
			canvas.queryByRole("button", { name: "Copy password" }),
		).not.toBeInTheDocument();
		await expect(
			canvas.getByRole("button", { name: "Open PDS MOOver" }),
		).toBeDisabled();
		await userEvent.click(
			canvas.getByRole("button", { name: "Get a new password" }),
		);
		await expect(
			canvas.getByRole("button", { name: "Get the password" }),
		).toBeVisible();
		await expectNoLayoutIssues(canvasElement);
	},
};

export const MoveDone: StoryObj<MoveArgs> = {
	parameters: desktop,
	args: { restoreAvailable: true },
	render: (args) => <MoveMock {...args} start="done" />,
	play: async ({ canvasElement }) => {
		await expect(
			within(canvasElement).getByText(`${SPACE} lives on pds.example.com now`),
		).toBeVisible();
		await expectNoLayoutIssues(canvasElement);
	},
};
