import { BugIcon } from "@solar-icons/solid/bold/bug";
import { ChatRoundLineIcon } from "@solar-icons/solid/bold/chat-round-line";
import { StarsIcon } from "@solar-icons/solid/bold/stars";
import { createSignal, type JSX } from "solid-js";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import {
	FALLBACK_BADGE_DEFINITIONS,
	TEAM_BADGE_DEFINITION,
	UserBadge,
} from "../Badge/Badge";
import {
	AdvancedSettings,
	ExperimentsSettings,
	type UpdateState,
} from "./AdvancedSettings";
import { DebugInformation, type DiagnosticsSection } from "./DebugInformation";
import { type LogLine, LogsSettings } from "./LogsSettings";
import { RELEASE_HISTORY_URL } from "./links";
import {
	SupportColibriSettings,
	type SupportColibriSettingsProps,
	type SupporterLink,
	type SupportTier,
} from "./SupportColibriSettings";
import {
	type CameraPreviewState,
	type MicTestState,
	type ScreenShareSettings,
	VoiceVideoSettings,
} from "./VoiceVideoSettings";
import { type ReleaseNoteView, WhatsNewSettings } from "./WhatsNewSettings";

type Args = {
	onChange?: (key: string, value: unknown) => void;
	onDeveloperModeChange?: (value: boolean) => void;
	onDeleteAccount?: () => void;
	onExperimentChange?: (id: string, enabled: boolean) => void;
	onCopyDid?: () => void;
	onOpenDebugInformation?: () => void;
	onOpenLogs?: () => void;
	onCopy?: () => void;
	onVerboseChange?: (value: boolean) => void;
	onConnect?: () => void;
	onDisconnect?: () => void;
	onRefresh?: () => void;
	onCheck?: () => void;
	onRestart?: () => void;
};

const meta: Meta<Args> = {
	title: "Surfaces/Settings pages",
	parameters: { viewport: { defaultViewport: "iphone" } },
};

const desktop = {
	viewport: {
		defaultViewport: "desktop",
		options: {
			desktop: {
				name: "Desktop",
				styles: { width: "1200px", height: "900px" },
				type: "desktop",
			},
		},
	},
};

export default meta;
type Story = StoryObj<Args>;

type Platform = "mobile" | "desktop";

const Frame = (props: { platform: Platform; children: JSX.Element }) => (
	<div
		data-frame={props.platform}
		class={
			props.platform === "mobile"
				? "w-[402px] max-w-full bg-background px-4 py-6"
				: "w-[720px] bg-background px-8 py-8"
		}
	>
		{props.children}
	</div>
);

const frameOf = (canvasElement: HTMLElement) =>
	canvasElement.querySelector<HTMLElement>("[data-frame]") as HTMLElement;

const MICROPHONES = [
	{ id: "default", label: "MacBook Pro Microphone" },
	{ id: "usb", label: "Shure MV7+ USB Microphone with a very long name" },
];
const SPEAKERS = [
	{ id: "default", label: "MacBook Pro Speakers" },
	{ id: "airpods", label: "AirPods Pro" },
];
const CAMERAS = [
	{ id: "facetime", label: "FaceTime HD Camera" },
	{ id: "continuity", label: "iPhone Camera" },
];

const FakePreview = () => (
	<div
		data-fake-preview=""
		class="size-full bg-[linear-gradient(135deg,#3b2f63,#1d4f5c)]"
	/>
);

