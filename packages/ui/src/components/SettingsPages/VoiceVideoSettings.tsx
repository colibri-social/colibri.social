import { Index, type JSX, Match, Show, Switch } from "solid-js";
import { cx } from "../../utils/cx";
import { createSlot } from "../../utils/slot";
import { Button } from "../Button/Button";
import { ListGroup, ToggleRow } from "../List/List";
import { Select, type SelectPlatform } from "../Select/Select";
import { Slider } from "../Slider/Slider";
import { Spinner } from "../Spinner/Spinner";
import { SettingsField, SettingsPage } from "./shared";

export type DeviceOption = { id: string; label: string };

export type MicTestState = "idle" | "starting" | "running";

export type CameraPreviewState = "idle" | "loading" | "ready" | "error";

export type ScreenShareResolution = "720" | "1080" | "1440" | "source";

export type ScreenShareFramerate = 15 | 30 | 60;

export type ScreenShareSettings = {
	resolution: ScreenShareResolution;
	framerate: ScreenShareFramerate;
	shareAudio?: boolean;
};

export const SCREEN_SHARE_RESOLUTIONS: readonly ScreenShareResolution[] = [
	"720",
	"1080",
	"1440",
	"source",
];

export const SCREEN_SHARE_FRAMERATES: readonly ScreenShareFramerate[] = [
	15, 30, 60,
];

const resolutionLabel = (resolution: ScreenShareResolution) =>
	resolution === "source" ? "Full size" : `${resolution}p`;

export const MAX_DEVICE_VOLUME = 200;

const METER_SEGMENTS = 32;

const segmentTone = (index: number) => {
	const at = index / METER_SEGMENTS;
	if (at < 0.6) return "bg-success";
	if (at < 0.85) return "bg-warning";
	return "bg-destructive";
};

export type MicLevelMeterProps = {
	level: number;
	active?: boolean;
	class?: string;
};

export const MicLevelMeter = (props: MicLevelMeterProps) => {
	const level = () => Math.min(1, Math.max(0, props.level));
	const lit = () => (props.active === false ? 0 : level() * METER_SEGMENTS);
	return (
		<div
			data-mic-meter=""
			class={cx(
				"relative flex h-5 min-w-0 flex-1 items-stretch justify-between gap-0.5",
				props.class,
			)}
		>
			<meter
				aria-label="Microphone level"
				min={0}
				max={100}
				value={Math.round(level() * 100)}
				class="sr-only"
			/>
			<Index each={Array.from({ length: METER_SEGMENTS })}>
				{(_, index) => (
					<span
						aria-hidden="true"
						data-lit={index < lit() || undefined}
						class={cx(
							"w-1 min-w-px shrink rounded-full bg-secondary",
							index < lit() && segmentTone(index),
						)}
					/>
				)}
			</Index>
		</div>
	);
};

export type VoiceVideoSettingsProps = {
	platform?: SelectPlatform;
	microphones: DeviceOption[];
	microphone?: string;
	onMicrophoneChange?: (id: string) => void;
	inputVolume: number;
	onInputVolumeChange?: (volume: number) => void;
	micTest: MicTestState;
	micLevel: number;
	onMicTestToggle?: () => void;
	speakers?: DeviceOption[];
	speaker?: string;
	onSpeakerChange?: (id: string) => void;
	outputVolume: number;
	onOutputVolumeChange?: (volume: number) => void;
	noiseSuppression: boolean;
	onNoiseSuppressionChange?: (enabled: boolean) => void;
	voiceGate: boolean;
	onVoiceGateChange?: (enabled: boolean) => void;
	confirmJoin: boolean;
	onConfirmJoinChange?: (enabled: boolean) => void;
	showNonVideoParticipants: boolean;
	onShowNonVideoParticipantsChange?: (enabled: boolean) => void;
	showOwnCamera: boolean;
	onShowOwnCameraChange?: (enabled: boolean) => void;
	cameras?: DeviceOption[];
	camera?: string;
	onCameraChange?: (id: string) => void;
	cameraPreview?: JSX.Element;
	cameraPreviewState?: CameraPreviewState;
	onCameraPreviewToggle?: () => void;
	cameraError?: JSX.Element;
	screenShare?: ScreenShareSettings;
	onScreenShareChange?: (patch: Partial<ScreenShareSettings>) => void;
	class?: string;
};

