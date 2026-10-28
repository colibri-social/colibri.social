import { AUTH_SUBPROTOCOL, VOICE_SIGNAL_LXM } from "@colibri-social/lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SCREEN_SHARE } from "../screen-share";
import { DEFAULT_VOICE_SETTINGS } from "../voice-settings";
import {
	endReasonOf,
	reconnectDelay,
	type VoiceEngine,
	voiceSocketUrl,
} from "./engine";
import {
	CHANNEL,
	connect,
	DEFS,
	FakeStream,
	FakeTrack,
	type FakeTransport,
	flush,
	handshake,
	OTHER_CHANNEL,
	PEER,
	pending,
	reply,
	setup,
	suppressor,
	transportOptions,
	VIEWER,
} from "./engine-fakes";

let running: VoiceEngine[] = [];

beforeEach(() => {
	vi.stubGlobal("MediaStream", FakeStream);
});

afterEach(() => {
	for (const engine of running) engine.dispose();
	running = [];
	vi.unstubAllGlobals();
});

const withCamera = (camera: string) => ({
	...DEFAULT_VOICE_SETTINGS,
	camera,
});

const camProducerInfo = {
	$type: `${DEFS}producerInfo`,
	producerId: "cam-1",
	did: VIEWER,
	kind: "video",
	source: "camera",
};

const track = (harness: ReturnType<typeof setup>) => {
	running.push(harness.engine);
	return harness;
};

describe("voice engine helpers", () => {
	it("builds the signaling URL on the AppView host", () => {
		expect(voiceSocketUrl("wss://appview.test")).toBe(
			`wss://appview.test/xrpc/${VOICE_SIGNAL_LXM}`,
		);
		expect(voiceSocketUrl("http://localhost:3000")).toBe(
			`ws://localhost:3000/xrpc/${VOICE_SIGNAL_LXM}`,
		);
	});

	it("maps server disconnect reasons", () => {
		expect(endReasonOf("moderator")).toBe("moderator");
		expect(endReasonOf("superseded")).toBe("superseded");
		expect(endReasonOf("something-new")).toBe("closed");
		expect(endReasonOf(undefined)).toBe("closed");
	});

	it("backs off between reconnect attempts up to ten seconds", () => {
		expect([1, 2, 3, 4, 5, 6].map(reconnectDelay)).toEqual([
			1_000, 2_000, 4_000, 8_000, 10_000, 10_000,
		]);
	});
});

