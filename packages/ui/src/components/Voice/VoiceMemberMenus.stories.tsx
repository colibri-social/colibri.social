import { createSignal, onCleanup } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { expectNoLayoutIssues } from "../../foundations/layout-test";
import { Button } from "../Button/Button";
import { VoiceChannelRow } from "../Channels/ChannelRow";
import { VoiceChannelContextMenu } from "../ContextMenu/ChannelMenu";
import { MemberContextMenu } from "../ContextMenu/MemberMenu";
import type { CameraPreviewState } from "../SettingsPages/VoiceVideoSettings";
import { CameraPreviewDialog } from "./CameraPreviewDialog";
import type { VoiceParticipant } from "./shared";
import { VoiceGrid, type VoiceTileData } from "./VoiceGrid";
import { VoiceJoinRoster } from "./VoiceJoin";

const meta = {
	title: "Voice/Member menus",
	parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const spy = {
	viewProfile: fn(),
	volume: fn(),
	tileMenu: fn(),
	rowMenu: fn(),
	rowOpen: fn(),
	turnOn: fn(),
	openChat: fn(),
};

const resetSpies = () => {
	for (const value of Object.values(spy)) value.mockClear();
};

const testStream = () => {
	const canvas = document.createElement("canvas");
	canvas.width = 320;
	canvas.height = 180;
	const context = canvas.getContext("2d");
	let frame = 0;
	const paint = () => {
		if (!context) return;
		context.fillStyle = "#5b21b6";
		context.fillRect(0, 0, canvas.width, canvas.height);
		context.fillStyle = "#ffd857";
		context.fillRect((frame * 4) % canvas.width, 60, 60, 60);
		frame += 1;
	};
	paint();
	const timer = setInterval(paint, 100);
	onCleanup(() => clearInterval(timer));
	return canvas.captureStream(10);
};

const participants: VoiceParticipant[] = [
	{ id: "did:plc:lou", name: "Lou", presence: "online" },
	{ id: "did:plc:wren", name: "Wren", presence: "online", muted: true },
	{ id: "did:plc:finch", name: "Finch", presence: "idle", serverMuted: true },
];

const rightClick = (element: Element) => {
	const rect = element.getBoundingClientRect();
	element.dispatchEvent(
		new MouseEvent("contextmenu", {
			bubbles: true,
			cancelable: true,
			button: 2,
			clientX: rect.left + rect.width / 2,
			clientY: rect.top + rect.height / 2,
		}),
	);
};

const TileMenuDemo = () => {
	const stream = testStream();
	const [volume, setVolume] = createSignal(100);
	const tiles = (): VoiceTileData[] => [
		{ ...participants[0], stream, mirror: true },
		participants[1],
		participants[2],
	];
	return (
		<div class="flex h-dvh flex-col bg-card p-4">
			<VoiceGrid
				tiles={tiles()}
				tileMenu={(tile, element) => (
					<MemberContextMenu
						name={tile.name}
						class="contents"
						onViewProfile={spy.viewProfile}
						voice={
							tile.id === "did:plc:lou"
								? undefined
								: {
										get volume() {
											return volume();
										},
										onVolumeChange: (value) => {
											spy.volume(tile.id, value);
											setVolume(value);
										},
									}
						}
					>
						{element}
					</MemberContextMenu>
				)}
			/>
		</div>
	);
};

export const TileMemberMenu: Story = {
	parameters: { viewport: { defaultViewport: "responsive" } },
	render: () => <TileMenuDemo />,
	play: async ({ canvasElement }) => {
		resetSpies();
		const tiles =
			canvasElement.querySelectorAll<HTMLElement>("[data-voice-tile]");
		await expect(tiles).toHaveLength(3);
		await expect(tiles[0].querySelector("video")).not.toBeNull();
		const grid = canvasElement.querySelector(
			"[data-voice-grid]",
		) as HTMLElement;
		await expectNoLayoutIssues(grid);
		const menu = await waitFor(() => {
			if (!screen.queryByRole("menu", { name: "Wren options" })) {
				rightClick(tiles[1]);
			}
			return screen.getByRole("menu", { name: "Wren options" });
		});
		await expectNoLayoutIssues(menu);
		const volume = within(menu).getByRole("slider", { name: "Volume" });
		volume.focus();
		await userEvent.keyboard("{ArrowLeft}");
		await waitFor(() =>
			expect(spy.volume).toHaveBeenLastCalledWith("did:plc:wren", 99),
		);
		await userEvent.click(
			within(menu).getByRole("menuitem", { name: "View profile" }),
		);
		await expect(spy.viewProfile).toHaveBeenCalledTimes(1);
		await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
	},
};

export const TileMenuGesture: Story = {
	parameters: { viewport: { defaultViewport: "iphone" } },
	render: () => (
		<div class="flex h-dvh flex-col bg-card p-4">
			<VoiceGrid
				portrait
				tiles={participants}
				onTileMenu={(tile) => spy.tileMenu(tile.id)}
			/>
		</div>
	),
	play: async ({ canvasElement }) => {
		resetSpies();
		const tile = canvasElement.querySelectorAll("[data-voice-tile]")[2];
		rightClick(tile);
		await expect(spy.tileMenu).toHaveBeenCalledWith("did:plc:finch");
	},
};

export const RosterMenus: Story = {
	parameters: { viewport: { defaultViewport: "iphone" } },
	render: () => (
		<div class="flex h-dvh flex-col bg-card p-4">
			<VoiceJoinRoster
				channelName="Birdwatch call"
				participants={participants}
				onOpenParticipant={spy.rowOpen}
				onParticipantMenu={spy.rowMenu}
			/>
		</div>
	),
	play: async ({ canvasElement }) => {
		resetSpies();
		const rows = canvasElement.querySelectorAll("[data-voice-participant]");
		rightClick(rows[1]);
		await expect(spy.rowMenu).toHaveBeenCalledWith("did:plc:wren");
		await userEvent.click(
			within(rows[0] as HTMLElement).getByRole("button", { name: /Lou/ }),
		);
		await expect(spy.rowOpen).toHaveBeenCalledWith("did:plc:lou");
		await expect(spy.rowMenu).toHaveBeenCalledTimes(1);
	},
};

const PreviewDemo = (props: {
	state: CameraPreviewState;
	inCall?: boolean;
	cameraOn?: boolean;
}) => {
	const [open, setOpen] = createSignal(false);
	const stream = props.state === "ready" ? testStream() : undefined;
	return (
		<div class="min-h-dvh bg-background p-4">
			<Button variant="secondary" onClick={() => setOpen(true)}>
				Preview camera
			</Button>
			<CameraPreviewDialog
				open={open()}
				onOpenChange={setOpen}
				stream={stream}
				state={props.state}
				cameraOn={props.cameraOn}
				onTurnOnCamera={props.inCall ? spy.turnOn : undefined}
			/>
		</div>
	);
};

const openPreview = async (canvasElement: HTMLElement) => {
	await userEvent.click(
		within(canvasElement).getByRole("button", { name: "Preview camera" }),
	);
	const dialog = await screen.findByRole("dialog", { name: "Camera preview" });
	await waitFor(() => expect(dialog).toBeVisible());
	await new Promise((resolve) => setTimeout(resolve, 300));
	return dialog;
};

export const CameraPreview: Story = {
	parameters: { viewport: { defaultViewport: "iphone" } },
	render: () => <PreviewDemo state="ready" inCall />,
	play: async ({ canvasElement }) => {
		resetSpies();
		const dialog = await openPreview(canvasElement);
		await expectNoLayoutIssues(dialog);
		const video = dialog.querySelector("video") as HTMLVideoElement;
		await expect(video).not.toBeNull();
		await expect(video.className).toContain("-scale-x-100");
		await userEvent.click(
			within(dialog).getByRole("button", { name: "Turn on camera" }),
		);
		await expect(spy.turnOn).toHaveBeenCalledTimes(1);
	},
};

export const CameraPreviewCameraOn: Story = {
	parameters: { viewport: { defaultViewport: "iphone" } },
	render: () => <PreviewDemo state="ready" inCall cameraOn />,
	play: async ({ canvasElement }) => {
		const dialog = await openPreview(canvasElement);
		await expectNoLayoutIssues(dialog);
		await expect(
			within(dialog).getByRole("button", { name: "Your camera is on" }),
		).toBeDisabled();
	},
};

export const CameraPreviewError: Story = {
	parameters: { viewport: { defaultViewport: "iphone" } },
	render: () => <PreviewDemo state="error" />,
	play: async ({ canvasElement }) => {
		const dialog = await openPreview(canvasElement);
		await expectNoLayoutIssues(dialog);
		await expect(
			within(dialog).getByText("Your camera didn't start."),
		).toBeVisible();
		await expect(
			within(dialog).queryByRole("button", { name: /camera/ }),
		).toBeNull();
		await expect(dialog.querySelector("video")).toBeNull();
	},
};

export const ChannelRowParticipantMenu: Story = {
	parameters: { viewport: { defaultViewport: "responsive" } },
	render: () => (
		<div class="min-h-dvh w-72 bg-card p-2">
			<VoiceChannelContextMenu
				name="Birdwatch call"
				connected
				onConnectedChange={() => {}}
				onOpenChat={spy.openChat}
			>
				<VoiceChannelRow
					name="Birdwatch call"
					platform="desktop"
					joined
					participants={participants}
					onOpenParticipant={spy.rowOpen}
					participantMenu={(participant, row) => (
						<MemberContextMenu
							name={participant.name}
							class="contents"
							onViewProfile={spy.viewProfile}
						>
							{row}
						</MemberContextMenu>
					)}
				/>
			</VoiceChannelContextMenu>
		</div>
	),
	play: async ({ canvasElement }) => {
		resetSpies();
		const row = canvasElement
			.querySelectorAll("[data-voice-participant]")[1]
			.querySelector("button") as HTMLElement;
		const menu = await waitFor(() => {
			if (!screen.queryByRole("menu", { name: "Wren options" })) {
				rightClick(row);
			}
			return screen.getByRole("menu", { name: "Wren options" });
		});
		await expectNoLayoutIssues(menu);
		await expect(
			screen.queryByRole("menu", { name: "Birdwatch call options" }),
		).toBeNull();
		await userEvent.click(
			within(menu).getByRole("menuitem", { name: "View profile" }),
		);
		await expect(spy.viewProfile).toHaveBeenCalledTimes(1);
	},
};

export const ChannelRowParticipantGesture: Story = {
	parameters: { viewport: { defaultViewport: "iphone" } },
	render: () => (
		<div class="min-h-dvh bg-card p-2">
			<VoiceChannelRow
				name="Birdwatch call"
				platform="mobile"
				participants={participants}
				onOpenParticipant={spy.rowOpen}
				onParticipantMenu={spy.rowMenu}
			/>
		</div>
	),
	play: async ({ canvasElement }) => {
		resetSpies();
		const rows = canvasElement.querySelectorAll("[data-voice-participant]");
		rightClick(rows[2]);
		await expect(spy.rowMenu).toHaveBeenCalledWith("did:plc:finch");
	},
};
