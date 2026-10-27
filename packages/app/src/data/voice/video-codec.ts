import { classifyThrown, createLogger } from "@colibri-social/lib";
import type { types } from "mediasoup-client";

const log = createLogger("voice");

export const SCREEN_SCALABILITY_MODE = "L1T3";

export const SCREEN_CODEC_CANDIDATES: readonly string[] = ["video/vp8"];

const LAYERED_MIME_TYPES = new Set(["video/vp8", "video/vp9"]);

const LAYERED_HANDLERS = new Set(["Chrome111"]);

export type VideoEncodingTarget = {
	width: number;
	height: number;
	framerate: number;
	bitrate: number;
};

export type VideoEncodingSupport = {
	supported: boolean;
	powerEfficient: boolean;
};

export type VideoEncodingProbe = (
	mimeType: string,
	target: VideoEncodingTarget,
	scalabilityMode: string | undefined,
) => Promise<VideoEncodingSupport | undefined>;

export type ScreenCodecChoice = {
	codec?: types.RtpCodecCapability;
	mimeType: string;
	scalabilityMode?: string;
	powerEfficient?: boolean;
};

type MediaCapabilitiesLike = {
	encodingInfo(config: unknown): Promise<VideoEncodingSupport>;
};

export const browserEncodingProbe: VideoEncodingProbe = async (
	mimeType,
	target,
	scalabilityMode,
) => {
	const capabilities =
		typeof navigator === "undefined"
			? undefined
			: (navigator as Navigator & { mediaCapabilities?: MediaCapabilitiesLike })
					.mediaCapabilities;
	if (!capabilities?.encodingInfo) return undefined;
	try {
		const info = await capabilities.encodingInfo({
			type: "webrtc",
			video: {
				contentType: mimeType,
				width: target.width,
				height: target.height,
				bitrate: target.bitrate,
				framerate: target.framerate,
				...(scalabilityMode ? { scalabilityMode } : {}),
			},
		});
		return {
			supported: !!info.supported,
			powerEfficient: !!info.powerEfficient,
		};
	} catch (error) {
		log.debug("encoder capability probe failed", {
			mimeType,
			code: classifyThrown(error).code,
		});
		return undefined;
	}
};

const mimeOf = (codec: types.RtpCodecCapability) =>
	codec.mimeType.toLowerCase();

export const sendableVideoCodecs = (
	device: Pick<types.Device, "rtpCapabilities"> & {
		sendRtpCapabilities?: types.RtpCapabilities;
	},
): types.RtpCodecCapability[] => {
	const caps = device.sendRtpCapabilities ?? device.rtpCapabilities;
	return (caps?.codecs ?? []).filter(
		(codec) => codec.kind === "video" && mimeOf(codec) !== "video/rtx",
	);
};

export const layersFor = (
	mimeType: string,
	handlerName: string | undefined,
): string | undefined =>
	handlerName &&
	LAYERED_HANDLERS.has(handlerName) &&
	LAYERED_MIME_TYPES.has(mimeType.toLowerCase())
		? SCREEN_SCALABILITY_MODE
		: undefined;

export const pickScreenCodec = async (input: {
	codecs: readonly types.RtpCodecCapability[];
	handlerName: string | undefined;
	target: VideoEncodingTarget;
	probe: VideoEncodingProbe;
	candidates?: readonly string[];
}): Promise<ScreenCodecChoice> => {
	const candidates = input.candidates ?? SCREEN_CODEC_CANDIDATES;
	const available = candidates
		.map((mimeType) => input.codecs.find((codec) => mimeOf(codec) === mimeType))
		.filter((codec): codec is types.RtpCodecCapability => !!codec);
	const choose = (
		codec: types.RtpCodecCapability | undefined,
		powerEfficient?: boolean,
	): ScreenCodecChoice => {
		const mimeType = codec ? mimeOf(codec) : "video/vp8";
		const scalabilityMode = layersFor(mimeType, input.handlerName);
		return {
			...(codec ? { codec } : {}),
			mimeType,
			...(scalabilityMode ? { scalabilityMode } : {}),
			...(powerEfficient === undefined ? {} : { powerEfficient }),
		};
	};
	if (available.length <= 1) return choose(available[0]);
	const probed = await Promise.all(
		available.map(async (codec) => ({
			codec,
			support: await input.probe(
				mimeOf(codec),
				input.target,
				layersFor(mimeOf(codec), input.handlerName),
			),
		})),
	);
	const efficient = probed.find(
		(entry) => entry.support?.supported && entry.support.powerEfficient,
	);
	if (efficient) return choose(efficient.codec, true);
	const fallback =
		probed.find(
			(entry) =>
				mimeOf(entry.codec) === "video/vp9" && entry.support?.supported,
		) ??
		probed.find((entry) => mimeOf(entry.codec) === "video/vp8") ??
		probed[0];
	return choose(fallback?.codec, fallback?.support?.powerEfficient);
};
