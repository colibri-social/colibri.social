import type {
	VoiceConnectionQuality,
	VoiceConnectionState,
} from "@colibri-social/ui";

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

export type VoiceNotice = "noMicrophone" | "streamFailed" | "cameraFailed";

export type VoiceConnectionMonitor = {
	connection: () => VoiceConnection;
	start: (session?: VoiceSession) => void;
	stop: () => void;
	setMuted?: (muted: boolean) => void;
	setDeafened?: (deafened: boolean) => void;
	setCamera?: (on: boolean) => Promise<boolean>;
	speakers?: () => ReadonlySet<string>;
	videos?: () => readonly VoiceVideo[];
	moderation?: () => Readonly<Record<string, VoiceModeration>>;
	onEnded?: (listener: (reason: VoiceEndReason) => void) => () => void;
	onNotice?: (listener: (notice: VoiceNotice) => void) => () => void;
	dispose?: () => void;
};

export const qualityFor = (latency: number): VoiceConnectionQuality => {
	if (latency < 150) return "excellent";
	if (latency < 300) return "good";
	return "poor";
};
