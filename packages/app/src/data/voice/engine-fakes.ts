import { channelSpace } from "@colibri-social/lexicons";
import type { types } from "mediasoup-client";
import { expect, vi } from "vitest";
import {
	type AudioOutput,
	createVoiceEngine,
	type VoiceEngineOptions,
	type VoiceSocket,
} from "./engine";
import type { NoiseSuppressor } from "./noise-suppressor";
import type { VoiceEndReason, VoiceNotice } from "./types";

export const VIEWER = "did:plc:viewer00000000000000000000";
export const PEER = "did:plc:peer0000000000000000000000";
export const CHANNEL = channelSpace(
	"did:plc:examplecommunityauthority01",
	"social.colibri.beta.channel.voice",
	"3lz4x5y6z7a8b",
);
export const DEFS = "social.colibri.beta.voice.defs#";

export type Frame = { $type: string } & Record<string, unknown>;

export class FakeTrack {
	stopped = false;
	listeners = new Map<string, () => void>();
	constructor(readonly kind: string) {}
	stop() {
		this.stopped = true;
	}
	addEventListener(type: string, listener: () => void) {
		this.listeners.set(type, listener);
	}
	removeEventListener(type: string) {
		this.listeners.delete(type);
	}
}

export class FakeStream {
	constructor(readonly tracks: FakeTrack[] = []) {}
	getTracks() {
		return this.tracks;
	}
	getAudioTracks() {
		return this.tracks.filter((track) => track.kind === "audio");
	}
	getVideoTracks() {
		return this.tracks.filter((track) => track.kind === "video");
	}
}

export class FakeSocket implements VoiceSocket {
	readyState = 0;
	sent: Frame[] = [];
	answered = 0;
	onopen: VoiceSocket["onopen"] = null;
	onmessage: VoiceSocket["onmessage"] = null;
	onclose: VoiceSocket["onclose"] = null;
	onerror: VoiceSocket["onerror"] = null;
	closed = false;

	constructor(
		readonly url: string,
		readonly protocols: string[],
	) {}

	send(data: string) {
		this.sent.push(JSON.parse(data));
	}

	close() {
		this.closed = true;
		this.readyState = 3;
	}

	open() {
		this.readyState = 1;
		this.onopen?.({});
	}

	serve(frame: Frame) {
		this.onmessage?.({ data: JSON.stringify(frame) });
	}

	drop() {
		this.readyState = 3;
		this.onclose?.({ code: 1006, reason: "" });
	}
}

export type Handler = (...args: never[]) => void;

export class FakeProducer {
	paused = false;
	closed = false;
	constructor(
		readonly id: string,
		readonly track: FakeTrack,
	) {}
	pause() {
		this.paused = true;
	}
	resume() {
		this.paused = false;
	}
	close() {
		this.closed = true;
	}
	async replaceTrack() {}
}

export class FakeConsumer {
	paused = false;
	closed = false;
	track: FakeTrack;
	constructor(
		readonly id: string,
		readonly producerId: string,
		readonly kind: string,
	) {
		this.track = new FakeTrack(kind);
	}
	pause() {
		this.paused = true;
	}
	resume() {
		this.paused = false;
	}
	close() {
		this.closed = true;
	}
}

export class FakeTransport {
	handlers = new Map<string, Handler>();
	closed = false;
	connectionState = "new";
	consumers: FakeConsumer[] = [];
	constructor(readonly id: string) {}
	on(event: string, handler: Handler) {
		this.handlers.set(event, handler);
	}
	async getStats() {
		return new Map();
	}
	close() {
		this.closed = true;
	}
	produce(options: {
		track: FakeTrack;
		appData: { source: string };
	}): Promise<FakeProducer> {
		return new Promise((resolve, reject) => {
			const handler = this.handlers.get("produce") as unknown as (
				params: unknown,
				callback: (value: { id: string }) => void,
				errback: (error: Error) => void,
			) => void;
			handler(
				{
					kind: options.track.kind,
					rtpParameters: { codecs: [] },
					appData: options.appData,
				},
				({ id }) => resolve(new FakeProducer(id, options.track)),
				reject,
			);
		});
	}
	async consume(options: { id: string; producerId: string; kind: string }) {
		const consumer = new FakeConsumer(
			options.id,
			options.producerId,
			options.kind,
		);
		this.consumers.push(consumer);
		return consumer;
	}
}

