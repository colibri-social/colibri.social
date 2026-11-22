import { describe, expect, it } from "vitest";
import { voiceDebugSections } from "./debug-sections";
import { readAudioDebug, readTransportDebug } from "./debug-stats";

const report = (stats: Record<string, unknown>[]) => ({
	forEach: (callback: (stat: Record<string, unknown>) => void) => {
		for (const stat of stats) callback(stat);
	},
});

describe("voice debug stats", () => {
	it("reads the selected candidate pair of a transport", () => {
		const transport = readTransportDebug(
			report([
				{ type: "transport", id: "T1", selectedCandidatePairId: "CP2" },
				{
					type: "candidate-pair",
					id: "CP1",
					nominated: true,
					state: "failed",
					currentRoundTripTime: 0.5,
				},
				{
					type: "candidate-pair",
					id: "CP2",
					localCandidateId: "L1",
					remoteCandidateId: "R1",
					currentRoundTripTime: 0.0384,
					availableOutgoingBitrate: 2_400_000,
				},
				{
					type: "local-candidate",
					id: "L1",
					candidateType: "relay",
					protocol: "udp",
					relayProtocol: "tls",
				},
				{
					type: "remote-candidate",
					id: "R1",
					candidateType: "host",
					protocol: "udp",
				},
			]),
			"send",
			"connected",
		);

		expect(transport).toEqual({
			direction: "send",
			state: "connected",
			rttMs: 38,
			local: { type: "relay", protocol: "udp", relayProtocol: "tls" },
			remote: { type: "host", protocol: "udp" },
			availableBitrate: 2_400_000,
		});
	});

	it("reads a receiving audio stream and its bitrate between two reads", () => {
		const stats = (bytes: number, timestamp: number) =>
			report([
				{ type: "codec", id: "C1", mimeType: "audio/opus" },
				{
					type: "inbound-rtp",
					id: "IN1",
					kind: "audio",
					codecId: "C1",
					bytesReceived: bytes,
					timestamp,
					packetsLost: 3,
					jitter: 0.012,
					audioLevel: 0.25,
				},
			]);
		const base = { id: "consumer-1", direction: "recv" as const };
		const first = readAudioDebug(stats(10_000, 1_000), base, undefined);
		const second = readAudioDebug(stats(14_000, 2_000), base, first.mark);

		expect(first.sample.bitrate).toBeUndefined();
		expect(second.sample).toEqual({
			id: "consumer-1",
			direction: "recv",
			codec: "opus",
			bitrate: 32_000,
			packetsLost: 3,
			jitterMs: 12,
			audioLevel: 0.25,
		});
	});

	it("takes loss and jitter of a sent stream from the remote report", () => {
		const { sample } = readAudioDebug(
			report([
				{
					type: "outbound-rtp",
					id: "OUT1",
					kind: "audio",
					bytesSent: 100,
					timestamp: 1,
				},
				{
					type: "remote-inbound-rtp",
					localId: "OUT1",
					kind: "audio",
					packetsLost: 1,
					jitter: 0.004,
				},
				{ type: "media-source", kind: "audio", audioLevel: 0.5 },
			]),
			{ id: "mic-1", direction: "send", source: "mic" },
			undefined,
		);

		expect(sample).toEqual({
			id: "mic-1",
			direction: "send",
			source: "mic",
			packetsLost: 1,
			jitterMs: 4,
			audioLevel: 0.5,
		});
	});

	it("turns a snapshot into diagnostics sections", () => {
		const sections = voiceDebugSections({
			node: {
				host: "https://fsn-1.nodes.test",
				id: "fsn-1",
				region: "eu",
				relayOnly: false,
				hops: 1,
			},
			failedHosts: ["https://us-1.nodes.test"],
			transports: [
				{
					direction: "send",
					state: "connected",
					rttMs: 24,
					local: { type: "host", protocol: "udp" },
					remote: { type: "host", protocol: "udp" },
					availableBitrate: 1_500_000,
				},
			],
			audio: [
				{
					id: "mic-1",
					direction: "send",
					source: "mic",
					codec: "opus",
					bitrate: 32_000,
					packetsLost: 0,
					jitterMs: 2,
					audioLevel: 0.1,
				},
			],
			video: [],
		});

		expect(sections.map((section) => section.title)).toEqual([
			"Node",
			"Connection",
			"Audio",
			"Video",
		]);
		expect(sections[0]?.fields).toContainEqual({
			kind: "list",
			label: "Skipped nodes",
			items: ["https://us-1.nodes.test"],
		});
		expect(sections[1]?.fields[0]).toEqual({
			kind: "value",
			label: "Sending",
			value:
				"connected | rtt 24 ms | local host udp | remote host udp | available 1500 kbps",
		});
		expect(sections[2]?.fields[0]).toEqual({
			kind: "value",
			label: "You, microphone",
			value:
				"sending | live | opus | 32 kbps | lost 0 | jitter 2 ms | level 0.10",
		});
	});
});
