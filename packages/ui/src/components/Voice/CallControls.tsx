import { ChatRoundDotsIcon } from "@solar-icons/solid/bold/chat-round-dots";
import { EndCallRoundedIcon } from "@solar-icons/solid/bold/end-call-rounded";
import { type JSX, Show, splitProps } from "solid-js";
import { AnimatedMicrophoneIcon } from "../../icons/animated/icons";
import {
	AnimatedHeadphonesIcon,
	AnimatedScreencastIcon,
	AnimatedVideocameraIcon,
} from "../../icons/animated/media";
import { cx } from "../../utils/cx";
import { useHaptics } from "../../utils/haptics";
import { IconButton } from "../IconButton/IconButton";
import {
	ScreenShareControl,
	type ScreenShareMenuProps,
} from "./ScreenShareMenu";

export type CallControlTone = "default" | "active" | "off" | "server";

const toneClass: Record<CallControlTone, string> = {
	default: "",
	active:
		"border-primary/40 bg-primary/15 text-primary-highlight not-aria-disabled:hover:bg-primary/25 data-pressed:bg-primary/25",
	off: "text-destructive",
	server: "text-warning aria-disabled:opacity-100",
};

export type CallControlSize = "md" | "lg" | "xl";

export type CallControlButtonProps = {
	label: string;
	icon: JSX.Element;
	pressed?: boolean;
	tone?: CallControlTone;
	size?: CallControlSize;
	stretch?: boolean;
	disabled?: boolean;
	loading?: boolean;
	tooltip?: string;
	onClick?: () => void;
	class?: string;
};

export const CallControlButton = (props: CallControlButtonProps) => {
	const haptics = useHaptics();
	return (
		<IconButton
			label={props.label}
			tooltip={props.tooltip}
			icon={props.icon}
			size={props.size ?? "xl"}
			variant="secondary"
			disabled={props.disabled}
			loading={props.loading}
			aria-pressed={props.pressed === undefined ? undefined : props.pressed}
			data-tone={props.tone ?? "default"}
			onClick={() => {
				haptics.selection();
				props.onClick?.();
			}}
			class={cx(
				toneClass[props.tone ?? "default"],
				props.stretch && "w-full",
				props.class,
			)}
		/>
	);
};

export type CallLeaveButtonProps = {
	label?: string;
	size?: CallControlSize;
	stretch?: boolean;
	onClick?: () => void;
	class?: string;
};

export const CallLeaveButton = (props: CallLeaveButtonProps) => {
	const haptics = useHaptics();
	return (
		<IconButton
			label={props.label ?? "Leave call"}
			icon={<EndCallRoundedIcon />}
			iconEffect="wiggle"
			size={props.size ?? "xl"}
			variant="destructive"
			data-call-leave=""
			onClick={() => {
				haptics.impact("medium");
				props.onClick?.();
			}}
			class={cx(props.stretch && "w-full", props.class)}
		/>
	);
};

export type CallMediaState = {
	muted?: boolean;
	deafened?: boolean;
	serverMuted?: boolean;
	serverDeafened?: boolean;
	micMissing?: boolean;
	micDenied?: boolean;
	listenDenied?: boolean;
	cameraDenied?: boolean;
	screenshareDenied?: boolean;
	cameraOn?: boolean;
	cameraPending?: boolean;
	screenSharing?: boolean;
};

export const CALL_PERMISSION_COPY = {
	speakLabel: "Speaking not allowed",
	speakTooltip: "You don't have permission to speak in this channel.",
	listenLabel: "Listening not allowed",
	listenTooltip: "You don't have permission to listen in this channel.",
	cameraLabel: "Camera not allowed",
	cameraTooltip:
		"You don't have permission to turn on your camera in this channel.",
	screenshareLabel: "Screen sharing not allowed",
	screenshareTooltip:
		"You don't have permission to share your screen in this channel.",
} as const;

export const micControl = (state: CallMediaState) => {
	const off = () =>
		!!(state.muted || state.serverMuted || state.micDenied || state.micMissing);
	return {
		off,
		disabled: () =>
			!!(state.serverMuted || state.micDenied || state.micMissing),
		label: () =>
			state.serverMuted
				? "Muted by a moderator"
				: state.micDenied
					? CALL_PERMISSION_COPY.speakLabel
					: state.micMissing
						? "No microphone"
						: off()
							? "Unmute"
							: "Mute",
		tooltip: () =>
			state.serverMuted
				? "A moderator muted you. Your mic stays muted until they lift it."
				: state.micDenied
					? CALL_PERMISSION_COPY.speakTooltip
					: state.micMissing
						? "Colibri can't find a microphone. Plug one in and join the call again to talk."
						: undefined,
		tone: (): CallControlTone =>
			state.serverMuted || state.micDenied
				? "server"
				: off()
					? "off"
					: "default",
	};
};

