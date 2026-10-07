import { createSignal, type JSX, Show } from "solid-js";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { HapticsProvider } from "../../utils/haptics";
import { Scrubber } from "./Scrubber";
import { createStoryClip } from "./story-clip";
import { VideoPlayer } from "./VideoPlayer";

const meta = {
	title: "Messaging/Media player",
	parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const iphone = { viewport: { defaultViewport: "iphone" } };

const Screen = (props: { children: JSX.Element; desktop?: boolean }) => (
	<div
		class={
			props.desktop
				? "flex min-h-dvh max-w-[960px] flex-col gap-6 bg-background p-6 text-foreground"
				: "flex min-h-dvh flex-col gap-6 bg-background p-4 text-foreground"
		}
	>
		{props.children}
	</div>
);

const Section = (props: { title: string; children: JSX.Element }) => (
	<section class="flex flex-col gap-2">
		<h2 class="m-0 text-sm font-medium text-muted-foreground">{props.title}</h2>
		{props.children}
	</section>
);

const seek = fn();
const seekEnd = fn();
const selection = fn();

const ControlledScrubber = (props: {
	initial: number;
	max: number;
	buffered?: [number, number][];
	tone?: "surface" | "overlay";
	disabled?: boolean;
	label: string;
}) => {
	const [value, setValue] = createSignal(props.initial);
	return (
		<Scrubber
			label={props.label}
			value={value()}
			max={props.max}
			buffered={props.buffered}
			tone={props.tone}
			disabled={props.disabled}
			onSeek={(time) => {
				setValue(time);
				seek(time);
			}}
			onSeekEnd={seekEnd}
		/>
	);
};

export const Scrubbers: Story = {
	render: () => (
		<HapticsProvider
			haptics={{ impact: () => {}, selection, notification: () => {} }}
		>
			<Screen desktop>
				<Section title="On a surface">
					<div class="max-w-[416px] rounded-control-lg border border-border bg-card p-3">
						<ControlledScrubber
							label="Seek song"
							initial={83}
							max={296}
							buffered={[[0, 180]]}
						/>
					</div>
				</Section>
				<Section title="Over video">
					<div class="max-w-[416px] rounded-control-lg bg-linear-to-t from-black to-[#2d1b69] p-3 pt-16">
						<ControlledScrubber
							label="Seek clip"
							tone="overlay"
							initial={12}
							max={42}
							buffered={[
								[0, 20],
								[28, 34],
							]}
						/>
					</div>
				</Section>
				<Section title="Disabled">
					<div class="max-w-[416px] rounded-control-lg border border-border bg-card p-3">
						<ControlledScrubber
							label="Seek unavailable"
							initial={0}
							max={60}
							disabled
						/>
					</div>
				</Section>
			</Screen>
		</HapticsProvider>
	),
	play: async ({ canvasElement }) => {
		seek.mockClear();
		seekEnd.mockClear();
		selection.mockClear();
		const canvas = within(canvasElement);
		const slider = canvas.getByRole("slider", { name: "Seek song" });
		await expect(slider).toHaveAttribute("aria-valuetext", "1:23 of 4:56");
		slider.focus();
		await userEvent.keyboard("{ArrowRight}");
		await expect(seek).toHaveBeenLastCalledWith(88);
		await expect(slider).toHaveAttribute("aria-valuenow", "88");
		await userEvent.keyboard("{End}");
		await expect(seek).toHaveBeenLastCalledWith(296);
		await userEvent.keyboard("{Home}");
		await expect(seekEnd).toHaveBeenLastCalledWith(0);
		await userEvent.keyboard("{PageUp}");
		await expect(seek).toHaveBeenLastCalledWith(29.6);

		const track = slider.querySelector("[data-scrubber-track]") as HTMLElement;
		const rect = track.getBoundingClientRect();
		const at = (ratio: number) => rect.left + rect.width * ratio;
		const y = rect.top + rect.height / 2;
		const fire = (type: string, x: number, pointerType = "touch") =>
			slider.dispatchEvent(
				new PointerEvent(type, {
					bubbles: true,
					cancelable: true,
					pointerId: 7,
					pointerType,
					button: 0,
					clientX: x,
					clientY: y,
				}),
			);
		seek.mockClear();
		selection.mockClear();
		fire("pointerdown", at(0.25));
		await expect(slider).toHaveAttribute("data-dragging");
		await expect(seek.mock.lastCall?.[0]).toBeCloseTo(74, 0);
		fire("pointermove", at(0.75));
		await expect(seek.mock.lastCall?.[0]).toBeCloseTo(222, 0);
		fire("pointermove", at(1.2));
		await expect(seek).toHaveBeenLastCalledWith(296);
		await expect(selection).toHaveBeenCalledTimes(1);
		fire("pointermove", at(1.4));
		await expect(selection).toHaveBeenCalledTimes(1);
		fire("pointerup", at(1.4));
		await expect(seekEnd).toHaveBeenLastCalledWith(296);
		await expect(slider).not.toHaveAttribute("data-dragging");

		const disabled = canvas.getByRole("slider", { name: "Seek unavailable" });
		await expect(disabled).toHaveAttribute("aria-disabled", "true");
	},
};

const ClipPlayer = (props: {
	desktop?: boolean;
	muted?: boolean;
	hideDelay?: number;
	broken?: boolean;
	label?: string;
}) => {
	const clip = createStoryClip(3);
	return (
		<Show when={clip()}>
			{(value) => (
				<VideoPlayer
					src={
						props.broken ? "data:video/webm;base64,AAAAAAAAAAAA" : value().src
					}
					poster={value().poster}
					width={640}
					height={360}
					muted={props.muted}
					controlsHideDelay={props.hideDelay}
					label={props.label ?? "A purple dot sliding back and forth"}
					class={
						props.desktop
							? "w-full max-w-[416px] rounded-control-lg"
							: "w-full rounded-control-lg"
					}
				/>
			)}
		</Show>
	);
};

const playerIn = async (canvasElement: HTMLElement) => {
	const root = await waitFor(
		() => {
			const element = canvasElement.querySelector(
				"[data-video-player]",
			) as HTMLElement | null;
			expect(element).not.toBeNull();
			return element as HTMLElement;
		},
		{ timeout: 8000 },
	);
	const video = root.querySelector("video") as HTMLVideoElement;
	await waitFor(() => expect(Number.isFinite(video.duration)).toBe(true), {
		timeout: 3000,
	});
	return { root, video };
};

export const Inline: Story = {
	parameters: iphone,
	render: () => (
		<Screen>
			<Section title="Tap the video to play">
				<ClipPlayer muted hideDelay={300} />
			</Section>
		</Screen>
	),
	play: async ({ canvasElement }) => {
		const { root, video } = await playerIn(canvasElement);
		const player = within(root);
		const play = player.getByRole("button", { name: "Play" });
		await expect(play).toHaveAttribute("aria-pressed", "false");
		await userEvent.click(play);
		await waitFor(() => expect(video.paused).toBe(false));
		const pause = player.getByRole("button", { name: "Pause" });
		await expect(pause).toHaveAttribute("aria-pressed", "true");
		await expect(pause.querySelector("[data-swap]")).toHaveAttribute(
			"data-swap",
			"second",
		);
		(document.activeElement as HTMLElement | null)?.blur();
		await waitFor(
			() => expect(root).toHaveAttribute("data-controls", "hidden"),
			{ timeout: 2000 },
		);
		root.dispatchEvent(
			new PointerEvent("pointermove", {
				bubbles: true,
				pointerType: "mouse",
			}),
		);
		await waitFor(() =>
			expect(root).toHaveAttribute("data-controls", "visible"),
		);
		const unmute = player.getByRole("button", { name: "Unmute" });
		await expect(unmute).toHaveAttribute("aria-pressed", "true");
		await userEvent.click(unmute);
		await waitFor(() => expect(video.muted).toBe(false));
		await expect(player.getByRole("button", { name: "Mute" })).toHaveAttribute(
			"aria-pressed",
			"false",
		);
		await userEvent.click(player.getByRole("button", { name: "Mute" }));
		await waitFor(() => expect(video.muted).toBe(true));
		if (!video.paused) {
			await userEvent.click(player.getByRole("button", { name: "Pause" }));
			await waitFor(() => expect(video.paused).toBe(true));
		}
		await expect(player.getByRole("button", { name: "Play" })).toHaveAttribute(
			"aria-pressed",
			"false",
		);
	},
};

export const KeyboardControls: Story = {
	render: () => (
		<Screen desktop>
			<Section title="Space or K plays, J and L jump 10s, arrows jump 5s, M mutes">
				<ClipPlayer desktop muted />
			</Section>
		</Screen>
	),
	play: async ({ canvasElement }) => {
		const { root, video } = await playerIn(canvasElement);
		root.focus();
		await userEvent.keyboard("k");
		await waitFor(() => expect(video.paused).toBe(false));
		await userEvent.keyboard("k");
		await waitFor(() => expect(video.paused).toBe(true));
		await userEvent.keyboard("m");
		await waitFor(() => expect(video.muted).toBe(false));
		await userEvent.keyboard("m");
		await waitFor(() => expect(video.muted).toBe(true));
	},
};

export const Desktop: Story = {
	render: () => (
		<Screen desktop>
			<Section title="Hover the volume button for the slider">
				<ClipPlayer desktop />
			</Section>
		</Screen>
	),
};

const BufferingPlayer = () => {
	let started = false;
	return (
		<div
			ref={(element) => {
				queueMicrotask(() => {
					if (started) return;
					started = true;
					setTimeout(() => {
						element.querySelector("video")?.dispatchEvent(new Event("waiting"));
					}, 800);
				});
			}}
		>
			<ClipPlayer label="A clip that is still loading" />
		</div>
	);
};

export const Buffering: Story = {
	parameters: iphone,
	render: () => (
		<Screen>
			<Section title="Buffering">
				<BufferingPlayer />
			</Section>
		</Screen>
	),
	play: async ({ canvasElement }) => {
		const { root, video } = await playerIn(canvasElement);
		video.dispatchEvent(new Event("waiting"));
		await waitFor(() =>
			expect(root.querySelector("[data-video-buffering]")).not.toBeNull(),
		);
		await expect(
			within(root).getByRole("img", { name: "Loading video" }),
		).toBeInTheDocument();
	},
};

export const PlaybackError: Story = {
	name: "Error",
	parameters: iphone,
	render: () => (
		<Screen>
			<Section title="A file that cannot be decoded">
				<ClipPlayer broken label="A broken clip" />
			</Section>
		</Screen>
	),
	play: async ({ canvasElement }) => {
		const alert = await within(canvasElement).findByRole(
			"alert",
			{},
			{ timeout: 3000 },
		);
		await expect(alert).toHaveTextContent("This video can't be played");
		await expect(
			within(alert).getByRole("button", { name: "Try again" }),
		).toBeInTheDocument();
	},
};
