import type {
	ScreenShareFramerate,
	ScreenShareResolution,
} from "@colibri-social/ui";

export type ScreenShareQuality = {
	resolution: ScreenShareResolution;
	framerate: ScreenShareFramerate;
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

export const DEFAULT_SCREEN_SHARE: ScreenShareOptions = {
	resolution: "1080",
	framerate: 30,
	shareAudio: false,
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

const DETAIL_FRAMERATE_CEILING = 15;

const RESOLUTION_HEIGHTS: Record<ScreenShareResolution, number | undefined> = {
	"720": 720,
	"1080": 1080,
	"1440": 1440,
	source: undefined,
};

const MAX_BITRATES: Record<
	ScreenShareResolution,
	Record<ScreenShareFramerate, number>
> = {
	"720": { 15: 1_500_000, 30: 2_500_000, 60: 4_000_000 },
	"1080": { 15: 2_500_000, 30: 4_500_000, 60: 8_000_000 },
	"1440": { 15: 4_000_000, 30: 8_000_000, 60: 14_000_000 },
	source: { 15: 4_000_000, 30: 8_000_000, 60: 14_000_000 },
};

export const resolutionHeight = (
	resolution: ScreenShareResolution,
): number | undefined => RESOLUTION_HEIGHTS[resolution];

export const isScreenShareOptions = (
	value: unknown,
): value is ScreenShareOptions => {
	if (typeof value !== "object" || value === null) return false;
	const options = value as Record<string, unknown>;
	return (
		SCREEN_SHARE_RESOLUTIONS.includes(
			options.resolution as ScreenShareResolution,
		) &&
		SCREEN_SHARE_FRAMERATES.includes(
			options.framerate as ScreenShareFramerate,
		) &&
		typeof options.shareAudio === "boolean"
	);
};

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

export const supportsDisplayMedia = (): boolean =>
	typeof navigator !== "undefined" &&
	typeof navigator.mediaDevices?.getDisplayMedia === "function";

const currentUserAgent = (): string | undefined =>
	typeof navigator === "undefined" ? undefined : navigator.userAgent;

export const supportsDisplayAudio = (
	userAgent: string | undefined = currentUserAgent(),
): boolean => {
	if (!userAgent || /\bFirefox\b/i.test(userAgent)) return false;
	return /\b(?:Chrome|Chromium|Edg|OPR)\b/i.test(userAgent);
};