export const deafenControl = (state: CallMediaState) => {
	const off = () =>
		!!(state.deafened || state.serverDeafened || state.listenDenied);
	return {
		off,
		disabled: () => !!(state.serverDeafened || state.listenDenied),
		label: () =>
			state.serverDeafened
				? "Deafened by a moderator"
				: state.listenDenied
					? CALL_PERMISSION_COPY.listenLabel
					: off()
						? "Undeafen"
						: "Deafen",
		tooltip: () =>
			state.serverDeafened
				? "A moderator deafened you. You stay deafened until they lift it."
				: state.listenDenied
					? CALL_PERMISSION_COPY.listenTooltip
					: undefined,
		tone: (): CallControlTone =>
			state.serverDeafened || state.listenDenied
				? "server"
				: off()
					? "off"
					: "default",
	};
};

export const cameraControl = (state: CallMediaState) => {
	const on = () => !!state.cameraOn && !state.cameraDenied;
	return {
		on,
		disabled: () => !!state.cameraDenied,
		label: () =>
			state.cameraDenied
				? CALL_PERMISSION_COPY.cameraLabel
				: on()
					? "Turn off camera"
					: "Turn on camera",
		tooltip: () =>
			state.cameraDenied ? CALL_PERMISSION_COPY.cameraTooltip : undefined,
		tone: (): CallControlTone =>
			state.cameraDenied ? "server" : on() ? "active" : "default",
	};
};

export const screenShareControl = (state: CallMediaState) => {
	const on = () => !!state.screenSharing && !state.screenshareDenied;
	return {
		on,
		disabled: () => !!state.screenshareDenied,
		label: () =>
			state.screenshareDenied
				? CALL_PERMISSION_COPY.screenshareLabel
				: on()
					? "Stop sharing"
					: "Share screen",
		tooltip: () =>
			state.screenshareDenied
				? CALL_PERMISSION_COPY.screenshareTooltip
				: undefined,
		tone: (): CallControlTone =>
			state.screenshareDenied ? "server" : on() ? "active" : "default",
	};
};

export type CallControlsProps = CallMediaState & {
	size?: CallControlSize;
	onToggleMute?: () => void;
	onToggleDeafen?: () => void;
	onToggleCamera?: () => void;
	onToggleScreenShare?: () => void;
	screenShareMenu?: ScreenShareMenuProps;
	onOpenChat?: () => void;
	chatOpen?: boolean;
	chatAvailable?: boolean;
	onLeave?: () => void;
	class?: string;
};

export const chatToggleProps = (open: boolean | undefined) => ({
	label: open ? "Close chat" : "Open chat",
	pressed: open === undefined ? undefined : open,
	tone: (open ? "active" : "default") as CallControlTone,
});

export const CallControls = (props: CallControlsProps) => {
	const [local] = splitProps(props, ["class"]);
	const mic = micControl(props);
	const deafen = deafenControl(props);
	const camera = cameraControl(props);
	const share = screenShareControl(props);

	return (
		<div
			role="toolbar"
			aria-label="Call controls"
			data-call-controls=""
			class={cx("flex items-center justify-center gap-6", local.class)}
		>
			<Show when={props.onToggleCamera}>
				<CallControlButton
					label={camera.label()}
					tooltip={camera.tooltip()}
					pressed={camera.on()}
					tone={camera.tone()}
					size={props.size}
					disabled={camera.disabled()}
					loading={!camera.disabled() && props.cameraPending}
					icon={<AnimatedVideocameraIcon off={!camera.on()} />}
					onClick={props.onToggleCamera}
				/>
			</Show>
			<CallControlButton
				label={mic.label()}
				tooltip={mic.tooltip()}
				pressed={mic.off()}
				tone={mic.tone()}
				size={props.size}
				disabled={mic.disabled()}
				icon={<AnimatedMicrophoneIcon muted={mic.off()} />}
				onClick={props.onToggleMute}
			/>
			<CallControlButton
				label={deafen.label()}
				tooltip={deafen.tooltip()}
				pressed={deafen.off()}
				tone={deafen.tone()}
				size={props.size}
				disabled={deafen.disabled()}
				icon={<AnimatedHeadphonesIcon deafened={deafen.off()} />}
				onClick={props.onToggleDeafen}
			/>
			<Show when={props.onToggleScreenShare}>
				<ScreenShareControl
					menu={share.disabled() ? undefined : props.screenShareMenu}
				>
					<CallControlButton
						label={share.label()}
						tooltip={share.tooltip()}
						pressed={share.on()}
						tone={share.tone()}
						size={props.size}
						disabled={share.disabled()}
						icon={<AnimatedScreencastIcon trigger="press" />}
						onClick={props.onToggleScreenShare}
					/>
				</ScreenShareControl>
			</Show>
			<Show when={props.chatAvailable !== false && props.onOpenChat}>
				<CallControlButton
					label={chatToggleProps(props.chatOpen).label}
					pressed={chatToggleProps(props.chatOpen).pressed}
					tone={chatToggleProps(props.chatOpen).tone}
					size={props.size}
					icon={<ChatRoundDotsIcon />}
					onClick={props.onOpenChat}
				/>
			</Show>
			<Show when={props.onLeave}>
				<CallLeaveButton size={props.size} onClick={props.onLeave} />
			</Show>
		</div>
	);
};
