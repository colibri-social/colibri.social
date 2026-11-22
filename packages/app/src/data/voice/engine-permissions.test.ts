import type { types } from "mediasoup-client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { VoiceEngine } from "./engine";
import {
	CHANNEL,
	connect,
	DEFS,
	FakeDevice,
	type FakeSocket,
	FakeStream,
	FakeTrack,
	flush,
	OTHER_CHANNEL,
	reply,
	setup,
	transportOptions,
	VIEWER,
} from "./engine-fakes";

let running: VoiceEngine[] = [];

class VideoDevice extends FakeDevice {
	handlerName = "Chrome111";
	sendRtpCapabilities = {
		codecs: [
			{
				kind: "video",
				mimeType: "video/VP8",
				clockRate: 90000,
				preferredPayloadType: 96,
				parameters: {},
			},
		],
	};
}

afterEach(() => {
	for (const engine of running) engine.dispose();
	running = [];
	vi.unstubAllGlobals();
});

const tracked = (video = false) => {
	const harness = setup(
		video
			? {
					createDevice: () => new VideoDevice() as unknown as types.Device,
				}
			: {},
	);
	running.push(harness.engine);
	return harness;
};

const joinWith = async (
	harness: ReturnType<typeof setup>,
	permissions: string[],
) => {
	harness.engine.start({ channel: CHANNEL, muted: false, deafened: false });
	await vi.waitFor(() => expect(harness.sockets).toHaveLength(1));
	const socket = harness.sockets[0] as FakeSocket;
	socket.open();
	await reply(socket, "join", {
		$type: `${DEFS}joined`,
		channel: CHANNEL,
		permissions,
	});
	await reply(socket, "getRtpCapabilities", {
		$type: `${DEFS}rtpCapabilities`,
		payload: { codecs: [] },
	});
	await reply(socket, "createTransport", transportOptions("send-1", "send"));
	await reply(socket, "createTransport", transportOptions("recv-1", "recv"));
	await vi.waitFor(() =>
		expect(harness.engine.connection().state).toBe("connected"),
	);
	await reply(socket, "setSelfState", { $type: `${DEFS}ack` });
	return socket;
};

const producedSources = (socket: FakeSocket) =>
	socket.sent
		.filter((frame) => frame.$type === `${DEFS}produce`)
		.map((frame) => frame.source);

const capture = () => {
	const video = new FakeTrack("video");
	const release = vi.fn();
	return {
		video,
		release,
		value: {
			video: video as unknown as MediaStreamTrack,
			audio: null,
			release,
		},
	};
};

describe("voice permissions", () => {
	it("treats a joined frame without permissions as all granted", async () => {
		const harness = tracked();
		await connect(harness);
		expect([...harness.engine.permissions()].sort()).toEqual([
			"voice.camera",
			"voice.chat",
			"voice.listen",
			"voice.screenshare",
			"voice.speak",
		]);
	});

	it("skips the microphone and refuses camera and screen when denied", async () => {
		const harness = tracked();
		const socket = await joinWith(harness, ["voice.listen", "voice.chat"]);
		expect([...harness.engine.permissions()].sort()).toEqual([
			"voice.chat",
			"voice.listen",
		]);

		expect(await harness.engine.setCamera(true)).toBe(false);
		expect(harness.engine.camera()).toBe(false);

		const screen = capture();
		expect(
			await harness.engine.shareScreen(screen.value, {
				resolution: "1080",
				framerate: 30,
			}),
		).toBe(false);
		expect(screen.video.stopped).toBe(true);
		expect(screen.release).toHaveBeenCalled();

		await flush();
		expect(producedSources(socket)).toEqual([]);
		expect(harness.getUserMedia).not.toHaveBeenCalled();
		expect(harness.notices).toEqual([]);
	});

	it("closes the microphone when speaking is revoked and reopens it when granted", async () => {
		const harness = tracked();
		const { socket } = await connect(harness);
		expect(producedSources(socket)).toEqual(["microphone"]);

		socket.serve({
			$type: `${DEFS}permissionsChanged`,
			channel: CHANNEL,
			permissions: ["voice.listen"],
		});
		expect(harness.engine.permissions().has("voice.speak")).toBe(false);
		await flush();
		expect(
			socket.sent.some((frame) => frame.$type === `${DEFS}closeProducer`),
		).toBe(false);

		socket.serve({
			$type: `${DEFS}permissionsChanged`,
			channel: CHANNEL,
			permissions: ["voice.listen", "voice.speak"],
		});
		await reply(socket, "produce", {
			$type: `${DEFS}producerInfo`,
			producerId: "mic-2",
			did: VIEWER,
			kind: "audio",
			source: "microphone",
		});
		expect(producedSources(socket)).toEqual(["microphone", "microphone"]);
	});

	it("stops the camera and screen locally when those permissions go away", async () => {
		vi.stubGlobal("MediaStream", FakeStream);
		const harness = tracked(true);
		const { socket } = await connect(harness);
		const cameraOff = vi.fn();
		const sharing: boolean[] = [];
		harness.engine.onCameraOff(cameraOff);
		harness.engine.onScreenShare((value) => sharing.push(value));

		const cameraOn = harness.engine.setCamera(true);
		await reply(socket, "produce", {
			$type: `${DEFS}producerInfo`,
			producerId: "cam-1",
			did: VIEWER,
			kind: "video",
			source: "camera",
		});
		expect(await cameraOn).toBe(true);

		const screen = capture();
		const shared = harness.engine.shareScreen(screen.value, {
			resolution: "1080",
			framerate: 30,
		});
		await reply(socket, "produce", {
			$type: `${DEFS}producerInfo`,
			producerId: "screen-1",
			did: VIEWER,
			kind: "video",
			source: "screen",
		});
		expect(await shared).toBe(true);

		const sentBefore = socket.sent.length;
		socket.serve({
			$type: `${DEFS}permissionsChanged`,
			channel: CHANNEL,
			permissions: ["voice.speak", "voice.listen", "voice.chat"],
		});
		await flush();

		expect(harness.engine.camera()).toBe(false);
		expect(cameraOff).toHaveBeenCalledTimes(1);
		expect(harness.engine.screenSharing()).toBe(false);
		expect(sharing.at(-1)).toBe(false);
		expect(screen.video.stopped).toBe(true);
		expect(
			socket.sent
				.slice(sentBefore)
				.some((frame) => frame.$type === `${DEFS}closeProducer`),
		).toBe(false);
	});

	it("ignores a permission change for another channel", async () => {
		const harness = tracked();
		const { socket } = await connect(harness);
		socket.serve({
			$type: `${DEFS}permissionsChanged`,
			channel: OTHER_CHANNEL,
			permissions: [],
		});
		expect(harness.engine.permissions().size).toBe(5);
	});

	it("passes the destination view along with a move", async () => {
		const harness = tracked();
		const { socket } = await connect(harness);
		const moves: [string, string | undefined, string | undefined][] = [];
		harness.engine.onMoved((channel, destination) =>
			moves.push([channel, destination?.view.name, destination?.after]),
		);
		socket.serve({
			$type: `${DEFS}moved`,
			channel: OTHER_CHANNEL,
			view: {
				space: OTHER_CHANNEL,
				type: "social.colibri.beta.channel.voice",
				name: "Mod office",
				private: true,
				viewer: { canRead: false, canPost: false },
			},
			after: CHANNEL,
		});
		expect(moves).toEqual([[OTHER_CHANNEL, "Mod office", CHANNEL]]);
	});
});
