import { VOICE_PERMISSIONS, type VoicePermission } from "@colibri-social/lib";
import type {
	VoiceConnectionQuality,
	VoiceConnectionState,
} from "@colibri-social/ui";
import type { ScreenShareQuality } from "../screen-share";
import type { ChannelView } from "../types";
import type { VoiceDebugSnapshot } from "./debug-stats";

export type VoiceConnection = {
	state: VoiceConnectionState;
	quality: VoiceConnectionQuality;
	latency: number | null;
};

export const DISCONNECTED: VoiceConnection = {
	state: "disconnected",
	quality: "unknown",
	latency: null,
};

export type VoiceSession = {
	channel: string;
	muted: boolean;
	deafened: boolean;
};

export type VoiceEndReason =
	| "moderator"
	| "superseded"
	| "channelGone"
	| "forbidden"
	| "closed"
	| "lost"
	| "unsupported"
	| "nodesDown"
	| "failed";

export type VoiceVideoSource = "cam" | "screen";

export type VoiceVideo = {
	did: string;
	source: VoiceVideoSource;
	stream: MediaStream;
};

export type VoiceModeration = {
	serverMuted: boolean;
	serverDeafened: boolean;
};

export type VoicePermissions = ReadonlySet<VoicePermission>;

export const ALL_VOICE_PERMISSIONS: VoicePermissions = new Set(
	VOICE_PERMISSIONS,
);

export type VoiceMoveDestination = {
	view: ChannelView;
	after?: string;
};

export type VoiceMovedListener = (
	channel: string,
	destination?: VoiceMoveDestination,
) => void;

export type VoiceMoveNotice = {
	deadline: number;
	moveNow: () => void;
};

export type VoiceNotice =
	| "screenStoppedByMove"
	| "moved"
	| "noMicrophone"
	| "streamFailed"
	| "cameraFailed"
	| "screenFailed";

export type ScreenCapture = {
	video: MediaStreamTrack;
	audio: MediaStreamTrack | null;
	release: () => void;
};

export type VoiceConnectionMonitor = {
	connection: () => VoiceConnection;
	start: (session?: VoiceSession) => void;
	stop: () => void;
	setMuted?: (muted: boolean) => void;
	setDeafened?: (deafened: boolean) => void;
	setCamera?: (on: boolean) => Promise<boolean>;
	shareScreen?: (
		capture: ScreenCapture,
		quality: ScreenShareQuality,
	) => Promise<boolean>;
	stopScreen?: () => void;
	applyScreenQuality?: (quality: ScreenShareQuality) => void;
	reportTileView?: (
		key: string,
		view: { height: number; visible: boolean },
	) => void;
	screenSharing?: () => boolean;
	micAvailable?: () => boolean;
	onMicAvailable?: (listener: (available: boolean) => void) => () => void;
	onScreenShare?: (listener: (sharing: boolean) => void) => () => void;
	speakers?: () => ReadonlySet<string>;
	videos?: () => readonly VoiceVideo[];
	moderation?: () => Readonly<Record<string, VoiceModeration>>;
	permissions?: () => VoicePermissions;
	onEnded?: (listener: (reason: VoiceEndReason) => void) => () => void;
	onMoved?: (listener: VoiceMovedListener) => () => void;
	onNotice?: (listener: (notice: VoiceNotice) => void) => () => void;
	onMove?: (listener: (move: VoiceMoveNotice | null) => void) => () => void;
	onCameraOff?: (listener: () => void) => () => void;
	debugSnapshot?: () => Promise<VoiceDebugSnapshot>;
	dispose?: () => void;
};

export const qualityFor = (latency: number): VoiceConnectionQuality => {
	if (latency < 150) return "excellent";
	if (latency < 300) return "good";
	return "poor";
};
