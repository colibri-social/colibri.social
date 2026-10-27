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
	reply,
	setup,
	VIEWER,
} from "./engine-fakes";
import { latestVideoStats } from "./video-stats";

const VP8 = {
	kind: "video",
	mimeType: "video/VP8",
	clockRate: 90000,
	parameters: {},
} as const;

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
	sendRtpCapabilities = { codecs: [VP8] };
	produced: Produced[] = [];
	createSendTransport(options: { id: string }): FakeTransport {
		const transport = super.createSendTransport(options);
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
});
