import { currentUserAgent } from "./voice-device";

export type ScreenResolution = "720" | "1080" | "1440" | "source";
export type ScreenFramerate = 15 | 30 | 60;

export type ScreenShareQuality = {
	resolution: ScreenResolution;
	framerate: ScreenFramerate;
};

export type ScreenShareOptions = ScreenShareQuality & {
	shareAudio: boolean;
};

export type DisplayMediaRequest = {
	video: MediaTrackConstraints;
	audio: boolean;
	systemAudio?: "include" | "exclude";
	selfBrowserSurface?: "include" | "exclude";
	surfaceSwitching?: "include" | "exclude";
};

export const SCREEN_RESOLUTIONS: readonly ScreenResolution[] = [
	"720",
	"1080",
	"1440",
	"source",
];

export const SCREEN_FRAMERATES: readonly ScreenFramerate[] = [15, 30, 60];

export const DEFAULT_SCREEN_RESOLUTION: ScreenResolution = "1080";
export const DEFAULT_SCREEN_FRAMERATE: ScreenFramerate = 30;

const DETAIL_FRAMERATE_CEILING = 15;

const RESOLUTION_HEIGHTS: Record<ScreenResolution, number | undefined> = {
	"720": 720,
	"1080": 1080,
	"1440": 1440,
	source: undefined,
};

const MAX_BITRATES: Record<
	ScreenResolution,
	Record<ScreenFramerate, number>
> = {
	"720": { 15: 1_500_000, 30: 2_500_000, 60: 4_000_000 },
	"1080": { 15: 2_500_000, 30: 4_500_000, 60: 8_000_000 },
	"1440": { 15: 4_000_000, 30: 8_000_000, 60: 14_000_000 },
	source: { 15: 4_000_000, 30: 8_000_000, 60: 14_000_000 },
};

export const resolutionLabel = (resolution: ScreenResolution): string =>
	resolution === "source" ? "Source" : `${resolution}p`;

export const framerateLabel = (framerate: ScreenFramerate): string =>
	`${framerate} FPS`;

export const normalizeResolution = (value: unknown): ScreenResolution =>
	SCREEN_RESOLUTIONS.includes(value as ScreenResolution)
		? (value as ScreenResolution)
		: DEFAULT_SCREEN_RESOLUTION;

export const normalizeFramerate = (value: unknown): ScreenFramerate =>
	SCREEN_FRAMERATES.includes(value as ScreenFramerate)
		? (value as ScreenFramerate)
		: DEFAULT_SCREEN_FRAMERATE;

export const screenMaxBitrate = (quality: ScreenShareQuality): number =>
	MAX_BITRATES[quality.resolution][quality.framerate];

export const screenContentHint = (quality: ScreenShareQuality): string =>
	quality.framerate <= DETAIL_FRAMERATE_CEILING ? "detail" : "motion";

export const screenDegradationPreference = (
	quality: ScreenShareQuality,
): RTCDegradationPreference =>
	quality.framerate <= DETAIL_FRAMERATE_CEILING
		? "maintain-resolution"
		: "maintain-framerate";

export const screenVideoConstraints = (
	quality: ScreenShareQuality,
): MediaTrackConstraints => {
	const constraints: MediaTrackConstraints = {
		frameRate: { ideal: quality.framerate, max: quality.framerate },
	};

	const height = RESOLUTION_HEIGHTS[quality.resolution];
	if (height !== undefined) {
		constraints.height = { ideal: height, max: height };
	}

	return constraints;
};

export const screenEncodings = (
	quality: ScreenShareQuality,
): RTCRtpEncodingParameters[] => [{ maxBitrate: screenMaxBitrate(quality) }];

export const screenCodecOptions = (
	quality: ScreenShareQuality,
): { videoGoogleStartBitrate: number } => ({
	videoGoogleStartBitrate: Math.round(screenMaxBitrate(quality) / 2000),
});

export const displayMediaRequest = (
	options: ScreenShareOptions,
): DisplayMediaRequest => ({
	video: screenVideoConstraints(options),
	audio: options.shareAudio,
	systemAudio: options.shareAudio ? "include" : "exclude",
	selfBrowserSurface: "exclude",
	surfaceSwitching: "include",
});

export const supportsScreenShare = (): boolean =>
	typeof navigator !== "undefined" &&
	typeof navigator.mediaDevices?.getDisplayMedia === "function";

export const supportsDisplayAudio = (
	userAgent: string | undefined = currentUserAgent(),
): boolean => {
	if (!userAgent || /\bFirefox\b/i.test(userAgent)) return false;
	return /\b(?:Chrome|Chromium|Edg|OPR)\b/i.test(userAgent);
};