const VoiceVideoStory = (props: {
	platform: Platform;
	speakers?: boolean;
	screen?: boolean;
	previewState?: CameraPreviewState;
	onChange?: (key: string, value: unknown) => void;
}) => {
	const [microphone, setMicrophone] = createSignal("default");
	const [inputVolume, setInputVolume] = createSignal(100);
	const [outputVolume, setOutputVolume] = createSignal(80);
	const [micTest, setMicTest] = createSignal<MicTestState>("idle");
	const [previewState, setPreviewState] = createSignal<CameraPreviewState>(
		props.previewState ?? "ready",
	);
	const [noise, setNoise] = createSignal(true);
	const [gate, setGate] = createSignal(false);
	const [confirm, setConfirm] = createSignal(false);
	const [nonVideo, setNonVideo] = createSignal(true);
	const [ownCamera, setOwnCamera] = createSignal(true);
	const [screen, setScreen] = createSignal<ScreenShareSettings>({
		resolution: "1080",
		framerate: 30,
		shareAudio: true,
	});
	const report = (key: string) => (value: unknown) =>
		props.onChange?.(key, value);

	return (
		<Frame platform={props.platform}>
			<VoiceVideoSettings
				platform={props.platform}
				microphones={MICROPHONES}
				microphone={microphone()}
				onMicrophoneChange={setMicrophone}
				inputVolume={inputVolume()}
				onInputVolumeChange={setInputVolume}
				micTest={micTest()}
				micLevel={micTest() === "running" ? 0.5 : 0}
				onMicTestToggle={() =>
					setMicTest((state) => (state === "running" ? "idle" : "running"))
				}
				speakers={props.speakers === false ? undefined : SPEAKERS}
				speaker="default"
				outputVolume={outputVolume()}
				onOutputVolumeChange={setOutputVolume}
				noiseSuppression={noise()}
				onNoiseSuppressionChange={(value) => {
					setNoise(value);
					report("noiseSuppression")(value);
				}}
				voiceGate={gate()}
				onVoiceGateChange={(value) => {
					setGate(value);
					report("voiceGate")(value);
				}}
				confirmJoin={confirm()}
				onConfirmJoinChange={(value) => {
					setConfirm(value);
					report("confirmJoin")(value);
				}}
				showNonVideoParticipants={nonVideo()}
				onShowNonVideoParticipantsChange={setNonVideo}
				showOwnCamera={ownCamera()}
				onShowOwnCameraChange={setOwnCamera}
				cameras={CAMERAS}
				camera="facetime"
				cameraPreview={<FakePreview />}
				cameraPreviewState={previewState()}
				onCameraPreviewToggle={() =>
					setPreviewState((state) => (state === "ready" ? "idle" : "ready"))
				}
				cameraError={
					previewState() === "error"
						? "Colibri isn't allowed to use your camera. Allow it in your system settings, then come back."
						: undefined
				}
				screenShare={props.screen ? screen() : undefined}
				onScreenShareChange={(patch) => {
					setScreen((current) => ({ ...current, ...patch }));
					report("screenShare")(patch);
				}}
			/>
		</Frame>
	);
};

export const VoiceVideoMobile: Story = {
	render: () => <VoiceVideoStory platform="mobile" speakers={false} />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.queryByText("Speaker")).toBeNull();
		await expect(canvas.queryByText("Screen sharing")).toBeNull();
		const meter = canvas.getByRole("meter", {
			name: "Microphone level",
		}) as HTMLMeterElement;
		const lit = () =>
			canvasElement.querySelectorAll("[data-mic-meter] [data-lit]").length;
		await expect(lit()).toBe(0);
		const test = canvas.getByRole("button", { name: "Test microphone" });
		const before = test.offsetWidth;
		await userEvent.click(test);
		const stop = canvas.getByRole("button", { name: "Stop test" });
		await expect(stop).toHaveAttribute("aria-pressed", "true");
		await expect(stop.offsetWidth).toBe(before);
		await expect(lit()).toBe(16);
		await expect(meter.value).toBe(50);
		await userEvent.click(stop);
		await expect(lit()).toBe(0);
		await expect(
			canvasElement.querySelector('[data-camera-preview="ready"]'),
		).toBeInTheDocument();
		await expectNoLayoutIssues(frameOf(canvasElement));
	},
};

