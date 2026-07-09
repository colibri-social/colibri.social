import type { types } from "mediasoup-client";
import { Device } from "mediasoup-client";
import {
	createContext,
	createEffect,
	onCleanup,
	type ParentComponent,
	useContext,
} from "solid-js";
import { createStore } from "solid-js/store";
import { processTrackWithRnnoise } from "../hooks/createRnnoiseProcessor";
import { getAppViewHost, getAppViewServiceRef } from "../utils/appview";
import { useAuthContext } from "./Auth";
import { useSocketContext } from "./Socket";
import { useSounds } from "./Sounds";
import { useUserContext } from "./User";
import { useUserPreferences } from "./UserPreferences";

export const ConnectionState = {
	Disconnected: "disconnected",
	Connecting: "connecting",
	Connected: "connected",
	Reconnecting: "reconnecting",
} as const;
export type ConnectionState =
	(typeof ConnectionState)[keyof typeof ConnectionState];

export const ConnectionQuality = {
	Unknown: "unknown",
	Excellent: "excellent",
	Good: "good",
	Poor: "poor",
	Lost: "lost",
} as const;
export type ConnectionQuality =
	(typeof ConnectionQuality)[keyof typeof ConnectionQuality];

export type VoiceChatConnection = {
	state: ConnectionState;
	quality: ConnectionQuality;
	uri: string | null;
	channelName: string | null;
	communityName: string | null;
};

export type VoiceChatStates = {
	camEnabled: boolean;
	screenEnabled: boolean;
	micEnabled: boolean;
	deafened: boolean;
};

export type VideoSource = "cam" | "screen";

export type VideoTileData = {
	did: string;
	source: VideoSource;
	stream: MediaStream;
};

export type VoiceMemberState = {
	muted: boolean;
	deafened: boolean;
};

export type VoiceChatData = {
	connection: VoiceChatConnection;
	states: VoiceChatStates;
	presence: Record<string, string[]>;
	activeSpeakers: string[];
	videoStreams: Record<string, VideoTileData>;
	memberStates: Record<string, VoiceMemberState>;
};

export type VoiceChatActions = {
	connect: (
		channelUri: string,
		meta?: { channelName?: string; communityName?: string },
	) => Promise<void>;
	disconnect: () => void;
	toggleMic: () => void;
	toggleCamera: () => void;
	toggleScreen: () => void;
	toggleDeafen: () => void;
	seedPresence: (
		members: Array<{
			did: string;
			vc?: string | null;
			vcMuted?: boolean;
			vcDeafened?: boolean;
		}>,
	) => void;
};

export type VoiceChatContextValue = [VoiceChatData, VoiceChatActions];

const VoiceChatContext = createContext<VoiceChatContextValue>();

const AUTH_SUBPROTOCOL = "colibri.auth.bearer";
const LXM = "social.colibri.voice.signal";
const SPEAKING_THRESHOLD = 0.02;
const MAX_RECONNECT_ATTEMPTS = 6;
const STATS_INTERVAL_MS = 3000;
const STATS_FAST_MS = 400;

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

const communityUriForChannel = (channelUri: string): string | null => {
	if (!channelUri.startsWith("at://")) return null;
	const authority = channelUri.slice("at://".length).split("/")[0];
	if (!authority) return null;
	return `at://${authority}/social.colibri.community/self`;
};

