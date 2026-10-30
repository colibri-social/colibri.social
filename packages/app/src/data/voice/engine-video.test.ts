import type { types } from "mediasoup-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VoiceEngine } from "./engine";
import {
	connect,
	DEFS,
	FakeDevice,
	FakeStream,
	FakeTrack,
	type FakeTransport,
	pending,
	reply,
	setup,
	VIEWER,
} from "./engine-fakes";
import { latestVideoStats } from "./video-stats";

const VP8 = {
	kind: "video",
	mimeType: "video/VP8",
	clockRate: 90000,
	preferredPayloadType: 96,
	parameters: {},
} as const;

const VP9 = {
	kind: "video",
	mimeType: "video/VP9",
	clockRate: 90000,
	preferredPayloadType: 98,
	parameters: { "profile-id": 0 },
} as const;

const TRANSPORT_STATS = new Map<string, Record<string, unknown>>([
	["t", { id: "t", type: "transport", selectedCandidatePairId: "pair" }],
	[
		"pair",
		{
			id: "pair",
			type: "candidate-pair",
			localCandidateId: "local",
			currentRoundTripTime: 0.045,
			availableOutgoingBitrate: 3_500_000,
		},
	],
	[
		"local",
		{
			id: "local",
			type: "local-candidate",
			protocol: "udp",
			candidateType: "srflx",
		},
	],
]);

const SCREEN_STATS = new Map<string, Record<string, unknown>>([
	[
		"out",
		{
			id: "out",
			type: "outbound-rtp",
			kind: "video",
			codecId: "codec",
			frameWidth: 1920,
			frameHeight: 1080,
			framesPerSecond: 4,
			bytesSent: 100,
			timestamp: 1,
			qualityLimitationReason: "cpu",
		},
	],
	["codec", { id: "codec", type: "codec", mimeType: "video/VP8" }],
	[
		"src",
		{ id: "src", type: "media-source", kind: "video", framesPerSecond: 30 },
	],
]);

type Produced = {
	encodings?: RTCRtpEncodingParameters[];
	codec?: types.RtpCodecCapability;
	onRtpSender?: (sender: RTCRtpSender) => void;
	appData: { source: string };
};

class ChromiumDevice extends FakeDevice {
	handlerName = "Chrome111";
	sendRtpCapabilities: { codecs: types.RtpCodecCapability[] };
	produced: Produced[] = [];
	constructor(codecs: types.RtpCodecCapability[] = [VP8]) {
		super();
		this.sendRtpCapabilities = { codecs };
	}
	createSendTransport(options: { id: string }): FakeTransport {
		const transport = super.createSendTransport(options);
		transport.getStats = async () => TRANSPORT_STATS;
		const produce = transport.produce.bind(transport);
		transport.produce = async (input) => {
			this.produced.push(input as unknown as Produced);
			const producer = await produce(input);
			return Object.assign(producer, {
				getStats: async () => SCREEN_STATS,
			});
		};
		return transport;
	}
}

let running: VoiceEngine[] = [];

beforeEach(() => {
	vi.stubGlobal("MediaStream", FakeStream);
});

