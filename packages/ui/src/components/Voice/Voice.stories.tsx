import { createSignal, For, type JSX, onCleanup } from "solid-js";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { HapticsProvider } from "../../utils/haptics";
import { storyImages } from "../Banner/story-images";
import { CallControls } from "./CallControls";
import { CallScreen } from "./CallScreen";
import type { VoiceParticipant } from "./shared";
import {
	VoiceGrid,
	VoiceTile,
	type VoiceTileData,
	voiceGridColumns,
} from "./VoiceGrid";
import {
	VoiceJoinDrawer,
	VoiceJoinPanel,
	VoiceParticipantRow,
} from "./VoiceJoin";
import {
	VoiceParticipantRowSkeleton,
	VoiceStatusPanelSkeleton,
	VoiceTileSkeleton,
} from "./VoiceSkeletons";
import {
	type VoiceConnectionQuality,
	type VoiceConnectionState,
	VoiceStatusPanel,
} from "./VoiceStatusPanel";

const meta = {
	title: "Voice/Call",
	parameters: { viewport: { defaultViewport: "iphone" }, layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const haptics = {
	impact: fn(),
	selection: fn(),
	notification: fn(),
};

const Screen = (props: { children: JSX.Element; class?: string }) => (
	<HapticsProvider haptics={haptics}>
		<div
			class={
				props.class ??
				"flex min-h-dvh flex-col gap-6 bg-popover p-4 text-foreground"
			}
		>
			{props.children}
		</div>
	</HapticsProvider>
);

const Label = (props: { children: JSX.Element }) => (
	<p class="m-0 text-sm font-medium text-muted-foreground">{props.children}</p>
);

const people: VoiceParticipant[] = [
	{
		id: "lou",
		name: "Lou",
		avatarSrc: storyImages.violetIcon(),
		color: "linear-gradient(135deg, #9c66ff, #5b21b6)",
		presence: "online",
		speaking: true,
	},
	{
		id: "lis",
		name: "Lis",
		avatarSrc: storyImages.tealIcon(),
		presence: "online",
		muted: true,
	},
	{
		id: "tim",
		name: "Tim",
		avatarSrc: storyImages.amberIcon(),
		presence: "idle",
		deafened: true,
		muted: true,
	},
	{ id: "kris", name: "Kris", presence: "online", serverMuted: true },
	{ id: "ana", name: "Ana", color: "#0f766e", presence: "online" },
	{ id: "ben", name: "Ben", color: "#7c2d12", presence: "dnd" },
	{ id: "cam", name: "Cam", presence: "online", speaking: true },
];

const fakeCamera = (label: string, hue: number) => {
	const canvas = document.createElement("canvas");
	canvas.width = 320;
	canvas.height = 180;
	const context = canvas.getContext("2d");
	let frame = 0;
	let raf = 0;
	const draw = () => {
		if (!context) return;
		frame += 1;
		const gradient = context.createLinearGradient(0, 0, 320, 180);
		gradient.addColorStop(0, `hsl(${(hue + frame) % 360} 70% 45%)`);
		gradient.addColorStop(1, `hsl(${(hue + frame + 60) % 360} 70% 25%)`);
		context.fillStyle = gradient;
		context.fillRect(0, 0, 320, 180);
		context.fillStyle = "rgba(255,255,255,0.9)";
		context.font = "600 20px sans-serif";
		context.fillText(label, 16, 32);
		raf = requestAnimationFrame(draw);
	};
	draw();
	const stream = canvas.captureStream(24);
	onCleanup(() => {
		cancelAnimationFrame(raf);
		for (const track of stream.getTracks()) track.stop();
	});
	return stream;
};

const toggles = {
	mute: fn(),
	deafen: fn(),
	camera: fn(),
	screen: fn(),
	chat: fn(),
	leave: fn(),
};

const ControlsDemo = () => {
	const [muted, setMuted] = createSignal(false);
	const [deafened, setDeafened] = createSignal(false);
	const [cameraOn, setCameraOn] = createSignal(false);
	const [sharing, setSharing] = createSignal(false);
	return (
		<Screen>
			<Label>Interactive</Label>
			<div data-testid="live-controls">
				<CallControls
					muted={muted()}
					deafened={deafened()}
					cameraOn={cameraOn()}
					screenSharing={sharing()}
					onToggleMute={() => {
						toggles.mute();
						setMuted((value) => !value);
					}}
					onToggleDeafen={() => {
						toggles.deafen();
						setDeafened((value) => !value);
					}}
					onToggleCamera={() => {
						toggles.camera();
						setCameraOn((value) => !value);
					}}
					onOpenChat={toggles.chat}
					onLeave={toggles.leave}
				/>
			</div>
			<Label>Desktop size with screen share</Label>
			<CallControls
				size="lg"
				onToggleMute={() => {}}
				onToggleDeafen={() => {}}
				onToggleCamera={() => {}}
				onToggleScreenShare={() => setSharing((value) => !value)}
				screenSharing={sharing()}
				onLeave={() => {}}
			/>
			<Label>Moderator muted and deafened</Label>
			<div data-testid="server-controls">
				<CallControls
					serverMuted
					serverDeafened
					onToggleMute={() => {}}
					onToggleDeafen={() => {}}
					onLeave={() => {}}
				/>
			</div>
		</Screen>
	);
};

export const Controls: Story = {
	render: () => <ControlsDemo />,
	play: async ({ canvasElement }) => {
		haptics.selection.mockClear();
		toggles.mute.mockClear();
		const live = within(within(canvasElement).getByTestId("live-controls"));
		const mute = live.getByRole("button", { name: "Mute" });
		await expect(mute).toHaveAttribute("aria-pressed", "false");
		await expect(mute.querySelector("[data-slashed]")).toHaveAttribute(
			"data-slashed",
			"off",
		);
		await userEvent.click(mute);
		const unmute = live.getByRole("button", { name: "Unmute" });
		await expect(unmute).toHaveAttribute("aria-pressed", "true");
		await expect(unmute.querySelector("[data-slashed]")).toHaveAttribute(
			"data-slashed",
			"on",
		);
		await expect(toggles.mute).toHaveBeenCalledTimes(1);
		await expect(haptics.selection).toHaveBeenCalledTimes(1);

		const deafen = live.getByRole("button", { name: "Deafen" });
		await userEvent.click(deafen);
		await expect(
			live.getByRole("button", { name: "Undeafen" }),
		).toHaveAttribute("aria-pressed", "true");

		await userEvent.click(live.getByRole("button", { name: "Turn on camera" }));
		await expect(
			live.getByRole("button", { name: "Turn off camera" }),
		).toHaveAttribute("aria-pressed", "true");

		const server = within(within(canvasElement).getByTestId("server-controls"));
		const serverMic = server.getByRole("button", {
			name: "Muted by a moderator",
		});
		await expect(serverMic).toBeDisabled();
		await expect(serverMic).toHaveAttribute("data-tone", "server");
		await expect(
			server.getByRole("button", { name: "Deafened by a moderator" }),
		).toBeDisabled();
	},
};

const tilesFor = (count: number, withCamera = false): VoiceTileData[] =>
	people.slice(0, count).map((person, index) => ({
		...person,
		stream:
			withCamera && index === 1
				? fakeCamera(`${person.name} camera`, 200)
				: undefined,
	}));

const GridFrame = (props: { count: number; camera?: boolean }) => (
	<section
		aria-label={`${props.count} participants`}
		data-testid={`grid-${props.count}`}
		class="flex flex-col gap-2"
	>
		<Label>{`${props.count} ${props.count === 1 ? "participant" : "participants"}`}</Label>
		<div class="h-64 rounded-surface border border-border bg-background p-3">
			<VoiceGrid tiles={tilesFor(props.count, props.camera)} />
		</div>
	</section>
);

export const Grid: Story = {
	render: () => (
		<Screen>
			<GridFrame count={1} />
			<GridFrame count={2} camera />
			<GridFrame count={4} />
			<GridFrame count={7} />
		</Screen>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		for (const count of [1, 2, 4, 7]) {
			const grid = canvas
				.getByTestId(`grid-${count}`)
				.querySelector("[data-voice-grid]") as HTMLElement;
			await expect(grid).toHaveAttribute(
				"data-columns",
				String(voiceGridColumns(count)),
			);
			await expect(grid.querySelectorAll("[data-voice-tile]").length).toBe(
				count,
			);
		}
		await expect(voiceGridColumns(1)).toBe(1);
		await expect(voiceGridColumns(6)).toBe(2);
		await expect(voiceGridColumns(7)).toBe(3);
		const four = canvas.getByTestId("grid-4");
		const lou = within(four).getByRole("figure", { name: "Lou, speaking" });
		await expect(lou).toHaveAttribute("data-speaking");
		await expect(
			within(four).getByRole("figure", { name: "Lis" }),
		).not.toHaveAttribute("data-speaking");
		await waitFor(() => {
			const tile = lou.getBoundingClientRect();
			expect(Math.round((tile.width / tile.height) * 9)).toBe(16);
		});
		const camera = canvas
			.getByTestId("grid-2")
			.querySelector("video[data-video-surface]");
		await expect(camera).not.toBeNull();
	},
};

const FocusDemo = () => {
	const [focused, setFocused] = createSignal<string | null>(null);
	const tiles = tilesFor(4);
	return (
		<Screen>
			<div class="h-96 rounded-surface border border-border bg-background p-3">
				<VoiceGrid
					tiles={tiles}
					focusedKey={focused()}
					onFocusChange={setFocused}
				/>
			</div>
		</Screen>
	);
};

export const FocusTile: Story = {
	render: () => <FocusDemo />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole("button", { name: /^Lis\b(?!.*focused)/ }),
		);
		const focused = canvas.getByRole("button", { name: /^Lis\b.*focused/ });
		await expect(focused).toHaveAttribute("aria-pressed", "true");
		await expect(
			canvasElement.querySelector("[data-voice-strip]"),
		).not.toBeNull();
		await userEvent.click(focused);
		await expect(
			canvas.getByRole("button", { name: /^Lis\b(?!.*focused)/ }),
		).toHaveAttribute("aria-pressed", "false");
	},
};

