import type { types } from "mediasoup-client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	browserEncodingProbe,
	layersFor,
	pickScreenCodec,
	SCREEN_CODEC_CANDIDATES,
	sendableVideoCodecs,
	type VideoEncodingProbe,
} from "./video-codec";

const codec = (
	mimeType: string,
	parameters: Record<string, unknown> = {},
): types.RtpCodecCapability => ({
	kind: mimeType.startsWith("audio") ? "audio" : "video",
	mimeType,
	clockRate: mimeType.startsWith("audio") ? 48000 : 90000,
	preferredPayloadType: 100,
	parameters,
});

const VP8 = codec("video/VP8");
const VP9 = codec("video/VP9", { "profile-id": 0 });
const H264 = codec("video/H264", { "profile-level-id": "42e028" });
const RTX = codec("video/rtx", { apt: 101 });
const OPUS = codec("audio/opus");

const TARGET = { width: 1920, height: 1080, framerate: 30, bitrate: 4_500_000 };

const probeWith =
	(
		table: Record<string, { supported: boolean; powerEfficient: boolean }>,
	): VideoEncodingProbe =>
	async (mimeType) =>
		table[mimeType];

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("sendableVideoCodecs", () => {
	it("prefers the send capabilities and drops audio and rtx", () => {
		expect(
			sendableVideoCodecs({
				rtpCapabilities: { codecs: [VP8] },
				sendRtpCapabilities: { codecs: [OPUS, VP9, RTX, VP8] },
			}),
		).toEqual([VP9, VP8]);
		expect(sendableVideoCodecs({ rtpCapabilities: { codecs: [VP8] } })).toEqual(
			[VP8],
		);
	});
});

describe("layersFor", () => {
	it("adds temporal layers for VP8 and VP9 on Chromium only", () => {
		expect(layersFor("video/VP8", "Chrome111")).toBe("L1T3");
		expect(layersFor("video/vp9", "Chrome111")).toBe("L1T3");
		expect(layersFor("video/h264", "Chrome111")).toBeUndefined();
		expect(layersFor("video/vp8", "Safari12")).toBeUndefined();
		expect(layersFor("video/vp8", "Firefox120")).toBeUndefined();
		expect(layersFor("video/vp8", undefined)).toBeUndefined();
	});
});

describe("pickScreenCodec", () => {
	it("sends VP8 with temporal layers by default without probing", async () => {
		const probe = vi.fn<VideoEncodingProbe>();
		const choice = await pickScreenCodec({
			codecs: [VP8, VP9, H264],
			handlerName: "Chrome111",
			target: TARGET,
			probe,
		});
		expect(SCREEN_CODEC_CANDIDATES).toEqual(["video/vp8"]);
		expect(choice).toEqual({
			codec: VP8,
			mimeType: "video/vp8",
			scalabilityMode: "L1T3",
		});
		expect(probe).not.toHaveBeenCalled();
	});

	it("leaves the codec to mediasoup when the device lists none", async () => {
		expect(
			await pickScreenCodec({
				codecs: [],
				handlerName: "Safari12",
				target: TARGET,
				probe: vi.fn(),
			}),
		).toEqual({ mimeType: "video/vp8" });
	});

	it("prefers a power efficient encoder", async () => {
		const probe = vi.fn(
			probeWith({
				"video/h264": { supported: true, powerEfficient: true },
				"video/vp9": { supported: true, powerEfficient: false },
				"video/vp8": { supported: true, powerEfficient: false },
			}),
		);
		const choice = await pickScreenCodec({
			codecs: [VP8, VP9, H264],
			handlerName: "Chrome111",
			target: TARGET,
			probe,
			candidates: ["video/vp9", "video/h264", "video/vp8"],
		});
		expect(choice).toEqual({
			codec: H264,
			mimeType: "video/h264",
			powerEfficient: true,
		});
		expect(probe).toHaveBeenCalledWith("video/vp9", TARGET, "L1T3");
		expect(probe).toHaveBeenCalledWith("video/h264", TARGET, undefined);
	});

	it("falls back to VP9, then VP8, when nothing is power efficient", async () => {
		const software = probeWith({
			"video/h264": { supported: true, powerEfficient: false },
			"video/vp9": { supported: true, powerEfficient: false },
			"video/vp8": { supported: true, powerEfficient: false },
		});
		const candidates = ["video/h264", "video/vp9", "video/vp8"];
		expect(
			await pickScreenCodec({
				codecs: [VP8, VP9, H264],
				handlerName: "Chrome111",
				target: TARGET,
				probe: software,
				candidates,
			}),
		).toMatchObject({ codec: VP9, scalabilityMode: "L1T3" });
		expect(
			await pickScreenCodec({
				codecs: [VP8, H264],
				handlerName: "Safari12",
				target: TARGET,
				probe: async () => undefined,
				candidates,
			}),
		).toEqual({ codec: VP8, mimeType: "video/vp8" });
	});
});

describe("browserEncodingProbe", () => {
	it("asks MediaCapabilities about a WebRTC encoder", async () => {
		const encodingInfo = vi.fn(async () => ({
			supported: true,
			powerEfficient: true,
			smooth: true,
		}));
		vi.stubGlobal("navigator", { mediaCapabilities: { encodingInfo } });
		expect(await browserEncodingProbe("video/VP9", TARGET, "L1T3")).toEqual({
			supported: true,
			powerEfficient: true,
		});
		expect(encodingInfo).toHaveBeenCalledWith({
			type: "webrtc",
			video: {
				contentType: "video/VP9",
				width: 1920,
				height: 1080,
				bitrate: 4_500_000,
				framerate: 30,
				scalabilityMode: "L1T3",
			},
		});
	});

	it("reports nothing when the probe is missing or fails", async () => {
		vi.stubGlobal("navigator", {});
		expect(await browserEncodingProbe("video/VP8", TARGET, undefined)).toBe(
			undefined,
		);
		vi.stubGlobal("navigator", {
			mediaCapabilities: {
				encodingInfo: async () => {
					throw new TypeError("unsupported");
				},
			},
		});
		expect(await browserEncodingProbe("video/VP8", TARGET, undefined)).toBe(
			undefined,
		);
	});
});
