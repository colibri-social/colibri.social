import type {
	VoiceConnectionQuality,
	VoiceConnectionState,
} from "@colibri-social/ui";
import type { ScreenShareQuality } from "../screen-share";

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

export type VoiceNotice =
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
	screenSharing?: () => boolean;
	onScreenShare?: (listener: (sharing: boolean) => void) => () => void;
	speakers?: () => ReadonlySet<string>;
	videos?: () => readonly VoiceVideo[];
	moderation?: () => Readonly<Record<string, VoiceModeration>>;
	onEnded?: (listener: (reason: VoiceEndReason) => void) => () => void;
	onMoved?: (listener: (channel: string) => void) => () => void;
	onNotice?: (listener: (notice: VoiceNotice) => void) => () => void;
	dispose?: () => void;
};

export const qualityFor = (latency: number): VoiceConnectionQuality => {
	if (latency < 150) return "excellent";
	if (latency < 300) return "good";
	return "poor";
};