const deviceOptions = (devices: DeviceOption[]) =>
	devices.map((device) => ({ value: device.id, label: device.label }));

const percent = (value: number) => `${Math.round(value)}%`;

const VOLUME_MARKS = [{ value: 100 }];

export const VoiceVideoSettings = (props: VoiceVideoSettingsProps) => {
	const preview = createSlot(() => props.cameraPreview);
	const previewState = () => props.cameraPreviewState ?? "idle";

	return (
		<SettingsPage class={props.class}>
			<SettingsField>
				<Select
					platform={props.platform}
					label="Microphone"
					options={deviceOptions(props.microphones)}
					value={props.microphone}
					placeholder="System default"
					disabled={props.microphones.length === 0}
					onChange={(id) => props.onMicrophoneChange?.(id)}
				/>
				<Slider
					label="Microphone volume"
					showValue
					formatValue={percent}
					minValue={0}
					maxValue={MAX_DEVICE_VOLUME}
					step={1}
					marks={VOLUME_MARKS}
					value={[props.inputVolume]}
					onChange={(values) => props.onInputVolumeChange?.(values[0] ?? 0)}
				/>
				<div class="flex flex-col gap-2">
					<div class="flex min-w-0 items-center gap-3">
						<Button
							variant={props.micTest === "running" ? "primary" : "secondary"}
							loading={props.micTest === "starting"}
							aria-pressed={props.micTest === "running"}
							class="w-36 shrink-0"
							onClick={() => props.onMicTestToggle?.()}
						>
							{props.micTest === "running" ? "Stop test" : "Test microphone"}
						</Button>
						<MicLevelMeter
							level={props.micLevel}
							active={props.micTest === "running"}
						/>
					</div>
					<p class="text-xs text-muted-foreground">
						Speak to see how loud you are. Nobody else hears the test.
					</p>
				</div>
			</SettingsField>

			<Show when={props.speakers}>
				{(speakers) => (
					<SettingsField>
						<Select
							platform={props.platform}
							label="Speaker"
							options={deviceOptions(speakers())}
							value={props.speaker}
							placeholder="System default"
							disabled={speakers().length === 0}
							onChange={(id) => props.onSpeakerChange?.(id)}
						/>
						<Slider
							label="Speaker volume"
							showValue
							formatValue={percent}
							minValue={0}
							maxValue={MAX_DEVICE_VOLUME}
							step={1}
							marks={VOLUME_MARKS}
							value={[props.outputVolume]}
							onChange={(values) =>
								props.onOutputVolumeChange?.(values[0] ?? 0)
							}
						/>
					</SettingsField>
				)}
			</Show>

			<ListGroup label="Sound">
				<ToggleRow
					title="Noise suppression"
					description="Removes background noise like fans, hum and typing before others hear you."
					checked={props.noiseSuppression}
					onChange={(checked) => props.onNoiseSuppressionChange?.(checked)}
				/>
				<ToggleRow
					title="Voice gate"
					description="Mutes your microphone between sentences, so silence stays silent."
					checked={props.voiceGate}
					onChange={(checked) => props.onVoiceGateChange?.(checked)}
				/>
			</ListGroup>

			<ListGroup label="Voice channels">
				<ToggleRow
					title="Confirm before joining"
					description="Opening a voice channel shows who's there. Press Join to connect."
					checked={props.confirmJoin}
					onChange={(checked) => props.onConfirmJoinChange?.(checked)}
				/>
				<ToggleRow
					title="Show people without video"
					description="Keeps everyone in the call grid, even with their camera off."
					checked={props.showNonVideoParticipants}
					onChange={(checked) =>
						props.onShowNonVideoParticipantsChange?.(checked)
					}
				/>
				<ToggleRow
					title="Show your own camera"
					description="Shows your camera in the call grid next to everyone else."
					checked={props.showOwnCamera}
					onChange={(checked) => props.onShowOwnCameraChange?.(checked)}
				/>
			</ListGroup>

			<Show when={props.cameras}>
				{(cameras) => (
					<SettingsField>
						<Select
							platform={props.platform}
							label="Camera"
							options={deviceOptions(cameras())}
							value={props.camera}
							placeholder="System default"
							disabled={cameras().length === 0}
							onChange={(id) => props.onCameraChange?.(id)}
						/>
						<div
							data-camera-preview={previewState()}
							class="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-control bg-secondary"
						>
							<Show when={preview.has()}>
								<div
									class={cx(
										"absolute inset-0 [&>video]:size-full [&>video]:object-cover",
										previewState() !== "ready" && "invisible",
									)}
								>
									{preview()}
								</div>
							</Show>
							<Switch>
								<Match when={previewState() === "idle"}>
									<span class="flex flex-col items-center gap-3 px-6 text-center">
										<span class="text-sm text-muted-foreground">
											Check how you look before you turn your camera on in a
											call. Only you see the preview.
										</span>
										<Button
											variant="secondary"
											onClick={() => props.onCameraPreviewToggle?.()}
										>
											Preview camera
										</Button>
									</span>
								</Match>
								<Match when={previewState() === "loading"}>
									<span class="flex items-center gap-2 text-sm text-muted-foreground">
										<Spinner size={16} />
										Starting your camera...
									</span>
								</Match>
								<Match when={previewState() === "error"}>
									<span class="flex flex-col items-center gap-3 px-6 text-center">
										<span role="alert" class="text-sm text-destructive">
											{props.cameraError ?? "Your camera couldn't start."}
										</span>
										<Button
											variant="secondary"
											onClick={() => props.onCameraPreviewToggle?.()}
										>
											Try again
										</Button>
									</span>
								</Match>
								<Match when={previewState() === "ready"}>
									<Button
										variant="secondary"
										aria-pressed="true"
										class="absolute right-3 bottom-3"
										onClick={() => props.onCameraPreviewToggle?.()}
									>
										Stop preview
									</Button>
								</Match>
							</Switch>
						</div>
					</SettingsField>
				)}
			</Show>

			<Show when={props.screenShare}>
				{(screen) => (
					<SettingsField label="Screen sharing">
						<div class="grid grid-cols-1 gap-4 @min-[480px]/settings:grid-cols-2">
							<Select
								platform={props.platform}
								label="Resolution"
								options={SCREEN_SHARE_RESOLUTIONS.map((resolution) => ({
									value: resolution,
									label: resolutionLabel(resolution),
								}))}
								value={screen().resolution}
								onChange={(value) =>
									props.onScreenShareChange?.({
										resolution: value as ScreenShareResolution,
									})
								}
							/>
							<Select
								platform={props.platform}
								label="Frame rate"
								options={SCREEN_SHARE_FRAMERATES.map((framerate) => ({
									value: String(framerate),
									label: `${framerate} per second`,
								}))}
								value={String(screen().framerate)}
								onChange={(value) =>
									props.onScreenShareChange?.({
										framerate: Number(value) as ScreenShareFramerate,
									})
								}
							/>
						</div>
						<p class="text-xs text-muted-foreground">
							Higher settings look sharper and smoother, but need a faster
							connection.
						</p>
						<Show when={screen().shareAudio !== undefined}>
							<ListGroup>
								<ToggleRow
									title="Share sound"
									description="Others hear what's playing on your screen."
									checked={screen().shareAudio}
									onChange={(checked) =>
										props.onScreenShareChange?.({ shareAudio: checked })
									}
								/>
							</ListGroup>
						</Show>
					</SettingsField>
				)}
			</Show>
		</SettingsPage>
	);
};
