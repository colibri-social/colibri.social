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
	cameraControl,
	deafenControl,
	micControl,
	screenShareControl,
} from "./CallControls";
import {
	ScreenShareControl,
	type ScreenShareMenuProps,
} from "./ScreenShareMenu";

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
	screenShareMenu?: ScreenShareMenuProps;
	onShowOverlay?: () => void;
	onOpenCall?: () => void;
	onQualityClick?: () => void;
	class?: string;
};

const qualityTile: Record<VoiceConnectionQuality, string> = {
	excellent: "bg-success/15 text-success",
	good: "bg-success/10 text-success",
	poor: "bg-destructive/15 text-destructive",
	lost: "bg-destructive/15 text-destructive",
	unknown: "bg-muted/50 text-foreground",
};

const qualityTileHover: Record<VoiceConnectionQuality, string> = {
	excellent: "hover:bg-success/25",
	good: "hover:bg-success/20",
	poor: "hover:bg-destructive/25",
	lost: "hover:bg-destructive/25",
	unknown: "hover:bg-muted",
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
	const camera = cameraControl(props);
	const share = screenShareControl(props);

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
							aria-label={
								props.onQualityClick
									? `Connection details, ${latencyLabel()}`
									: `Connection: ${latencyLabel()}`
							}
							data-quality-tile=""
							data-clickable={props.onQualityClick ? "" : undefined}
							onClick={() => props.onQualityClick?.()}
							class={cx(
								"flex size-8 shrink-0 items-center justify-center rounded-control-sm border-0 p-0 outline-none focus-ring [&_svg]:size-5",
								props.onQualityClick
									? cx("cursor-pointer", qualityTileHover[quality()])
									: "cursor-default",
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
							<Show
								when={props.onOpenCall}
								fallback={
									<span class="truncate text-xs text-muted-foreground">
										{location()}
									</span>
								}
							>
								{(open) => (
									<button
										type="button"
										data-open-call=""
										aria-label={`Open call, ${location()}`}
										onClick={() => open()()}
										class="cursor-pointer truncate rounded-control-sm border-0 bg-transparent p-0 text-left text-xs text-muted-foreground outline-none hover:text-foreground hover:underline focus-ring"
									>
										{location()}
									</button>
								)}
							</Show>
						</Show>
					</div>
				</div>
				<CallLeaveButton
					label="Disconnect"
					size="lg"
					onClick={props.onDisconnect}
				/>
			</div>
			<div
				class={cx(
					"grid w-full gap-2",
					props.onToggleScreenShare ? "grid-cols-4" : "grid-cols-3",
				)}
			>
				<CallControlButton
					label={mic.label()}
					tooltip={mic.tooltip()}
					pressed={mic.off()}
					tone={mic.tone()}
					size="lg"
					stretch
					disabled={mic.disabled()}
					icon={<AnimatedMicrophoneIcon muted={mic.off()} />}
					onClick={props.onToggleMute}
				/>
				<CallControlButton
					label={deafen.label()}
					tooltip={deafen.tooltip()}
					pressed={deafen.off()}
					tone={deafen.tone()}
					size="lg"
					stretch
					disabled={deafen.disabled()}
					icon={<AnimatedHeadphonesIcon deafened={deafen.off()} />}
					onClick={props.onToggleDeafen}
				/>
				<CallControlButton
					label={camera.label()}
					tooltip={camera.tooltip()}
					pressed={camera.on()}
					tone={camera.tone()}
					size="lg"
					stretch
					disabled={camera.disabled()}
					loading={!camera.disabled() && props.cameraPending}
					icon={<AnimatedVideocameraIcon off={!camera.on()} />}
					onClick={props.onToggleCamera}
				/>
				<Show when={props.onToggleScreenShare}>
					<ScreenShareControl
						menu={share.disabled() ? undefined : props.screenShareMenu}
						stretch
					>
						<CallControlButton
							label={share.label()}
							tooltip={share.tooltip()}
							pressed={share.on()}
							tone={share.tone()}
							size="lg"
							stretch
							disabled={share.disabled()}
							icon={<AnimatedScreencastIcon trigger="press" />}
							onClick={props.onToggleScreenShare}
						/>
					</ScreenShareControl>
				</Show>
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
