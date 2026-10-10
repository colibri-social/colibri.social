import { WiFiIcon } from "@solar-icons/solid/bold/wi-fi";
import { WiFiHighIcon } from "@solar-icons/solid/bold/wi-fi-high";
import { WiFiLowIcon } from "@solar-icons/solid/bold/wi-fi-low";
import { WiFiNoneIcon } from "@solar-icons/solid/bold/wi-fi-none";
import { WiFiOffIcon } from "@solar-icons/solid/bold/wi-fi-off";
import { Match, Show, Switch } from "solid-js";
import { AnimatedMicrophoneIcon } from "../../icons/animated/icons";
import {
	AnimatedHeadphonesIcon,
	AnimatedScreencastIcon,
	AnimatedVideocameraIcon,
} from "../../icons/animated/media";
import { cx } from "../../utils/cx";
import { Button } from "../Button/Button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../Tooltip/Tooltip";
import {
	CallControlButton,
	CallLeaveButton,
	type CallMediaState,
	deafenControl,
	micControl,
} from "./CallControls";

export type VoiceConnectionState =
	| "connected"
	| "connecting"
	| "reconnecting"
	| "disconnected";

export type VoiceConnectionQuality =
	| "excellent"
	| "good"
	| "poor"
	| "lost"
	| "unknown";

export type VoiceStatusPanelProps = CallMediaState & {
	state: VoiceConnectionState;
	quality?: VoiceConnectionQuality;
	latency?: number | null;
	channelName?: string;
	spaceName?: string;
	onDisconnect?: () => void;
	onToggleMute?: () => void;
	onToggleDeafen?: () => void;
	onToggleCamera?: () => void;
	onToggleScreenShare?: () => void;
	onShowOverlay?: () => void;
	class?: string;
};

const qualityTile: Record<VoiceConnectionQuality, string> = {
	excellent: "bg-success/15 text-success",
	good: "bg-success/10 text-success",
	poor: "bg-destructive/15 text-destructive",
	lost: "bg-destructive/15 text-destructive",
	unknown: "bg-muted/50 text-foreground",
};

const qualityText: Record<VoiceConnectionQuality, string> = {
	excellent: "text-success",
	good: "text-success",
	poor: "text-destructive",
	lost: "text-destructive",
	unknown: "text-foreground",
};

const QualityIcon = (props: { quality: VoiceConnectionQuality }) => (
	<Switch fallback={<WiFiNoneIcon />}>
		<Match when={props.quality === "excellent"}>
			<WiFiIcon />
		</Match>
		<Match when={props.quality === "good"}>
			<WiFiHighIcon />
		</Match>
		<Match when={props.quality === "poor"}>
			<WiFiLowIcon />
		</Match>
		<Match when={props.quality === "lost"}>
			<WiFiOffIcon />
		</Match>
	</Switch>
);

export const voiceStatusLabel = (state: VoiceConnectionState) => {
	if (state === "connecting" || state === "reconnecting")
		return "Connecting...";
	if (state === "disconnected") return "Voice disconnected";
	return "Voice connected";
};

export const VoiceStatusPanel = (props: VoiceStatusPanelProps) => {
	const quality = (): VoiceConnectionQuality => props.quality ?? "unknown";
	const connecting = () =>
		props.state === "connecting" || props.state === "reconnecting";
	const latencyLabel = () =>
		props.latency != null ? `${props.latency} ms` : "Measuring...";
	const location = () =>
		[props.channelName, props.spaceName].filter(Boolean).join(" · ");
	const statusTone = () => {
		if (connecting()) return "text-warning";
		if (props.state === "disconnected") return "text-destructive";
		return qualityText[quality()];
	};
	const mic = micControl(props);
	const deafen = deafenControl(props);

	return (
		<div
			data-voice-status=""
			data-state={props.state}
			data-quality={quality()}
			class={cx(
				"flex w-full flex-col gap-2 border-t border-border p-3",
				props.class,
			)}
		>
			<div class="flex items-center justify-between gap-2">
				<div class="flex min-w-0 flex-1 items-center gap-2">
					<Tooltip placement="top">
						<TooltipTrigger
							aria-label={`Connection: ${latencyLabel()}`}
							data-quality-tile=""
							class={cx(
								"flex size-8 shrink-0 cursor-default items-center justify-center rounded-control-sm border-0 p-0 outline-none focus-ring [&_svg]:size-5",
								qualityTile[quality()],
							)}
						>
							<QualityIcon quality={quality()} />
						</TooltipTrigger>
						<TooltipContent class={qualityText[quality()]}>
							{latencyLabel()}
						</TooltipContent>
					</Tooltip>
					<div class="flex min-w-0 flex-col">
						<span
							role="status"
							data-status-label=""
							class={cx("truncate text-sm font-semibold", statusTone())}
						>
							{voiceStatusLabel(props.state)}
						</span>
						<Show when={location()}>
							<span class="truncate text-xs text-muted-foreground">
								{location()}
							</span>
						</Show>
					</div>
				</div>
				<CallLeaveButton
					label="Disconnect"
					size="lg"
					onClick={props.onDisconnect}
				/>
			</div>
			<div class="grid w-full grid-cols-4 gap-2">
				<CallControlButton
					label={mic.label()}
					title={mic.title()}
					pressed={mic.off()}
					tone={mic.tone()}
					size="lg"
					stretch
					disabled={props.serverMuted}
					icon={<AnimatedMicrophoneIcon muted={mic.off()} />}
					onClick={props.onToggleMute}
				/>
				<CallControlButton
					label={deafen.label()}
					title={deafen.title()}
					pressed={deafen.off()}
					tone={deafen.tone()}
					size="lg"
					stretch
					disabled={props.serverDeafened}
					icon={<AnimatedHeadphonesIcon deafened={deafen.off()} />}
					onClick={props.onToggleDeafen}
				/>
				<CallControlButton
					label={props.cameraOn ? "Turn off camera" : "Turn on camera"}
					pressed={!!props.cameraOn}
					tone={props.cameraOn ? "active" : "default"}
					size="lg"
					stretch
					icon={<AnimatedVideocameraIcon off={!props.cameraOn} />}
					onClick={props.onToggleCamera}
				/>
				<CallControlButton
					label={props.screenSharing ? "Stop sharing" : "Share screen"}
					pressed={!!props.screenSharing}
					tone={props.screenSharing ? "active" : "default"}
					size="lg"
					stretch
					icon={<AnimatedScreencastIcon />}
					onClick={props.onToggleScreenShare}
				/>
			</div>
			<Show when={props.onShowOverlay}>
				<Button
					variant="secondary"
					block
					onClick={() => props.onShowOverlay?.()}
				>
					Show floating window
				</Button>
			</Show>
		</div>
	);
};