afterEach(() => {
	for (const engine of running) engine.dispose();
	running = [];
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe("screen share encoding", () => {
	it("sends VP8 with temporal layers, presets degradation and samples stats", async () => {
		const device = new ChromiumDevice();
		const harness = setup({
			createDevice: () => device as unknown as types.Device,
		});
		running.push(harness.engine);
		vi.useFakeTimers({ shouldAdvanceTime: true });
		const { socket } = await connect(harness);

		const video = new FakeTrack("video");
		const sharing = harness.engine.shareScreen(
			{
				video: video as unknown as MediaStreamTrack,
				audio: null,
				release() {},
			},
			{ resolution: "1080", framerate: 60 },
		);
		await reply(socket, "produce", {
			$type: `${DEFS}producerInfo`,
			producerId: "screen-1",
			did: VIEWER,
			kind: "video",
			source: "screen",
		});
		expect(await sharing).toBe(true);

		const screen = device.produced.find(
			(entry) => entry.appData.source === "screen",
		);
		expect(screen?.codec).toEqual(VP8);
		expect(screen?.encodings).toEqual([
			expect.objectContaining({ maxFramerate: 60, scalabilityMode: "L1T3" }),
		]);

		const setParameters = vi.fn(async () => {});
		screen?.onRtpSender?.({
			getParameters: () => ({ encodings: [{}] }),
			setParameters,
		} as unknown as RTCRtpSender);
		expect(setParameters).toHaveBeenCalledWith(
			expect.objectContaining({ degradationPreference: "maintain-framerate" }),
		);

		await vi.advanceTimersByTimeAsync(2_100);
		await vi.waitFor(() =>
			expect(latestVideoStats()).toEqual([
				expect.objectContaining({
					direction: "send",
					source: "screen",
					fps: 4,
					captureFps: 30,
					limitation: "cpu",
				}),
			]),
		);

		harness.engine.stop();
		expect(latestVideoStats()).toEqual([]);
	});

	it("sends VP9 for sharp text at 30 fps and logs the send route", async () => {
		const device = new ChromiumDevice([VP8, VP9]);
		const probe = vi.fn(async (mimeType: string) => ({
			supported: true,
			powerEfficient: mimeType === "video/h264",
		}));
		const harness = setup({
			createDevice: () => device as unknown as types.Device,
			probeVideoEncoding: probe,
		});
		running.push(harness.engine);
		vi.useFakeTimers({ shouldAdvanceTime: true });
		const { socket } = await connect(harness);

		const video = new FakeTrack("video");
		const sharing = harness.engine.shareScreen(
			{
				video: video as unknown as MediaStreamTrack,
				audio: null,
				release() {},
			},
			{ resolution: "1080", framerate: 30 },
		);
		await reply(socket, "produce", {
			$type: `${DEFS}producerInfo`,
			producerId: "screen-1",
			did: VIEWER,
			kind: "video",
			source: "screen",
		});
		expect(await sharing).toBe(true);
		expect(video.contentHint).toBe("detail");

		const screen = device.produced.find(
			(entry) => entry.appData.source === "screen",
		);
		expect(screen?.codec).toEqual(VP9);
		expect(screen?.encodings).toEqual([
			expect.objectContaining({ maxFramerate: 30, scalabilityMode: "L1T3" }),
		]);
		const setParameters = vi.fn(async () => {});
		screen?.onRtpSender?.({
			getParameters: () => ({ encodings: [{}] }),
			setParameters,
		} as unknown as RTCRtpSender);
		expect(setParameters).toHaveBeenCalledWith(
			expect.objectContaining({ degradationPreference: "maintain-resolution" }),
		);

		await vi.advanceTimersByTimeAsync(2_100);
		await vi.waitFor(() =>
			expect(latestVideoStats()).toEqual([
				expect.objectContaining({
					direction: "send",
					source: "screen",
					protocol: "udp",
					candidateType: "srflx",
					relayed: false,
					rtt: 45,
					availableBitrate: 3_500_000,
				}),
			]),
		);
	});

	it("sends the screen again in VP8 once a viewer can't decode VP9", async () => {
		const device = new ChromiumDevice([VP8, VP9]);
		const harness = setup({
			createDevice: () => device as unknown as types.Device,
			probeVideoEncoding: vi.fn(async () => ({
				supported: true,
				powerEfficient: false,
			})),
		});
		running.push(harness.engine);
		const { socket } = await connect(harness);

		const video = new FakeTrack("video");
		const sharing = harness.engine.shareScreen(
			{
				video: video as unknown as MediaStreamTrack,
				audio: null,
				release() {},
			},
			{ resolution: "1080", framerate: 30 },
		);
		await reply(socket, "produce", {
			$type: `${DEFS}producerInfo`,
			producerId: "screen-1",
			did: VIEWER,
			kind: "video",
			source: "screen",
		});
		expect(await sharing).toBe(true);

		socket.serve({ $type: `${DEFS}codecUnsupported`, producerId: "screen-1" });
		await reply(socket, "produce", {
			$type: `${DEFS}producerInfo`,
			producerId: "screen-2",
			did: VIEWER,
			kind: "video",
			source: "screen",
		});
		const closing = await pending(socket, "closeProducer");
		expect(closing).toEqual(
			expect.objectContaining({ producerId: "screen-1" }),
		);
		const screens = device.produced.filter(
			(entry) => entry.appData.source === "screen",
		);
		expect(screens.map((entry) => entry.codec?.mimeType)).toEqual([
			"video/VP9",
			"video/VP8",
		]);
		expect(video.stopped).toBe(false);

		socket.serve({ $type: `${DEFS}codecUnsupported`, producerId: "screen-2" });
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(
			device.produced.filter((entry) => entry.appData.source === "screen"),
		).toHaveLength(2);
	});
});
