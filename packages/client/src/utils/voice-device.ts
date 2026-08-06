import { detectDevice, type types } from "mediasoup-client";

const WEBKIT_MIN_MAJOR = 605;
const OTHER_ENGINE = /\b(?:Chrome|Chromium|Edg|OPR|Firefox)\b/i;

export const webKitFallbackHandler = (
	userAgent: string | undefined,
): types.BuiltinHandlerName | undefined => {
	if (!userAgent || OTHER_ENGINE.test(userAgent)) return undefined;

	const major = Number(userAgent.match(/AppleWebKit\/(\d+)/i)?.[1]);
	if (!Number.isFinite(major) || major < WEBKIT_MIN_MAJOR) return undefined;

	return "Safari12";
};

export const currentUserAgent = (): string | undefined =>
	typeof navigator === "undefined" ? undefined : navigator.userAgent;

export const currentUserAgentData = (): types.NavigatorUAData | undefined =>
	typeof navigator === "undefined"
		? undefined
		: (navigator as Navigator & { userAgentData?: types.NavigatorUAData })
				.userAgentData;

export const supportsWebRtc = (): boolean =>
	typeof RTCPeerConnection !== "undefined";

export const pickVoiceHandler = (
	userAgent: string | undefined = currentUserAgent(),
	userAgentData: types.NavigatorUAData | undefined = currentUserAgentData(),
): types.BuiltinHandlerName | undefined =>
	detectDevice(userAgent, userAgentData) ?? webKitFallbackHandler(userAgent);