const join = { onJoin: fn(), onOpenChat: fn(), onOpenSettings: fn() };

const JoinDemo = (props: { participants?: VoiceParticipant[] }) => {
	const [joinMuted, setJoinMuted] = createSignal(false);
	return (
		<VoiceJoinPanel
			channelName="Hangout"
			participants={props.participants}
			joinMuted={joinMuted()}
			onJoinMutedChange={setJoinMuted}
			onJoin={join.onJoin}
			onOpenChat={join.onOpenChat}
			onOpenSettings={join.onOpenSettings}
			onClose={() => {}}
		/>
	);
};

export const JoinPanels: Story = {
	render: () => (
		<Screen>
			<Label>Empty</Label>
			<div data-testid="join-empty" class="rounded-t-sheet bg-popover">
				<JoinDemo />
			</div>
			<Label>With participants</Label>
			<div data-testid="join-full" class="rounded-t-sheet bg-popover">
				<JoinDemo participants={people.slice(0, 3)} />
			</div>
			<Label>Loading</Label>
			<div class="flex flex-col gap-2">
				<VoiceParticipantRowSkeleton />
				<VoiceParticipantRowSkeleton nameWidth="30%" />
			</div>
		</Screen>
	),
	play: async ({ canvasElement }) => {
		join.onJoin.mockClear();
		const empty = within(within(canvasElement).getByTestId("join-empty"));
		await expect(
			empty.getByText(
				"This voice channel is empty. Join to get the conversation started!",
			),
		).toBeInTheDocument();
		const toggle = empty.getByRole("button", { name: "Join muted" });
		await expect(toggle).toHaveAttribute("aria-pressed", "false");
		await userEvent.click(toggle);
		await expect(toggle).toHaveAttribute("aria-pressed", "true");
		await expect(toggle.querySelector("[data-slashed]")).toHaveAttribute(
			"data-slashed",
			"on",
		);
		await userEvent.click(empty.getByRole("button", { name: "Join voice" }));
		await expect(join.onJoin).toHaveBeenCalledTimes(1);

		const full = within(within(canvasElement).getByTestId("join-full"));
		const list = full.getByRole("list", { name: "In Hangout" });
		await expect(within(list).getAllByRole("listitem")).toHaveLength(3);
		await expect(
			list.querySelector("[data-voice-participant][data-speaking]"),
		).not.toBeNull();
		await expect(
			full.getAllByRole("img", { name: "Muted" }).length,
		).toBeGreaterThan(0);
	},
};