export const VoiceChatContextProvider: ParentComponent = (props) => {
	const user = useUserContext();
	const auth = useAuthContext();
	const socket = useSocketContext();
	const userPreferences = useUserPreferences();
	const { playSound } = useSounds();

	const [voiceData, setVoiceData] = createStore<VoiceChatData>({
		connection: {
			state: ConnectionState.Disconnected,
			quality: ConnectionQuality.Unknown,
			uri: null,
			channelName: null,
			communityName: null,
		},
		states: {
			camEnabled: false,
			screenEnabled: false,
			micEnabled: false,
			deafened: false,
		},
		presence: {},
		activeSpeakers: [],
		videoStreams: {},
		memberStates: {},
	});

	let ws: WebSocket | null = null;
	let device: Device | null = null;
	let sendTransport: types.Transport | null = null;
	let recvTransport: types.Transport | null = null;
	let micProducer: types.Producer | null = null;
	let camProducer: types.Producer | null = null;
	let screenProducer: types.Producer | null = null;
	let micStream: MediaStream | null = null;
	let audioContext: AudioContext | null = null;
	let speakingContext: AudioContext | null = null;
	let speakingInterval: ReturnType<typeof setInterval> | null = null;
	let localSpeaking = false;
	let serverSpeakers: string[] = [];
	let ready = false;
	let intentionalClose = false;
	let reconnectAttempts = 0;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let statsTimer: ReturnType<typeof setTimeout> | null = null;
	let statsGen = 0;

	const consumers = new Map<string, types.Consumer>();
	const audioEls = new Map<string, { el: HTMLAudioElement; did: string }>();
	const producerOwners = new Map<
		string,
		{ did: string; kind: types.MediaKind; source: string }
	>();
	const pendingConsume: string[] = [];
	const pendingByAction = new Map<
		string,
		Array<{ resolve: (m: ServerMessage) => void; reject: (e: unknown) => void }>
	>();
	const pendingConsumed = new Map<
		string,
		{ resolve: (m: ServerMessage) => void; reject: (e: unknown) => void }
	>();

	const send = (message: Record<string, unknown>): void => {
		if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
	};

	const waitForAction = (action: string): Promise<ServerMessage> => {
		new Promise((resolve, reject) => {
			const queue = pendingByAction.get(action) ?? [];
			queue.push({ resolve, reject });
			pendingByAction.set(action, queue);
		});
	};

	const waitForConsumed = (producerId: string): Promise<ServerMessage> => {
		new Promise((resolve, reject) => {
			pendingConsumed.set(producerId, { resolve, reject });
		});
	};

	const rejectAllPending = (): void => {
		for (const queue of pendingByAction.values()) {
			for (const p of queue) {
				p.reject(new Error("voice signaling closed"));
			}
		}

		pendingByAction.clear();

		for (const p of pendingConsumed.values()) {
			p.reject(new Error("voice signaling closed"));
		}

		pendingConsumed.clear();
	};

	const applyPresence = (kind: string, channel: string, did: string): void => {
		const current = voiceData.presence[channel] ?? [];

		if (kind === "leave") {
			if (current.includes(did)) {
				setVoiceData(
					"presence",
					channel,
					current.filter((d) => d !== did),
				);
			}

			setVoiceData("memberStates", did, undefined!);

			for (const [producerId, owner] of [...producerOwners.entries()]) {
				if (owner.did === did) removeProducer(producerId);
			}
		} else if (!current.includes(did)) {
			setVoiceData("presence", channel, [...current, did]);
		}
	};

	const sendVoiceState = (): void => {
		const channel = voiceData.connection.uri;

		if (!channel) return;

		const community = communityUriForChannel(channel);

		if (!community) return;

		const muted = !voiceData.states.micEnabled;
		const deafened = voiceData.states.deafened;

		setVoiceData("memberStates", user.did, { muted, deafened });

		socket.send({
			type: "voice_state",
			data: { channel, community, muted, deafened },
		});
	};

	const recomputeSpeakers = (): void => {
		const others = serverSpeakers.filter((d) => d !== user.did);
		setVoiceData(
			"activeSpeakers",
			localSpeaking ? [...others, user.did] : others,
		);
	};

	const applyAudioSettings = (el: HTMLAudioElement, did: string): void => {
		const output = userPreferences.preferences().voice.output;
		const override =
			userPreferences.preferences().voice.participantVolumeOverrides[did]
				?.voice;
		const base = output.enabled ? output.volume : 0;

		el.volume = Math.max(0, Math.min(1, base * (override?.volume ?? 1)));
		el.muted = override?.muted ?? false;

		const sinkable = el as HTMLAudioElement & {
			setSinkId?: (id: string) => Promise<void>;
		};

		if (output.preferredDeviceId && typeof sinkable.setSinkId === "function") {
			sinkable.setSinkId(output.preferredDeviceId).catch(() => {});
		}
	};

	const rttToQuality = (rtt: number): ConnectionQuality => {
		if (rtt < 0.15) return ConnectionQuality.Excellent;
		if (rtt < 0.3) return ConnectionQuality.Good;
		return ConnectionQuality.Poor;
	};

	const readRtt = async (
		transport: types.Transport | null,
	): Promise<number | undefined> => {
		if (!transport) return undefined;
		try {
			const stats = await transport.getStats();
			let rtt: number | undefined;

			stats.forEach((report: { type?: string } & Record<string, unknown>) => {
				if (
					report.type === "candidate-pair" &&
					(report.nominated === true || report.selected === true) &&
					typeof report.currentRoundTripTime === "number"
				)
					rtt = report.currentRoundTripTime as number;
			});

			return rtt;
		} catch {
			return undefined;
		}
	};

	const pollQuality = async (): Promise<boolean> => {
		const rtts = (
			await Promise.all([readRtt(sendTransport), readRtt(recvTransport)])
		).filter((v): v is number => typeof v === "number");

		if (!rtts.length) return false;

		setVoiceData("connection", "quality", rttToQuality(Math.min(...rtts)));

		return true;
	};

	const stopStatsMonitor = (): void => {
		statsGen += 1;
		if (statsTimer) {
			clearTimeout(statsTimer);
			statsTimer = null;
		}
	};

	const startStatsMonitor = (): void => {
		stopStatsMonitor();

		const gen = statsGen;
		const loop = async (): Promise<void> => {
			if (gen !== statsGen) return;
			const ok = await pollQuality();
			if (gen !== statsGen) return;
			statsTimer = setTimeout(
				() => void loop(),
				ok ? STATS_INTERVAL_MS : STATS_FAST_MS,
			);
		};

		void loop();
	};

	const resetState = (): void => {
		setVoiceData("connection", {
			state: ConnectionState.Disconnected,
			quality: ConnectionQuality.Unknown,
			uri: null,
			channelName: null,
			communityName: null,
		});
		setVoiceData("states", {
			camEnabled: false,
			screenEnabled: false,
			micEnabled: false,
			deafened: false,
		});
		setVoiceData("activeSpeakers", []);
		setVoiceData("videoStreams", {});
		setVoiceData("memberStates", {});
	};

	const teardownMedia = (): void => {
		rejectAllPending();

		if (speakingInterval) {
			clearInterval(speakingInterval);
			speakingInterval = null;
		}
		stopStatsMonitor();
		speakingContext?.close().catch(() => {});
		speakingContext = null;
		localSpeaking = false;
		serverSpeakers = [];

		for (const producer of [micProducer, camProducer, screenProducer]) {
			producer?.track?.stop();
			producer?.close();
		}
		micProducer = null;
		camProducer = null;
		screenProducer = null;

		for (const consumer of consumers.values()) consumer.close();
		consumers.clear();

		for (const { el } of audioEls.values()) {
			el.pause();
			el.srcObject = null;
		}
		audioEls.clear();

		producerOwners.clear();
		pendingConsume.length = 0;

		sendTransport?.close();
		recvTransport?.close();
		sendTransport = null;
		recvTransport = null;
		device = null;

		for (const t of micStream?.getTracks() ?? []) t.stop();
		micStream = null;
		audioContext?.close().catch(() => {});
		audioContext = null;

		ready = false;
	};

	const teardown = (): void => {
		if (reconnectTimer) {
			clearTimeout(reconnectTimer);
			reconnectTimer = null;
		}
		teardownMedia();

		if (ws) {
			ws.onclose = null;
			ws.onerror = null;
			ws.onmessage = null;
			ws.onopen = null;
			ws.close();
			ws = null;
		}
	};

	const setupLocalSpeaking = (track: MediaStreamTrack): void => {
		speakingContext = new AudioContext();
		const source = speakingContext.createMediaStreamSource(
			new MediaStream([track]),
		);
		const analyser = speakingContext.createAnalyser();
		analyser.fftSize = 512;
		source.connect(analyser);
		const buffer = new Uint8Array(analyser.frequencyBinCount);

		speakingInterval = setInterval(() => {
			analyser.getByteTimeDomainData(buffer);
			let sum = 0;

			for (const v of buffer) {
				const n = (v - 128) / 128;
				sum += n * n;
			}

			const rms = Math.sqrt(sum / buffer.length);
			const speaking = voiceData.states.micEnabled && rms > SPEAKING_THRESHOLD;

			if (speaking !== localSpeaking) {
				localSpeaking = speaking;
				recomputeSpeakers();
			}
		}, 150);
	};

	const startMic = async (): Promise<void> => {
		if (!sendTransport) return;
		const input = userPreferences.preferences().voice.input;

		micStream = await navigator.mediaDevices.getUserMedia({
			audio: {
				echoCancellation: true,
				autoGainControl: true,
				noiseSuppression: input.noiseSuppression,
				deviceId: input.preferredDeviceId
					? { ideal: input.preferredDeviceId }
					: undefined,
			},
		});

		const rawTrack = micStream.getAudioTracks()[0];
		let track = rawTrack;

		if (input.noiseSuppression) {
			audioContext = new AudioContext({ sampleRate: 48000 });
			track = await processTrackWithRnnoise(rawTrack, audioContext);
		}

		micProducer = await sendTransport.produce({
			track,
			appData: { source: "mic" },
		});
		const muted = userPreferences.preferences().voice.selfMuted;

		if (muted) micProducer.pause();

		setVoiceData("states", "micEnabled", !muted);
		setupLocalSpeaking(rawTrack);
	};

	const consumeProducer = async (producerId: string): Promise<void> => {
		if (!recvTransport) return;
		const owner = producerOwners.get(producerId);

		send({ action: "consume", producerId });
		let message: ServerMessage;

		try {
			message = await waitForConsumed(producerId);
		} catch {
			return;
		}

		if (message.action !== "consumed") return;

		const consumer = await recvTransport.consume({
			id: message.id,
			producerId: message.producerId,
			kind: message.kind,
			rtpParameters: message.rtpParameters,
		});

		consumers.set(consumer.id, consumer);

		send({ action: "consumerResume", id: consumer.id });

		if (consumer.kind === "audio") {
			const el = new Audio();

			el.autoplay = true;
			el.srcObject = new MediaStream([consumer.track]);
			applyAudioSettings(el, owner?.did ?? "");
			audioEls.set(consumer.id, { el, did: owner?.did ?? "" });

			if (voiceData.states.deafened) consumer.pause();

			el.play().catch(() => {});
		} else if (owner) {
			setVoiceData("videoStreams", producerId, {
				did: owner.did,
				source: owner.source === "screen" ? "screen" : "cam",
				stream: new MediaStream([consumer.track]),
			});
		}
	};

	const removeProducer = (producerId: string): void => {
		producerOwners.delete(producerId);

		for (const [id, consumer] of consumers) {
			if (consumer.producerId !== producerId) continue;

			consumer.close();
			consumers.delete(id);

			const entry = audioEls.get(id);
			if (entry) {
				entry.el.pause();
				entry.el.srcObject = null;
				audioEls.delete(id);
			}
		}

		if (voiceData.videoStreams[producerId]) {
			setVoiceData("videoStreams", producerId, undefined!);
		}
	};

	const setupDevice = async (message: ServerMessage): Promise<void> => {
		if (message.action !== "init") return;

		setVoiceData(
			"states",
			"deafened",
			userPreferences.preferences().voice.selfDeafened,
		);

		device = new Device();
		await device.load({ routerRtpCapabilities: message.routerRtpCapabilities });

		sendTransport = device.createSendTransport({
			...message.producerTransportOptions,
			iceServers: message.iceServers,
		});

		sendTransport.on("connect", ({ dtlsParameters }, callback, errback) => {
			send({ action: "connectProducerTransport", dtlsParameters });
			waitForAction("connectedProducerTransport")
				.then(() => callback())
				.catch(errback);
		});

		sendTransport.on(
			"produce",
			({ kind, rtpParameters, appData }, callback, errback) => {
				const source = (appData as { source?: string }).source ?? "mic";
				send({ action: "produce", kind, rtpParameters, source });
				waitForAction("produced")
					.then((m) => {
						if (m.action === "produced") callback({ id: m.id });
					})
					.catch(errback);
			},
		);

		recvTransport = device.createRecvTransport({
			...message.consumerTransportOptions,
			iceServers: message.iceServers,
		});

		recvTransport.on("connect", ({ dtlsParameters }, callback, errback) => {
			send({ action: "connectConsumerTransport", dtlsParameters });
			waitForAction("connectedConsumerTransport")
				.then(() => callback())
				.catch(errback);
		});

		send({ action: "init", rtpCapabilities: device.rtpCapabilities });

		try {
			await startMic();
		} catch (err) {
			console.error("[voice] microphone unavailable, joining listen-only", err);
		}

		ready = true;
		reconnectAttempts = 0;
		setVoiceData("connection", "state", ConnectionState.Connected);

		const joinedUri = voiceData.connection.uri;
		if (joinedUri) {
			applyPresence("join", joinedUri, user.did);
			const community = communityUriForChannel(joinedUri);
			if (community)
				socket.send({
					type: "voice_join",
					data: { channel: joinedUri, community },
				});
		}

		sendVoiceState();
		startStatsMonitor();

		const queued = pendingConsume.splice(0, pendingConsume.length);
		for (const producerId of queued) void consumeProducer(producerId);
	};

	const handleServerMessage = (message: ServerMessage): void => {
		switch (message.action) {
			case "init":
				void setupDevice(message);
				break;
			case "connectedProducerTransport":
			case "connectedConsumerTransport":
			case "produced": {
				const queue = pendingByAction.get(message.action);
				queue?.shift()?.resolve(message);
				break;
			}
			case "consumed": {
				pendingConsumed.get(message.producerId)?.resolve(message);
				pendingConsumed.delete(message.producerId);
				break;
			}
			case "producerAdded":
				producerOwners.set(message.producerId, {
					did: message.did,
					kind: message.kind,
					source: message.source,
				});
				if (ready) void consumeProducer(message.producerId);
				else pendingConsume.push(message.producerId);
				break;
			case "producerRemoved":
				removeProducer(message.producerId);
				break;
			case "activeSpeakers":
				serverSpeakers = message.dids;
				recomputeSpeakers();
				break;
			case "error":
				console.error("[voice] server error:", message.message);
				break;
		}
	};

	const openSignaling = async (channelUri: string): Promise<void> => {
		if (!auth?.loggedIn) return;

		let token: string;
		try {
			const { data } = await auth.agent.com.atproto.server.getServiceAuth({
				aud: getAppViewServiceRef(),
				lxm: LXM,
				exp: Math.floor(Date.now() / 1000) + 60,
			});
			token = data.token;
		} catch (err) {
			console.error("[voice] service-auth fetch failed", err);
			scheduleReconnect(channelUri);
			return;
		}

		intentionalClose = false;
		const url = `${getAppViewHost("ws")}/xrpc/${LXM}?channel=${encodeURIComponent(channelUri)}`;
		const socketConn = new WebSocket(url, [AUTH_SUBPROTOCOL, token]);
		ws = socketConn;

		socketConn.onmessage = (event) => {
			let message: ServerMessage;
			try {
				message = JSON.parse(event.data as string) as ServerMessage;
			} catch {
				return;
			}
			handleServerMessage(message);
		};

		socketConn.onerror = () => console.error("[voice] signaling socket error");

		socketConn.onclose = () => {
			if (ws !== socketConn || intentionalClose) return;
			teardownMedia();
			scheduleReconnect(channelUri);
		};
	};

	const scheduleReconnect = (channelUri: string): void => {
		if (reconnectTimer) return;
		if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
			applyPresence("leave", channelUri, user.did);
			teardown();
			resetState();
			return;
		}
		reconnectAttempts += 1;
		setVoiceData("connection", "state", ConnectionState.Reconnecting);
		setVoiceData("connection", "quality", ConnectionQuality.Lost);
		setVoiceData("states", "camEnabled", false);
		setVoiceData("states", "screenEnabled", false);
		setVoiceData("videoStreams", {});
		setVoiceData("activeSpeakers", []);
		const delay = Math.min(1000 * 2 ** (reconnectAttempts - 1), 10000);
		reconnectTimer = setTimeout(() => {
			reconnectTimer = null;
			void openSignaling(channelUri);
		}, delay);
	};

	const connect = async (
		channelUri: string,
		meta?: { channelName?: string; communityName?: string },
	): Promise<void> => {
		if (
			voiceData.connection.uri === channelUri &&
			voiceData.connection.state !== ConnectionState.Disconnected
		) {
			return;
		}

		if (ws || voiceData.connection.state !== ConnectionState.Disconnected) {
			disconnect();
		}
		if (!auth?.loggedIn) return;

		reconnectAttempts = 0;

		setVoiceData("connection", {
			state: ConnectionState.Connecting,
			quality: ConnectionQuality.Unknown,
			uri: channelUri,
			channelName: meta?.channelName ?? null,
			communityName: meta?.communityName ?? null,
		});

		playSound("join");

		await openSignaling(channelUri);
	};

	const disconnect = (): void => {
		intentionalClose = true;

		const uri = voiceData.connection.uri;
		if (voiceData.connection.state !== ConnectionState.Disconnected) {
			socket.send({ type: "voice_leave" });
			playSound("leave");
		}

		if (uri) applyPresence("leave", uri, user.did);

		teardown();
		resetState();
	};

	const setMic = (enabled: boolean): void => {
		if (micProducer) {
			if (enabled) micProducer.resume();
			else micProducer.pause();
		}

		setVoiceData("states", "micEnabled", enabled);
		userPreferences.setVoiceSelfState({ selfMuted: !enabled });

		if (!enabled && localSpeaking) {
			localSpeaking = false;
			recomputeSpeakers();
		}
	};

	const setDeafen = (deafened: boolean): void => {
		for (const consumer of consumers.values()) {
			if (consumer.kind !== "audio") continue;
			if (deafened) consumer.pause();
			else consumer.resume();
		}

		setVoiceData("states", "deafened", deafened);
		userPreferences.setVoiceSelfState({ selfDeafened: deafened });
	};

	const toggleMic = (): void => {
		if (!micProducer) return;
		const next = !voiceData.states.micEnabled;
		setMic(next);
		playSound(next ? "unmute" : "mute");
		if (next && voiceData.states.deafened) setDeafen(false);
		sendVoiceState();
	};

	const selfVideoKey = (which: VideoSource): string => `self:${which}`;

	const produceVideo = async (
		which: VideoSource,
		track: MediaStreamTrack,
	): Promise<void> => {
		if (!sendTransport) return;
		setVoiceData("videoStreams", selfVideoKey(which), {
			did: user.did,
			source: which,
			stream: new MediaStream([track]),
		});

		const producer = await sendTransport.produce({
			track,
			appData: { source: which },
		});

		if (which === "cam") camProducer = producer;
		else screenProducer = producer;

		track.addEventListener("ended", () => {
			if (which === "cam") stopVideo("cam");
			else stopVideo("screen");
		});
	};

	const stopVideo = (which: VideoSource): void => {
		setVoiceData("videoStreams", selfVideoKey(which), undefined!);
		const producer = which === "cam" ? camProducer : screenProducer;

		if (!producer) return;

		send({ action: "closeProducer", producerId: producer.id });

		producer.track?.stop();
		producer.close();

		if (which === "cam") {
			camProducer = null;
			setVoiceData("states", "camEnabled", false);
		} else {
			screenProducer = null;
			setVoiceData("states", "screenEnabled", false);
		}
	};

	const toggleCamera = async (): Promise<void> => {
		if (camProducer) {
			stopVideo("cam");
			playSound("camOff");
			return;
		}

		try {
			const stream = await navigator.mediaDevices.getUserMedia({ video: true });
			const track = stream.getVideoTracks()[0];
			setVoiceData("states", "camEnabled", true);
			await produceVideo("cam", track);
			playSound("camOn");
		} catch (err) {
			console.error("[voice] camera failed", err);
		}
	};

	const toggleScreen = async (): Promise<void> => {
		if (screenProducer) {
			stopVideo("screen");
			playSound("screenUnshared");
			return;
		}

		try {
			const stream = await navigator.mediaDevices.getDisplayMedia({
				video: true,
			});
			await produceVideo("screen", stream.getVideoTracks()[0]);
			setVoiceData("states", "screenEnabled", true);
			playSound("screenShared");
		} catch (err) {
			console.error("[voice] screen share failed", err);
		}
	};

	const toggleDeafen = (): void => {
		const next = !voiceData.states.deafened;
		if (next) {
			setDeafen(true);
			setMic(false);
		} else {
			setDeafen(false);
		}

		playSound(next ? "deafen" : "undeafen");
		sendVoiceState();
	};

	const seedPresence = (
		members: Array<{
			did: string;
			vc?: string | null;
			vcMuted?: boolean;
			vcDeafened?: boolean;
		}>,
	): void => {
		for (const member of members) {
			if (!member.vc) continue;
			applyPresence("join", member.vc, member.did);
			setVoiceData("memberStates", member.did, {
				muted: member.vcMuted ?? false,
				deafened: member.vcDeafened ?? false,
			});
		}
	};

	createEffect(() => {
		userPreferences.preferences();
		for (const { el, did } of audioEls.values()) applyAudioSettings(el, did);
	});

	let mainSocketWasConnected = socket.connected();
	createEffect(() => {
		const isConnected = socket.connected();

		if (
			isConnected &&
			!mainSocketWasConnected &&
			voiceData.connection.uri &&
			voiceData.connection.state !== ConnectionState.Disconnected
		) {
			const community = communityUriForChannel(voiceData.connection.uri);
			if (community)
				socket.send({
					type: "voice_join",
					data: { channel: voiceData.connection.uri, community },
				});
			sendVoiceState();
		}

		mainSocketWasConnected = isConnected;
	});

	const unsubscribePresence = socket.onEvent((event) => {
		if (event.type === "voice_presence_event") {
			const data = event.data;
			if (!data) return;

			applyPresence(data.event, data.channel, data.did);

			if (
				data.did !== user.did &&
				voiceData.connection.state === ConnectionState.Connected &&
				voiceData.connection.uri === data.channel
			) {
				playSound(data.event === "leave" ? "leave" : "join");
			}
		} else if (event.type === "voice_state_event") {
			const data = event.data;

			if (!data) return;

			setVoiceData("memberStates", data.did, {
				muted: data.muted,
				deafened: data.deafened,
			});
		}
	});

	const actions: VoiceChatActions = {
		connect,
		disconnect,
		toggleMic,
		toggleCamera: () => void toggleCamera(),
		toggleScreen: () => void toggleScreen(),
		toggleDeafen,
		seedPresence,
	};

	onCleanup(() => {
		unsubscribePresence();
		teardown();
	});

	return (
		<VoiceChatContext.Provider value={[voiceData, actions]}>
			{props.children}
		</VoiceChatContext.Provider>
	);
};

export const useVoiceChatContext = (): VoiceChatContextValue => {
	const ctx = useContext(VoiceChatContext);
	if (!ctx)
		throw new Error(
			"useVoiceChatContext called outside VoiceChatContextProvider",
		);
	return ctx;
};