export const VoiceVideoDesktop: Story = {
	parameters: desktop,
	render: (args) => (
		<VoiceVideoStory platform="desktop" screen onChange={args.onChange} />
	),
	args: { onChange: fn() },
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("Speaker")).toBeVisible();
		const segments = [
			...canvasElement.querySelectorAll<HTMLElement>("[data-mic-meter] > span"),
		].map((segment) => segment.getBoundingClientRect());
		await expect(segments.length).toBeGreaterThan(0);
		for (const segment of segments) {
			await expect(segment.width).toBeLessThanOrEqual(4);
			await expect(segment.height).toBeGreaterThan(segment.width * 3);
		}
		const resolution = canvas.getByRole("button", { name: /Resolution/ });
		const framerate = canvas.getByRole("button", { name: /Frame rate/ });
		const resolutionBox = resolution.getBoundingClientRect();
		const framerateBox = framerate.getBoundingClientRect();
		await expect(Math.round(resolutionBox.top)).toBe(
			Math.round(framerateBox.top),
		);
		await expect(framerateBox.left).toBeGreaterThan(resolutionBox.right);
		await userEvent.click(
			canvas.getByRole("switch", { name: /Confirm before joining/ }),
		);
		await expect(args.onChange).toHaveBeenCalledWith("confirmJoin", true);
		await userEvent.click(canvas.getByRole("switch", { name: /Share sound/ }));
		await expect(args.onChange).toHaveBeenCalledWith("screenShare", {
			shareAudio: false,
		});
		await expectNoLayoutIssues(frameOf(canvasElement));
	},
};

export const VoiceVideoCameraIdle: Story = {
	render: () => <VoiceVideoStory platform="mobile" previewState="idle" />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const preview = () =>
			canvasElement.querySelector<HTMLElement>("[data-camera-preview]");
		const height = preview()?.getBoundingClientRect().height;
		await userEvent.click(
			canvas.getByRole("button", { name: "Preview camera" }),
		);
		await expect(preview()).toHaveAttribute("data-camera-preview", "ready");
		await expect(preview()?.getBoundingClientRect().height).toBe(height);
		await userEvent.click(canvas.getByRole("button", { name: "Stop preview" }));
		await expect(
			canvas.getByRole("button", { name: "Preview camera" }),
		).toBeVisible();
		await expectNoLayoutIssues(frameOf(canvasElement));
	},
};

export const VoiceVideoCameraLoading: Story = {
	render: () => <VoiceVideoStory platform="mobile" previewState="loading" />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("Starting your camera...")).toBeVisible();
		const preview = canvasElement.querySelector<HTMLElement>(
			"[data-fake-preview]",
		);
		await expect(preview?.parentElement).toHaveClass("invisible");
	},
};

export const VoiceVideoCameraError: Story = {
	render: () => <VoiceVideoStory platform="mobile" previewState="error" />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByRole("alert")).toHaveTextContent(
			"Colibri isn't allowed to use your camera",
		);
		await expectNoLayoutIssues(frameOf(canvasElement));
	},
};

const AdvancedStory = (props: {
	platform: Platform;
	windowControls?: boolean;
	onDeveloperModeChange?: (value: boolean) => void;
	onDeleteAccount?: () => void;
}) => {
	const [developer, setDeveloper] = createSignal(false);
	const [reports, setReports] = createSignal(false);
	const [windowControls, setWindowControls] = createSignal(false);
	return (
		<Frame platform={props.platform}>
			<AdvancedSettings
				developerMode={developer()}
				onDeveloperModeChange={(value) => {
					setDeveloper(value);
					props.onDeveloperModeChange?.(value);
				}}
				includeAccountInReports={reports()}
				onIncludeAccountInReportsChange={setReports}
				systemWindowControls={
					props.windowControls ? windowControls() : undefined
				}
				onSystemWindowControlsChange={setWindowControls}
				onDeleteAccount={props.onDeleteAccount ?? fn()}
			/>
		</Frame>
	);
};

export const AdvancedMobile: Story = {
	render: (args) => (
		<AdvancedStory
			platform="mobile"
			onDeveloperModeChange={args.onDeveloperModeChange}
			onDeleteAccount={args.onDeleteAccount}
		/>
	),
	args: { onDeveloperModeChange: fn(), onDeleteAccount: fn() },
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		await expect(canvas.queryByText("Use system window controls")).toBeNull();
		const developer = canvas.getByRole("switch", { name: /Developer mode/ });
		await userEvent.click(developer);
		await expect(developer).toBeChecked();
		await expect(args.onDeveloperModeChange).toHaveBeenCalledWith(true);
		await expect(canvas.getByText("Danger zone")).toBeVisible();
		await userEvent.click(
			canvas.getByRole("button", { name: "Delete my Colibri data" }),
		);
		await expect(args.onDeleteAccount).toHaveBeenCalledOnce();
		await expectNoLayoutIssues(frameOf(canvasElement));
	},
};

