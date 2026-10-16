import { AUTH_SUBPROTOCOL, VOICE_SIGNAL_LXM } from "@colibri-social/lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
	type FakeTransport,
	flush,
	PEER,
	pending,
	reply,
	setup,
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

	it("ends the call when a moderator disconnects the viewer", async () => {
		const harness = track(setup());
		const { socket } = await connect(harness);
		socket.serve({ $type: `${DEFS}disconnected`, reason: "moderator" });
		expect(harness.ended).toEqual(["moderator"]);
		expect(harness.engine.connection().state).toBe("disconnected");
		expect(socket.closed).toBe(true);
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

	it("stops cleanly and ignores frames afterwards", async () => {
		const harness = track(setup());
		const { socket } = await connect(harness);
		harness.engine.stop();
		expect(harness.engine.connection().state).toBe("disconnected");
		expect(socket.closed).toBe(true);
		expect(harness.ended).toEqual([]);
	});
});
