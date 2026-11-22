import { createSignal } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SCREEN_SHARE } from "../screen-share";
import type { VoiceSettings } from "../voice-settings";
import type { VoiceEngine } from "./engine";
import {
	CHANNEL,
	connect,
	DEFS,
	FakeStream,
	type FakeTrack,
	PEER,
	reply,
	setup,
	suppressor,
	transportOptions,
	VIEWER,
} from "./engine-fakes";
import type { NoiseSuppressor } from "./noise-suppressor";
import type { ParticipantVolumes } from "./volumes";

const BASE: VoiceSettings = {
	inputVolume: 100,
	outputVolume: 100,
	noiseSuppression: true,
	voiceGate: false,
	screen: DEFAULT_SCREEN_SHARE,
};

let running: VoiceEngine[] = [];

beforeEach(() => {
	vi.stubGlobal("MediaStream", FakeStream);
});

afterEach(() => {
	for (const engine of running) engine.dispose();
	running = [];
	vi.unstubAllGlobals();
});

const harness = () => {
	const [settings, setSettings] = createSignal<VoiceSettings>(BASE);
	const [volumes, setVolumes] = createSignal<ParticipantVolumes>({});
	const graphs: NoiseSuppressor[] = [];
	const test = setup({
		settings,
		volumes,
		createSuppressor: async (track, options) => {
			const graph = suppressor(track as unknown as FakeTrack);
			graphs.push(graph);
			expect(options.inputGain).toBe(settings().inputVolume / 100);
			return graph;
		},
	});
	running.push(test.engine);
	return { ...test, setSettings, setVolumes, graphs };
};