export const JoinDrawer: Story = {
	render: () => (
		<Screen>
			<VoiceJoinDrawer
				initialOpen
				channelName="Hangout"
				participants={people.slice(0, 2)}
				onJoin={() => {}}
				onOpenChat={() => {}}
				onOpenSettings={() => {}}
			/>
		</Screen>
	),
	play: async () => {
		const dialog = await screen.findByRole("dialog", { name: "Join Hangout" });
		await waitFor(() =>
			expect(
				within(dialog).getByRole("button", { name: "Join voice" }),
			).toBeVisible(),
		);
	},
};

const CallDemo = () => {
	const [muted, setMuted] = createSignal(false);
	const [deafened, setDeafened] = createSignal(false);
	const [cameraOn, setCameraOn] = createSignal(false);
	const [focused, setFocused] = createSignal<string | null>(null);
	return (
		<HapticsProvider haptics={haptics}>
			<div class="h-dvh">
				<CallScreen
					channelName="Hangout"
					tiles={[people[0] as VoiceTileData]}
					focusedKey={focused()}
					onFocusChange={setFocused}
					muted={muted()}
					deafened={deafened()}
					cameraOn={cameraOn()}
					onToggleMute={() => setMuted((value) => !value)}
					onToggleDeafen={() => setDeafened((value) => !value)}
					onToggleCamera={() => setCameraOn((value) => !value)}
					onOpenChat={() => {}}
					onLeave={toggles.leave}
					onClose={() => {}}
					onOpenSettings={() => {}}
				/>
			</div>
		</HapticsProvider>
	);
};

