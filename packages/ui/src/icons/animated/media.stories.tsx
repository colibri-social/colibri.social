import { EndCallRoundedIcon } from "@solar-icons/solid/bold/end-call-rounded";
import { createSignal, For, type JSX } from "solid-js";
import { expect, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { Button } from "../../components/Button/Button";
import { IconButton } from "../../components/IconButton/IconButton";
import { HeadphonesSlashIcon } from "../custom";
import { AnimatedMicrophoneIcon } from "./icons";
import {
	AnimatedHeadphonesIcon,
	AnimatedMonitorSmartphoneIcon,
	AnimatedMusicLibraryIcon,
	AnimatedPauseIcon,
	AnimatedPhoneCallingIcon,
	AnimatedPipIcon,
	AnimatedPlayPauseIcon,
	AnimatedRadioIcon,
	AnimatedScreencastIcon,
	AnimatedSoundwaveIcon,
	AnimatedVideocameraIcon,
	AnimatedVolumeIcon,
	type VolumeLevel,
} from "./media";

const meta = {
	title: "Icons/Media",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const Cell = (props: { label: string; children: JSX.Element }) => (
	<div class="flex w-28 flex-col items-center gap-2">
		{props.children}
		<span class="text-center text-xs text-muted-foreground">{props.label}</span>
	</div>
);

const gallery: { label: string; icon: () => JSX.Element }[] = [
	{ label: "Headphones", icon: () => <AnimatedHeadphonesIcon /> },
	{ label: "Videocamera", icon: () => <AnimatedVideocameraIcon /> },
	{ label: "Volume", icon: () => <AnimatedVolumeIcon /> },
	{ label: "Phone calling", icon: () => <AnimatedPhoneCallingIcon /> },
	{ label: "Pause", icon: () => <AnimatedPauseIcon /> },
	{ label: "Play or pause", icon: () => <AnimatedPlayPauseIcon /> },
	{ label: "Music library", icon: () => <AnimatedMusicLibraryIcon /> },
	{ label: "Soundwave", icon: () => <AnimatedSoundwaveIcon /> },
	{ label: "Screencast", icon: () => <AnimatedScreencastIcon /> },
	{ label: "Picture in picture", icon: () => <AnimatedPipIcon /> },
	{ label: "Monitor and phone", icon: () => <AnimatedMonitorSmartphoneIcon /> },
	{ label: "Radio", icon: () => <AnimatedRadioIcon /> },
];

export const Gallery: Story = {
	render: () => (
		<div class="flex flex-wrap gap-4">
			<For each={gallery}>
				{(item) => (
					<Cell label={item.label}>
						<IconButton size="xl" label={item.label} icon={item.icon()} />
					</Cell>
				)}
			</For>
		</div>
	),
	play: async ({ canvasElement }) => {
		await expect(
			canvasElement.querySelectorAll("[data-animated-icon]"),
		).toHaveLength(gallery.length);
	},
};

const volumeLevels: VolumeLevel[] = ["high", "low", "off"];

export const VoiceControls: Story = {
	render: () => {
		const [muted, setMuted] = createSignal(false);
		const [deafened, setDeafened] = createSignal(false);
		const [cameraOff, setCameraOff] = createSignal(true);
		const [levelIndex, setLevelIndex] = createSignal(0);
		const [playing, setPlaying] = createSignal(false);
		const [speaking, setSpeaking] = createSignal(true);
		const level = () => volumeLevels[levelIndex()];

		return (
			<div class="flex flex-col gap-6">
				<div class="flex flex-wrap gap-4">
					<Cell label="Mute">
						<IconButton
							size="xl"
							label={muted() ? "Unmute" : "Mute"}
							aria-pressed={muted()}
							onClick={() => setMuted(!muted())}
							icon={<AnimatedMicrophoneIcon muted={muted()} />}
						/>
					</Cell>
					<Cell label="Deafen">
						<IconButton
							size="xl"
							label={deafened() ? "Undeafen" : "Deafen"}
							aria-pressed={deafened()}
							onClick={() => setDeafened(!deafened())}
							icon={<AnimatedHeadphonesIcon deafened={deafened()} />}
						/>
					</Cell>
					<Cell label="Camera">
						<IconButton
							size="xl"
							label={cameraOff() ? "Turn camera on" : "Turn camera off"}
							aria-pressed={!cameraOff()}
							onClick={() => setCameraOff(!cameraOff())}
							icon={<AnimatedVideocameraIcon off={cameraOff()} />}
						/>
					</Cell>
					<Cell label={`Volume ${level()}`}>
						<IconButton
							size="xl"
							label="Change volume"
							onClick={() => setLevelIndex((levelIndex() + 1) % 3)}
							icon={<AnimatedVolumeIcon level={level()} />}
						/>
					</Cell>
					<Cell label="Play or pause">
						<IconButton
							size="xl"
							label={playing() ? "Pause" : "Play"}
							onClick={() => setPlaying(!playing())}
							icon={<AnimatedPlayPauseIcon playing={playing()} />}
						/>
					</Cell>
					<Cell label="Leave call">
						<IconButton
							size="xl"
							variant="destructive"
							label="Leave call"
							icon={<EndCallRoundedIcon />}
						/>
					</Cell>
				</div>
				<div class="flex items-center gap-4">
					<Cell label="Speaking">
						<div class="flex size-12 items-center justify-center text-success">
							<AnimatedSoundwaveIcon size={32} loop={speaking()} />
						</div>
					</Cell>
					<Button variant="secondary" onClick={() => setSpeaking(!speaking())}>
						{speaking() ? "Stop speaking" : "Start speaking"}
					</Button>
				</div>
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole("button", { name: "Deafen" }));
		const icon = canvasElement.querySelector(
			'[data-animated-icon="headphones"]',
		)!;
		await expect(icon.querySelector("[data-slashed]")).toHaveAttribute(
			"data-slashed",
			"on",
		);
		const slash = icon.querySelector("[data-slash]:not(mask [data-slash])")!;
		await waitFor(() =>
			expect(getComputedStyle(slash).strokeDashoffset).toBe("0px"),
		);
	},
};

export const HeadphonesMatchCustomGlyph: Story = {
	render: () => (
		<div class="flex items-center gap-6">
			<AnimatedHeadphonesIcon size={96} deafened />
			<HeadphonesSlashIcon size={96} />
			<span class="relative size-24">
				<span class="absolute inset-0 text-primary opacity-50">
					<AnimatedHeadphonesIcon size={96} deafened />
				</span>
				<span class="absolute inset-0 text-success opacity-50">
					<HeadphonesSlashIcon size={96} />
				</span>
			</span>
		</div>
	),
};