export const AdvancedDesktop: Story = {
	parameters: desktop,
	render: () => <AdvancedStory platform="desktop" windowControls />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole("switch", { name: /Use system window controls/ }),
		).not.toBeChecked();
		await expectNoLayoutIssues(frameOf(canvasElement));
	},
};

const UpdatesStory = (props: {
	initial: UpdateState;
	onCheck?: () => void;
	onRestart?: () => void;
}) => {
	const [state, setState] = createSignal<UpdateState>(props.initial);
	return (
		<Frame platform="desktop">
			<AdvancedSettings
				developerMode={false}
				updates={{
					version: "0.18.2",
					state: state(),
					onCheck: () => {
						props.onCheck?.();
						setState({ status: "ready", version: "0.18.3" });
					},
					onRestart: props.onRestart,
				}}
			/>
		</Frame>
	);
};

export const AdvancedUpdates: Story = {
	parameters: desktop,
	render: (args) => (
		<UpdatesStory
			initial={{ status: "idle" }}
			onCheck={args.onCheck}
			onRestart={args.onRestart}
		/>
	),
	args: { onCheck: fn(), onRestart: fn() },
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("Version 0.18.2")).toBeVisible();
		await userEvent.click(
			canvas.getByRole("button", { name: "Check for updates" }),
		);
		await expect(args.onCheck).toHaveBeenCalledOnce();
		await expect(
			canvas.getByText("Version 0.18.3 is ready. Restart to finish."),
		).toBeVisible();
		await userEvent.click(
			canvas.getByRole("button", { name: "Restart to update" }),
		);
		await expect(args.onRestart).toHaveBeenCalledOnce();
		await expectNoLayoutIssues(frameOf(canvasElement));
	},
};

export const AdvancedUpdatesDownloading: Story = {
	parameters: desktop,
	render: () => (
		<UpdatesStory initial={{ status: "downloading", version: "0.18.3" }} />
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole("button", { name: "Check for updates" }),
		).toBeDisabled();
		await expectNoLayoutIssues(frameOf(canvasElement));
	},
};

export const AdvancedUpdatesHomebrew: Story = {
	parameters: desktop,
	render: () => (
		<UpdatesStory
			initial={{
				status: "managed",
				version: "0.18.3",
				command: "brew upgrade --cask colibri-social",
			}}
		/>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByText("brew upgrade --cask colibri-social"),
		).toBeVisible();
		await expectNoLayoutIssues(frameOf(canvasElement));
	},
};

export const AdvancedUpdatesError: Story = {
	parameters: desktop,
	render: () => <UpdatesStory initial={{ status: "error" }} />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByText(
				"Couldn't check for updates. Check your connection and try again.",
			),
		).toBeVisible();
		await expectNoLayoutIssues(frameOf(canvasElement));
	},
};

const EXPERIMENTS = [
	{
		id: "light-mode-v1",
		name: "Light mode",
		description:
			"Adds a light theme to Appearance. It follows your system by default and is still rough in places.",
		enabled: false,
	},
	{
		id: "threads-inline-v1",
		name: "Threads in the channel",
		description: "Opens threads below their message instead of on the side.",
		enabled: true,
	},
];

export const Experiments: Story = {
	render: (args) => {
		const [experiments, setExperiments] = createSignal(EXPERIMENTS);
		return (
			<Frame platform="mobile">
				<ExperimentsSettings
					experiments={experiments()}
					onExperimentChange={(id, enabled) => {
						setExperiments((current) =>
							current.map((entry) =>
								entry.id === id ? { ...entry, enabled } : entry,
							),
						);
						args.onExperimentChange?.(id, enabled);
					}}
				/>
			</Frame>
		);
	},
	args: { onExperimentChange: fn() },
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const light = () => canvas.getByRole("switch", { name: /Light mode/ });
		await expect(light()).not.toBeChecked();
		await userEvent.click(light());
		await waitFor(() => expect(light()).toBeChecked());
		await expect(args.onExperimentChange).toHaveBeenCalledWith(
			"light-mode-v1",
			true,
		);
		await expect(
			canvas.getByRole("switch", { name: /Threads in the channel/ }),
		).toBeChecked();
		await expectNoLayoutIssues(frameOf(canvasElement));
	},
};