export const MobileCallScreen: Story = {
	render: () => <CallDemo />,
	play: async ({ canvasElement }) => {
		toggles.leave.mockClear();
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole("toolbar", { name: "Call controls" }),
		).toBeInTheDocument();
		await userEvent.click(canvas.getByRole("button", { name: "Leave call" }));
		await expect(toggles.leave).toHaveBeenCalledTimes(1);
		await expect(
			canvas.getByRole("heading", { name: "Hangout" }),
		).toBeVisible();
	},
};

const statuses: {
	state: VoiceConnectionState;
	quality: VoiceConnectionQuality;
	latency?: number;
}[] = [
	{ state: "connected", quality: "excellent", latency: 24 },
	{ state: "connected", quality: "good", latency: 68 },
	{ state: "connected", quality: "poor", latency: 310 },
	{ state: "reconnecting", quality: "lost" },
	{ state: "connecting", quality: "unknown" },
	{ state: "disconnected", quality: "lost" },
];

const disconnect = fn();

export const StatusPanel: Story = {
	parameters: { viewport: { defaultViewport: "responsive" } },
	render: () => (
		<Screen class="flex min-h-dvh flex-col gap-4 bg-background p-4 text-foreground">
			<div class="flex w-72 flex-col gap-4">
				<For each={statuses}>
					{(status) => (
						<div
							data-testid={`status-${status.state}-${status.quality}`}
							class="rounded-control-lg bg-card"
						>
							<VoiceStatusPanel
								{...status}
								channelName="Hangout"
								spaceName="Colibri Social Flock"
								muted={status.quality === "good"}
								deafened={status.quality === "poor"}
								cameraOn={status.quality === "excellent"}
								onDisconnect={disconnect}
								onToggleMute={() => {}}
								onToggleDeafen={() => {}}
								onToggleCamera={() => {}}
								onToggleScreenShare={() => {}}
							/>
						</div>
					)}
				</For>
				<div data-testid="status-server" class="rounded-control-lg bg-card">
					<VoiceStatusPanel
						state="connected"
						quality="excellent"
						latency={30}
						channelName="Hangout"
						spaceName="Colibri Social Flock"
						serverMuted
						serverDeafened
						onDisconnect={() => {}}
						onShowOverlay={() => {}}
					/>
				</div>
				<div class="rounded-control-lg bg-card">
					<VoiceStatusPanelSkeleton />
				</div>
			</div>
		</Screen>
	),
	play: async ({ canvasElement }) => {
		disconnect.mockClear();
		const canvas = within(canvasElement);
		const excellent = within(canvas.getByTestId("status-connected-excellent"));
		await expect(excellent.getByRole("status")).toHaveTextContent(
			"Voice connected",
		);
		await expect(
			excellent.getByText("Hangout · Colibri Social Flock"),
		).toBeVisible();
		await userEvent.click(
			excellent.getByRole("button", { name: "Disconnect" }),
		);
		await expect(disconnect).toHaveBeenCalledTimes(1);
		await expect(
			within(canvas.getByTestId("status-reconnecting-lost")).getByRole(
				"status",
			),
		).toHaveTextContent("Connecting...");
		await expect(
			within(canvas.getByTestId("status-disconnected-lost")).getByRole(
				"status",
			),
		).toHaveTextContent("Voice disconnected");
		const server = within(canvas.getByTestId("status-server"));
		await expect(
			server.getByRole("button", { name: "Muted by a moderator" }),
		).toBeDisabled();
	},
};

