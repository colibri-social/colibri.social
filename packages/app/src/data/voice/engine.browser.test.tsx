import { createSignal } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SCREEN_SHARE } from "../screen-share";
import type { VoiceSettings } from "../voice-settings";
import type { VoiceEngine } from "./engine";
import {
	connect,
	DEFS,
	FakeStream,
	type FakeTrack,
	PEER,
	reply,
	setup,
	suppressor,
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
			audio: expect.objectContaining({ deviceId: { ideal: "usb-mic" } }),
		});
	});

	it("switches the microphone when the saved device changes", async () => {
		const test = harness();
		await connect(test);
		test.setSettings({ ...BASE, microphone: "headset" });
		await vi.waitFor(() =>
			expect(test.getUserMedia).toHaveBeenLastCalledWith({
				audio: expect.objectContaining({ deviceId: { ideal: "headset" } }),
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
});
