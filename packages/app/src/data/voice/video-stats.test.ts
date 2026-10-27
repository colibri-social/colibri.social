import { describe, expect, it } from "vitest";
import { videoSection } from "../debug-info";
import {
	formatVideoSample,
	latestVideoStats,
	publishVideoStats,
	readVideoStats,
	type StatsLike,
} from "./video-stats";

const report = (stats: Record<string, unknown>[]): StatsLike =>
	new Map(stats.map((stat) => [stat.id as string, stat])) as StatsLike;

const outbound = (bytesSent: number, timestamp: number) =>
	report([
		{
			id: "out",
			type: "outbound-rtp",
			kind: "video",
			codecId: "codec",
			frameWidth: 1920,
			frameHeight: 1080,
			framesPerSecond: 4,
			bytesSent,
			timestamp,
			qualityLimitationReason: "cpu",
			qualityLimitationDurations: {
				none: 1,
				cpu: 3,
				bandwidth: 0,
				other: 0,
			},
			encoderImplementation: "libvpx",
			powerEfficientEncoder: false,
			scalabilityMode: "L1T3",
			nackCount: 2,
			pliCount: 5,
			keyFramesEncoded: 7,
		},
		{ id: "codec", type: "codec", mimeType: "video/VP8" },
		{ id: "src", type: "media-source", kind: "video", framesPerSecond: 30 },
		{
			id: "remote",
			type: "remote-inbound-rtp",
			kind: "video",
			packetsLost: 3,
			fractionLost: 0.01,
		},
		{ id: "audio", type: "outbound-rtp", kind: "audio", bytesSent: 999 },
	]);

describe("readVideoStats", () => {
	it("separates capture rate, encoder rate and the limiting resource", () => {
		const base = {
			id: "screen-1",
			direction: "send" as const,
			source: "screen" as const,
			trackFps: 30,
		};
		const first = readVideoStats(outbound(1_000_000, 10_000), base, undefined);
		expect(first.sample.bitrate).toBeUndefined();
		const second = readVideoStats(
			outbound(1_500_000, 12_000),
			base,
			first.mark,
		);
		expect(second.sample).toEqual({
			id: "screen-1",
			direction: "send",
			source: "screen",
			codec: "VP8",
			width: 1920,
			height: 1080,
			fps: 4,
			captureFps: 30,
			trackFps: 30,
			bitrate: 2_000_000,
			limitation: "cpu",
			limitationShares: { none: 25, cpu: 75 },
			implementation: "libvpx",
			powerEfficient: false,
			scalabilityMode: "L1T3",
			nackCount: 2,
			pliCount: 5,
			packetsLost: 3,
			fractionLost: 0.01,
			keyFrames: 7,
		});
		expect(formatVideoSample(second.sample)).toBe(
			"screen send | VP8 | 1920x1080 | 4 fps | capture 30 fps (track 30) | 2.00 Mbps | limit cpu (none 25%, cpu 75%) | L1T3 | encoder libvpx hw no | nack 2 pli 5 lost 3",
		);
	});

	it("reads decoder health for a received stream", () => {
		const { sample } = readVideoStats(
			report([
				{
					id: "in",
					type: "inbound-rtp",
					kind: "video",
					codecId: "codec",
					frameWidth: 1280,
					frameHeight: 720,
					framesPerSecond: 24,
					bytesReceived: 10,
					timestamp: 1,
					decoderImplementation: "ExternalDecoder",
					powerEfficientDecoder: true,
					packetsLost: 4,
					framesDropped: 1,
					freezeCount: 2,
					keyFramesDecoded: 9,
					nackCount: 0,
					pliCount: 1,
				},
				{ id: "codec", type: "codec", mimeType: "video/VP9" },
			]),
			{ id: "c-1", direction: "recv", source: "cam", did: "did:plc:peer" },
			undefined,
		);
		expect(formatVideoSample(sample)).toBe(
			"cam recv | VP9 | 1280x720 | 24 fps | ? | decoder ExternalDecoder hw yes | nack 0 pli 1 lost 4 | dropped 1 freezes 2 keyframes 9",
		);
	});
});

describe("debug information", () => {
	it("lists the latest video samples", () => {
		const { sample } = readVideoStats(
			outbound(1, 1),
			{ id: "screen-1", direction: "send", source: "screen" },
			undefined,
		);
		publishVideoStats([sample]);
		expect(latestVideoStats()).toEqual([sample]);
		expect(videoSection()).toEqual({
			title: "Call video",
			fields: [
				{ kind: "list", label: "Streams", items: [formatVideoSample(sample)] },
			],
		});
		publishVideoStats([]);
		expect(videoSection().fields[0]).toMatchObject({ items: [] });
	});
});