const SizeRow = (props: { real: JSX.Element; skeleton: JSX.Element }) => (
	<div class="flex flex-col gap-2">
		<div data-real="">{props.real}</div>
		<div data-skeleton-copy="">{props.skeleton}</div>
	</div>
);

export const SkeletonParity: Story = {
	parameters: { viewport: { defaultViewport: "responsive" } },
	render: () => (
		<Screen class="flex w-80 flex-col gap-6 bg-popover p-4 text-foreground">
			<div data-testid="pair-row">
				<SizeRow
					real={
						<ul class="m-0 list-none p-0">
							<VoiceParticipantRow
								participant={people[1] as VoiceParticipant}
							/>
						</ul>
					}
					skeleton={<VoiceParticipantRowSkeleton />}
				/>
			</div>
			<div data-testid="pair-tile">
				<SizeRow
					real={
						<VoiceTile
							tile={people[2] as VoiceTileData}
							class="h-[158px] w-[280px]"
						/>
					}
					skeleton={<VoiceTileSkeleton class="h-[158px] w-[280px]" />}
				/>
			</div>
			<div data-testid="pair-status">
				<SizeRow
					real={
						<VoiceStatusPanel
							state="connected"
							quality="good"
							channelName="Hangout"
							spaceName="Colibri"
						/>
					}
					skeleton={<VoiceStatusPanelSkeleton />}
				/>
			</div>
		</Screen>
	),
	play: async ({ canvasElement }) => {
		for (const id of ["pair-row", "pair-tile", "pair-status"]) {
			const pair = within(canvasElement).getByTestId(id);
			const real = (pair.querySelector("[data-real]") as HTMLElement)
				.firstElementChild as HTMLElement;
			const copy = (pair.querySelector("[data-skeleton-copy]") as HTMLElement)
				.firstElementChild as HTMLElement;
			const a = real.getBoundingClientRect();
			const b = copy.getBoundingClientRect();
			await expect(Math.abs(a.width - b.width)).toBeLessThanOrEqual(1);
			await expect(Math.abs(a.height - b.height)).toBeLessThanOrEqual(1);
		}
	},
};

const manyPeople: VoiceParticipant[] = Array.from(
	{ length: 12 },
	(_, index) => {
		const base = people[index % people.length] as VoiceParticipant;
		return {
			...base,
			id: `${base.id}-${index}`,
			name: `${base.name} ${index + 1}`,
		};
	},
);

const insideTile = (
	tile: Element,
	padding: number,
): { avatar: boolean; label: boolean } => {
	const box = tile.getBoundingClientRect();
	const avatar = tile
		.querySelector("[data-tile-avatar-area] > span")
		?.getBoundingClientRect();
	const label = tile
		.querySelector("[data-tile-label]")
		?.getBoundingClientRect();
	const within = (rect: DOMRect | undefined, inset: number) =>
		!!rect &&
		rect.left >= box.left + inset - 0.5 &&
		rect.right <= box.right - inset + 0.5 &&
		rect.top >= box.top + inset - 0.5 &&
		rect.bottom <= box.bottom - inset + 0.5;
	return { avatar: within(avatar, padding), label: within(label, 0) };
};

const TinyFocusDemo = () => {
	const tiles = tilesFor(5);
	const [focused, setFocused] = createSignal<string | null>("p:lou");
	return (
		<div
			data-testid="tiny-focus"
			class="h-[300px] w-[360px] overflow-hidden bg-background"
		>
			<VoiceGrid
				tiles={tiles}
				focusedKey={focused()}
				onFocusChange={setFocused}
			/>
		</div>
	);
};

export const TileAvatarFit: Story = {
	render: () => (
		<Screen>
			<Label>Seven tiles in 360 by 240</Label>
			<div
				data-testid="tiny-grid"
				class="h-[240px] w-[360px] overflow-hidden bg-background"
			>
				<VoiceGrid tiles={tilesFor(7)} />
			</div>
			<Label>Focus strip</Label>
			<TinyFocusDemo />
			<Label>Large tile</Label>
			<div data-testid="large-tile">
				<VoiceTile
					tile={people[0] as VoiceTileData}
					class="h-[220px] w-[370px]"
				/>
			</div>
		</Screen>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const grid = canvas.getByTestId("tiny-grid");
		await waitFor(() => {
			const tiles = grid.querySelectorAll("[data-voice-tile]");
			expect(tiles.length).toBe(7);
			for (const tile of tiles) {
				const fit = insideTile(tile, 12);
				expect(fit.avatar).toBe(true);
				expect(fit.label).toBe(true);
			}
		});
		const strip = canvas
			.getByTestId("tiny-focus")
			.querySelector("[data-voice-strip]") as HTMLElement;
		await waitFor(() => {
			const tiles = strip.querySelectorAll("[data-voice-tile]");
			expect(tiles.length).toBe(4);
			for (const tile of tiles) {
				expect(insideTile(tile, 8).avatar).toBe(true);
			}
		});
		const large = canvas
			.getByTestId("large-tile")
			.querySelector("[data-tile-avatar-area] > span") as HTMLElement;
		await waitFor(() =>
			expect(Math.round(large.getBoundingClientRect().width)).toBe(88),
		);
	},
};