export const ExperimentsEmpty: Story = {
	parameters: desktop,
	render: () => (
		<Frame platform="desktop">
			<ExperimentsSettings experiments={[]} />
		</Frame>
	),
	play: async ({ canvasElement }) => {
		await expect(
			within(canvasElement).getByText(
				"No experiments right now. Check back after the next update.",
			),
		).toBeVisible();
	},
};

const DID = "did:plc:mprdjqjluoswa7awzggaggj3";

const stubClipboard = () => {
	const writeText = fn(async (_value: string) => {});
	Object.defineProperty(navigator, "clipboard", {
		configurable: true,
		value: { writeText },
	});
	return writeText;
};

const SECTIONS: DiagnosticsSection[] = [
	{
		title: "App",
		fields: [
			{ kind: "value", label: "App version", value: "0.42.0" },
			{ kind: "value", label: "Runtime", value: "native" },
			{ kind: "value", label: "Build", value: "production" },
		],
	},
	{
		title: "Account",
		fields: [
			{ kind: "value", label: "DID", value: DID },
			{ kind: "value", label: "Handle", value: "lou.gg" },
			{
				kind: "list",
				label: "Granted access",
				items: ["Messages and reactions", "Profile", "Preferences"],
			},
			{ kind: "list", label: "Experiments", items: [] },
		],
	},
];

const DIAGNOSTICS_TEXT = "App\nApp version: 0.42.0";

export const DebugInformationPage: Story = {
	parameters: desktop,
	render: (args) => (
		<Frame platform="desktop">
			<DebugInformation
				sections={SECTIONS}
				copyValue={DIAGNOSTICS_TEXT}
				onCopy={args.onCopy}
			/>
		</Frame>
	),
	args: { onCopy: fn() },
	play: async ({ canvasElement, args }) => {
		const writeText = stubClipboard();
		const canvas = within(canvasElement);
		await expect(canvas.getByText(DID)).toBeVisible();
		await expect(canvas.getByText("None")).toBeVisible();
		const copy = canvas.getByRole("button", {
			name: "Copy debug information",
		});
		await userEvent.click(copy);
		await expect(writeText).toHaveBeenCalledWith(DIAGNOSTICS_TEXT);
		await expect(args.onCopy).toHaveBeenCalledOnce();
		await waitFor(() => expect(copy).toHaveTextContent("Copied"));
		await expectNoLayoutIssues(frameOf(canvasElement));
	},
};

export const DebugInformationGathering: Story = {
	render: () => (
		<Frame platform="mobile">
			<DebugInformation />
		</Frame>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText("Gathering information...")).toBeVisible();
		await expect(
			canvas.getByRole("button", { name: "Copy debug information" }),
		).toBeDisabled();
	},
};

const LINES: LogLine[] = [
	{
		time: "14:02:11",
		level: "info",
		scope: "live",
		message: "connected",
	},
	{
		time: "14:02:13",
		level: "warn",
		scope: "preferences",
		message: "could not save the notification level { code: NetworkFailed }",
	},
	{
		time: "14:02:20",
		level: "debug",
		scope: "message-cache",
		message:
			"restored 50 messages for at://did:plc:space/space/social.colibri.beta.channel.text/general",
	},
	{
		time: "14:03:01",
		level: "error",
		scope: "voice",
		message: "the microphone could not start { code: DeviceNotAllowed }",
	},
];

export const Logs: Story = {
	render: (args) => {
		const [verbose, setVerbose] = createSignal(false);
		return (
			<Frame platform="mobile">
				<LogsSettings
					lines={LINES}
					verbose={verbose()}
					onVerboseChange={(value) => {
						setVerbose(value);
						args.onVerboseChange?.(value);
					}}
					copyValue="14:02:11 info live connected"
				/>
			</Frame>
		);
	},
	args: { onVerboseChange: fn() },
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const log = canvas.getByRole("list", { name: "Log" });
		const levels = () =>
			[...log.querySelectorAll("li")].map((line) => line.dataset.level);
		await expect(levels()).toEqual(["error", "debug", "warn", "info"]);
		await userEvent.click(
			canvas.getByRole("radio", { name: "Warnings and errors" }),
		);
		await waitFor(() => expect(levels()).toEqual(["error", "warn"]));
		await userEvent.click(
			canvas.getByRole("switch", { name: /Detailed logging/ }),
		);
		await expect(args.onVerboseChange).toHaveBeenCalledWith(true);
		await expectNoLayoutIssues(frameOf(canvasElement));
	},
};

