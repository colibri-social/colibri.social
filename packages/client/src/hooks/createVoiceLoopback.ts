import type { Agent } from "@atproto/api";
import type { types } from "mediasoup-client";
import { Device } from "mediasoup-client";
import { getAppViewHost, getAppViewServiceRef } from "../utils/appview";

const AUTH_SUBPROTOCOL = "colibri.auth.bearer";
const LXM = "social.colibri.voice.signal";

type ServerMessage =
	| {
			action: "init";
			routerRtpCapabilities: types.RtpCapabilities;
			producerTransportOptions: types.TransportOptions;
			consumerTransportOptions: types.TransportOptions;
			iceServers: RTCIceServer[];
	  }
	| { action: "connectedProducerTransport" }
	| { action: "produced"; id: string }
	| { action: "connectedConsumerTransport" }
	| {
			action: "consumed";
			id: string;
			producerId: string;
			kind: types.MediaKind;
			rtpParameters: types.RtpParameters;
	  }
	| {
			action: "producerAdded";
			did: string;
			producerId: string;
			kind: types.MediaKind;
			source: string;
	  }
	| { action: "producerRemoved"; did: string; producerId: string }
	| { action: "activeSpeakers"; dids: string[] }
	| { action: "error"; message: string };

export type VoiceLoopback = {
	inGain: GainNode;
	setOutputVolume: (volume: number) => void;
	destroy: () => void;
};

export type VoiceLoopbackOptions = {
	agent: Agent;
	did: string;
	sourceTrack: MediaStreamTrack;
	audioCtx: AudioContext;
	outputDeviceId?: string;
};

type Connection = {
	role: "producer" | "consumer";
	ws: WebSocket;
	device: Device;
	sendTransport: types.Transport | null;
	recvTransport: types.Transport | null;
	ready: boolean;
	pendingConsume: string[];
	pendingByAction: Map<
		string,
		Array<{ resolve: (m: ServerMessage) => void; reject: (e: unknown) => void }>
	>;
	pendingConsumed: Map<
		string,
		{ resolve: (m: ServerMessage) => void; reject: (e: unknown) => void }
	>;
};