const setInsets = (insets: Record<string, number> | null) => {
	const style = document.documentElement.style;
	for (const side of ["top", "bottom", "left", "right"]) {
		if (insets)
			style.setProperty(`--safe-area-${side}`, `${insets[side] ?? 0}px`);
		else style.removeProperty(`--safe-area-${side}`);
	}
};

export const JoinDrawerCrowded: Story = {
	render: () => (
		<Screen>
			<VoiceJoinDrawer
				initialOpen
				channelName="Lounge"
				participants={manyPeople}
				onJoin={() => {}}
				onOpenChat={() => {}}
				onOpenSettings={() => {}}
			/>
		</Screen>
	),
	play: async () => {
		setInsets({ top: 62, bottom: 34 });
		try {
			const dialog = await screen.findByRole("dialog", { name: "Join Lounge" });
			const joinButton = within(dialog).getByRole("button", {
				name: "Join voice",
			});
			const chat = within(dialog).getByRole("button", { name: "Open chat" });
			await waitFor(() => {
				const join = joinButton.getBoundingClientRect();
				expect(join.height).toBeGreaterThan(0);
				expect(join.bottom).toBeLessThanOrEqual(window.innerHeight - 34 + 0.5);
				expect(join.top).toBeGreaterThanOrEqual(62);
				expect(chat.getBoundingClientRect().right).toBeLessThanOrEqual(
					window.innerWidth + 0.5,
				);
			});
			const list = dialog.querySelector(
				"[data-voice-join-list]",
			) as HTMLElement;
			await expect(list.querySelectorAll("li").length).toBe(12);
			const scroller = dialog.querySelector(
				"[data-drawer-scroll]",
			) as HTMLElement;
			scroller.scrollTop = scroller.scrollHeight;
			await waitFor(() => {
				const join = joinButton.getBoundingClientRect();
				expect(join.bottom).toBeLessThanOrEqual(window.innerHeight - 34 + 0.5);
			});
			const footer = dialog.querySelector(
				"[data-drawer-footer]",
			) as HTMLElement;
			await expect(footer).not.toBeNull();
			await expect(footer.contains(joinButton)).toBe(true);
			await expect(scroller.contains(footer)).toBe(false);
			const footerBox = footer.getBoundingClientRect();
			const scrollBox = scroller.getBoundingClientRect();
			await expect(scrollBox.bottom).toBeLessThanOrEqual(footerBox.top + 0.5);
			const sampleXs = [
				footerBox.left + 24,
				footerBox.left + footerBox.width / 2,
			];
			for (let y = footerBox.top + 1; y < window.innerHeight; y += 6) {
				for (const x of sampleXs) {
					const hit = document.elementFromPoint(x, y);
					if (!hit) continue;
					await expect(hit.closest("[data-voice-participant]")).toBeNull();
					await expect(list.contains(hit)).toBe(false);
				}
			}
		} finally {
			setInsets(null);
		}
	},
};

export const JoinPanelNarrow: Story = {
	render: () => (
		<Screen class="w-[320px] bg-popover p-4 text-foreground">
			<div data-testid="narrow-join">
				<JoinDemo participants={people.slice(0, 2)} />
			</div>
		</Screen>
	),
	play: async ({ canvasElement }) => {
		const box = within(canvasElement).getByTestId("narrow-join");
		const frame = box.getBoundingClientRect();
		for (const name of ["Join muted", "Join voice", "Open chat"]) {
			const rect = within(box)
				.getByRole("button", { name })
				.getBoundingClientRect();
			await expect(rect.left).toBeGreaterThanOrEqual(frame.left - 0.5);
			await expect(rect.right).toBeLessThanOrEqual(frame.right + 0.5);
		}
	},
};