export const LogsQuiet: Story = {
	parameters: desktop,
	render: () => (
		<Frame platform="desktop">
			<LogsSettings lines={LINES.slice(0, 1)} verbose={false} />
		</Frame>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole("button", { name: "Copy logs" }),
		).toBeDisabled();
		await userEvent.click(
			canvas.getByRole("radio", { name: "Warnings and errors" }),
		);
		await waitFor(() =>
			expect(
				canvas.getByText(
					"No warnings or errors. Everything is running smoothly.",
				),
			).toBeVisible(),
		);
		const copy = canvas.getByRole("button", { name: "Copy logs" });
		const filter = canvas.getByRole("radio", { name: "Everything" });
		await expect(
			Math.abs(
				copy.getBoundingClientRect().top - filter.getBoundingClientRect().top,
			),
		).toBeLessThan(8);
		await expectNoLayoutIssues(frameOf(canvasElement));
	},
};

const NOTES: ReleaseNoteView[] = [
	{
		version: "0.42.0",
		date: "October 15, 2026",
		title: "Your settings, everywhere",
		items: [
			{
				kind: "feature",
				icon: <StarsIcon />,
				title: "Settings follow you",
				body: "Mutes, notification levels and your Space order now sync to every device you use.",
			},
			{
				kind: "fix",
				icon: <BugIcon />,
				title: "Threads open where you left them",
				body: "Going back from a thread no longer leaves it open on the side.",
			},
		],
	},
	{
		version: "0.41.0",
		date: "October 1, 2026",
		items: [
			{
				kind: "feature",
				icon: <ChatRoundLineIcon />,
				title: "Message toasts",
				body: "Mentions show up at the top of the screen while you're in another channel.",
			},
		],
	},
];

export const WhatsNew: Story = {
	render: () => (
		<Frame platform="mobile">
			<WhatsNewSettings notes={NOTES} />
		</Frame>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole("heading", { name: "Your settings, everywhere" }),
		).toBeVisible();
		await expect(
			canvas.getByText("Version 0.42.0, October 15, 2026"),
		).toBeVisible();
		await expect(canvas.getByRole("heading", { name: "New" })).toBeVisible();
		await expect(canvas.getByRole("heading", { name: "Fixed" })).toBeVisible();
		await expect(
			canvas.getByRole("heading", { name: "Version 0.41.0" }),
		).toBeVisible();
		const older = canvasElement.querySelector('[data-release-note="0.41.0"]');
		await expect(
			within(older as HTMLElement).queryByRole("heading", { name: "New" }),
		).toBeNull();
		await expect(
			canvas.getByRole("link", { name: "full release history" }),
		).toHaveAttribute("href", RELEASE_HISTORY_URL);
		await expectNoLayoutIssues(frameOf(canvasElement));
	},
};

export const WhatsNewEmpty: Story = {
	parameters: desktop,
	render: () => (
		<Frame platform="desktop">
			<WhatsNewSettings notes={[]} />
		</Frame>
	),
	play: async ({ canvasElement }) => {
		await expect(
			within(canvasElement).getByText(
				"Nothing here yet. New features show up here as they ship.",
			),
		).toBeVisible();
	},
};

const definition = (identifier: string) =>
	FALLBACK_BADGE_DEFINITIONS.find((entry) => entry.identifier === identifier) ??
	TEAM_BADGE_DEFINITION;

