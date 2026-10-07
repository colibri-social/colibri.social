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

export type CallControlTone = "default" | "active" | "off" | "server";

const toneClass: Record<CallControlTone, string> = {
	default: "",
	active:
		"border-primary/40 bg-primary/15 text-primary-highlight enabled:hover:bg-primary/25 data-pressed:bg-primary/25",
	off: "text-destructive",
	server: "text-warning disabled:opacity-100",
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
	title?: string;
	onClick?: () => void;
	class?: string;
};

export const CallControlButton = (props: CallControlButtonProps) => {
	const haptics = useHaptics();
	return (
		<IconButton
			label={props.label}
			title={props.title ?? props.label}
			icon={props.icon}
			size={props.size ?? "xl"}
			variant="secondary"
			disabled={props.disabled}
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
	cameraOn?: boolean;
	screenSharing?: boolean;
};

export const micControl = (state: CallMediaState) => {
	const off = () => !!(state.muted || state.serverMuted);
	return {
		off,
		label: () =>
			state.serverMuted ? "Muted by a moderator" : off() ? "Unmute" : "Mute",
		title: () =>
			state.serverMuted
				? "A moderator muted you. Your mic stays muted until they lift it."
				: undefined,
		tone: (): CallControlTone =>
			state.serverMuted ? "server" : off() ? "off" : "default",
	};
};

export const deafenControl = (state: CallMediaState) => {
	const off = () => !!(state.deafened || state.serverDeafened);
	return {
		off,
		label: () =>
			state.serverDeafened
				? "Deafened by a moderator"
				: off()
					? "Undeafen"
					: "Deafen",
		title: () =>
			state.serverDeafened
				? "A moderator deafened you. You stay deafened until they lift it."
				: undefined,
		tone: (): CallControlTone =>
			state.serverDeafened ? "server" : off() ? "off" : "default",
	};
};

export type CallControlsProps = CallMediaState & {
	size?: CallControlSize;
	onToggleMute?: () => void;
	onToggleDeafen?: () => void;
	onToggleCamera?: () => void;
	onToggleScreenShare?: () => void;
	onOpenChat?: () => void;
	onLeave?: () => void;
	class?: string;
};

export const CallControls = (props: CallControlsProps) => {
	const [local] = splitProps(props, ["class"]);
	const mic = micControl(props);
	const deafen = deafenControl(props);
	return (
		<div
			role="toolbar"
			aria-label="Call controls"
			data-call-controls=""
			class={cx("flex items-center justify-center gap-6", local.class)}
		>
			<Show when={props.onToggleCamera}>
				<CallControlButton
					label={props.cameraOn ? "Turn off camera" : "Turn on camera"}
					pressed={!!props.cameraOn}
					tone={props.cameraOn ? "active" : "default"}
					size={props.size}
					icon={<AnimatedVideocameraIcon off={!props.cameraOn} />}
					onClick={props.onToggleCamera}
				/>
			</Show>
			<CallControlButton
				label={mic.label()}
				title={mic.title()}
				pressed={mic.off()}
				tone={mic.tone()}
				size={props.size}
				disabled={props.serverMuted}
				icon={<AnimatedMicrophoneIcon muted={mic.off()} />}
				onClick={props.onToggleMute}
			/>
			<CallControlButton
				label={deafen.label()}
				title={deafen.title()}
				pressed={deafen.off()}
				tone={deafen.tone()}
				size={props.size}
				disabled={props.serverDeafened}
				icon={<AnimatedHeadphonesIcon deafened={deafen.off()} />}
				onClick={props.onToggleDeafen}
			/>
			<Show when={props.onToggleScreenShare}>
				<CallControlButton
					label={props.screenSharing ? "Stop sharing" : "Share screen"}
					pressed={!!props.screenSharing}
					tone={props.screenSharing ? "active" : "default"}
					size={props.size}
					icon={<AnimatedScreencastIcon />}
					onClick={props.onToggleScreenShare}
				/>
			</Show>
			<Show when={props.onOpenChat}>
				<CallControlButton
					label="Open chat"
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