export class FakeDevice {
	rtpCapabilities = { codecs: [] };
	send?: FakeTransport;
	recv?: FakeTransport;
	async load() {}
	createSendTransport(options: { id: string }) {
		this.send = new FakeTransport(options.id);
		return this.send;
	}
	createRecvTransport(options: { id: string }) {
		this.recv = new FakeTransport(options.id);
		return this.recv;
	}
}

export const fakeAudio = () => {
	const el = {
		autoplay: false,
		srcObject: null,
		volume: 1,
		muted: false,
		playing: false,
		async play() {
			el.playing = true;
		},
		pause() {
			el.playing = false;
		},
	};
	return el;
};

export const suppressor = (track: FakeTrack): NoiseSuppressor => ({
	outputTrack: track as unknown as MediaStreamTrack,
	setSuppression: vi.fn(),
	setGate: vi.fn(),
	setInputGain: vi.fn(),
	destroy: vi.fn(),
});

export const flush = async () => {
	for (let step = 0; step < 10; step += 1) await Promise.resolve();
};

export const setup = (overrides: Partial<VoiceEngineOptions> = {}) => {
	const sockets: FakeSocket[] = [];
	const devices: FakeDevice[] = [];
	const audio: ReturnType<typeof fakeAudio>[] = [];
	const ended: VoiceEndReason[] = [];
	const notices: VoiceNotice[] = [];
	const getServiceAuth = vi.fn(async () => ({ data: { token: "token" } }));
	const getUserMedia = vi.fn(
		async (constraints: MediaStreamConstraints) =>
			new FakeStream([
				new FakeTrack(constraints.video ? "video" : "audio"),
			]) as unknown as MediaStream,
	);
	const engine = createVoiceEngine({
		agent: { com: { atproto: { server: { getServiceAuth } } } },
		appViewHost: "wss://appview.test",
		serviceRef: "did:web:appview.test#colibri_appview",
		viewerDid: VIEWER,
		createSocket: (url, protocols) => {
			const socket = new FakeSocket(url, protocols);
			sockets.push(socket);
			return socket;
		},
		createDevice: () => {
			const device = new FakeDevice();
			devices.push(device);
			return device as unknown as types.Device;
		},
		createAudio: () => {
			const el = fakeAudio();
			audio.push(el);
			return el as unknown as AudioOutput;
		},
		createSuppressor: async (track) =>
			suppressor(track as unknown as FakeTrack),
		media: { getUserMedia },
		webRtc: () => true,
		handlerName: () => undefined,
		...overrides,
	});
	engine.onEnded((reason) => ended.push(reason));
	engine.onNotice((notice) => notices.push(notice));
	return {
		engine,
		sockets,
		devices,
		audio,
		ended,
		notices,
		getServiceAuth,
		getUserMedia,
	};
};

export const pending = async (socket: FakeSocket, type: string) => {
	await vi.waitFor(() => {
		const frame = socket.sent.slice(socket.answered).find(Boolean);
		if (frame?.$type !== `${DEFS}${type}`) {
			throw new Error(`waiting for ${type}, saw ${frame?.$type}`);
		}
	});
	const frame = socket.sent[socket.answered];
	socket.answered += 1;
	return frame;
};

export const reply = async (socket: FakeSocket, type: string, frame: Frame) => {
	const request = await pending(socket, type);
	socket.serve(frame);
	return request;
};

export const transportOptions = (id: string, direction: "send" | "recv") => ({
	$type: `${DEFS}transportOptions`,
	id,
	iceParameters: { usernameFragment: "u", password: "p" },
	iceCandidates: [],
	dtlsParameters: { fingerprints: [], role: "auto" },
	direction,
});

export const connect = async (
	harness: ReturnType<typeof setup>,
	session = { channel: CHANNEL, muted: false, deafened: false },
) => {
	harness.engine.start(session);
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
	await reply(socket, "produce", {
		$type: `${DEFS}producerInfo`,
		producerId: "mic-1",
		did: VIEWER,
		kind: "audio",
		source: "microphone",
	});
	await vi.waitFor(() =>
		expect(harness.engine.connection().state).toBe("connected"),
	);
	const selfState = await reply(socket, "setSelfState", {
		$type: `${DEFS}ack`,
	});
	return { socket, selfState };
};