const TIERS: SupportTier[] = [
	{
		id: "backer-five",
		badge: <UserBadge definition={definition("backer-five")} size="sm" />,
		price: "$5",
		cadence: "/ month",
		blurb: "Keep the lights on and wear a badge for it on your profile.",
		href: "https://opencollective.com/colibri-social/contribute/backers-100302/checkout",
	},
	{
		id: "sponsor-twenty-five",
		badge: (
			<UserBadge definition={definition("sponsor-twenty-five")} size="sm" />
		),
		price: "$25",
		cadence: "/ month",
		blurb: "Seriously move the needle on development.",
		href: "https://opencollective.com/colibri-social/contribute/sponsor-100710/checkout",
		highlight: true,
	},
	{
		id: "donator",
		badge: <UserBadge definition={definition("donator")} size="sm" />,
		price: "Custom",
		cadence: "one-time",
		blurb: "Chip in any amount, whenever you like.",
		href: "https://opencollective.com/colibri-social/donate",
	},
];

const SupportStory = (
	props: Partial<SupportColibriSettingsProps> & {
		platform: Platform;
		link: SupporterLink;
	},
) => (
	<Frame platform={props.platform}>
		<SupportColibriSettings
			link={props.link}
			earnedBadges={props.earnedBadges}
			onConnect={props.onConnect}
			onDisconnect={props.onDisconnect}
			onRefresh={props.onRefresh}
			busy={props.busy}
			tiers={TIERS}
			preview={{
				name: "Lou",
				seed: DID,
				badge: (
					<UserBadge definition={definition("sponsor-twenty-five")} size="xs" />
				),
			}}
		/>
	</Frame>
);

export const SupportNotConnected: Story = {
	render: (args) => (
		<SupportStory
			platform="mobile"
			link={{ state: "none" }}
			onConnect={args.onConnect}
		/>
	),
	args: { onConnect: fn() },
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.queryByText("Thank you for supporting Colibri!"),
		).toBeNull();
		await userEvent.click(
			canvas.getByRole("button", { name: "Connect Open Collective" }),
		);
		await expect(args.onConnect).toHaveBeenCalledOnce();
		const tiers = [
			...canvasElement.querySelectorAll<HTMLElement>("[data-support-tier]"),
		];
		await expect(tiers).toHaveLength(3);
		const [first, second] = tiers.map((tier) => tier.getBoundingClientRect());
		await expect(second?.top).toBeGreaterThan(first?.bottom ?? 0);
		await expectNoLayoutIssues(frameOf(canvasElement));
	},
};

export const SupportConnected: Story = {
	parameters: desktop,
	render: (args) => (
		<SupportStory
			platform="desktop"
			link={{
				state: "connected",
				account: "lou",
				verifiedAt: "October 12, 2026",
			}}
			earnedBadges={[
				<UserBadge definition={definition("sponsor-twenty-five")} size="sm" />,
			]}
			onDisconnect={args.onDisconnect}
			onRefresh={args.onRefresh}
		/>
	),
	args: { onDisconnect: fn(), onRefresh: fn() },
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByText("Thank you for supporting Colibri!"),
		).toBeVisible();
		await expect(canvas.getByText("@lou")).toBeVisible();
		await expect(canvas.getByText("Checked October 12, 2026")).toBeVisible();
		await userEvent.click(canvas.getByRole("button", { name: "Check again" }));
		await expect(args.onRefresh).toHaveBeenCalledOnce();
		await userEvent.click(canvas.getByRole("button", { name: "Disconnect" }));
		await expect(args.onDisconnect).toHaveBeenCalledOnce();
		const tiers = [
			...canvasElement.querySelectorAll<HTMLElement>("[data-support-tier]"),
		].map((tier) => tier.getBoundingClientRect());
		await expect(Math.round(tiers[0]?.top ?? 0)).toBe(
			Math.round(tiers[2]?.top ?? 1),
		);
		await expect(Math.round(tiers[0]?.height ?? 0)).toBe(
			Math.round(tiers[1]?.height ?? 1),
		);
		await expectNoLayoutIssues(frameOf(canvasElement));
	},
};

export const SupportLoading: Story = {
	render: () => <SupportStory platform="mobile" link={{ state: "loading" }} />,
	play: async ({ canvasElement }) => {
		await expect(
			canvasElement.querySelector('[data-supporter-link="loading"]'),
		).toBeInTheDocument();
		await expect(
			within(canvasElement).queryByRole("button", {
				name: "Connect Open Collective",
			}),
		).toBeNull();
	},
};