describe("voice engine settings", () => {
	it("applies noise suppression, the voice gate and input volume live", async () => {
		const test = harness();
		await connect(test);
		const graph = test.graphs[0];
		test.setSettings({ ...BASE, noiseSuppression: false });
		expect(graph.setSuppression).toHaveBeenLastCalledWith(false);
		test.setSettings({ ...BASE, noiseSuppression: false, voiceGate: true });
		expect(graph.setGate).toHaveBeenLastCalledWith(true);
		test.setSettings({
			...BASE,
			noiseSuppression: false,
			voiceGate: true,
			inputVolume: 150,
		});
		expect(graph.setInputGain).toHaveBeenLastCalledWith(1.5);
	});

	it("captures from the saved microphone", async () => {
		const test = harness();
		test.setSettings({ ...BASE, microphone: "usb-mic" });
		await connect(test);
		expect(test.getUserMedia).toHaveBeenCalledWith({
			audio: expect.objectContaining({ deviceId: { exact: "usb-mic" } }),
		});
	});

	it("captures from the system microphone when the saved one is gone", async () => {
		const test = harness();
		test.getUserMedia.mockImplementationOnce(async () => {
			throw Object.assign(new Error("gone"), { name: "OverconstrainedError" });
		});
		test.setSettings({ ...BASE, microphone: "unplugged" });
		await connect(test);
		expect(test.getUserMedia).toHaveBeenLastCalledWith({
			audio: expect.not.objectContaining({ deviceId: expect.anything() }),
		});
		expect(test.engine.micAvailable()).toBe(true);
	});

	it("starts the microphone when one is picked after joining without one", async () => {
		const test = harness();
		test.getUserMedia.mockImplementationOnce(async () => {
			throw new DOMException("busy", "NotReadableError");
		});
		test.engine.start({ channel: CHANNEL, muted: false, deafened: false });
		await vi.waitFor(() => expect(test.sockets).toHaveLength(1));
		const socket = test.sockets[0];
		socket.open();
		await reply(socket, "join", { $type: `${DEFS}joined`, channel: CHANNEL });
		await reply(socket, "getRtpCapabilities", {
			$type: `${DEFS}rtpCapabilities`,
			payload: { codecs: [] },
		});
		await reply(socket, "createTransport", transportOptions("send-1", "send"));
		await reply(socket, "createTransport", transportOptions("recv-1", "recv"));
		await vi.waitFor(() =>
			expect(test.engine.connection().state).toBe("connected"),
		);
		expect(test.engine.micAvailable()).toBe(false);
		await reply(socket, "setSelfState", { $type: `${DEFS}ack` });

		test.setSettings({ ...BASE, microphone: "headset" });
		await reply(socket, "produce", {
			$type: `${DEFS}producerInfo`,
			producerId: "mic-1",
			did: VIEWER,
			kind: "audio",
			source: "microphone",
		});
		const state = await reply(socket, "setSelfState", { $type: `${DEFS}ack` });
		expect(state).toMatchObject({ muted: false });
		expect(test.engine.micAvailable()).toBe(true);
		expect(test.getUserMedia).toHaveBeenLastCalledWith({
			audio: expect.objectContaining({ deviceId: { exact: "headset" } }),
		});
	});

	it("switches the microphone when the saved device changes", async () => {
		const test = harness();
		await connect(test);
		test.setSettings({ ...BASE, microphone: "headset" });
		await vi.waitFor(() =>
			expect(test.getUserMedia).toHaveBeenLastCalledWith({
				audio: expect.objectContaining({ deviceId: { exact: "headset" } }),
			}),
		);
		await vi.waitFor(() => expect(test.graphs[0].destroy).toHaveBeenCalled());
	});

	it("reapplies output and participant volume to playing audio", async () => {
		const test = harness();
		const { socket } = await connect(test);
		socket.serve({
			$type: `${DEFS}producerInfo`,
			producerId: "peer-mic",
			did: PEER,
			kind: "audio",
			source: "microphone",
		});
		await reply(socket, "consume", {
			$type: `${DEFS}consumerOptions`,
			id: "consumer-1",
			producerId: "peer-mic",
			kind: "audio",
			rtpParameters: { codecs: [] },
		});
		await reply(socket, "resumeConsumer", { $type: `${DEFS}ack` });
		await vi.waitFor(() => expect(test.audio).toHaveLength(1));
		expect(test.audio[0].volume).toBe(1);
		test.setVolumes({ [PEER]: { voice: 40 } });
		expect(test.audio[0].volume).toBeCloseTo(0.4);
		test.setSettings({ ...BASE, outputVolume: 50 });
		expect(test.audio[0].volume).toBeCloseTo(0.2);
	});

	it("mutes and unmutes a screen share's sound without touching the voice", async () => {
		const test = harness();
		const { socket } = await connect(test);
		const consumeAudio = async (producerId: string, source: string) => {
			socket.serve({
				$type: `${DEFS}producerInfo`,
				producerId,
				did: PEER,
				kind: "audio",
				source,
			});
			await reply(socket, "consume", {
				$type: `${DEFS}consumerOptions`,
				id: `consumer-${producerId}`,
				producerId,
				kind: "audio",
				rtpParameters: { codecs: [] },
			});
			await reply(socket, "resumeConsumer", { $type: `${DEFS}ack` });
		};
		await consumeAudio("peer-mic", "microphone");
		await vi.waitFor(() => expect(test.audio).toHaveLength(1));
		await consumeAudio("peer-screen-audio", "screen");
		await vi.waitFor(() => expect(test.audio).toHaveLength(2));
		const [mic, stream] = test.audio;
		test.setVolumes({ [PEER]: { voice: 50, stream: 80 } });
		expect(stream.volume).toBeCloseTo(0.8);
		test.setVolumes({ [PEER]: { voice: 50, stream: 80, streamMuted: true } });
		expect(stream.volume).toBe(0);
		expect(mic.volume).toBeCloseTo(0.5);
		test.setVolumes({ [PEER]: { voice: 50, stream: 80 } });
		expect(stream.volume).toBeCloseTo(0.8);
		expect(mic.volume).toBeCloseTo(0.5);
	});

	it("keeps the camera and microphone when other settings change", async () => {
		const test = harness();
		const { socket } = await connect(test);
		const turningOn = test.engine.setCamera(true);
		await reply(socket, "produce", {
			$type: `${DEFS}producerInfo`,
			producerId: "cam-1",
			did: VIEWER,
			kind: "video",
			source: "camera",
		});
		expect(await turningOn).toBe(true);
		const camera = test.engine.videos()[0]?.stream;
		const opened = test.getUserMedia.mock.calls.length;
		test.setSettings({
			...BASE,
			screen: { ...DEFAULT_SCREEN_SHARE, framerate: 60 },
		});
		test.setSettings({ ...BASE, outputVolume: 80 });
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(test.getUserMedia).toHaveBeenCalledTimes(opened);
		expect(test.engine.videos()[0]?.stream).toBe(camera);
	});

	it("switches to a newly saved camera exactly", async () => {
		const test = harness();
		const { socket } = await connect(test);
		const turningOn = test.engine.setCamera(true);
		await reply(socket, "produce", {
			$type: `${DEFS}producerInfo`,
			producerId: "cam-1",
			did: VIEWER,
			kind: "video",
			source: "camera",
		});
		expect(await turningOn).toBe(true);
		test.setSettings({ ...BASE, camera: "cam-2" });
		await vi.waitFor(() =>
			expect(test.getUserMedia).toHaveBeenLastCalledWith({
				video: expect.objectContaining({
					width: { ideal: 1280 },
					deviceId: { exact: "cam-2" },
				}),
			}),
		);
	});
});
