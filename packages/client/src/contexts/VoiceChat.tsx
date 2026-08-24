import * as Sentry from "@sentry/solid";
import type { types } from "mediasoup-client";
import { Device } from "mediasoup-client";
import {
	createContext,
	createEffect,
	on,
	onCleanup,
	type ParentComponent,
	useContext,
} from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { toast } from "somoto";
import { asSpaceRef } from "../atproto/lexicons";
import { voiceDisabledOn } from "../atproto/server-features";
import { frameIs, setPresenceFrame } from "../atproto/sync-frames";
import type { ProfileView } from "../atproto/views";
import {
	type ClientVoiceFrame,
	closeProducerFrame,
	connectTransportFrame,
	consumeFrame,
	createTransportFrame,
	decodeMediaSource,
	decodeVoiceFrame,
	encodeVoiceFrame,
	getRtpCapabilitiesFrame,
	heartbeatFrame,
	isServerVoiceFrame,
	joinFrame,
	type MediaSource,
	produceFrame,
	resumeConsumerFrame,
	type ServerVoiceFrame,
	setSelfStateFrame,
	type TransportOptionsFrame,
	VOICE_SIGNAL_LXM,
	VOICE_SIGNAL_PATH,
} from "../atproto/voice-frames";
import { classifyThrown } from "../errors/classify";
import { isAppViewErrorCode } from "../errors/codes";
import { colibriError } from "../errors/error";
import { showError } from "../errors/show-error";
import {
	createNoiseSuppressor,
	type NoiseSuppressor,
} from "../hooks/createNoiseSuppressor";
import {
	createSuppressionMonitor,
	type SuppressionMonitor,
} from "../hooks/createSuppressionMonitor";
import { noiseMode } from "../hooks/noise/modes";
import { appViewHostFor, getAppViewServiceRef } from "../utils/appview";
import { applyAudioSink } from "../utils/audio-sink";
import { createLogger, isVerboseLogging } from "../utils/logger";
import { watchPortErrors } from "../utils/port-diagnostics";
import {
	displayMediaRequest,
	type ScreenShareOptions,
	type ScreenShareQuality,
	screenCodecOptions,
	screenContentHint,
	screenDegradationPreference,
	screenEncodings,
	screenVideoConstraints,
} from "../utils/screen-share";
import { pickVoiceHandler, supportsWebRtc } from "../utils/voice-device";
import {
	computePresenceSync,
	effectiveDeafened,
	effectiveMuted,
	type PresenceMember,
} from "../utils/voice-presence";
import { syncGroupFor } from "../utils/voice-sync";
import { useAuthContext } from "./Auth";
import { useSocketContext } from "./Socket";
import { useSounds } from "./Sounds";
import { useUserContext } from "./User";
import { useUserPreferences, type VolumeOverrides } from "./UserPreferences";

const log = createLogger("voice");

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
	latency: number | null;
	uri: string | null;
	channelName: string | null;
	communityName: string | null;
	managingApp: string | null;
};

export type VoiceChatStates = {
	camEnabled: boolean;
	screenEnabled: boolean;
	micEnabled: boolean;
	deafened: boolean;
	serverMuted: boolean;
	serverDeafened: boolean;
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
	serverMuted?: boolean;
	serverDeafened?: boolean;
};

export type PresenceSource = {
	did: string;
	actor: Pick<ProfileView, "presence">;
};

export type VoiceChatData = {
	connection: VoiceChatConnection;
	states: VoiceChatStates;
	presence: Record<string, string[]>;
	activeSpeakers: string[];
	videoStreams: Record<string, VideoTileData>;
	memberStates: Record<string, VoiceMemberState>;
	focusedKey: string | null;
	overlayDismissed: boolean;
};

export type VoiceChatActions = {
	connect: (
		channelUri: string,
		meta?: {
			channelName?: string;
			communityName?: string;
			managingApp?: string;
		},
	) => Promise<void>;
	disconnect: () => void;
	toggleMic: () => void;
	toggleCamera: () => void;
	toggleScreen: (options?: ScreenShareOptions) => void;
	shareScreenTrack: (
		track: MediaStreamTrack,
		audioTrack: MediaStreamTrack | null,
		quality: ScreenShareQuality,
		onStopped: () => void,
	) => void;
	applyScreenQuality: (quality: ScreenShareQuality) => void;
	toggleDeafen: () => void;
	setFocusedKey: (key: string | null) => void;
	setOverlayDismissed: (dismissed: boolean) => void;
	syncPresence: (
		communityAuthority: string,
		members: Array<PresenceSource>,
		since?: number,
	) => void;
	addPresence: (member: PresenceSource) => void;
	presenceMark: () => number;
};

export type VoiceChatContextValue = [VoiceChatData, VoiceChatActions];

const VoiceChatContext = createContext<VoiceChatContextValue>();

const AUTH_SUBPROTOCOL = "colibri.auth.bearer";
const SPEAKING_THRESHOLD = 0.007;
const MAX_RECONNECT_ATTEMPTS = 6;
const STATS_INTERVAL_MS = 3000;
const STATS_FAST_MS = 400;
const HEARTBEAT_INTERVAL_MS = 20000;
const REPLY_TIMEOUT_MS = 15000;

type ChannelRef = ReturnType<typeof asSpaceRef>;