describe("voice engine", () => {
	it("authorizes, joins and finishes the handshake", async () => {
		const harness = track(setup());
		const { socket, selfState } = await connect(harness);
		expect(harness.getServiceAuth).toHaveBeenCalledWith(
			expect.objectContaining({
				aud: "did:web:appview.test#colibri_appview",
				lxm: VOICE_SIGNAL_LXM,
			}),
		);
		expect(socket.url).toBe(`wss://appview.test/xrpc/${VOICE_SIGNAL_LXM}`);
		expect(socket.protocols).toEqual([AUTH_SUBPROTOCOL, "token"]);
		expect(socket.sent[0]).toMatchObject({ channel: CHANNEL });
		expect(selfState).toMatchObject({ muted: false, deafened: false });
		expect(harness.getUserMedia).toHaveBeenCalledWith({
			audio: expect.objectContaining({ echoCancellation: true }),
		});
	});

	it("joins muted with a paused microphone and unmutes on request", async () => {
		const harness = track(setup());
		const { socket, selfState } = await connect(harness, {
			channel: CHANNEL,
			muted: true,
			deafened: false,
		});
		expect(selfState).toMatchObject({ muted: true });
		harness.engine.setMuted(false);
		const frame = await reply(socket, "setSelfState", { $type: `${DEFS}ack` });
		expect(frame).toMatchObject({ muted: false });
	});

	it("plays a peer's microphone at the saved volumes and pauses it on deafen", async () => {
		const harness = track(
			setup({
				settings: () => ({
					inputVolume: 100,
					outputVolume: 50,
					noiseSuppression: true,
					voiceGate: false,
					screen: DEFAULT_SCREEN_SHARE,
				}),
				volumes: () => ({ [PEER]: { voice: 50 } }),
			}),
		);
		const { socket } = await connect(harness);
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
		await vi.waitFor(() => expect(harness.audio).toHaveLength(1));
		expect(harness.audio[0].volume).toBe(0.25);
		expect(harness.audio[0].playing).toBe(true);
		harness.engine.setDeafened(true);
		const recv = harness.devices[0].recv as FakeTransport;
		expect(recv.consumers[0].paused).toBe(true);
	});

	it("boosts a peer above 100% through a gain node", async () => {
		const boosted = { id: "boosted" } as unknown as MediaStream;
		const gain = { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() };
		const harness = track(
			setup({
				volumes: () => ({ [PEER]: { voice: 150 } }),
				createAudioContext: () => ({
					createMediaStreamSource: () => ({
						connect: vi.fn(),
						disconnect: vi.fn(),
					}),
					createGain: () => gain,
					createMediaStreamDestination: () => ({
						stream: boosted,
						connect: vi.fn(),
						disconnect: vi.fn(),
					}),
				}),
			}),
		);
		const { socket } = await connect(harness);
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
		await vi.waitFor(() => expect(harness.audio.length).toBeGreaterThan(0));
		expect(harness.audio[0].volume).toBe(1);
		expect(harness.audio[0].srcObject).toBe(boosted);
		expect(gain.gain.value).toBe(1.5);
	});

	it("starts a muted screen share silent and keeps the sharer's voice playing", async () => {
		const harness = track(
			setup({
				volumes: () => ({
					[PEER]: { voice: 50, stream: 80, streamMuted: true },
				}),
			}),
		);
		const { socket } = await connect(harness);
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
		await vi.waitFor(() => expect(harness.audio).toHaveLength(1));
		await consumeAudio("peer-screen-audio", "screen");
		await vi.waitFor(() => expect(harness.audio).toHaveLength(2));
		const [mic, stream] = harness.audio;
		expect(mic.volume).toBe(0.5);
		expect(stream.volume).toBe(0);
		expect(stream.playing).toBe(true);
	});

	it("shows a peer's camera until the producer goes away", async () => {
		const harness = track(setup());
		const { socket } = await connect(harness);
		socket.serve({
			$type: `${DEFS}producerInfo`,
			producerId: "peer-cam",
			did: PEER,
			kind: "video",
			source: "camera",
		});
		await reply(socket, "consume", {
			$type: `${DEFS}consumerOptions`,
			id: "consumer-2",
			producerId: "peer-cam",
			kind: "video",
			rtpParameters: { codecs: [] },
		});
		await reply(socket, "resumeConsumer", { $type: `${DEFS}ack` });
		await vi.waitFor(() =>
			expect(harness.engine.videos()).toEqual([
				expect.objectContaining({ did: PEER, source: "cam" }),
			]),
		);
		socket.serve({
			$type: `${DEFS}producerRemoved`,
			producerId: "peer-cam",
			did: PEER,
		});
		expect(harness.engine.videos()).toEqual([]);
	});

	it("tracks speakers and moderation from the server", async () => {
		const harness = track(setup());
		const { socket } = await connect(harness);
		socket.serve({
			$type: `${DEFS}speakingUpdate`,
			did: PEER,
			speaking: true,
		});
		expect([...harness.engine.speakers()]).toEqual([PEER]);
		socket.serve({
			$type: `${DEFS}moderationChanged`,
			did: PEER,
			muted: true,
			deafened: false,
			serverMuted: true,
		});
		expect(harness.engine.moderation()[PEER]).toEqual({
			serverMuted: true,
			serverDeafened: false,
		});
		socket.serve({ $type: `${DEFS}peerLeft`, did: PEER });
		expect(harness.engine.speakers().size).toBe(0);
		expect(harness.engine.moderation()[PEER]).toBeUndefined();
	});

	it("reports the viewer's own speaking to the server and stops it on mute", async () => {
		let onSpeaking: ((speaking: boolean) => void) | undefined;
		const harness = track(
			setup({
				createSuppressor: async (input, options) => {
					onSpeaking = options.onSpeaking;
					return suppressor(input as unknown as FakeTrack);
				},
			}),
		);
		const { socket } = await connect(harness);
		expect(socket.speaking).toEqual([false]);

		onSpeaking?.(true);
		expect([...harness.engine.speakers()]).toEqual([VIEWER]);
		onSpeaking?.(true);
		onSpeaking?.(false);
		onSpeaking?.(true);
		expect(socket.speaking).toEqual([false, true, false, true]);

		harness.engine.setMuted(true);
		expect(harness.engine.speakers().size).toBe(0);
		harness.engine.setMuted(false);
		await reply(socket, "setSelfState", { $type: `${DEFS}ack` });
		harness.engine.setMuted(true);
		expect(socket.speaking).toEqual([false, true, false, true, false, false]);
	});

	it("ends the call when a moderator disconnects the viewer", async () => {
		const harness = track(setup());
		const { socket } = await connect(harness);
		socket.serve({ $type: `${DEFS}disconnected`, reason: "moderator" });
		expect(harness.ended).toEqual(["moderator"]);
		expect(harness.engine.connection().state).toBe("disconnected");
		expect(socket.closed).toBe(true);
	});

	it("reports a move without ending the call", async () => {
		const harness = track(setup());
		const { socket } = await connect(harness);
		const moves: string[] = [];
		harness.engine.onMoved((channel) => moves.push(channel));
		socket.serve({ $type: `${DEFS}moved`, channel: OTHER_CHANNEL });
		expect(moves).toEqual([OTHER_CHANNEL]);
		expect(harness.ended).toEqual([]);
	});

	it("reconnects after the signaling socket drops", async () => {
		const harness = track(setup());
		const { socket } = await connect(harness);
		socket.drop();
		expect(harness.engine.connection()).toEqual({
			state: "reconnecting",
			quality: "lost",
			latency: null,
		});
		expect(harness.ended).toEqual([]);
	});

	it("joins listen-only when the microphone is unavailable", async () => {
		const harness = track(
			setup({
				media: {
					getUserMedia: async () => {
						throw new DOMException("denied", "NotAllowedError");
					},
				},
			}),
		);
		harness.engine.start({ channel: CHANNEL, muted: false, deafened: false });
		await vi.waitFor(() => expect(harness.sockets).toHaveLength(1));
		const socket = harness.sockets[0];
		socket.open();
		await reply(socket, "join", { $type: `${DEFS}joined`, channel: CHANNEL });
		await reply(socket, "getRtpCapabilities", {
			$type: `${DEFS}rtpCapabilities`,
			payload: { codecs: [] },
		});
		await reply(socket, "createTransport", transportOptions("send-1", "send"));
		await reply(socket, "createTransport", transportOptions("recv-1", "recv"));
		await vi.waitFor(() =>
			expect(harness.engine.connection().state).toBe("connected"),
		);
		expect(harness.notices).toEqual(["noMicrophone"]);
		expect(harness.engine.connection().latency).toBeNull();
		await reply(socket, "setSelfState", { $type: `${DEFS}ack` });
		await vi.waitFor(() =>
			expect(harness.engine.connection().latency).toBeGreaterThan(0),
		);
	});

	it("joins listen-only without a warning when there is no microphone", async () => {
		const harness = track(
			setup({
				media: {
					getUserMedia: async () => {
						throw new DOMException("none", "NotFoundError");
					},
				},
			}),
		);
		harness.engine.start({ channel: CHANNEL, muted: false, deafened: false });
		await vi.waitFor(() => expect(harness.sockets).toHaveLength(1));
		const socket = harness.sockets[0];
		socket.open();
		await reply(socket, "join", { $type: `${DEFS}joined`, channel: CHANNEL });
		await reply(socket, "getRtpCapabilities", {
			$type: `${DEFS}rtpCapabilities`,
			payload: { codecs: [] },
		});
		await reply(socket, "createTransport", transportOptions("send-1", "send"));
		await reply(socket, "createTransport", transportOptions("recv-1", "recv"));
		await vi.waitFor(() =>
			expect(harness.engine.connection().state).toBe("connected"),
		);
		expect(harness.notices).toEqual([]);
		expect(harness.engine.micAvailable()).toBe(false);
		const state = await reply(socket, "setSelfState", { $type: `${DEFS}ack` });
		expect(state).toMatchObject({ muted: true });
	});

	it("gives up when the system has no WebRTC", async () => {
		const harness = track(setup({ webRtc: () => false }));
		harness.engine.start({ channel: CHANNEL, muted: false, deafened: false });
		await flush();
		expect(harness.ended).toEqual(["unsupported"]);
		expect(harness.sockets).toHaveLength(0);
	});

	it("fails the join when the server rejects it", async () => {
		const harness = track(setup());
		harness.engine.start({ channel: CHANNEL, muted: false, deafened: false });
		await vi.waitFor(() => expect(harness.sockets).toHaveLength(1));
		const socket = harness.sockets[0];
		socket.open();
		await reply(socket, "join", {
			$type: `${DEFS}error`,
			error: "VoiceUnavailable",
		});
		await vi.waitFor(() => expect(harness.ended).toEqual(["failed"]));
	});

	it("turns the camera on and off", async () => {
		const harness = track(setup());
		const { socket } = await connect(harness);
		const turningOn = harness.engine.setCamera(true);
		await reply(socket, "produce", {
			$type: `${DEFS}producerInfo`,
			producerId: "cam-1",
			did: VIEWER,
			kind: "video",
			source: "camera",
		});
		expect(await turningOn).toBe(true);
		expect(harness.engine.videos()).toEqual([
			expect.objectContaining({ did: VIEWER, source: "cam" }),
		]);
		expect(await harness.engine.setCamera(false)).toBe(false);
		expect(harness.engine.videos()).toEqual([]);
		const close = await pending(socket, "closeProducer");
		expect(close).toMatchObject({ producerId: "cam-1" });
	});

	it("resumes the camera after the signaling socket reconnects", async () => {
		const harness = track(setup());
		const { socket } = await connect(harness);
		const offs: number[] = [];
		harness.engine.onCameraOff(() => offs.push(1));
		const turningOn = harness.engine.setCamera(true);
		expect(harness.engine.camera()).toBe(true);
		await reply(socket, "produce", camProducerInfo);
		expect(await turningOn).toBe(true);
		socket.drop();
		expect(harness.engine.camera()).toBe(true);
		expect(harness.engine.videos()).toEqual([]);
		await vi.waitFor(() => expect(harness.sockets).toHaveLength(2), {
			timeout: 3_000,
		});
		const next = harness.sockets[1];
		await handshake(harness, next);
		const produce = await reply(next, "produce", {
			...camProducerInfo,
			producerId: "cam-2",
		});
		expect(produce).toMatchObject({ kind: "video", source: "camera" });
		await vi.waitFor(() =>
			expect(harness.engine.videos()).toEqual([
				expect.objectContaining({ did: VIEWER, source: "cam" }),
			]),
		);
		expect(harness.engine.camera()).toBe(true);
		expect(offs).toEqual([]);
		expect(harness.notices).toEqual([]);
	});

	it("turns the camera off when it cannot resume after a reconnect", async () => {
		const harness = track(setup());
		const { socket } = await connect(harness);
		const offs: number[] = [];
		harness.engine.onCameraOff(() => offs.push(1));
		const turningOn = harness.engine.setCamera(true);
		await reply(socket, "produce", camProducerInfo);
		expect(await turningOn).toBe(true);
		const open = harness.getUserMedia.getMockImplementation();
		harness.getUserMedia.mockImplementation(async (constraints) => {
			if (constraints.video)
				throw new DOMException("denied", "NotAllowedError");
			return (open as NonNullable<typeof open>)(constraints);
		});
		socket.drop();
		await vi.waitFor(() => expect(harness.sockets).toHaveLength(2), {
			timeout: 3_000,
		});
		const next = harness.sockets[1];
		await handshake(harness, next);
		await vi.waitFor(() => expect(harness.engine.camera()).toBe(false));
		expect(offs).toEqual([1]);
		expect(harness.notices).toEqual(["cameraFailed"]);
		expect(harness.engine.videos()).toEqual([]);
		await flush();
		expect(next.sent.slice(next.answered)).toEqual([]);
	});

	it("turns the camera off when its track ends", async () => {
		const harness = track(setup());
		const { socket } = await connect(harness);
		const offs: number[] = [];
		harness.engine.onCameraOff(() => offs.push(1));
		const turningOn = harness.engine.setCamera(true);
		await reply(socket, "produce", camProducerInfo);
		expect(await turningOn).toBe(true);
		const stream = (await harness.getUserMedia.mock.results.at(-1)
			?.value) as unknown as FakeStream;
		const camTrack = stream.getVideoTracks()[0];
		camTrack.listeners.get("ended")?.();
		expect(harness.engine.camera()).toBe(false);
		expect(offs).toEqual([1]);
		expect(harness.engine.videos()).toEqual([]);
		const close = await pending(socket, "closeProducer");
		expect(close).toMatchObject({ producerId: "cam-1" });
	});

	it("does not resume a camera turned off before the reconnect", async () => {
		const harness = track(setup());
		const { socket } = await connect(harness);
		const turningOn = harness.engine.setCamera(true);
		await reply(socket, "produce", camProducerInfo);
		expect(await turningOn).toBe(true);
		expect(await harness.engine.setCamera(false)).toBe(false);
		expect(harness.engine.camera()).toBe(false);
		socket.drop();
		await vi.waitFor(() => expect(harness.sockets).toHaveLength(2), {
			timeout: 3_000,
		});
		const next = harness.sockets[1];
		await handshake(harness, next);
		await flush();
		expect(next.sent.slice(next.answered)).toEqual([]);
		expect(harness.engine.camera()).toBe(false);
	});

	it("drops a camera turned off while the device is still opening", async () => {
		const harness = track(setup());
		const { socket } = await connect(harness);
		const camTrack = new FakeTrack("video");
		let open: (stream: MediaStream) => void = () => {};
		harness.getUserMedia.mockImplementationOnce(
			() =>
				new Promise<MediaStream>((resolve) => {
					open = resolve;
				}),
		);
		const calls = harness.getUserMedia.mock.calls.length;
		const turningOn = harness.engine.setCamera(true);
		const again = harness.engine.setCamera(true);
		await flush();
		expect(harness.getUserMedia.mock.calls.length).toBe(calls + 1);
		expect(await harness.engine.setCamera(false)).toBe(false);
		open(new FakeStream([camTrack]) as unknown as MediaStream);
		expect(await turningOn).toBe(false);
		expect(await again).toBe(false);
		await flush();
		expect(camTrack.stopped).toBe(true);
		expect(harness.engine.videos()).toEqual([]);
		expect(socket.sent.slice(socket.answered)).toEqual([]);
		expect(harness.notices).toEqual([]);
	});

	it("closes a camera turned off while it is still being sent", async () => {
		const harness = track(setup());
		const { socket } = await connect(harness);
		const turningOn = harness.engine.setCamera(true);
		await vi.waitFor(() =>
			expect(socket.sent[socket.answered]?.$type).toBe(`${DEFS}produce`),
		);
		expect(await harness.engine.setCamera(false)).toBe(false);
		expect(harness.engine.videos()).toEqual([]);
		await reply(socket, "produce", {
			$type: `${DEFS}producerInfo`,
			producerId: "cam-1",
			did: VIEWER,
			kind: "video",
			source: "camera",
		});
		expect(await turningOn).toBe(false);
		expect(harness.engine.videos()).toEqual([]);
		const close = await pending(socket, "closeProducer");
		expect(close).toMatchObject({ producerId: "cam-1" });
	});

	it("opens the saved camera exactly at 720p", async () => {
		const harness = track(setup({ settings: () => withCamera("cam-2") }));
		const { socket } = await connect(harness);
		const turningOn = harness.engine.setCamera(true);
		await reply(socket, "produce", camProducerInfo);
		expect(await turningOn).toBe(true);
		expect(harness.getUserMedia).toHaveBeenLastCalledWith({
			video: {
				width: { ideal: 1280 },
				height: { ideal: 720 },
				aspectRatio: { ideal: 16 / 9 },
				deviceId: { exact: "cam-2" },
			},
		});
	});

	it.each([
		"OverconstrainedError",
		"NotFoundError",
	])("falls back to the default camera on %s", async (name) => {
		const harness = track(setup({ settings: () => withCamera("unplugged") }));
		const { socket } = await connect(harness);
		harness.getUserMedia.mockImplementationOnce(async () => {
			throw new DOMException("gone", name);
		});
		const turningOn = harness.engine.setCamera(true);
		await reply(socket, "produce", camProducerInfo);
		expect(await turningOn).toBe(true);
		expect(harness.getUserMedia).toHaveBeenLastCalledWith({
			video: {
				width: { ideal: 1280 },
				height: { ideal: 720 },
				aspectRatio: { ideal: 16 / 9 },
			},
		});
		expect(harness.notices).toEqual([]);
	});

	it("reports a blocked camera without trying the default one", async () => {
		const harness = track(setup({ settings: () => withCamera("cam-2") }));
		await connect(harness);
		const calls = harness.getUserMedia.mock.calls.length;
		harness.getUserMedia.mockImplementationOnce(async () => {
			throw new DOMException("denied", "NotAllowedError");
		});
		expect(await harness.engine.setCamera(true)).toBe(false);
		expect(harness.getUserMedia.mock.calls.length).toBe(calls + 1);
		expect(harness.notices).toEqual(["cameraFailed"]);
	});

	it("shares the screen with sound and stops when the capture ends", async () => {
		const harness = track(setup());
		const { socket } = await connect(harness);
		const changes: boolean[] = [];
		harness.engine.onScreenShare((sharing) => changes.push(sharing));
		const video = new FakeTrack("video");
		const audio = new FakeTrack("audio");
		const release = vi.fn();
		const sharing = harness.engine.shareScreen(
			{
				video: video as unknown as MediaStreamTrack,
				audio: audio as unknown as MediaStreamTrack,
				release,
			},
			{ resolution: "1080", framerate: 15 },
		);
		expect(harness.engine.screenSharing()).toBe(true);
		const produced = await reply(socket, "produce", {
			$type: `${DEFS}producerInfo`,
			producerId: "screen-1",
			did: VIEWER,
			kind: "video",
			source: "screen",
		});
		expect(produced).toMatchObject({ kind: "video", source: "screen" });
		await reply(socket, "produce", {
			$type: `${DEFS}producerInfo`,
			producerId: "screen-audio-1",
			did: VIEWER,
			kind: "audio",
			source: "screen",
		});
		expect(await sharing).toBe(true);
		expect(video.contentHint).toBe("detail");
		expect(harness.engine.videos()).toEqual([
			expect.objectContaining({ did: VIEWER, source: "screen" }),
		]);
		harness.engine.applyScreenQuality({ resolution: "720", framerate: 60 });
		expect(video.contentHint).toBe("motion");
		expect(video.constraints.at(-1)).toMatchObject({
			height: { ideal: 720, max: 720 },
		});
		video.listeners.get("ended")?.();
		expect(harness.engine.screenSharing()).toBe(false);
		expect(harness.engine.videos()).toEqual([]);
		expect(release).toHaveBeenCalledOnce();
		expect(audio.stopped).toBe(true);
		expect(changes).toEqual([true, false]);
		const closed = [
			await reply(socket, "closeProducer", { $type: `${DEFS}ack` }),
			await pending(socket, "closeProducer"),
		];
		expect(closed.map((frame) => frame.producerId)).toEqual([
			"screen-audio-1",
			"screen-1",
		]);
	});

	it("releases a capture it cannot send", async () => {
		const harness = track(setup());
		const { socket } = await connect(harness);
		const video = new FakeTrack("video");
		const release = vi.fn();
		const sharing = harness.engine.shareScreen(
			{ video: video as unknown as MediaStreamTrack, audio: null, release },
			{ resolution: "1080", framerate: 30 },
		);
		await reply(socket, "produce", {
			$type: `${DEFS}error`,
			error: "InvalidRequest",
		});
		expect(await sharing).toBe(false);
		expect(harness.notices).toEqual(["screenFailed"]);
		expect(harness.engine.screenSharing()).toBe(false);
		expect(video.stopped).toBe(true);
		expect(release).toHaveBeenCalledOnce();
	});

	it("ends the share when the call stops", async () => {
		const harness = track(setup());
		const { socket } = await connect(harness);
		const release = vi.fn();
		const sharing = harness.engine.shareScreen(
			{
				video: new FakeTrack("video") as unknown as MediaStreamTrack,
				audio: null,
				release,
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
		harness.engine.stop();
		await vi.waitFor(() => expect(release).toHaveBeenCalledOnce());
		expect(harness.engine.screenSharing()).toBe(false);
	});

	it("reports when a peer starts and stops sharing", async () => {
		const harness = track(setup());
		const { socket } = await connect(harness);
		const changes: boolean[] = [];
		harness.engine.onScreenShare((sharing) => changes.push(sharing));
		socket.serve({
			$type: `${DEFS}producerInfo`,
			producerId: "peer-screen",
			did: PEER,
			kind: "video",
			source: "screen",
		});
		socket.serve({
			$type: `${DEFS}producerInfo`,
			producerId: "peer-cam",
			did: PEER,
			kind: "video",
			source: "camera",
		});
		socket.serve({
			$type: `${DEFS}producerRemoved`,
			producerId: "peer-screen",
			did: PEER,
		});
		expect(changes).toEqual([true, false]);
	});

	it("stops cleanly and ignores frames afterwards", async () => {
		const harness = track(setup());
		const { socket } = await connect(harness);
		harness.engine.stop();
		expect(harness.engine.connection().state).toBe("disconnected");
		expect(socket.closed).toBe(true);
		expect(harness.ended).toEqual([]);
	});
});