export const createVoiceLoopback = ({
	agent,
	did,
	sourceTrack,
	audioCtx,
	outputDeviceId,
}: VoiceLoopbackOptions): VoiceLoopback => {
	const room = `at://${did}/social.colibri.voice.test/${crypto.randomUUID()}`;

	void audioCtx.resume().catch(() => {});

	const inGain = audioCtx.createGain();
	const sendSource = audioCtx.createMediaStreamSource(
		new MediaStream([sourceTrack]),
	);
	const sendDestination = audioCtx.createMediaStreamDestination();
	sendSource.connect(inGain);
	inGain.connect(sendDestination);

	let outputVolume = 1;
	let audioEl: HTMLAudioElement | null = null;
	let destroyed = false;
	const connections: Connection[] = [];

	const clampVolume = (v: number): number => Math.max(0, Math.min(1, v));

	const setOutputVolume = (volume: number): void => {
		outputVolume = volume;
		if (audioEl) audioEl.volume = clampVolume(volume);
	};

	const fetchToken = async (): Promise<string> => {
		const { data } = await agent.com.atproto.server.getServiceAuth({
			aud: getAppViewServiceRef(),
			lxm: LXM,
			exp: Math.floor(Date.now() / 1000) + 60,
		});
		return data.token;
	};

	const waitForAction = (
		conn: Connection,
		action: string,
	): Promise<ServerMessage> =>
		new Promise((resolve, reject) => {
			const queue = conn.pendingByAction.get(action) ?? [];
			queue.push({ resolve, reject });
			conn.pendingByAction.set(action, queue);
		});

	const waitForConsumed = (
		conn: Connection,
		producerId: string,
	): Promise<ServerMessage> =>
		new Promise((resolve, reject) => {
			conn.pendingConsumed.set(producerId, { resolve, reject });
		});

	const send = (conn: Connection, message: Record<string, unknown>): void => {
		if (conn.ws.readyState === WebSocket.OPEN) {
			conn.ws.send(JSON.stringify(message));
		}
	};

	const setupTransports = async (
		conn: Connection,
		message: ServerMessage,
	): Promise<void> => {
		if (message.action !== "init") return;

		await conn.device.load({
			routerRtpCapabilities: message.routerRtpCapabilities,
		});

		conn.sendTransport = conn.device.createSendTransport({
			...message.producerTransportOptions,
			iceServers: message.iceServers,
		});
		conn.sendTransport.on(
			"connect",
			({ dtlsParameters }, callback, errback) => {
				send(conn, { action: "connectProducerTransport", dtlsParameters });
				waitForAction(conn, "connectedProducerTransport")
					.then(() => callback())
					.catch((err) => errback(err as Error));
			},
		);
		conn.sendTransport.on(
			"produce",
			({ kind, rtpParameters, appData }, callback, errback) => {
				const source = (appData as { source?: string }).source ?? "mic";
				send(conn, { action: "produce", kind, rtpParameters, source });
				waitForAction(conn, "produced")
					.then((m) => {
						if (m.action === "produced") callback({ id: m.id });
					})
					.catch((err) => errback(err as Error));
			},
		);

		conn.recvTransport = conn.device.createRecvTransport({
			...message.consumerTransportOptions,
			iceServers: message.iceServers,
		});
		conn.recvTransport.on(
			"connect",
			({ dtlsParameters }, callback, errback) => {
				send(conn, { action: "connectConsumerTransport", dtlsParameters });
				waitForAction(conn, "connectedConsumerTransport")
					.then(() => callback())
					.catch((err) => errback(err as Error));
			},
		);

		send(conn, {
			action: "init",
			rtpCapabilities: conn.device.rtpCapabilities,
		});

		conn.ready = true;
		const queued = conn.pendingConsume.splice(0, conn.pendingConsume.length);
		for (const producerId of queued) void consume(conn, producerId);
	};

	const startProducing = async (conn: Connection): Promise<void> => {
		if (!conn.sendTransport) return;
		await conn.sendTransport.produce({
			track: sendDestination.stream.getAudioTracks()[0],
			appData: { source: "mic" },
		});
	};

	const consume = async (
		conn: Connection,
		producerId: string,
	): Promise<void> => {
		if (!conn.recvTransport) return;
		send(conn, { action: "consume", producerId });

		let message: ServerMessage;
		try {
			message = await waitForConsumed(conn, producerId);
		} catch {
			return;
		}

		if (message.action !== "consumed" || message.kind !== "audio") return;

		const consumer = await conn.recvTransport.consume({
			id: message.id,
			producerId: message.producerId,
			kind: message.kind,
			rtpParameters: message.rtpParameters,
		});

		send(conn, { action: "consumerResume", id: consumer.id });

		if (destroyed) {
			consumer.close();
			return;
		}

		const el = new Audio();
		el.autoplay = true;
		el.srcObject = new MediaStream([consumer.track]);
		el.volume = clampVolume(outputVolume);

		if (outputDeviceId && "setSinkId" in el) {
			(el as unknown as { setSinkId: (id: string) => Promise<void> })
				.setSinkId(outputDeviceId)
				.catch(() => {});
		}

		audioEl = el;
		el.play().catch(() => {});
	};

	const openConnection = async (
		role: "producer" | "consumer",
	): Promise<void> => {
		let token: string;
		try {
			token = await fetchToken();
		} catch {
			return;
		}

		if (destroyed) return;

		const url = `${getAppViewHost("ws")}/xrpc/${LXM}?channel=${encodeURIComponent(room)}`;
		const ws = new WebSocket(url, [AUTH_SUBPROTOCOL, token]);
		const conn: Connection = {
			role,
			ws,
			device: new Device(),
			sendTransport: null,
			recvTransport: null,
			ready: false,
			pendingConsume: [],
			pendingByAction: new Map(),
			pendingConsumed: new Map(),
		};
		connections.push(conn);

		ws.onmessage = (event) => {
			let message: ServerMessage;
			try {
				message = JSON.parse(event.data as string) as ServerMessage;
			} catch {
				return;
			}

			switch (message.action) {
				case "init":
					void setupTransports(conn, message).then(() => {
						if (role === "producer") void startProducing(conn);
					});
					break;
				case "connectedProducerTransport":
				case "connectedConsumerTransport":
				case "produced":
					conn.pendingByAction.get(message.action)?.shift()?.resolve(message);
					break;
				case "consumed":
					conn.pendingConsumed.get(message.producerId)?.resolve(message);
					conn.pendingConsumed.delete(message.producerId);
					break;
				case "producerAdded":
					if (role !== "consumer" || message.kind !== "audio") break;
					if (conn.ready) void consume(conn, message.producerId);
					else conn.pendingConsume.push(message.producerId);
					break;
			}
		};
	};

	void openConnection("producer");
	void openConnection("consumer");

	const destroy = (): void => {
		destroyed = true;

		for (const conn of connections) {
			conn.sendTransport?.close();
			conn.recvTransport?.close();
			conn.ws.onmessage = null;
			if (
				conn.ws.readyState === WebSocket.OPEN ||
				conn.ws.readyState === WebSocket.CONNECTING
			) {
				conn.ws.close();
			}
		}
		connections.length = 0;

		if (audioEl) {
			audioEl.pause();
			audioEl.srcObject = null;
			audioEl = null;
		}

		try {
			sendSource.disconnect();
			inGain.disconnect();
		} catch {}
	};

	return { inGain, setOutputVolume, destroy };
};