const disconnectReason = (reason: string | undefined): string => {
	if (reason === "moderator") return "A moderator disconnected you.";
	if (reason === "superseded") return "You joined this call somewhere else.";
	if (reason === "channelGone") return "The channel is no longer there.";
	if (reason === "forbidden")
		return "You no longer have access to this channel.";
	return "The server closed your connection.";
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
			latency: null,
			uri: null,
			channelName: null,
			communityName: null,
			managingApp: null,
		},
		states: {
			camEnabled: false,
			screenEnabled: false,
			micEnabled: false,
			deafened: false,
			serverMuted: false,
			serverDeafened: false,
		},
		presence: {},
		activeSpeakers: [],
		videoStreams: {},
		memberStates: {},
		focusedKey: null,
		overlayDismissed: false,
	});

	let ws: WebSocket | null = null;
	let device: Device | null = null;
	let sendTransport: types.Transport | null = null;
	let recvTransport: types.Transport | null = null;
	let micProducer: types.Producer | null = null;
	let camProducer: types.Producer | null = null;
	let screenProducer: types.Producer | null = null;
	let screenAudioProducer: types.Producer | null = null;
	let screenAudioListener: (() => void) | null = null;
	let screenTrackCleanup: (() => void) | null = null;
	let micStream: MediaStream | null = null;
	let suppressor: NoiseSuppressor | null = null;
	let speakingContext: AudioContext | null = null;
	let speakingInterval: ReturnType<typeof setInterval> | null = null;
	let suppressionMonitor: SuppressionMonitor | null = null;
	let localSpeaking = false;
	let serverSpeakers: string[] = [];
	let ready = false;
	let mediaEpoch = 0;
	let intentionalClose = false;
	let reconnectAttempts = 0;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let statsTimer: ReturnType<typeof setTimeout> | null = null;
	let statsGen = 0;
	let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
	let channelRef: ChannelRef | null = null;
	let sendChain: Promise<void> = Promise.resolve();
	let pendingVideoTeardown: Promise<void> | null = null;
	let sessionId = 0;
	let presenceClock = 0;
	const joinOrder = new Map<string, number>();
	const videoTrackListeners = new Map<VideoSource, () => void>();

	const consumers = new Map<string, types.Consumer>();
	const audioEls = new Map<
		string,
		{ el: HTMLAudioElement; did: string; channel: keyof VolumeOverrides }
	>();
	const producerOwners = new Map<
		string,
		{ did: string; kind: types.MediaKind; source: MediaSource }
	>();
	const pendingConsume: string[] = [];
	const consumersByProducer = new Map<string, string | null>();
	let pendingReplies: Array<{
		resolve: (frame: ServerVoiceFrame) => void;
		reject: (err: unknown) => void;
	}> = [];

	const describeArg = (arg: unknown): string => {
		if (typeof arg === "string") return arg;
		try {
			return JSON.stringify(arg) ?? String(arg);
		} catch {
			return String(arg);
		}
	};

	const dbg = (...args: unknown[]): void => {
		log.debug(args.map(describeArg).join(" "));
	};

	const reportVoiceFailure = (err: unknown, stage: string): void => {
		Sentry.withScope((scope) => {
			scope.setTag("voice.stage", stage);
			scope.setContext("voice", {
				handler: device?.handlerName ?? "none",
				userAgent:
					typeof navigator === "undefined" ? "unknown" : navigator.userAgent,
				channel: voiceData.connection.uri,
				managingApp: voiceData.connection.managingApp,
				state: voiceData.connection.state,
			});
			Sentry.captureException(
				err instanceof Error ? err : new Error(String(err)),
			);
		});
	};

	const failSetup = (err: unknown): void => {
		if (voiceData.connection.state === ConnectionState.Disconnected) return;
		if (voiceData.connection.state === ConnectionState.Reconnecting) {
			dbg("setup failed while reconnecting, letting the retry run", err);
			return;
		}

		dbg("✗ setupDevice failed", err);

		if (!supportsWebRtc()) {
			toast.error("Voice isn't available on this system", {
				description:
					"This system's web engine was built without WebRTC, so calls can't connect.",
			});
			disconnect();
			return;
		}

		log.error("setup failed", { code: classifyThrown(err).code });
		reportVoiceFailure(err, "setup");

		toast.error("Couldn't join the voice channel", {
			description:
				err instanceof Error && err.name === "UnsupportedError"
					? "Voice isn't supported by this device's browser engine yet."
					: "Something went wrong while setting up the connection.",
		});

		disconnect();
	};

	const send = (frame: ClientVoiceFrame): void => {
		if (ws?.readyState === WebSocket.OPEN) {
			dbg("→ send", frame.$type, frame);
			ws.send(encodeVoiceFrame(frame));
		} else {
			dbg("✗ send dropped (socket not open)", frame.$type, {
				readyState: ws?.readyState,
			});
		}
	};

	const sendAndWait = (frame: ClientVoiceFrame): Promise<ServerVoiceFrame> => {
		const run = sendChain.then(
			() =>
				new Promise<ServerVoiceFrame>((resolve, reject) => {
					const timer = setTimeout(() => {
						const at = pendingReplies.indexOf(waiter);
						if (at !== -1) pendingReplies.splice(at, 1);
						dbg("✗ no reply", frame.$type);
						reject(colibriError({ code: "VoiceConnectionLost" }));
						const uri = voiceData.connection.uri;
						if (uri && !intentionalClose) {
							teardownMedia();
							scheduleReconnect(uri);
						}
					}, REPLY_TIMEOUT_MS);
					const waiter = {
						resolve: (value: ServerVoiceFrame) => {
							clearTimeout(timer);
							resolve(value);
						},
						reject: (reason: unknown) => {
							clearTimeout(timer);
							reject(reason);
						},
					};
					pendingReplies.push(waiter);
					send(frame);
				}),
		);
		sendChain = run.then(
			() => undefined,
			() => undefined,
		);
		return run;
	};

	const expectFrame = <T extends ServerVoiceFrame["$type"]>(
		frame: ServerVoiceFrame,
		type: T,
	): Extract<ServerVoiceFrame, { $type: T }> => {
		if (frame.$type !== type) {
			throw colibriError({
				code: "MalformedResponse",
				message: `expected ${type}, got ${frame.$type}`,
			});
		}
		return frame as Extract<ServerVoiceFrame, { $type: T }>;
	};

	const rejectAllPending = (): void => {
		const pending = pendingReplies;
		pendingReplies = [];
		sendChain = Promise.resolve();

		for (const p of pending) {
			p.reject(colibriError({ code: "VoiceConnectionLost" }));
		}
	};

	const removeFromChannel = (channel: string, did: string): void => {
		setVoiceData("presence", channel, (current) =>
			current?.includes(did) ? current.filter((d) => d !== did) : current,
		);
	};

	const inAnyChannel = (did: string): boolean =>
		Object.values(voiceData.presence).some((dids) => dids?.includes(did));

	const applyPresence = (kind: string, channel: string, did: string): void => {
		if (kind === "leave") {
			removeFromChannel(channel, did);
			if (inAnyChannel(did)) return;

			joinOrder.delete(did);
			setVoiceData("memberStates", did, undefined!);

			for (const [producerId, owner] of [...producerOwners.entries()]) {
				if (owner.did === did) removeProducer(producerId);
			}
		} else {
			presenceClock += 1;
			joinOrder.set(did, presenceClock);
			setVoiceData("presence", channel, (current) =>
				current?.includes(did) ? current : [...(current ?? []), did],
			);
		}
	};

	const selfMuted = (): boolean => effectiveMuted(voiceData.states);
	const selfDeafened = (): boolean => effectiveDeafened(voiceData.states);

	const sendVoiceState = (): void => {
		if (!channelRef) return;

		const muted = selfMuted();
		const deafened = selfDeafened();

		setVoiceData("memberStates", user.did, (prev) => ({
			...prev,
			muted,
			deafened,
		}));

		socket.send(
			setPresenceFrame({
				voice: { channel: channelRef, muted, deafened },
			}),
		);
	};

	const sendSelfState = (): void => {
		if (!ready) return;

		void sendAndWait(
			setSelfStateFrame({
				muted: !voiceData.states.micEnabled,
				deafened: voiceData.states.deafened,
			}),
		).catch((err) => {
			dbg("✗ setSelfState failed", err);
		});
	};

	const recomputeSpeakers = (): void => {
		const others = serverSpeakers.filter((d) => d !== user.did);
		setVoiceData(
			"activeSpeakers",
			localSpeaking ? [...others, user.did] : others,
		);
	};

	const applyAudioSettings = (
		el: HTMLAudioElement,
		did: string,
		channel: keyof VolumeOverrides,
		options: { force?: boolean } = {},
	): void => {
		const output = userPreferences.preferences().voice.output;
		const override =
			userPreferences.preferences().voice.participantVolumeOverrides[did]?.[
				channel
			];
		const base = output.enabled ? output.volume : 0;

		el.volume = Math.max(0, Math.min(1, base * (override?.volume ?? 1)));
		el.muted = override?.muted ?? false;

		void applyAudioSink(el, output.preferredDeviceId, options).catch((err) => {
			log.warn("could not route voice audio to the selected speaker", {
				code: classifyThrown(err).code,
			});
		});
	};

	const reapplyAudioSettings = (options: { force?: boolean } = {}): void => {
		for (const { el, did, channel } of audioEls.values())
			applyAudioSettings(el, did, channel, options);
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

	const meanJitterBufferMs = (
		report: Record<string, unknown>,
	): number | undefined => {
		const delay = report.jitterBufferDelay;
		const emitted = report.jitterBufferEmittedCount;

		if (
			typeof delay !== "number" ||
			typeof emitted !== "number" ||
			emitted <= 0
		)
			return undefined;

		return Math.round((delay / emitted) * 1000);
	};

	const logPlayoutSkew = async (): Promise<void> => {
		if (!recvTransport || !isVerboseLogging()) return;

		const groupOf = new Map<string, string>();

		for (const consumer of consumers.values()) {
			const owner = producerOwners.get(consumer.producerId);
			if (owner) groupOf.set(consumer.track.id, syncGroupFor(owner));
		}

		if (!groupOf.size) return;

		type PlayoutSide = { playoutAt?: number; jitterMs?: number };
		const groups = new Map<
			string,
			{ audio: PlayoutSide; video: PlayoutSide }
		>();

		try {
			const stats = await recvTransport.getStats();

			stats.forEach((report: { type?: string } & Record<string, unknown>) => {
				if (report.type !== "inbound-rtp") return;

				const trackId = report.trackIdentifier;
				if (typeof trackId !== "string") return;

				const group = groupOf.get(trackId);
				if (!group) return;

				const side = groups.get(group) ?? { audio: {}, video: {} };
				const playoutAt = report.estimatedPlayoutTimestamp;

				side[report.kind === "audio" ? "audio" : "video"] = {
					playoutAt: typeof playoutAt === "number" ? playoutAt : undefined,
					jitterMs: meanJitterBufferMs(report),
				};

				groups.set(group, side);
			});
		} catch {
			return;
		}

		for (const [group, { audio, video }] of groups) {
			if (video.playoutAt === undefined && video.jitterMs === undefined)
				continue;

			const skewMs =
				audio.playoutAt !== undefined && video.playoutAt !== undefined
					? Math.round(audio.playoutAt - video.playoutAt)
					: undefined;

			dbg("a/v skew", {
				group,
				skewMs,
				audioJitterMs: audio.jitterMs,
				videoJitterMs: video.jitterMs,
			});
		}
	};

	const pollQuality = async (): Promise<boolean> => {
		const rtts = (
			await Promise.all([readRtt(sendTransport), readRtt(recvTransport)])
		).filter((v): v is number => typeof v === "number");

		if (!rtts.length) return false;

		const min = Math.min(...rtts);
		setVoiceData("connection", "quality", rttToQuality(min));
		setVoiceData("connection", "latency", Math.round(min * 1000));

		void logPlayoutSkew();

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

	const stopHeartbeat = (): void => {
		if (heartbeatTimer) {
			clearInterval(heartbeatTimer);
			heartbeatTimer = null;
		}
	};

	const startHeartbeat = (): void => {
		stopHeartbeat();
		heartbeatTimer = setInterval(() => {
			void sendAndWait(heartbeatFrame()).catch((err) => {
				dbg("✗ heartbeat failed", err);
			});
		}, HEARTBEAT_INTERVAL_MS);
	};

	const resetState = (): void => {
		setVoiceData("connection", {
			state: ConnectionState.Disconnected,
			quality: ConnectionQuality.Unknown,
			latency: null,
			uri: null,
			channelName: null,
			communityName: null,
			managingApp: null,
		});
		setVoiceData("states", {
			camEnabled: false,
			screenEnabled: false,
			micEnabled: false,
			deafened: false,
			serverMuted: false,
			serverDeafened: false,
		});
		setVoiceData("activeSpeakers", []);
		setVoiceData("videoStreams", reconcile({}));
		setVoiceData("memberStates", reconcile({}));
		setVoiceData("focusedKey", null);
	};

	const teardownMedia = (): void => {
		mediaEpoch += 1;
		rejectAllPending();

		if (speakingInterval) {
			clearInterval(speakingInterval);
			speakingInterval = null;
		}
		suppressionMonitor?.destroy();
		suppressionMonitor = null;
		stopStatsMonitor();
		stopHeartbeat();
		channelRef = null;
		speakingContext?.close().catch(() => {});
		speakingContext = null;
		localSpeaking = false;
		serverSpeakers = [];

		// Only stop the local tracks here — do NOT call producer.close(). That
		// triggers mediasoup-client's async stopSending() renegotiation
		// (createOffer/setLocalDescription/setRemoteDescription on the real
		// RTCPeerConnection), which sendTransport.close() below can then abort
		// mid-flight by closing the underlying RTCPeerConnection out from
		// under it. Closing the transport already closes every producer on it
		// synchronously via transportClosed(), with no renegotiation involved.
		for (const producer of [
			micProducer,
			camProducer,
			screenProducer,
			screenAudioProducer,
		]) {
			producer?.track?.stop();
		}
		micProducer = null;
		camProducer = null;
		screenProducer = null;
		screenAudioProducer = null;
		screenAudioListener = null;
		screenTrackCleanup?.();
		screenTrackCleanup = null;

		for (const consumer of consumers.values()) consumer.close();
		consumers.clear();

		for (const { el } of audioEls.values()) {
			el.pause();
			el.srcObject = null;
		}
		audioEls.clear();

		producerOwners.clear();
		consumersByProducer.clear();
		pendingConsume.length = 0;

		sendTransport?.close();
		recvTransport?.close();
		sendTransport = null;
		recvTransport = null;
		device = null;

		suppressor?.destroy();
		suppressor = null;
		for (const t of micStream?.getTracks() ?? []) t.stop();
		micStream = null;

		ready = false;
	};

	const abandonSignaling = (): void => {
		if (!ws) return;
		const stale = ws;
		ws = null;
		stale.onclose = null;
		stale.onerror = null;
		stale.onmessage = null;
		stale.onopen = null;
		stale.close();
	};

	const teardown = (): void => {
		if (reconnectTimer) {
			clearTimeout(reconnectTimer);
			reconnectTimer = null;
		}
		teardownMedia();
		abandonSignaling();
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
			if (suppressor?.getActiveMode() === "high") return;

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
		const transport = sendTransport;
		if (!transport) return;
		const epoch = mediaEpoch;
		const stale = (): boolean => mediaEpoch !== epoch;
		dbg("startMic() — requesting getUserMedia + producing");
		const input = userPreferences.preferences().voice.input;

		const stream = await navigator.mediaDevices.getUserMedia({
			audio: {
				echoCancellation: true,
				autoGainControl: true,
				noiseSuppression: false,
				deviceId: input.preferredDeviceId
					? { ideal: input.preferredDeviceId }
					: undefined,
			},
		});

		const rawTrack = stream.getAudioTracks()[0];
		let ns: NoiseSuppressor | null = null;
		let adopted = false;

		try {
			if (stale()) {
				dbg("startMic(): session ended while waiting for the microphone");
				return;
			}

			ns = await createNoiseSuppressor(rawTrack, {
				desiredMode: input.noiseSuppressionMode,
				suppressionLevel: input.noiseSuppressionLevel,
				onFallback: (_from, to) => {
					userPreferences.setNoiseSuppressionMode(to);
					toast(
						`Switched to ${noiseMode(to).label.toLowerCase()} noise suppression`,
						{
							description:
								"The mode you picked couldn't run smoothly on this device.",
						},
					);
				},
				onSpeaking: (speaking) => {
					if (speaking === localSpeaking) return;
					localSpeaking = speaking && !selfMuted();
					recomputeSpeakers();
				},
			});

			if (stale()) {
				dbg("startMic(): session ended while building the audio graph");
				return;
			}

			const producer = await transport.produce({
				track: ns.outputTrack,
				appData: { source: "mic" },
			});

			if (stale()) {
				dbg("startMic(): session ended before the producer was live");
				producer.close();
				return;
			}

			micStream = stream;
			suppressor = ns;
			micProducer = producer;
			adopted = true;

			const muted = userPreferences.preferences().voice.selfMuted;
			if (muted) producer.pause();

			setVoiceData("states", "micEnabled", !muted);
			setupLocalSpeaking(rawTrack);
			suppressionMonitor = createSuppressionMonitor({
				rawTrack,
				processedTrack: ns.outputTrack,
				isActive: () => !selfMuted(),
				isTunable: () =>
					noiseMode(suppressor?.getActiveMode() ?? "off").tunable,
				hintsEnabled: () =>
					userPreferences.preferences().voice.noiseSuppressionHints,
				getLevel: () =>
					userPreferences.preferences().voice.input.noiseSuppressionLevel,
				setLevel: (level) => userPreferences.setNoiseSuppressionLevel(level),
				disableHints: () => userPreferences.setNoiseSuppressionHints(false),
			});
		} finally {
			if (!adopted) {
				ns?.destroy();
				for (const track of stream.getTracks()) track.stop();
			}
		}
	};

	const consumeProducer = async (producerId: string): Promise<void> => {
		if (!recvTransport || !device) return;
		if (consumersByProducer.has(producerId)) {
			dbg("consumeProducer(): already consuming", { producerId });
			return;
		}

		const owner = producerOwners.get(producerId);
		dbg("consumeProducer()", { producerId, owner });

		const epoch = mediaEpoch;
		const stale = (): boolean => mediaEpoch !== epoch;
		consumersByProducer.set(producerId, null);

		let reply: Extract<
			ServerVoiceFrame,
			{ $type: "social.colibri.beta.voice.defs#consumerOptions" }
		>;

		try {
			reply = expectFrame(
				await sendAndWait(
					consumeFrame(recvTransport.id, producerId, device.rtpCapabilities),
				),
				"social.colibri.beta.voice.defs#consumerOptions",
			);
		} catch (err) {
			consumersByProducer.delete(producerId);
			if (stale()) {
				dbg("consume abandoned, the session ended while it was in flight");
				return;
			}
			dbg("✗ consume rejected", { producerId, err });
			log.warn("could not receive a participant's stream", {
				producerId,
				owner,
				code: classifyThrown(err).code,
			});
			reportVoiceFailure(err, "consume");
			showError(err, {
				fallbackTitle: "Someone's audio or video didn't come through.",
				description: "Rejoining the channel usually fixes it.",
				report: false,
			});
			return;
		}

		const consumer = await recvTransport.consume({
			id: reply.id,
			producerId: reply.producerId,
			kind: reply.kind as types.MediaKind,
			rtpParameters: reply.rtpParameters as unknown as types.RtpParameters,
			...(owner ? { streamId: syncGroupFor(owner) } : {}),
		});

		if (stale() || !producerOwners.has(producerId)) {
			dbg("consume landed after its owner left", { producerId });
			consumer.close();
			consumersByProducer.delete(producerId);
			return;
		}

		consumers.set(consumer.id, consumer);
		consumersByProducer.set(producerId, consumer.id);

		try {
			await sendAndWait(resumeConsumerFrame(consumer.id));
		} catch (err) {
			dbg("✗ resumeConsumer failed", { consumerId: consumer.id, err });
		}

		if (stale()) {
			dbg("consume resumed after the session ended", { producerId });
			consumer.close();
			consumers.delete(consumer.id);
			consumersByProducer.delete(producerId);
			return;
		}

		if (consumer.kind === "audio") {
			const el = new Audio();

			el.autoplay = true;
			el.srcObject = new MediaStream([consumer.track]);
			const channel: keyof VolumeOverrides =
				owner?.source === "screen" ? "screen" : "voice";
			applyAudioSettings(el, owner?.did ?? "", channel);
			audioEls.set(consumer.id, { el, did: owner?.did ?? "", channel });

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
		consumersByProducer.delete(producerId);

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

	const toTransportOptions = (
		frame: TransportOptionsFrame,
	): types.TransportOptions => {
		const iceServers = frame.iceServers ?? [];

		return {
			id: frame.id,
			iceParameters: frame.iceParameters as unknown as types.IceParameters,
			iceCandidates: frame.iceCandidates as unknown as types.IceCandidate[],
			dtlsParameters: frame.dtlsParameters as unknown as types.DtlsParameters,
			...(iceServers.length > 0
				? { iceServers: iceServers as unknown as RTCIceServer[] }
				: {}),
		};
	};

	const wireSendTransport = (transport: types.Transport): void => {
		transport.on("connect", ({ dtlsParameters }, callback, errback) => {
			dbg("sendTransport 'connect' fired → sending DTLS params");
			sendAndWait(connectTransportFrame(transport.id, dtlsParameters))
				.then((frame) => {
					expectFrame(frame, "social.colibri.beta.voice.defs#ack");
					dbg("sendTransport DTLS confirmed by server");
					callback();
				})
				.catch((err) => {
					dbg("✗ sendTransport connect failed", err);
					errback(err as Error);
				});
		});

		let sendConnected = false;
		transport.on("connectionstatechange", (state) => {
			dbg("sendTransport connectionstatechange →", state);
			if (state === "connected") sendConnected = true;
			if (state === "failed" || state === "disconnected") {
				dbg(
					"✗ sendTransport ICE/DTLS unreachable: check the SFU media port range and the announced IP",
				);
			}
		});

		setTimeout(() => {
			if (sendConnected || sendTransport !== transport) return;
			dbg("⏱ sendTransport still not connected after 8s — dumping ICE stats");
			void transport.getStats().then((stats) => {
				const pairs: unknown[] = [];
				const local = new Map<string, Record<string, unknown>>();
				const remote = new Map<string, Record<string, unknown>>();
				stats.forEach((r: { type?: string } & Record<string, unknown>) => {
					if (r.type === "candidate-pair") pairs.push(r);
					else if (r.type === "local-candidate") local.set(r.id as string, r);
					else if (r.type === "remote-candidate") remote.set(r.id as string, r);
				});
				dbg("ICE candidate-pairs", pairs);
				dbg("ICE local-candidates", [...local.values()]);
				dbg("ICE remote-candidates", [...remote.values()]);
			});
		}, 8000);

		transport.observer.on("close", () => dbg("sendTransport closed"));

		transport.on(
			"produce",
			({ kind, rtpParameters, appData }, callback, errback) => {
				const source = (appData as { source?: MediaSource }).source ?? "mic";
				dbg("sendTransport 'produce' fired", { kind, source });
				sendAndWait(produceFrame(transport.id, kind, rtpParameters, source))
					.then((frame) => {
						const info = expectFrame(
							frame,
							"social.colibri.beta.voice.defs#producerInfo",
						);
						dbg("produce confirmed", { id: info.producerId, kind, source });
						callback({ id: info.producerId });
					})
					.catch((err) => {
						dbg("✗ produce failed", err);
						errback(err as Error);
					});
			},
		);
	};

	const wireRecvTransport = (transport: types.Transport): void => {
		transport.on("connect", ({ dtlsParameters }, callback, errback) => {
			dbg("recvTransport 'connect' fired → sending DTLS params");
			sendAndWait(connectTransportFrame(transport.id, dtlsParameters))
				.then((frame) => {
					expectFrame(frame, "social.colibri.beta.voice.defs#ack");
					dbg("recvTransport DTLS confirmed by server");
					callback();
				})
				.catch((err) => {
					dbg("✗ recvTransport connect failed", err);
					errback(err as Error);
				});
		});

		transport.on("connectionstatechange", (state) => {
			dbg("recvTransport connectionstatechange →", state);
			if (state === "failed" || state === "disconnected") {
				dbg(
					"✗ recvTransport ICE/DTLS unreachable: check the SFU media port range and the announced IP",
				);
			}
		});

		transport.observer.on("close", () => dbg("recvTransport closed"));
	};

	const performHandshake = async (): Promise<void> => {
		const epoch = mediaEpoch;
		const stale = (): boolean => mediaEpoch !== epoch;
		const abandoned = (): boolean => {
			if (!stale()) return false;
			dbg("handshake abandoned, the session ended while it was in flight");
			return true;
		};

		setVoiceData(
			"states",
			"deafened",
			userPreferences.preferences().voice.selfDeafened,
		);

		const rtpCaps = expectFrame(
			await sendAndWait(getRtpCapabilitiesFrame()),
			"social.colibri.beta.voice.defs#rtpCapabilities",
		);

		if (abandoned()) return;

		const handlerName = pickVoiceHandler();
		dbg("device handler", { handlerName, userAgent: navigator.userAgent });
		Sentry.addBreadcrumb({
			category: "voice.device",
			level: handlerName ? "info" : "warning",
			message: `handler ${handlerName ?? "none"}`,
		});

		const loaded = new Device({ handlerName });
		await loaded.load({
			routerRtpCapabilities:
				rtpCaps.payload as unknown as types.RtpCapabilities,
		});

		if (abandoned()) return;

		device = loaded;
		dbg("device loaded", { canProduceAudio: loaded.canProduce("audio") });

		const sendOptions = expectFrame(
			await sendAndWait(createTransportFrame("send")),
			"social.colibri.beta.voice.defs#transportOptions",
		);

		if (abandoned()) return;

		sendTransport = loaded.createSendTransport(toTransportOptions(sendOptions));
		dbg("sendTransport created", { id: sendTransport.id });
		wireSendTransport(sendTransport);

		const recvOptions = expectFrame(
			await sendAndWait(createTransportFrame("recv")),
			"social.colibri.beta.voice.defs#transportOptions",
		);

		if (abandoned()) return;

		recvTransport = loaded.createRecvTransport(toTransportOptions(recvOptions));
		dbg("recvTransport created", { id: recvTransport.id });
		wireRecvTransport(recvTransport);

		try {
			await startMic();
		} catch (err) {
			if (stale()) {
				dbg("startMic() failed after the session ended", err);
				return;
			}
			log.warn("microphone unavailable, joining listen-only", {
				code: classifyThrown(err).code,
			});
			reportVoiceFailure(err, "mic");
			toast("Joined without a microphone", {
				description: "Colibri couldn't access your input device.",
			});
		}

		if (abandoned()) return;

		ready = true;
		reconnectAttempts = 0;
		setVoiceData("connection", "state", ConnectionState.Connected);

		const joinedUri = voiceData.connection.uri;
		if (joinedUri) {
			applyPresence("join", joinedUri, user.did);
		}

		sendVoiceState();
		sendSelfState();
		startStatsMonitor();
		startHeartbeat();

		const queued = pendingConsume.splice(0, pendingConsume.length);
		for (const producerId of queued) {
			consumeProducer(producerId).catch((err) =>
				reportVoiceFailure(err, "consume"),
			);
		}
	};

	const handlePeerProducer = (
		frame: Extract<
			ServerVoiceFrame,
			{ $type: "social.colibri.beta.voice.defs#producerInfo" }
		>,
	): void => {
		const source =
			decodeMediaSource(frame.source) ??
			(frame.kind === "audio" ? "mic" : "cam");

		producerOwners.set(frame.producerId, {
			did: frame.did,
			kind: frame.kind as types.MediaKind,
			source,
		});

		if (
			frame.kind === "video" &&
			frame.did !== user.did &&
			voiceData.connection.state === ConnectionState.Connected
		) {
			playSound(source === "screen" ? "screenShared" : "camOn");
		}

		if (ready) {
			consumeProducer(frame.producerId).catch((err) =>
				reportVoiceFailure(err, "consume"),
			);
		} else {
			pendingConsume.push(frame.producerId);
		}
	};

	const handleServerFrame = (frame: ServerVoiceFrame): void => {
		dbg("← recv", frame.$type, frame);

		switch (frame.$type) {
			case "social.colibri.beta.voice.defs#joined":
			case "social.colibri.beta.voice.defs#rtpCapabilities":
			case "social.colibri.beta.voice.defs#transportOptions":
			case "social.colibri.beta.voice.defs#ack":
			case "social.colibri.beta.voice.defs#consumerOptions":
				pendingReplies.shift()?.resolve(frame);
				break;
			case "social.colibri.beta.voice.defs#producerInfo":
				if (frame.did === user.did) {
					pendingReplies.shift()?.resolve(frame);
				} else {
					handlePeerProducer(frame);
				}
				break;
			case "social.colibri.beta.voice.defs#error": {
				const next = pendingReplies.shift();
				const err = colibriError({
					code: isAppViewErrorCode(frame.error)
						? frame.error
						: "InvalidRequest",
					serverMessage: frame.message,
				});
				if (next) next.reject(err);
				else log.error("unsolicited voice error", { code: frame.error });
				break;
			}
			case "social.colibri.beta.voice.defs#peerJoined": {
				dbg("peer joined the room", { did: frame.did });
				const joinedUri = voiceData.connection.uri;
				if (joinedUri) applyPresence("join", joinedUri, frame.did);
				break;
			}
			case "social.colibri.beta.voice.defs#peerLeft": {
				const leftUri = voiceData.connection.uri;
				if (leftUri) applyPresence("leave", leftUri, frame.did);
				for (const [producerId, owner] of [...producerOwners.entries()]) {
					if (owner.did === frame.did) removeProducer(producerId);
				}
				break;
			}
			case "social.colibri.beta.voice.defs#producerRemoved": {
				const owner = producerOwners.get(frame.producerId);
				removeProducer(frame.producerId);
				if (
					owner?.kind === "video" &&
					frame.did !== user.did &&
					voiceData.connection.state === ConnectionState.Connected
				) {
					playSound(owner.source === "screen" ? "screenUnshared" : "camOff");
				}
				break;
			}
			case "social.colibri.beta.voice.defs#speakingUpdate":
				serverSpeakers = frame.speaking
					? serverSpeakers.includes(frame.did)
						? serverSpeakers
						: [...serverSpeakers, frame.did]
					: serverSpeakers.filter((d) => d !== frame.did);
				recomputeSpeakers();
				break;
			case "social.colibri.beta.voice.defs#moderationChanged": {
				const serverMuted = frame.serverMuted ?? false;
				const serverDeafened = frame.serverDeafened ?? false;

				setVoiceData("memberStates", frame.did, (prev) => ({
					...prev,
					muted: frame.muted,
					deafened: frame.deafened,
					serverMuted,
					serverDeafened,
				}));

				if (frame.did === user.did) {
					setVoiceData("states", "serverMuted", serverMuted);
					setVoiceData("states", "serverDeafened", serverDeafened);
				}
				break;
			}
			case "social.colibri.beta.voice.defs#disconnected":
				dbg("the server removed us from the call", { reason: frame.reason });
				toast("You were disconnected from the call", {
					description: disconnectReason(frame.reason),
				});
				disconnect();
				break;
		}
	};

	const openSignaling = async (channelUri: string): Promise<void> => {
		if (!auth?.loggedIn) return;

		let ref: ChannelRef;
		try {
			ref = asSpaceRef(channelUri);
		} catch (err) {
			log.error("channel is not a valid voice space reference", {
				code: classifyThrown(err).code,
			});
			toast.error("Couldn't join the voice channel", {
				description: "That channel isn't set up for voice yet.",
			});
			disconnect();
			return;
		}

		const managingApp = voiceData.connection.managingApp;
		const serviceRef = managingApp
			? `${managingApp}#colibri_appview`
			: getAppViewServiceRef();
		const wsHost = appViewHostFor(managingApp ?? undefined, "ws");

		let token: string;
		try {
			const { data } = await auth.agent.com.atproto.server.getServiceAuth({
				aud: serviceRef,
				lxm: VOICE_SIGNAL_LXM,
				exp: Math.floor(Date.now() / 1000) + 60,
			});
			token = data.token;
		} catch (err) {
			log.error("service-auth fetch failed", {
				code: classifyThrown(err).code,
			});
			scheduleReconnect(channelUri);
			return;
		}

		intentionalClose = false;
		channelRef = ref;
		pendingReplies = [];
		sendChain = Promise.resolve();

		const url = `${wsHost}${VOICE_SIGNAL_PATH}`;
		dbg("opening signaling socket", { url });
		abandonSignaling();
		const socketConn = new WebSocket(url, [AUTH_SUBPROTOCOL, token]);
		ws = socketConn;

		socketConn.onopen = () => {
			dbg("signaling socket open", { protocol: socketConn.protocol });
			sendAndWait(joinFrame(ref))
				.then((frame) => {
					expectFrame(frame, "social.colibri.beta.voice.defs#joined");
					return performHandshake();
				})
				.catch((err) => {
					if (ws !== socketConn) return;
					failSetup(err);
				});
		};

		socketConn.onmessage = (event) => {
			if (ws !== socketConn) return;
			const frame = decodeVoiceFrame(event.data as string);
			if (!frame) {
				dbg("✗ failed to decode server frame", event.data);
				return;
			}
			if (!isServerVoiceFrame(frame)) {
				dbg("✗ received a non-server frame", frame.$type);
				return;
			}
			handleServerFrame(frame);
		};

		socketConn.onerror = (event) => {
			dbg("✗ signaling socket error", event);
			log.error("signaling socket errored");
		};

		socketConn.onclose = (event) => {
			dbg("signaling socket closed", {
				code: event.code,
				reason: event.reason,
				wasClean: event.wasClean,
				intentional: intentionalClose,
			});
			if (ws !== socketConn || intentionalClose) return;
			teardownMedia();
			scheduleReconnect(channelUri);
		};
	};

	const scheduleReconnect = (channelUri: string): void => {
		if (reconnectTimer) return;
		abandonSignaling();
		if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
			log.warn("gave up reconnecting to voice", { channelUri });
			toast.error("Lost the voice connection", {
				description:
					"Colibri couldn't get back into the channel. Try rejoining.",
			});
			playSound("leave");
			applyPresence("leave", channelUri, user.did);
			teardown();
			resetState();
			return;
		}
		reconnectAttempts += 1;
		setVoiceData("connection", "state", ConnectionState.Reconnecting);
		setVoiceData("connection", "quality", ConnectionQuality.Lost);
		setVoiceData("connection", "latency", null);
		setVoiceData("states", "micEnabled", false);
		setVoiceData("states", "camEnabled", false);
		setVoiceData("states", "screenEnabled", false);
		setVoiceData("states", "serverMuted", false);
		setVoiceData("states", "serverDeafened", false);
		setVoiceData("videoStreams", reconcile({}));
		setVoiceData("activeSpeakers", []);
		const delay = Math.min(1000 * 2 ** (reconnectAttempts - 1), 10000);
		reconnectTimer = setTimeout(() => {
			reconnectTimer = null;
			void openSignaling(channelUri);
		}, delay);
	};

	const connect = async (
		channelUri: string,
		meta?: {
			channelName?: string;
			communityName?: string;
			managingApp?: string;
		},
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

		sessionId += 1;
		const session = sessionId;
		setVoiceData("connection", {
			state: ConnectionState.Connecting,
			quality: ConnectionQuality.Unknown,
			latency: null,
			uri: channelUri,
			channelName: meta?.channelName ?? null,
			communityName: meta?.communityName ?? null,
			managingApp: meta?.managingApp ?? null,
		});

		const giveUp = (): void => {
			if (sessionId !== session) return;
			teardown();
			resetState();
		};

		if (!supportsWebRtc()) {
			toast.error("Voice isn't available on this system", {
				description:
					"This system's web engine was built without WebRTC, so calls can't connect.",
			});
			giveUp();
			return;
		}

		if (await voiceDisabledOn(appViewHostFor(meta?.managingApp, "http"))) {
			log.warn("this appview has voice turned off");
			toast.error("Voice isn't available here.", {
				description: "This community's server has no voice server running.",
			});
			giveUp();
			return;
		}

		if (sessionId !== session) return;

		dbg("connect()", {
			channelUri,
			managingApp: meta?.managingApp ?? null,
			appViewHost: appViewHostFor(meta?.managingApp, "ws"),
		});
		reconnectAttempts = 0;

		setVoiceData("overlayDismissed", false);

		playSound("join");

		await openSignaling(channelUri);
	};

	const disconnect = (): void => {
		intentionalClose = true;

		const uri = voiceData.connection.uri;
		if (voiceData.connection.state !== ConnectionState.Disconnected) {
			playSound("leave");
		}

		if (uri) applyPresence("leave", uri, user.did);

		const wait = pendingVideoTeardown;
		pendingVideoTeardown = null;
		if (wait) {
			const session = sessionId;
			void wait.then(() => {
				if (sessionId !== session) return;
				teardown();
				resetState();
			});
		} else {
			teardown();
			resetState();
		}
	};

	const setMic = (enabled: boolean, remember = true): void => {
		if (micProducer) {
			if (enabled) micProducer.resume();
			else micProducer.pause();
		}

		setVoiceData("states", "micEnabled", enabled);
		if (remember) userPreferences.setVoiceSelfState({ selfMuted: !enabled });

		if (!enabled && localSpeaking) {
			localSpeaking = false;
			recomputeSpeakers();
		}

		sendSelfState();
	};

	const setDeafen = (deafened: boolean, remember = true): void => {
		for (const consumer of consumers.values()) {
			if (consumer.kind !== "audio") continue;
			if (deafened) consumer.pause();
			else consumer.resume();
		}

		setVoiceData("states", "deafened", deafened);
		if (remember) userPreferences.setVoiceSelfState({ selfDeafened: deafened });

		sendSelfState();
	};

	const toggleMic = (): void => {
		if (!micProducer) return;

		if (voiceData.states.serverMuted) {
			toast("You're muted by a moderator", {
				description: "Your mic stays muted until they lift it.",
			});
			return;
		}

		const next = !voiceData.states.micEnabled;
		setMic(next);
		playSound(next ? "unmute" : "mute");
		if (next && voiceData.states.deafened) setDeafen(false);
		sendVoiceState();
	};

	const selfVideoKey = (which: VideoSource): string => `self:${which}`;

	const applyDegradationPreference = (
		producer: types.Producer,
		quality: ScreenShareQuality,
	): void => {
		const sender = producer.rtpSender;
		if (!sender) return;

		try {
			const params = sender.getParameters() as RTCRtpSendParameters & {
				degradationPreference?: string;
			};
			params.degradationPreference = screenDegradationPreference(quality);
			void sender.setParameters(params).catch(() => {});
		} catch {
			return;
		}
	};

	const produceVideo = async (
		which: VideoSource,
		track: MediaStreamTrack,
		quality?: ScreenShareQuality,
	): Promise<boolean> => {
		const transport = sendTransport;
		if (!transport) return false;
		const epoch = mediaEpoch;
		const preview = new MediaStream([track]);

		setVoiceData("videoStreams", selfVideoKey(which), {
			did: user.did,
			source: which,
			stream: preview,
		});

		if (quality) track.contentHint = screenContentHint(quality);

		let producer: types.Producer;
		try {
			producer = await transport.produce({
				track,
				appData: { source: which },
				...(quality
					? {
							encodings: screenEncodings(quality),
							codecOptions: screenCodecOptions(quality),
						}
					: {}),
			});
		} catch (err) {
			if (voiceData.videoStreams[selfVideoKey(which)]?.stream === preview) {
				setVoiceData("videoStreams", selfVideoKey(which), undefined!);
			}
			setVoiceData(
				"states",
				which === "cam" ? "camEnabled" : "screenEnabled",
				false,
			);
			throw err;
		}

		if (mediaEpoch !== epoch) {
			dbg("produceVideo(): session ended before the producer was live", {
				which,
			});
			producer.close();
			track.stop();

			if (voiceData.videoStreams[selfVideoKey(which)]?.stream === preview) {
				setVoiceData("videoStreams", selfVideoKey(which), undefined!);
			}

			return false;
		}

		if (quality) applyDegradationPreference(producer, quality);

		if (which === "cam") camProducer = producer;
		else screenProducer = producer;

		const onEnded = (): void => stopVideo(which);
		videoTrackListeners.set(which, onEnded);
		track.addEventListener("ended", onEnded);
		return true;
	};

	const produceScreenAudio = async (
		track: MediaStreamTrack,
	): Promise<boolean> => {
		const transport = sendTransport;
		if (!transport) return false;
		const epoch = mediaEpoch;

		const producer = await transport.produce({
			track,
			appData: { source: "screen" satisfies MediaSource },
		});

		if (mediaEpoch !== epoch) {
			producer.close();
			track.stop();
			return false;
		}

		screenAudioProducer = producer;
		screenAudioListener = (): void => stopScreenAudio();
		track.addEventListener("ended", screenAudioListener);
		return true;
	};

	const stopScreenAudio = (): void => {
		if (!screenAudioProducer) return;

		if (screenAudioListener) {
			screenAudioProducer.track?.removeEventListener(
				"ended",
				screenAudioListener,
			);
			screenAudioListener = null;
		}

		void sendAndWait(closeProducerFrame(screenAudioProducer.id)).catch(
			(err) => {
				dbg("✗ closeProducer failed", err);
			},
		);
		screenAudioProducer.track?.stop();
		screenAudioProducer.close();
		screenAudioProducer = null;
	};

	const applyScreenQuality = (quality: ScreenShareQuality): void => {
		const track = screenProducer?.track;
		if (!screenProducer || !track) return;

		track.contentHint = screenContentHint(quality);
		void track
			.applyConstraints(screenVideoConstraints(quality))
			.catch(() => {});

		const sender = screenProducer.rtpSender;
		if (sender) {
			try {
				const params = sender.getParameters() as RTCRtpSendParameters & {
					degradationPreference?: string;
				};
				const maxBitrate = screenEncodings(quality)[0].maxBitrate;
				params.degradationPreference = screenDegradationPreference(quality);
				for (const encoding of params.encodings ?? []) {
					encoding.maxBitrate = maxBitrate;
				}
				void sender.setParameters(params).catch(() => {});
			} catch {
				return;
			}
		}
	};

	const stopVideo = (which: VideoSource): void => {
		setVoiceData("videoStreams", selfVideoKey(which), undefined!);
		const producer = which === "cam" ? camProducer : screenProducer;

		if (which === "screen") {
			stopScreenAudio();
			screenTrackCleanup?.();
			screenTrackCleanup = null;
		}

		if (!producer) return;

		const onEnded = videoTrackListeners.get(which);
		if (onEnded) {
			producer.track?.removeEventListener("ended", onEnded);
			videoTrackListeners.delete(which);
		}

		void sendAndWait(closeProducerFrame(producer.id)).catch((err) => {
			dbg("✗ closeProducer failed", err);
		});

		producer.track?.stop();
		producer.close();
		// producer.close() kicks off mediasoup-client's async stopSending()
		// renegotiation on the RTCPeerConnection. If the user hits "Leave"
		// right after toggling off cam/screen, disconnect() waits this out
		// before closing the transport, so it can't abort that renegotiation
		// mid-flight (a real cause of native WebRTC crashes on close).
		const settling = new Promise<void>((resolve) => setTimeout(resolve, 300));
		pendingVideoTeardown = settling;
		void settling.then(() => {
			if (pendingVideoTeardown === settling) pendingVideoTeardown = null;
		});

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

		const epoch = mediaEpoch;

		try {
			const stream = await navigator.mediaDevices.getUserMedia({ video: true });

			if (mediaEpoch !== epoch) {
				dbg("toggleCamera(): session ended while waiting for the camera");
				for (const track of stream.getTracks()) track.stop();
				return;
			}

			const track = stream.getVideoTracks()[0];
			setVoiceData("states", "camEnabled", true);

			if (!(await produceVideo("cam", track))) {
				for (const t of stream.getTracks()) t.stop();
				setVoiceData("states", "camEnabled", false);
				return;
			}

			playSound("camOn");
		} catch (err) {
			log.error("camera failed", { code: classifyThrown(err).code });
		}
	};

	const shareScreenTrack = async (
		track: MediaStreamTrack,
		audioTrack: MediaStreamTrack | null,
		quality: ScreenShareQuality,
		onStopped: () => void,
	): Promise<void> => {
		if (screenProducer) {
			onStopped();
			return;
		}

		try {
			if (!(await produceVideo("screen", track, quality))) {
				track.stop();
				audioTrack?.stop();
				onStopped();
				return;
			}

			screenTrackCleanup = onStopped;
			setVoiceData("states", "screenEnabled", true);
			playSound("screenShared");
		} catch (err) {
			track.stop();
			audioTrack?.stop();
			onStopped();
			showError(err, {
				fallbackTitle: "Couldn't start sharing your screen.",
				description: "The capture started but couldn't be sent to the channel.",
			});
			return;
		}

		if (!audioTrack) return;

		try {
			if (!(await produceScreenAudio(audioTrack))) audioTrack.stop();
		} catch (err) {
			audioTrack.stop();
			showError(err, {
				fallbackTitle: "Sharing without sound",
				description: "Your screen is still shared, but its audio couldn't be.",
			});
		}
	};

	const toggleScreen = async (options?: ScreenShareOptions): Promise<void> => {
		if (screenProducer) {
			stopVideo("screen");
			playSound("screenUnshared");
			return;
		}

		const settings = options ?? userPreferences.preferences().voice.screen;
		const epoch = mediaEpoch;
		let stream: MediaStream;

		try {
			stream = await navigator.mediaDevices.getDisplayMedia(
				displayMediaRequest(settings) as DisplayMediaStreamOptions,
			);
		} catch (err) {
			if (err instanceof DOMException && err.name === "NotAllowedError") return;
			showError(err, {
				fallbackTitle: "Couldn't start sharing your screen.",
				description: "Something went wrong while starting the capture.",
			});
			return;
		}

		if (mediaEpoch !== epoch) {
			dbg("toggleScreen(): session ended while picking a capture source");
			for (const track of stream.getTracks()) track.stop();
			return;
		}

		const videoTrack = stream.getVideoTracks()[0];
		if (!videoTrack) {
			for (const track of stream.getTracks()) track.stop();
			return;
		}

		try {
			if (!(await produceVideo("screen", videoTrack, settings))) {
				for (const track of stream.getTracks()) track.stop();
				return;
			}

			setVoiceData("states", "screenEnabled", true);
			playSound("screenShared");
		} catch (err) {
			for (const track of stream.getTracks()) track.stop();
			showError(err, {
				fallbackTitle: "Couldn't start sharing your screen.",
				description: "The capture started but couldn't be sent to the channel.",
			});
			return;
		}

		const audioTrack = stream.getAudioTracks()[0];
		if (!audioTrack) {
			if (settings.shareAudio) {
				toast.info("Sharing without sound", {
					description:
						"This browser or capture source didn't provide any audio.",
				});
			}
			return;
		}

		try {
			if (!(await produceScreenAudio(audioTrack))) audioTrack.stop();
		} catch (err) {
			audioTrack.stop();
			showError(err, {
				fallbackTitle: "Sharing without sound",
				description: "Your screen is still shared, but its audio couldn't be.",
			});
		}
	};

	const toggleDeafen = (): void => {
		const next = !voiceData.states.deafened;

		if (voiceData.states.serverDeafened) {
			toast("You're deafened by a moderator", {
				description: "You stay deafened until they lift it.",
			});
			return;
		}

		if (next) {
			setDeafen(true);
			setMic(false);
		} else {
			setDeafen(false);
		}

		playSound(next ? "deafen" : "undeafen");
		sendVoiceState();
	};

	const toPresenceMember = (source: PresenceSource): PresenceMember => {
		const voice = source.actor.presence?.voice;
		return {
			did: source.did,
			vc: voice?.channel,
			vcMuted: voice?.muted,
			vcDeafened: voice?.deafened,
			vcServerMuted: voice?.serverMuted,
			vcServerDeafened: voice?.serverDeafened,
		};
	};

	const addPresence = (source: PresenceSource): void => {
		const member = toPresenceMember(source);
		if (!member.vc) return;

		applyPresence("join", member.vc, member.did);
		setVoiceData("memberStates", member.did, (prev) => ({
			...prev,
			muted: member.vcMuted ?? false,
			deafened: member.vcDeafened ?? false,
			...(member.vcServerMuted !== undefined && {
				serverMuted: member.vcServerMuted,
			}),
			...(member.vcServerDeafened !== undefined && {
				serverDeafened: member.vcServerDeafened,
			}),
		}));
	};

	const presenceMark = (): number => presenceClock;

	const pinnedSince = (since: number | undefined): Set<string> => {
		const pinned = new Set<string>();
		if (since === undefined) return pinned;
		for (const [did, at] of joinOrder) {
			if (at > since) pinned.add(did);
		}
		return pinned;
	};

	const syncPresence = (
		communityAuthority: string,
		sources: Array<PresenceSource>,
		since?: number,
	): void => {
		const plan = computePresenceSync({
			communityAuthority,
			members: sources.map(toPresenceMember),
			presence: voiceData.presence,
			ownChannel:
				voiceData.connection.state !== ConnectionState.Disconnected
					? voiceData.connection.uri
					: null,
			ownDid: user.did,
			pinned: pinnedSince(since),
		});

		for (const { channel, added, left, moved } of plan.channels) {
			for (const did of moved) removeFromChannel(channel, did);
			for (const did of left) applyPresence("leave", channel, did);
			for (const did of added) applyPresence("join", channel, did);
		}

		for (const { did, state } of plan.states) {
			setVoiceData("memberStates", did, (prev) => ({
				...prev,
				muted: state.muted,
				deafened: state.deafened,
				...(state.serverMuted !== undefined && {
					serverMuted: state.serverMuted,
				}),
				...(state.serverDeafened !== undefined && {
					serverDeafened: state.serverDeafened,
				}),
			}));
		}
	};

	createEffect(() => {
		userPreferences.preferences();
		reapplyAudioSettings();
	});

	const mediaDevices =
		typeof navigator === "undefined" ? undefined : navigator.mediaDevices;

	if (mediaDevices) {
		const onDeviceChange = (): void => reapplyAudioSettings({ force: true });

		mediaDevices.addEventListener("devicechange", onDeviceChange);
		onCleanup(() =>
			mediaDevices.removeEventListener("devicechange", onDeviceChange),
		);
	}

	createEffect(
		on(
			() => userPreferences.preferences().voice.input.noiseSuppressionMode,
			(mode) => {
				void suppressor?.setMode(mode);
			},
			{ defer: true },
		),
	);

	createEffect(
		on(
			() => userPreferences.preferences().voice.input.noiseSuppressionLevel,
			(level) => {
				suppressor?.setSuppressionLevel(level);
			},
			{ defer: true },
		),
	);

	onCleanup(watchPortErrors());

	const unsubscribePresence = socket.onEvent((event) => {
		if (!frameIs(event, "voiceEvent")) return;

		if (event.event === "join" || event.event === "leave") {
			applyPresence(event.event, event.channel, event.did);
		}

		if (event.event === "join" || event.event === "update") {
			setVoiceData("memberStates", event.did, (prev) => ({
				...prev,
				muted: event.voice?.muted ?? false,
				deafened: event.voice?.deafened ?? false,
				...(event.voice?.serverMuted !== undefined && {
					serverMuted: event.voice.serverMuted,
				}),
				...(event.voice?.serverDeafened !== undefined && {
					serverDeafened: event.voice.serverDeafened,
				}),
			}));
		}

		if (
			(event.event === "join" || event.event === "leave") &&
			event.did !== user.did &&
			voiceData.connection.state === ConnectionState.Connected &&
			voiceData.connection.uri === event.channel
		) {
			playSound(event.event === "leave" ? "leave" : "join");
		}
	});

	const setFocusedKey = (key: string | null): void => {
		setVoiceData("focusedKey", key);
	};

	const setOverlayDismissed = (dismissed: boolean): void => {
		setVoiceData("overlayDismissed", dismissed);
	};

	const focusedKeyValid = (): boolean => {
		const key = voiceData.focusedKey;
		if (!key) return true;
		if (key.startsWith("s:")) return !!voiceData.videoStreams[key.slice(2)];
		if (key.startsWith("p:")) {
			const uri = voiceData.connection.uri;
			return !!uri && (voiceData.presence[uri] ?? []).includes(key.slice(2));
		}
		return false;
	};

	createEffect(() => {
		if (!focusedKeyValid()) setVoiceData("focusedKey", null);
	});

	const actions: VoiceChatActions = {
		connect,
		disconnect,
		toggleMic,
		toggleCamera: () => void toggleCamera(),
		toggleScreen: (options?: ScreenShareOptions) => void toggleScreen(options),
		shareScreenTrack: (
			track: MediaStreamTrack,
			audioTrack: MediaStreamTrack | null,
			quality: ScreenShareQuality,
			onStopped: () => void,
		) => void shareScreenTrack(track, audioTrack, quality, onStopped),
		applyScreenQuality,
		toggleDeafen,
		setFocusedKey,
		setOverlayDismissed,
		syncPresence,
		addPresence,
		presenceMark,
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
