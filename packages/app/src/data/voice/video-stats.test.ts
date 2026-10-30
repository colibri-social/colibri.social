import { describe, expect, it } from "vitest";
import { videoSection } from "../debug-info";
import {
	formatVideoSample,
	latestVideoStats,
	publishVideoStats,
	readVideoStats,
	type StatsLike,
	withTransportStats,
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

	it("adds the selected route, round trip and send estimate", () => {
		const stats = [
			{
				id: "out",
				type: "outbound-rtp",
				kind: "video",
				codecId: "codec",
				frameWidth: 1920,
				frameHeight: 1080,
				timestamp: 1,
			},
			{ id: "codec", type: "codec", mimeType: "video/VP9" },
			{
				id: "stale-remote",
				type: "remote-inbound-rtp",
				kind: "video",
				localId: "other",
				packetsLost: 90,
				fractionLost: 0.5,
			},
			{
				id: "remote",
				type: "remote-inbound-rtp",
				kind: "video",
				localId: "out",
				packetsLost: 12,
				fractionLost: 0.04,
			},
			{ id: "t", type: "transport", selectedCandidatePairId: "pair" },
			{
				id: "old-pair",
				type: "candidate-pair",
				nominated: true,
				state: "succeeded",
				localCandidateId: "host",
				currentRoundTripTime: 0.9,
			},
			{
				id: "pair",
				type: "candidate-pair",
				localCandidateId: "turn",
				currentRoundTripTime: 0.0834,
				availableOutgoingBitrate: 3_200_000,
			},
			{
				id: "host",
				type: "local-candidate",
				protocol: "udp",
				candidateType: "host",
			},
			{
				id: "turn",
				type: "local-candidate",
				protocol: "udp",
				candidateType: "relay",
				relayProtocol: "tcp",
			},
		];
		const { sample } = readVideoStats(
			report(stats),
			{ id: "screen-1", direction: "send", source: "screen" },
			undefined,
		);
		expect(sample).toMatchObject({
			codec: "VP9",
			packetsLost: 12,
			fractionLost: 0.04,
			protocol: "udp",
			candidateType: "relay",
			relayed: true,
			relayProtocol: "tcp",
			rtt: 83,
			availableBitrate: 3_200_000,
		});
		expect(formatVideoSample(sample)).toBe(
			"screen send | VP9 | 1920x1080 | ? fps | capture ? fps (track ?) | ? | limit ? | net udp relay tcp rtt 83 ms avail 3.20 Mbps loss 4% | encoder ? hw ? | nack ? pli ? lost 12",
		);
	});

	it("falls back to the nominated pair and reports a direct route", () => {
		const { sample } = readVideoStats(
			report([
				{ id: "out", type: "outbound-rtp", kind: "video", timestamp: 1 },
				{
					id: "pair",
					type: "candidate-pair",
					nominated: true,
					state: "succeeded",
					localCandidateId: "local",
					currentRoundTripTime: 0.02,
				},
				{
					id: "local",
					type: "local-candidate",
					protocol: "tcp",
					candidateType: "host",
				},
			]),
			{ id: "cam-1", direction: "send", source: "cam" },
			undefined,
		);
		expect(sample).toMatchObject({
			protocol: "tcp",
			candidateType: "host",
			relayed: false,
			rtt: 20,
		});
		expect(sample.relayProtocol).toBeUndefined();
		expect(formatVideoSample(sample)).toContain(
			"net tcp direct rtt 20 ms avail ? loss ?",
		);
	});

	it("leaves out the route for a received stream", () => {
		const { sample } = readVideoStats(
			report([
				{ id: "in", type: "inbound-rtp", kind: "video", timestamp: 1 },
				{
					id: "pair",
					type: "candidate-pair",
					selected: true,
					localCandidateId: "local",
					currentRoundTripTime: 0.02,
				},
				{ id: "local", type: "local-candidate", protocol: "udp" },
			]),
			{ id: "c-1", direction: "recv", source: "cam" },
			undefined,
		);
		expect(sample.protocol).toBeUndefined();
		expect(sample.rtt).toBeUndefined();
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

describe("withTransportStats", () => {
	const collect = (stats: StatsLike) => {
		const ids: string[] = [];
		stats.forEach((stat) => {
			ids.push(stat.id ?? "");
		});
		return ids;
	};

	it("keeps a report that already names a candidate pair", async () => {
		const own = report([
			{ id: "out", type: "outbound-rtp" },
			{ id: "pair", type: "candidate-pair" },
		]);
		const readTransport = async () => report([]);
		expect(await withTransportStats(own, readTransport)).toBe(own);
	});

	it("adds the transport route from the transport report", async () => {
		const merged = await withTransportStats(
			report([{ id: "out", type: "outbound-rtp" }]),
			async () =>
				report([
					{ id: "other-out", type: "outbound-rtp" },
					{ id: "t", type: "transport" },
					{ id: "pair", type: "candidate-pair" },
					{ id: "local", type: "local-candidate" },
					{ id: "remote", type: "remote-candidate" },
				]),
		);
		expect(collect(merged)).toEqual(["out", "t", "pair", "local", "remote"]);
	});

	it("keeps the report when no transport is available", async () => {
		const own = report([{ id: "out", type: "outbound-rtp" }]);
		expect(await withTransportStats(own, undefined)).toBe(own);
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
