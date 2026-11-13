import {
	AUTH_SUBPROTOCOL,
	type ClientVoiceFrame,
	ColibriError,
	classifyThrown,
	closeProducerFrame,
	connectTransportFrame,
	consumeFrame,
	createLogger,
	createTransportFrame,
	decodeMediaSource,
	decodeVoiceFrame,
	encodeVoiceFrame,
	getRtpCapabilitiesFrame,
	isAppViewErrorCode,
	isColibriError,
	isServerVoiceFrame,
	isVerboseLogging,
	joinFrame,
	moveNowFrame,
	produceFrame,
	resumeConsumerFrame,
	rttReportFrame,
	type ServerVoiceFrame,
	setConsumerPreferenceFrame,
	setSelfStateFrame,
	setSpeakingFrame,
	type TransportOptionsFrame,
	VOICE_SIGNAL_LXM,
	VOICE_SIGNAL_PATH,
	type VoiceMediaSource,
	voiceHeartbeatFrame,
} from "@colibri-social/lib";
import { Device, type types } from "mediasoup-client";
import {
	createEffect,
	createMemo,
	createRoot,
	createSignal,
	on,
} from "solid-js";
import {
	CAMERA_CONTENT_HINT,
	cameraEncodings,
	openCamera,
	openMicrophone,
} from "../media-devices";
import type { ServiceAuthAgent } from "../remote/live/connection";
import {
	type ScreenShareQuality,
	screenCodecOptions,
	screenContentHint,
	screenDegradationPreference,
	screenEncodings,
	screenEncodingTarget,
	screenVideoConstraints,
} from "../screen-share";
import { DEFAULT_VOICE_SETTINGS, type VoiceSettings } from "../voice-settings";
import { applyAudioSink, type SinkableMediaElement } from "./audio-sink";
import { pickVoiceHandler, supportsWebRtc } from "./device";
import {
	type AudioBoost,
	type BoostAudioContext,
	browserAudioContext,
	createAudioBoost,
} from "./gain";
import {
	type ConsumerPreference,
	PREFERENCE_DEBOUNCE_MS,
	preferredLayers,
	samePreference,
	spatialLayersOf,
	type TileView,
	tileKeyFor,
} from "./layers";
import {
	captureConstraints,
	createNoiseSuppressor,
	type NoiseSuppressor,
	type NoiseSuppressorOptions,
} from "./noise-suppressor";
import { createProducerRegistry } from "./producer-registry";
import {
	INITIAL_SENDER_LOAD,
	type SenderLoad,
	stepSenderLoad,
	tunedEncodings,
	tuningFor,
} from "./sender-load";
import {
	DISCONNECTED,
	qualityFor,
	type ScreenCapture,
	type VoiceConnection,
	type VoiceConnectionMonitor,
	type VoiceEndReason,
	type VoiceModeration,
	type VoiceMoveNotice,
	type VoiceNotice,
	type VoiceSession,
	type VoiceVideo,
} from "./types";
import {
	browserEncodingProbe,
	pickScreenCodec,
	SCREEN_SCALABILITY_MODE,
	SCREEN_SVC_SCALABILITY_MODE,
	type ScreenCodecChoice,
	sendableVideoCodecs,
	supportsSimulcast,
	type VideoEncodingProbe,
} from "./video-codec";
import {
	type ByteMark,
	publishVideoStats,
	readVideoStats,
	type StatsLike,
	VIDEO_STATS_INTERVAL_MS,
	type VideoStatsSample,
	type VideoStatsSource,
	withTransportStats,
} from "./video-stats";
import {
	type ParticipantVolumes,
	playbackGain,
	playbackVolumeOf,
	type VolumeChannel,
} from "./volumes";

const log = createLogger("voice");

const MAX_RECONNECT_ATTEMPTS = 6;
const STATS_INTERVAL_MS = 3_000;
const STATS_FAST_MS = 400;
const HEARTBEAT_INTERVAL_MS = 20_000;
const ICE_WATCHDOG_MS = 8_000;
const REPLY_TIMEOUT_MS = 15_000;
const VIDEO_SETTLE_MS = 300;
const TOKEN_TTL_S = 60;

const MIC_CODEC_OPTIONS = {
	opusStereo: false,
	opusFec: true,
	opusDtx: true,
} as const;

const OPEN = 1;

const DEFS = "social.colibri.beta.voice.defs#";

export type VoiceSocket = {
	readonly readyState: number;
	send(data: string): void;
	close(): void;
	onopen: ((event: unknown) => void) | null;
	onmessage: ((event: { data: unknown }) => void) | null;
	onclose: ((event: { code: number; reason: string }) => void) | null;
	onerror: ((event: unknown) => void) | null;
};

export type AudioOutput = SinkableMediaElement & {
	autoplay: boolean;
	srcObject: MediaProvider | null;
	volume: number;
	muted: boolean;
	play(): Promise<void>;
	pause(): void;
};

type VoiceMedia = {
	getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream>;
	onDeviceChange?(listener: () => void): () => void;
};

export type VoiceEngineOptions = {
	agent: ServiceAuthAgent;
	appViewHost: string;
	serviceRef: string;
	viewerDid: string;
	settings?: () => VoiceSettings;
	volumes?: () => ParticipantVolumes;
	createSocket?: (url: string, protocols: string[]) => VoiceSocket;
	createDevice?: (handlerName?: types.BuiltinHandlerName) => types.Device;
	createAudio?: () => AudioOutput;
	createAudioContext?: () => BoostAudioContext | undefined;
	createSuppressor?: (
		track: MediaStreamTrack,
		options: NoiseSuppressorOptions,
	) => Promise<NoiseSuppressor>;
	media?: VoiceMedia;
	webRtc?: () => boolean;
	handlerName?: () => types.BuiltinHandlerName | undefined;
	probeVideoEncoding?: VideoEncodingProbe;
	pickHost?: () => string | null;
	probe?: (url: string) => Promise<number | null>;
	forceRelay?: () => boolean;
};

export type VoiceMove = VoiceMoveNotice;

export type VoiceEngine = {
	camera: () => boolean;
	onCameraOff: (listener: () => void) => () => void;
	onMove: (listener: (move: VoiceMove | null) => void) => () => void;
	host: () => string;
} & Required<
	Pick<
		VoiceConnectionMonitor,
		| "connection"
		| "start"
		| "stop"
		| "setMuted"
		| "setDeafened"
		| "setCamera"
		| "shareScreen"
		| "stopScreen"
		| "applyScreenQuality"
		| "reportTileView"
		| "screenSharing"
		| "micAvailable"
		| "onMicAvailable"
		| "onScreenShare"
		| "speakers"
		| "videos"
		| "moderation"
		| "onEnded"
		| "onMoved"
		| "onNotice"
		| "dispose"
	>
>;

type ProducerOwner = {
	did: string;
	kind: types.MediaKind;
	source: VoiceMediaSource;
};

type TunedSender = {
	source: VideoStatsSource;
	base: RTCRtpEncodingParameters[];
	scalabilityMode?: string;
	degradation?: RTCDegradationPreference;
	load: SenderLoad;
};

type AudioEntry = {
	el: AudioOutput;
	did: string;
	channel: VolumeChannel;
	boost: AudioBoost;
};

type Waiter = {
	resolve: (frame: ServerVoiceFrame) => void;
	reject: (reason: unknown) => void;
};

type FrameOf<T extends string> = Extract<
	ServerVoiceFrame,
	{ $type: `${typeof DEFS}${T}` }
>;

export const voiceSocketUrl = (host: string): string => {
	const url = new URL(/^[a-z]+:\/\//i.test(host) ? host : `https://${host}`);
	url.protocol =
		url.protocol === "http:" || url.protocol === "ws:" ? "ws:" : "wss:";
	url.pathname = VOICE_SIGNAL_PATH;
	url.search = "";
	url.hash = "";
	return url.toString();
};

export const endReasonOf = (reason: string | undefined): VoiceEndReason => {
	if (
		reason === "moderator" ||
		reason === "superseded" ||
		reason === "channelGone" ||
		reason === "forbidden"
	) {
		return reason;
	}
	return "closed";
};

export const reconnectDelay = (attempt: number) =>
	Math.min(1_000 * 2 ** (attempt - 1), 10_000);

const syncGroupFor = (owner: {
	did: string;
	source: VoiceMediaSource;
}): string => `${owner.did}|${owner.source === "screen" ? "screen" : "live"}`;

const browserMedia = (): VoiceMedia | undefined => {
	if (typeof navigator === "undefined" || !navigator.mediaDevices) {
		return undefined;
	}
	const devices = navigator.mediaDevices;
	return {
		getUserMedia: (constraints) => devices.getUserMedia(constraints),
		onDeviceChange: (listener) => {
			devices.addEventListener("devicechange", listener);
			return () => devices.removeEventListener("devicechange", listener);
		},
	};
};

const documentHidden = () => {
	return typeof document !== "undefined" && document.hidden;
};

const pixelRatio = () => {
	return typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
};

const isMissingDevice = (error: unknown): boolean =>
	error instanceof DOMException && error.name === "NotFoundError";

const trackSettings = (
	track: MediaStreamTrack | null | undefined,
): MediaTrackSettings => {
	try {
		return track?.getSettings() ?? {};
	} catch {
		return {};
	}
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
			) {
				rtt = report.currentRoundTripTime;
			}
		});
		return rtt;
	} catch {
		return undefined;
	}
};

const PROBE_TIMEOUT_MS = 3_000;

const MAX_ELSEWHERE_HOPS = 2;

const probeRoundTrip = async (url: string): Promise<number | null> => {
	let best: number | null = null;

	for (let round = 0; round < 2; round += 1) {
		const started = performance.now();

		try {
			const response = await fetch(url, {
				cache: "no-store",
				signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
			});

			if (!response.ok) return null;

			const elapsed = Math.round(performance.now() - started);

			best = best === null ? elapsed : Math.min(best, elapsed);
		} catch {
			return null;
		}
	}

	return best;
};

const toTransportOptions = (
	frame: TransportOptionsFrame,
	relayOnly = false,
): types.TransportOptions => {
	const iceServers = frame.iceServers ?? [];
	return {
		...(relayOnly ? { iceTransportPolicy: "relay" as const } : {}),
		id: frame.id,
		iceParameters: frame.iceParameters as unknown as types.IceParameters,
		iceCandidates: frame.iceCandidates as unknown as types.IceCandidate[],
		dtlsParameters: frame.dtlsParameters as unknown as types.DtlsParameters,
		...(iceServers.length > 0
			? { iceServers: iceServers as unknown as RTCIceServer[] }
			: {}),
	};
};

export const createVoiceEngine = (options: VoiceEngineOptions): VoiceEngine =>
	createRoot((disposeRoot) => {
		const settings = options.settings ?? (() => DEFAULT_VOICE_SETTINGS);
		const volumes = options.volumes ?? (() => ({}));
		const createSocket =
			options.createSocket ??
			((url: string, protocols: string[]) =>
				new WebSocket(url, protocols) as unknown as VoiceSocket);
		const createDevice =
			options.createDevice ??
			((handlerName?: types.BuiltinHandlerName) => new Device({ handlerName }));
		const createAudio =
			options.createAudio ?? (() => new Audio() as unknown as AudioOutput);
		const createSuppressor = options.createSuppressor ?? createNoiseSuppressor;
		const createAudioContext =
			options.createAudioContext ?? browserAudioContext;
		let boostContext: BoostAudioContext | null | undefined;
		const sharedBoostContext = () => {
			if (boostContext === undefined)
				boostContext = createAudioContext() ?? null;
			return boostContext ?? undefined;
		};
		const media = options.media ?? browserMedia();
		const webRtc = options.webRtc ?? supportsWebRtc;
		const handlerName = options.handlerName ?? (() => pickVoiceHandler());
		const probeVideoEncoding =
			options.probeVideoEncoding ?? browserEncodingProbe;
		const viewer = options.viewerDid;

		const [connection, setConnection] =
			createSignal<VoiceConnection>(DISCONNECTED);
		const [speakers, setSpeakers] = createSignal<ReadonlySet<string>>(
			new Set(),
		);
		const [videoMap, setVideoMap] = createSignal<Record<string, VoiceVideo>>(
			{},
		);
		const [moderation, setModeration] = createSignal<
			Record<string, VoiceModeration>
		>({});
		const [screenSharing, setScreenSharing] = createSignal(false);
		const [camera, setCameraOn] = createSignal(false);
		const cameraOffListeners = new Set<() => void>();
		const [micAvailable, setMicAvailableSignal] = createSignal(true);
		const micListeners = new Set<(available: boolean) => void>();
		const setMicAvailable = (available: boolean) => {
			if (micAvailable() === available) return;
			setMicAvailableSignal(available);
			for (const listener of [...micListeners]) listener(available);
		};

		const endedListeners = new Set<(reason: VoiceEndReason) => void>();
		const movedListeners = new Set<(channel: string) => void>();
		const noticeListeners = new Set<(notice: VoiceNotice) => void>();
		const screenShareListeners = new Set<(sharing: boolean) => void>();

		let session: VoiceSession | null = null;
		let ws: VoiceSocket | null = null;
		let hostOverride: string | null = null;
		let elsewhereHops = 0;
		let switching = false;
		const moveListeners = new Set<(move: VoiceMove | null) => void>();
		const probe = options.probe ?? probeRoundTrip;
		const relayOnly = () => options.forceRelay?.() ?? false;
		const signalingHost = () =>
			hostOverride ?? options.pickHost?.() ?? options.appViewHost;
		const emitMove = (move: VoiceMove | null) => {
			for (const listener of [...moveListeners]) listener(move);
		};
		let device: types.Device | null = null;
		let sendTransport: types.Transport | null = null;
		let recvTransport: types.Transport | null = null;
		let sendConnected = false;
		let transportRttAt = 0;
		let recvConnected = false;
		let sendWatchdog: ReturnType<typeof setTimeout> | null = null;
		let recvWatchdog: ReturnType<typeof setTimeout> | null = null;
		let micProducer: types.Producer | null = null;
		let camProducer: types.Producer | null = null;
		let camEndedListener: (() => void) | null = null;
		let cameraGeneration = 0;
		let pendingCameraStart: Promise<boolean> | null = null;
		let cameraIntent = 0;
		let screenProducer: types.Producer | null = null;
		let screenAudioProducer: types.Producer | null = null;
		let screenCapture: ScreenCapture | null = null;
		let screenQuality: ScreenShareQuality | null = null;
		let screenVp8Only = false;
		let screenMimeType: string | null = null;
		let screenEndedListener: (() => void) | null = null;
		let micStream: MediaStream | null = null;
		let suppressor: NoiseSuppressor | null = null;
		let localSpeaking = false;
		let serverSpeakers: string[] = [];
		let ready = false;
		let mediaEpoch = 0;
		let sessionId = 0;
		let intentionalClose = false;
		let reconnectAttempts = 0;
		let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
		let statsTimer: ReturnType<typeof setTimeout> | null = null;
		let statsGen = 0;
		let videoStatsTimer: ReturnType<typeof setTimeout> | null = null;
		let videoStatsGen = 0;
		const videoByteMarks = new Map<string, ByteMark>();
		let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
		let sendChain: Promise<void> = Promise.resolve();
		let pendingReplies: Waiter[] = [];
		let pendingVideoTeardown: Promise<void> | null = null;

		const consumers = new Map<string, types.Consumer>();
		const audioEls = new Map<string, AudioEntry>();
		const producers = createProducerRegistry<ProducerOwner>();
		const consumersByProducer = new Map<string, string | null>();
		const tunedSenders = new Map<string, TunedSender>();
		const tileViews = new Map<string, TileView>();
		const sentPreferences = new Map<string, ConsumerPreference>();
		let preferenceTimer: ReturnType<typeof setTimeout> | null = null;
		let preferencesSupported = true;

		const patchConnection = (patch: Partial<VoiceConnection>) =>
			setConnection((current) => ({ ...current, ...patch }));

		const emitEnded = (reason: VoiceEndReason) => {
			for (const listener of [...endedListeners]) listener(reason);
		};

		const notice = (value: VoiceNotice) => {
			for (const listener of [...noticeListeners]) listener(value);
		};

		const emitScreenShare = (sharing: boolean) => {
			for (const listener of [...screenShareListeners]) listener(sharing);
		};

		const recomputeSpeakers = () => {
			const others = serverSpeakers.filter((did) => did !== viewer);
			setSpeakers(new Set(localSpeaking ? [...others, viewer] : others));
		};

		const setVideo = (key: string, video: VoiceVideo | undefined) =>
			setVideoMap((current) => {
				const next = { ...current };
				if (video) next[key] = video;
				else delete next[key];
				return next;
			});

		const send = (frame: ClientVoiceFrame) => {
			if (ws?.readyState === OPEN) {
				log.debug(`send ${frame.$type}`);
				ws.send(encodeVoiceFrame(frame));
				return;
			}
			log.debug(`dropped ${frame.$type}, the socket is not open`);
		};

		const sendAndWait = (
			frame: ClientVoiceFrame,
		): Promise<ServerVoiceFrame> => {
			const run = sendChain.then(
				() =>
					new Promise<ServerVoiceFrame>((resolve, reject) => {
						const timer = setTimeout(() => {
							const at = pendingReplies.indexOf(waiter);
							if (at !== -1) pendingReplies.splice(at, 1);
							reject(new ColibriError({ code: "VoiceConnectionLost" }));
							if (session && !intentionalClose) {
								teardownMedia();
								scheduleReconnect();
							}
						}, REPLY_TIMEOUT_MS);
						const waiter: Waiter = {
							resolve: (value) => {
								clearTimeout(timer);
								resolve(value);
							},
							reject: (reason) => {
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

		const expectFrame = <T extends string>(
			frame: ServerVoiceFrame,
			type: T,
		): FrameOf<T> => {
			if (frame.$type !== `${DEFS}${type}`) {
				throw new ColibriError({
					code: "MalformedResponse",
					message: `expected ${type}, got ${frame.$type}`,
				});
			}
			return frame as FrameOf<T>;
		};

		const rejectAllPending = () => {
			const pending = pendingReplies;
			pendingReplies = [];
			sendChain = Promise.resolve();
			for (const waiter of pending) {
				waiter.reject(new ColibriError({ code: "VoiceConnectionLost" }));
			}
		};

		const noteSignalingLatency = (sentAt: number) => {
			if (!ready || connection().state !== "connected") return;
			if (Date.now() - transportRttAt < STATS_INTERVAL_MS * 2) return;
			const latency = Math.max(1, Math.round(performance.now() - sentAt));
			patchConnection({ quality: qualityFor(latency), latency });
		};

		const setLocalSpeaking = (speaking: boolean) => {
			if (speaking === localSpeaking) return;
			localSpeaking = speaking;
			recomputeSpeakers();
			if (ready) send(setSpeakingFrame(speaking));
		};

		const sendSelfState = () => {
			if (!ready || !session) return;
			const sentAt = performance.now();
			void sendAndWait(
				setSelfStateFrame({
					muted: session.muted || !micAvailable(),
					deafened: session.deafened,
				}),
			).then(
				() => noteSignalingLatency(sentAt),
				(error: unknown) => {
					log.debug("setSelfState failed", {
						code: classifyThrown(error).code,
					});
				},
			);
		};

		const applyAudioSettings = (entry: AudioEntry, force = false) => {
			const current = settings();
			entry.boost.apply(
				playbackGain(
					current.outputVolume,
					playbackVolumeOf(volumes(), entry.did, entry.channel),
				),
			);
			void applyAudioSink(entry.el, current.speaker, { force }).catch(
				(error: unknown) => {
					log.warn("could not route voice audio to the selected speaker", {
						code: classifyThrown(error).code,
					});
				},
			);
		};

		const reapplyAudioSettings = (force = false) => {
			for (const entry of audioEls.values()) applyAudioSettings(entry, force);
		};

		const armIceWatchdog = (
			label: string,
			transport: types.Transport,
			isConnected: () => boolean,
		) =>
			setTimeout(() => {
				if (isConnected() || transport.closed) return;
				log.warn(`${label} not connected after ${ICE_WATCHDOG_MS}ms`, {
					connectionState: transport.connectionState,
				});
			}, ICE_WATCHDOG_MS);

		const pollQuality = async (): Promise<boolean> => {
			const rtts = (
				await Promise.all([readRtt(sendTransport), readRtt(recvTransport)])
			).filter((value): value is number => typeof value === "number");
			if (rtts.length === 0) return false;
			transportRttAt = Date.now();
			const latency = Math.round(Math.min(...rtts) * 1_000);
			patchConnection({ quality: qualityFor(latency), latency });
			return true;
		};

		const readVideoSample = async (
			read: () => Promise<StatsLike>,
			base: {
				id: string;
				direction: "send" | "recv";
				source: VideoStatsSource;
				did?: string;
				trackFps?: number;
			},
		): Promise<VideoStatsSample | undefined> => {
			try {
				const report = await read();
				const { sample, mark } = readVideoStats(
					report,
					base,
					videoByteMarks.get(base.id),
				);
				if (mark) videoByteMarks.set(base.id, mark);
				return sample;
			} catch (error) {
				log.debug("video stats unavailable", {
					code: classifyThrown(error).code,
				});
				return undefined;
			}
		};

		const sampleVideo = async (): Promise<VideoStatsSample[]> => {
			const jobs: Promise<VideoStatsSample | undefined>[] = [];
			const transport = sendTransport;
			const own: [types.Producer | null, VideoStatsSource][] = [
				[camProducer, "cam"],
				[screenProducer, "screen"],
			];
			for (const [producer, source] of own) {
				if (!producer || producer.closed) continue;
				jobs.push(
					readVideoSample(
						async () =>
							withTransportStats(
								await producer.getStats(),
								transport ? () => transport.getStats() : undefined,
							),
						{
							id: producer.id,
							direction: "send",
							source,
							did: viewer,
							trackFps: trackSettings(producer.track).frameRate,
						},
					),
				);
			}
			for (const consumer of consumers.values()) {
				if (consumer.kind !== "video" || consumer.closed) continue;
				const owner = producers.owner(consumer.producerId);
				jobs.push(
					readVideoSample(() => consumer.getStats(), {
						id: consumer.id,
						direction: "recv",
						source: owner?.source === "screen" ? "screen" : "cam",
						did: owner?.did,
					}),
				);
			}
			const samples = (await Promise.all(jobs)).filter(
				(sample): sample is VideoStatsSample => !!sample,
			);
			const live = new Set(samples.map((sample) => sample.id));
			for (const id of videoByteMarks.keys()) {
				if (!live.has(id)) videoByteMarks.delete(id);
			}
			return samples;
		};

		const applySenderTuning = (producer: types.Producer) => {
			const tuned = tunedSenders.get(producer.id);
			const sender = producer.rtpSender;
			if (!tuned || !sender) return;
			const target = tunedEncodings(
				tuned.base,
				tuningFor(tuned.load.level, tuned.base.length),
			);

			try {
				const params = sender.getParameters() as RTCRtpSendParameters & {
					degradationPreference?: RTCDegradationPreference;
				};

				if (tuned.degradation) {
					params.degradationPreference = tuned.degradation;
				}

				params.encodings = (params.encodings ?? []).map((encoding, index) => {
					const wanted = target[index] ?? target.at(-1);

					return wanted
						? {
								...encoding,
								maxBitrate: wanted.maxBitrate,
								maxFramerate: wanted.maxFramerate,
								active: wanted.active,
							}
						: encoding;
				});

				void sender.setParameters(params).catch((error: unknown) => {
					log.debug("video parameters rejected", {
						source: tuned.source,
						code: classifyThrown(error).code,
					});
				});
			} catch (error) {
				log.debug("video parameters unavailable", {
					source: tuned.source,
					code: classifyThrown(error).code,
				});
			}
		};

		const tuneSenders = (samples: readonly VideoStatsSample[]) => {
			const live = new Map<string, types.Producer>();

			for (const producer of [camProducer, screenProducer]) {
				if (producer && !producer.closed) live.set(producer.id, producer);
			}

			for (const [id, tuned] of tunedSenders) {
				const producer = live.get(id);

				if (!producer) {
					tunedSenders.delete(id);
					continue;
				}

				const sample = samples.find(
					(entry) => entry.id === id && entry.direction === "send",
				);
				const next = stepSenderLoad(tuned.load, sample, tuned.base.length);
				const moved = next.level !== tuned.load.level;

				tuned.load = next;
				if (!moved) continue;

				log.info("adjusted the video for the encoder load", {
					source: tuned.source,
					level: next.level,
				});
				applySenderTuning(producer);
			}
		};

		const trackSender = (
			producer: types.Producer,
			sender: Omit<TunedSender, "load">,
		) => {
			tunedSenders.set(producer.id, {
				...sender,
				load: { ...INITIAL_SENDER_LOAD },
			});
		};

		const produceLayered = async (
			transport: types.Transport,
			produce: Omit<types.ProducerOptions, "encodings">,
			layered: RTCRtpEncodingParameters[],
			single: RTCRtpEncodingParameters[],
		): Promise<{
			producer: types.Producer;
			encodings: RTCRtpEncodingParameters[];
		}> => {
			try {
				const producer = await transport.produce({
					...produce,
					encodings: layered,
				});

				return { producer, encodings: layered };
			} catch (error) {
				const code = classifyThrown(error).code;
				const sameLayers = JSON.stringify(layered) === JSON.stringify(single);

				if (sameLayers || code === "VoiceConnectionLost") throw error;

				log.info("layered video was rejected, sending one layer", {
					code,
				});

				const producer = await transport.produce({
					...produce,
					encodings: single,
				});

				return { producer, encodings: single };
			}
		};

		const sendPreference = (
			consumerId: string,
			preference: ConsumerPreference,
		) => {
			const epoch = mediaEpoch;

			sentPreferences.set(consumerId, preference);
			void sendAndWait(
				setConsumerPreferenceFrame({ consumerId, ...preference }),
			).catch((error: unknown) => {
				const code = classifyThrown(error).code;

				if (mediaEpoch !== epoch) return;
				if (sentPreferences.get(consumerId) === preference) {
					sentPreferences.delete(consumerId);
				}

				if (code === "InvalidFrame" || code === "InvalidRequest") {
					if (!preferencesSupported) return;
					preferencesSupported = false;
					log.info("the voice server does not take layer preferences", {
						code,
					});
					return;
				}

				log.debug("setConsumerPreference failed", { code });
			});
		};

		const flushPreferences = () => {
			if (!ready || !preferencesSupported || tileViews.size === 0) return;
			const hidden = documentHidden();
			const ratio = pixelRatio();

			for (const consumer of consumers.values()) {
				if (consumer.kind !== "video" || consumer.closed) continue;
				const owner = producers.owner(consumer.producerId);
				if (!owner) continue;
				const source = owner.source === "screen" ? "screen" : "cam";
				const view = tileViews.get(tileKeyFor({ did: owner.did, source }));
				if (!view) continue;
				const preference = preferredLayers(view, {
					source,
					spatialLayers: spatialLayersOf(
						consumer.rtpParameters?.encodings?.[0]?.scalabilityMode,
						source,
					),
					documentHidden: hidden,
					pixelRatio: ratio,
				});

				if (samePreference(sentPreferences.get(consumer.id), preference)) {
					continue;
				}

				sendPreference(consumer.id, preference);
			}
		};

		const schedulePreferences = () => {
			if (tileViews.size === 0) return;
			if (preferenceTimer) clearTimeout(preferenceTimer);

			preferenceTimer = setTimeout(() => {
				preferenceTimer = null;
				flushPreferences();
			}, PREFERENCE_DEBOUNCE_MS);
		};

		const cancelPreferences = () => {
			if (preferenceTimer) clearTimeout(preferenceTimer);
			preferenceTimer = null;
			sentPreferences.clear();
		};

		const reportTileView = (key: string, view: TileView) => {
			const previous = tileViews.get(key);

			if (
				previous?.height === view.height &&
				previous.visible === view.visible
			) {
				return;
			}

			tileViews.set(key, { height: view.height, visible: view.visible });
			schedulePreferences();
		};

		const stopVideoStats = () => {
			videoStatsGen += 1;
			if (videoStatsTimer) clearTimeout(videoStatsTimer);
			videoStatsTimer = null;
			videoByteMarks.clear();
			publishVideoStats([]);
		};

		const startVideoStats = () => {
			stopVideoStats();
			const gen = videoStatsGen;
			const loop = async () => {
				if (gen !== videoStatsGen) return;
				const samples = await sampleVideo();
				if (gen !== videoStatsGen) return;
				publishVideoStats(samples);
				tuneSenders(samples);
				if (isVerboseLogging()) {
					for (const sample of samples) log.debug("video stats", sample);
				}
				videoStatsTimer = setTimeout(
					() => void loop(),
					VIDEO_STATS_INTERVAL_MS,
				);
			};
			videoStatsTimer = setTimeout(() => void loop(), VIDEO_STATS_INTERVAL_MS);
		};

		const stopStatsMonitor = () => {
			statsGen += 1;
			if (statsTimer) clearTimeout(statsTimer);
			statsTimer = null;
			stopVideoStats();
		};

		const startStatsMonitor = () => {
			stopStatsMonitor();
			startVideoStats();
			const gen = statsGen;
			const loop = async () => {
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

		const stopHeartbeat = () => {
			if (heartbeatTimer) clearInterval(heartbeatTimer);
			heartbeatTimer = null;
		};

		const startHeartbeat = () => {
			stopHeartbeat();
			heartbeatTimer = setInterval(() => {
				const sentAt = performance.now();
				void sendAndWait(voiceHeartbeatFrame()).then(
					() => noteSignalingLatency(sentAt),
					(error: unknown) => {
						log.debug("heartbeat failed", {
							code: classifyThrown(error).code,
						});
					},
				);
			}, HEARTBEAT_INTERVAL_MS);
		};

		const releaseCameraListener = () => {
			if (camEndedListener) {
				camProducer?.track?.removeEventListener("ended", camEndedListener);
			}
			camEndedListener = null;
		};

		const releaseScreenCapture = () => {
			const capture = screenCapture;
			screenCapture = null;
			screenQuality = null;
			if (capture && screenEndedListener) {
				capture.video.removeEventListener("ended", screenEndedListener);
			}
			screenEndedListener = null;
			setVideo("self:screen", undefined);
			setScreenSharing(false);
			if (!capture) return;
			capture.video.stop();
			capture.audio?.stop();
			capture.release();
		};

		const teardownMedia = () => {
			mediaEpoch += 1;
			rejectAllPending();
			stopStatsMonitor();
			stopHeartbeat();
			localSpeaking = false;
			serverSpeakers = [];
			setSpeakers(new Set<string>());

			cameraGeneration += 1;
			pendingCameraStart = null;
			releaseCameraListener();
			for (const producer of [micProducer, camProducer]) {
				producer?.track?.stop();
			}
			micProducer = null;
			camProducer = null;
			screenProducer = null;
			screenAudioProducer = null;
			releaseScreenCapture();

			tunedSenders.clear();
			cancelPreferences();
			for (const consumer of consumers.values()) consumer.close();
			consumers.clear();
			for (const { el, boost } of audioEls.values()) {
				boost.dispose();
				el.pause();
				el.srcObject = null;
			}
			audioEls.clear();
			producers.clear();
			consumersByProducer.clear();
			setVideoMap({});

			if (sendWatchdog) clearTimeout(sendWatchdog);
			if (recvWatchdog) clearTimeout(recvWatchdog);
			sendWatchdog = null;
			recvWatchdog = null;
			sendConnected = false;
			recvConnected = false;

			sendTransport?.close();
			recvTransport?.close();
			sendTransport = null;
			recvTransport = null;
			device = null;

			suppressor?.destroy();
			suppressor = null;
			for (const track of micStream?.getTracks() ?? []) track.stop();
			micStream = null;
			ready = false;
		};

		const abandonSignaling = () => {
			if (!ws) return;
			const stale = ws;
			ws = null;
			stale.onclose = null;
			stale.onerror = null;
			stale.onmessage = null;
			stale.onopen = null;
			stale.close();
		};

		const teardown = () => {
			if (reconnectTimer) clearTimeout(reconnectTimer);
			reconnectTimer = null;
			cameraIntent += 1;
			setCameraOn(false);
			screenVp8Only = false;
			teardownMedia();
			tileViews.clear();
			abandonSignaling();
		};

		const finish = (reason: VoiceEndReason) => {
			intentionalClose = true;
			session = null;
			hostOverride = null;
			emitMove(null);
			teardown();
			setModeration({});
			setConnection(DISCONNECTED);
			emitEnded(reason);
		};

		const buildMicGraph = async (stream: MediaStream) => {
			const input = settings();
			return createSuppressor(stream.getAudioTracks()[0], {
				suppression: input.noiseSuppression,
				gate: input.voiceGate,
				inputGain: input.inputVolume / 100,
				onSpeaking: (speaking) => {
					setLocalSpeaking(speaking && !!session && !session.muted);
				},
			});
		};

		const openSavedMicrophone = (devices: VoiceMedia) =>
			openMicrophone(
				(constraints) => devices.getUserMedia(constraints),
				captureConstraints(),
				settings().microphone,
			);

		const startMic = async () => {
			const transport = sendTransport;
			if (!transport || !media) {
				throw new ColibriError({ code: "DeviceUnavailable" });
			}
			const epoch = mediaEpoch;
			const stale = () => mediaEpoch !== epoch;
			const stream = await openSavedMicrophone(media);
			let graph: NoiseSuppressor | null = null;
			let adopted = false;
			try {
				if (stale()) return;
				graph = await buildMicGraph(stream);
				if (stale()) return;
				const producer = await transport.produce({
					track: graph.outputTrack,
					appData: { source: "mic" },
					codecOptions: MIC_CODEC_OPTIONS,
				});
				if (stale()) {
					producer.close();
					return;
				}
				micStream = stream;
				suppressor = graph;
				micProducer = producer;
				adopted = true;
				if (session?.muted) producer.pause();
			} finally {
				if (!adopted) {
					graph?.destroy();
					for (const track of stream.getTracks()) track.stop();
				}
			}
		};

		let recoveringMic = false;
		const recoverMicrophone = async () => {
			if (!ready || !session || micAvailable() || recoveringMic) return;
			recoveringMic = true;
			const epoch = mediaEpoch;
			try {
				await startMic();
				if (mediaEpoch !== epoch || !micProducer) return;
				setMicAvailable(true);
				sendSelfState();
			} catch (error) {
				if (mediaEpoch !== epoch) return;
				log.warn("the chosen microphone is still unavailable", {
					code: classifyThrown(error).code,
				});
			} finally {
				recoveringMic = false;
			}
		};

		const switchMicrophone = async () => {
			const producer = micProducer;
			if (!producer) return recoverMicrophone();
			if (!media) return;
			const epoch = mediaEpoch;
			let stream: MediaStream | undefined;
			let graph: NoiseSuppressor | undefined;
			try {
				stream = await openSavedMicrophone(media);
				if (mediaEpoch !== epoch || micProducer !== producer) {
					throw new ColibriError({ code: "VoiceConnectionLost" });
				}
				graph = await buildMicGraph(stream);
				if (mediaEpoch !== epoch || micProducer !== producer) {
					throw new ColibriError({ code: "VoiceConnectionLost" });
				}
				await producer.replaceTrack({ track: graph.outputTrack });
				suppressor?.destroy();
				for (const track of micStream?.getTracks() ?? []) track.stop();
				suppressor = graph;
				micStream = stream;
			} catch (error) {
				graph?.destroy();
				for (const track of stream?.getTracks() ?? []) track.stop();
				if (mediaEpoch !== epoch) return;
				log.warn("could not switch the microphone", {
					code: classifyThrown(error).code,
				});
			}
		};

		const consumeProducer = async (producerId: string) => {
			const transport = recvTransport;
			const loaded = device;
			if (!transport || !loaded) return;
			if (consumersByProducer.has(producerId)) return;
			const owner = producers.owner(producerId);
			if (!owner) return;
			recvWatchdog ??= armIceWatchdog(
				"recvTransport",
				transport,
				() => recvConnected,
			);
			const epoch = mediaEpoch;
			const stale = () => mediaEpoch !== epoch;
			consumersByProducer.set(producerId, null);

			let reply: FrameOf<"consumerOptions">;
			try {
				reply = expectFrame(
					await sendAndWait(
						consumeFrame(transport.id, producerId, loaded.rtpCapabilities),
					),
					"consumerOptions",
				);
			} catch (error) {
				consumersByProducer.delete(producerId);
				if (stale()) return;
				if (
					!producers.has(producerId) ||
					(isColibriError(error) && error.code === "NotFound")
				) {
					return;
				}
				log.warn("could not receive a participant's stream", {
					code: classifyThrown(error).code,
				});
				notice("streamFailed");
				return;
			}

			const consumer = await transport.consume({
				id: reply.id,
				producerId: reply.producerId,
				kind: reply.kind as types.MediaKind,
				rtpParameters: reply.rtpParameters as unknown as types.RtpParameters,
				streamId: syncGroupFor(owner),
			});
			if (stale() || !producers.has(producerId)) {
				consumer.close();
				consumersByProducer.delete(producerId);
				return;
			}
			consumers.set(consumer.id, consumer);
			consumersByProducer.set(producerId, consumer.id);

			try {
				await sendAndWait(resumeConsumerFrame(consumer.id));
			} catch (error) {
				log.debug("resumeConsumer failed", {
					code: classifyThrown(error).code,
				});
			}
			if (stale()) {
				consumer.close();
				consumers.delete(consumer.id);
				consumersByProducer.delete(producerId);
				return;
			}

			if (consumer.kind === "audio") {
				const el = createAudio();
				const stream = new MediaStream([consumer.track]);
				el.autoplay = true;
				el.srcObject = stream;
				const entry: AudioEntry = {
					el,
					did: owner.did,
					channel: owner.source === "screen" ? "stream" : "voice",
					boost: createAudioBoost({
						el,
						stream,
						context: sharedBoostContext,
						createHolder: createAudio,
					}),
				};
				applyAudioSettings(entry);
				audioEls.set(consumer.id, entry);
				if (session?.deafened) consumer.pause();
				el.play().catch(() => {});
				return;
			}
			setVideo(producerId, {
				did: owner.did,
				source: owner.source === "screen" ? "screen" : "cam",
				stream: new MediaStream([consumer.track]),
			});
			schedulePreferences();
		};

		const removeProducer = (producerId: string) => {
			producers.remove(producerId);
			consumersByProducer.delete(producerId);
			for (const [id, consumer] of consumers) {
				if (consumer.producerId !== producerId) continue;
				consumer.close();
				consumers.delete(id);
				sentPreferences.delete(id);
				const entry = audioEls.get(id);
				if (!entry) continue;
				entry.boost.dispose();
				entry.el.pause();
				entry.el.srcObject = null;
				audioEls.delete(id);
			}
			setVideo(producerId, undefined);
		};

		const wireTransport = (
			label: "sendTransport" | "recvTransport",
			transport: types.Transport,
		) => {
			transport.on("connect", ({ dtlsParameters }, callback, errback) => {
				sendAndWait(connectTransportFrame(transport.id, dtlsParameters))
					.then((frame) => {
						expectFrame(frame, "ack");
						callback();
					})
					.catch((error: unknown) => errback(error as Error));
			});
			transport.on("connectionstatechange", (state) => {
				log.debug(`${label} ${state}`);
				if (state !== "connected") return;
				if (label === "sendTransport") sendConnected = true;
				else recvConnected = true;
			});
		};

		const wireSendTransport = (transport: types.Transport) => {
			wireTransport("sendTransport", transport);
			transport.on(
				"produce",
				({ kind, rtpParameters, appData }, callback, errback) => {
					const source =
						(appData as { source?: VoiceMediaSource }).source ?? "mic";
					sendWatchdog ??= armIceWatchdog(
						"sendTransport",
						transport,
						() => sendConnected,
					);
					sendAndWait(produceFrame(transport.id, kind, rtpParameters, source))
						.then((frame) =>
							callback({ id: expectFrame(frame, "producerInfo").producerId }),
						)
						.catch((error: unknown) => errback(error as Error));
				},
			);
		};

		const performHandshake = async () => {
			const epoch = mediaEpoch;
			const stale = () => mediaEpoch !== epoch;
			const caps = expectFrame(
				await sendAndWait(getRtpCapabilitiesFrame()),
				"rtpCapabilities",
			);
			if (stale()) return;
			const loaded = createDevice(handlerName());
			await loaded.load({
				routerRtpCapabilities: caps.payload as unknown as types.RtpCapabilities,
			});
			if (stale()) return;
			device = loaded;

			const sendOptions = expectFrame(
				await sendAndWait(createTransportFrame("send")),
				"transportOptions",
			);
			if (stale()) return;
			sendTransport = loaded.createSendTransport(
				toTransportOptions(sendOptions, relayOnly()),
			);
			wireSendTransport(sendTransport);

			const recvOptions = expectFrame(
				await sendAndWait(createTransportFrame("recv")),
				"transportOptions",
			);
			if (stale()) return;
			recvTransport = loaded.createRecvTransport(
				toTransportOptions(recvOptions, relayOnly()),
			);
			wireTransport("recvTransport", recvTransport);

			try {
				await startMic();
				if (stale()) return;
				setMicAvailable(true);
			} catch (error) {
				if (stale()) return;
				setMicAvailable(false);
				log.warn("microphone unavailable, joining listen-only", {
					code: classifyThrown(error).code,
				});
				if (!isMissingDevice(error)) notice("noMicrophone");
			}
			if (stale()) return;

			ready = true;
			reconnectAttempts = 0;
			patchConnection({ state: "connected" });
			sendSelfState();
			send(setSpeakingFrame(localSpeaking));
			startStatsMonitor();
			startHeartbeat();
			for (const producerId of producers.drain()) {
				void consumeProducer(producerId);
			}
			if (camera()) void resumeCamera();
		};

		const failSetup = (error: unknown) => {
			if (!session) return;
			if (connection().state === "reconnecting") return;
			const code = classifyThrown(error).code;
			log.error("voice setup failed", { code });
			finish(
				error instanceof Error && error.name === "UnsupportedError"
					? "unsupported"
					: "failed",
			);
		};

		const handlePeerProducer = (frame: FrameOf<"producerInfo">) => {
			const source =
				decodeMediaSource(frame.source) ??
				(frame.kind === "audio" ? "mic" : "cam");
			producers.track(frame.producerId, {
				did: frame.did,
				kind: frame.kind as types.MediaKind,
				source,
			});
			if (ready) {
				void consumeProducer(frame.producerId);
				if (frame.kind === "video" && source === "screen")
					emitScreenShare(true);
			} else {
				producers.queue(frame.producerId);
			}
		};

		const dropPeer = (did: string) => {
			for (const [producerId, owner] of producers.entries()) {
				if (owner.did === did) removeProducer(producerId);
			}
			serverSpeakers = serverSpeakers.filter((entry) => entry !== did);
			recomputeSpeakers();
			setModeration((current) => {
				if (!current[did]) return current;
				const next = { ...current };
				delete next[did];
				return next;
			});
		};

		const handleServerFrame = (frame: ServerVoiceFrame) => {
			switch (frame.$type) {
				case `${DEFS}joined`:
				case `${DEFS}rtpCapabilities`:
				case `${DEFS}transportOptions`:
				case `${DEFS}ack`:
				case `${DEFS}consumerOptions`:
					pendingReplies.shift()?.resolve(frame);
					return;
				case `${DEFS}producerInfo`:
					if (frame.did === viewer) pendingReplies.shift()?.resolve(frame);
					else handlePeerProducer(frame);
					return;
				case `${DEFS}error`: {
					const error = new ColibriError({
						code: isAppViewErrorCode(frame.error)
							? frame.error
							: "InvalidRequest",
						serverMessage: frame.message,
					});
					const next = pendingReplies.shift();
					if (next) next.reject(error);
					else log.error("unsolicited voice error", { code: error.code });
					return;
				}
				case `${DEFS}peerJoined`:
					return;
				case `${DEFS}peerLeft`:
					dropPeer(frame.did);
					return;
				case `${DEFS}codecUnsupported`:
					void fallBackToVp8(frame.producerId);
					return;
				case `${DEFS}producerRemoved`: {
					const owner = producers.owner(frame.producerId);
					removeProducer(frame.producerId);
					if (
						ready &&
						owner?.did !== viewer &&
						owner?.kind === "video" &&
						owner.source === "screen"
					) {
						emitScreenShare(false);
					}
					return;
				}
				case `${DEFS}speakingUpdate`:
					serverSpeakers = frame.speaking
						? serverSpeakers.includes(frame.did)
							? serverSpeakers
							: [...serverSpeakers, frame.did]
						: serverSpeakers.filter((did) => did !== frame.did);
					recomputeSpeakers();
					return;
				case `${DEFS}moderationChanged`: {
					const state: VoiceModeration = {
						serverMuted: frame.serverMuted ?? false,
						serverDeafened: frame.serverDeafened ?? false,
					};
					setModeration((current) => ({ ...current, [frame.did]: state }));
					if (frame.did === viewer && state.serverMuted) {
						setLocalSpeaking(false);
					}
					return;
				}
				case `${DEFS}disconnected`:
					log.info("the server ended the call", { reason: frame.reason });
					finish(endReasonOf(frame.reason));
					return;
				case `${DEFS}callElsewhere`:
					pendingReplies.shift()?.resolve(frame);
					return;
				case `${DEFS}migrationProposal`:
					void answerProposal(frame);
					return;
				case `${DEFS}migrateTo`:
					emitMove(null);
					log.info("the call moves to another node", {
						now: frame.now === true,
					});
					void openSignaling({ host: frame.signalingUrl, keepCurrent: true });
					return;
				case `${DEFS}moved`:
					log.info("a moderator moved this client to another channel");
					for (const listener of [...movedListeners]) listener(frame.channel);
					return;
			}
		};

		const scheduleReconnect = () => {
			if (reconnectTimer || !session) return;
			abandonSignaling();
			if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
				log.warn("gave up reconnecting to voice");
				finish("lost");
				return;
			}
			reconnectAttempts += 1;
			patchConnection({
				state: "reconnecting",
				quality: "lost",
				latency: null,
			});
			setVideoMap({});
			serverSpeakers = [];
			localSpeaking = false;
			setSpeakers(new Set<string>());
			reconnectTimer = setTimeout(() => {
				reconnectTimer = null;
				void openSignaling();
			}, reconnectDelay(reconnectAttempts));
		};

		const answerProposal = async (
			frame: FrameOf<"migrationProposal">,
		): Promise<void> => {
			const socket = ws;
			const deadline = Date.parse(frame.deadline);
			const results = await Promise.all(
				frame.candidates.map(async (candidate) => {
					const rttMs = await probe(candidate.probeUrl).catch(() => null);

					return rttMs === null
						? { nodeId: candidate.nodeId }
						: {
								nodeId: candidate.nodeId,
								rttMs: Math.max(0, Math.round(rttMs)),
							};
				}),
			);

			if (ws !== socket || !session) return;

			send(rttReportFrame(results));
			emitMove({
				deadline: Number.isFinite(deadline) ? deadline : Date.now() + 60_000,
				moveNow: () => {
					if (ws === socket) send(moveNowFrame());
				},
			});
		};

		const openSignaling = async (
			move: { host: string; keepCurrent: boolean } | null = null,
		) => {
			const current = session;
			if (!current) return;
			if (move) {
				if (switching) return;
				switching = move.keepCurrent;
				hostOverride = move.host;
			}
			const id = sessionId;
			let token: string;
			try {
				const { data } = await options.agent.com.atproto.server.getServiceAuth({
					aud: options.serviceRef,
					lxm: VOICE_SIGNAL_LXM,
					exp: Math.floor(Date.now() / 1_000) + TOKEN_TTL_S,
				});
				token = data.token;
			} catch (error) {
				switching = false;
				if (id !== sessionId) return;
				log.warn("could not authorize the voice connection", {
					code: classifyThrown(error).code,
				});
				scheduleReconnect();
				return;
			}
			if (id !== sessionId || !session) {
				switching = false;
				return;
			}

			const keepCurrent = move?.keepCurrent === true && ws !== null;

			if (!keepCurrent) {
				intentionalClose = false;
				preferencesSupported = true;
				pendingReplies = [];
				sendChain = Promise.resolve();
				abandonSignaling();
			}

			const socket = createSocket(voiceSocketUrl(signalingHost()), [
				AUTH_SUBPROTOCOL,
				token,
			]);

			if (!keepCurrent) ws = socket;

			const adopt = () => {
				if (ws === socket) return;
				if (screenProducer) {
					notice("screenStoppedByMove");
					emitScreenShare(false);
				}
				abandonSignaling();
				teardownMedia();
				patchConnection({ state: "connecting" });
				intentionalClose = false;
				preferencesSupported = true;
				pendingReplies = [];
				sendChain = Promise.resolve();
				ws = socket;
			};

			socket.onopen = () => {
				if (id !== sessionId || !session) {
					socket.close();
					return;
				}
				if (keepCurrent) adopt();
				switching = false;
				sendAndWait(joinFrame(current.channel))
					.then((frame) => {
						if (frame.$type === `${DEFS}callElsewhere`) {
							const elsewhere = frame as FrameOf<"callElsewhere">;

							if (elsewhereHops >= MAX_ELSEWHERE_HOPS) {
								throw new ColibriError({
									code: "VoiceUnavailable",
									message: "the call kept pointing at other nodes",
								});
							}

							elsewhereHops += 1;
							log.info("the call runs on another node", {
								node: elsewhere.nodeId,
							});
							void openSignaling({
								host: elsewhere.signalingUrl,
								keepCurrent: false,
							});
							return;
						}

						expectFrame(frame, "joined");
						elsewhereHops = 0;
						return performHandshake();
					})
					.catch((error: unknown) => {
						if (ws !== socket) return;
						failSetup(error);
					});
			};
			socket.onmessage = (event) => {
				if (ws !== socket || typeof event.data !== "string") return;
				const frame = decodeVoiceFrame(event.data);
				if (!frame || !isServerVoiceFrame(frame)) {
					log.debug("ignored an unreadable voice frame");
					return;
				}
				handleServerFrame(frame);
			};
			socket.onerror = () => {
				log.warn("voice signaling socket errored");
			};
			socket.onclose = (event) => {
				if (ws !== socket) {
					if (keepCurrent && switching) {
						switching = false;
						log.warn("couldn't reach the node the call moves to", {
							code: event.code,
						});
					}
					return;
				}
				if (intentionalClose) return;
				log.info("voice signaling socket closed", { code: event.code });
				teardownMedia();
				scheduleReconnect();
			};
		};

		const start = (next?: VoiceSession) => {
			if (!next) return;
			if (session?.channel === next.channel) {
				setMuted(next.muted);
				setDeafened(next.deafened);
				return;
			}
			if (session) stop();
			sessionId += 1;
			session = { ...next };
			hostOverride = null;
			elsewhereHops = 0;
			switching = false;
			reconnectAttempts = 0;
			setModeration({});
			setConnection({ state: "connecting", quality: "unknown", latency: null });
			if (!webRtc()) {
				log.warn("this system has no WebRTC");
				finish("unsupported");
				return;
			}
			void openSignaling();
		};

		const stop = () => {
			intentionalClose = true;
			session = null;
			hostOverride = null;
			emitMove(null);
			sessionId += 1;
			cameraIntent += 1;
			setCameraOn(false);
			const close = () => {
				teardown();
				setModeration({});
				setConnection(DISCONNECTED);
			};
			const wait = pendingVideoTeardown;
			pendingVideoTeardown = null;
			if (!wait) {
				close();
				return;
			}
			const id = sessionId;
			setConnection(DISCONNECTED);
			void wait.then(() => {
				if (id === sessionId) close();
			});
		};

		const setMuted = (muted: boolean) => {
			if (!session || session.muted === muted) return;
			session = { ...session, muted };
			if (micProducer) {
				if (muted) micProducer.pause();
				else micProducer.resume();
			}
			if (muted) {
				const wasSpeaking = localSpeaking;
				setLocalSpeaking(false);
				if (!wasSpeaking && ready) send(setSpeakingFrame(false));
			}
			sendSelfState();
		};

		const setDeafened = (deafened: boolean) => {
			if (!session || session.deafened === deafened) return;
			session = { ...session, deafened };
			for (const consumer of consumers.values()) {
				if (consumer.kind !== "audio") continue;
				if (deafened) consumer.pause();
				else consumer.resume();
			}
			sendSelfState();
		};

		const closeProducer = (producer: types.Producer) => {
			void sendAndWait(closeProducerFrame(producer.id)).catch(
				(error: unknown) => {
					log.debug("closeProducer failed", {
						code: classifyThrown(error).code,
					});
				},
			);
			producer.track?.stop();
			producer.close();
		};

		const settleVideoTeardown = () => {
			const settling = new Promise<void>((resolve) =>
				setTimeout(resolve, VIDEO_SETTLE_MS),
			);
			pendingVideoTeardown = settling;
			void settling.then(() => {
				if (pendingVideoTeardown === settling) pendingVideoTeardown = null;
			});
		};

		const stopCamera = () => {
			cameraGeneration += 1;
			pendingCameraStart = null;
			setVideo("self:cam", undefined);
			const producer = camProducer;
			if (!producer) return;
			releaseCameraListener();
			closeProducer(producer);
			camProducer = null;
			settleVideoTeardown();
		};

		const stopScreen = () => {
			const video = screenProducer;
			const audio = screenAudioProducer;
			screenProducer = null;
			screenAudioProducer = null;
			if (audio) closeProducer(audio);
			if (video) closeProducer(video);
			const sharing = screenSharing();
			releaseScreenCapture();
			if (video) settleVideoTeardown();
			if (sharing) emitScreenShare(false);
		};

		const applyDegradation = (
			producer: types.Producer,
			quality: ScreenShareQuality,
		) => {
			const tuned = tunedSenders.get(producer.id);

			if (tuned) {
				tuned.base = screenEncodings(
					quality,
					tuned.scalabilityMode,
					tuned.base.length > 1,
				);
				tuned.degradation = screenDegradationPreference(quality);
			}

			applySenderTuning(producer);
		};

		const presetDegradation = (
			sender: RTCRtpSender,
			quality: ScreenShareQuality,
		) => {
			try {
				const params = sender.getParameters() as RTCRtpSendParameters & {
					degradationPreference?: RTCDegradationPreference;
				};
				params.degradationPreference = screenDegradationPreference(quality);
				void sender.setParameters(params).catch((error: unknown) => {
					log.debug("screen degradation preset rejected", {
						code: classifyThrown(error).code,
					});
				});
			} catch (error) {
				log.debug("screen degradation preset unavailable", {
					code: classifyThrown(error).code,
				});
			}
		};

		const chooseScreenCodec = async (
			track: MediaStreamTrack,
			quality: ScreenShareQuality,
		): Promise<ScreenCodecChoice> => {
			const loaded = device;
			if (!loaded) return { mimeType: "video/vp8" };
			const settings = trackSettings(track);
			return pickScreenCodec({
				codecs: sendableVideoCodecs(loaded),
				handlerName: loaded.handlerName,
				target: screenEncodingTarget(quality, settings),
				probe: probeVideoEncoding,
				...(screenVp8Only ? { candidates: ["video/vp8"] } : {}),
			});
		};

		const produceScreen = (
			transport: types.Transport,
			capture: ScreenCapture,
			quality: ScreenShareQuality,
			choice: ScreenCodecChoice,
		) => {
			return produceLayered(
				transport,
				{
					track: capture.video,
					appData: { source: "screen" },
					codecOptions: screenCodecOptions(quality),
					stopTracks: false,
					...(choice.codec ? { codec: choice.codec } : {}),
					onRtpSender: (sender) => presetDegradation(sender, quality),
				},
				screenEncodings(
					quality,
					choice.scalabilityMode,
					supportsSimulcast(choice.mimeType),
				),
				screenEncodings(
					quality,
					choice.scalabilityMode === SCREEN_SVC_SCALABILITY_MODE
						? SCREEN_SCALABILITY_MODE
						: choice.scalabilityMode,
					false,
				),
			);
		};

		const discardCapture = (capture: ScreenCapture) => {
			capture.video.stop();
			capture.audio?.stop();
			capture.release();
		};

		const shareScreen = async (
			capture: ScreenCapture,
			quality: ScreenShareQuality,
		): Promise<boolean> => {
			const transport = sendTransport;
			if (!transport || !ready) {
				discardCapture(capture);
				return false;
			}
			if (screenCapture) stopScreen();
			const epoch = mediaEpoch;
			const live = () => mediaEpoch === epoch && screenCapture === capture;
			screenCapture = capture;
			screenQuality = quality;
			setScreenSharing(true);
			capture.video.contentHint = screenContentHint(quality);
			setVideo("self:screen", {
				did: viewer,
				source: "screen",
				stream: new MediaStream([capture.video]),
			});
			const choice = await chooseScreenCodec(capture.video, quality);
			if (!live()) return false;
			log.info("sending the screen", {
				codec: choice.mimeType,
				layers: choice.scalabilityMode ?? "none",
				powerEfficient: choice.powerEfficient,
			});
			let producer: types.Producer;
			let encodings: RTCRtpEncodingParameters[];
			try {
				({ producer, encodings } = await produceScreen(
					transport,
					capture,
					quality,
					choice,
				));
			} catch (error) {
				if (screenCapture === capture) releaseScreenCapture();
				else discardCapture(capture);
				log.warn("could not send the screen", {
					code: classifyThrown(error).code,
				});
				notice("screenFailed");
				return false;
			}
			if (!live()) {
				if (mediaEpoch === epoch) closeProducer(producer);
				else producer.close();
				return false;
			}
			screenProducer = producer;
			screenMimeType = choice.mimeType.toLowerCase();
			trackSender(producer, {
				source: "screen",
				base: encodings,
				scalabilityMode: choice.scalabilityMode,
			});
			applyDegradation(producer, quality);
			screenEndedListener = () => stopScreen();
			capture.video.addEventListener("ended", screenEndedListener);
			emitScreenShare(true);
			if (!capture.audio) return true;
			try {
				const audio = await transport.produce({
					track: capture.audio,
					appData: { source: "screen" },
				});
				if (!live()) {
					if (mediaEpoch === epoch) closeProducer(audio);
					else audio.close();
					return screenCapture !== null;
				}
				screenAudioProducer = audio;
			} catch (error) {
				log.warn("could not send the screen sound", {
					code: classifyThrown(error).code,
				});
			}
			return true;
		};

		const fallBackToVp8 = async (producerId: string) => {
			const previous = screenProducer;
			const capture = screenCapture;
			const quality = screenQuality;
			const transport = sendTransport;
			if (
				screenVp8Only ||
				!previous ||
				previous.id !== producerId ||
				!capture ||
				!quality ||
				!transport
			) {
				return;
			}
			screenVp8Only = true;
			const choice = await chooseScreenCodec(capture.video, quality);
			if (screenProducer !== previous) return;
			if (choice.mimeType.toLowerCase() === screenMimeType) return;
			const epoch = mediaEpoch;
			log.info("sending the screen again for a viewer", {
				codec: choice.mimeType,
				layers: choice.scalabilityMode ?? "none",
			});
			let producer: types.Producer;
			let encodings: RTCRtpEncodingParameters[];
			try {
				({ producer, encodings } = await produceScreen(
					transport,
					capture,
					quality,
					choice,
				));
			} catch (error) {
				log.warn("could not send the screen again", {
					code: classifyThrown(error).code,
				});
				return;
			}
			if (mediaEpoch !== epoch || screenProducer !== previous) {
				producer.close();
				return;
			}
			screenProducer = producer;
			screenMimeType = choice.mimeType.toLowerCase();
			tunedSenders.delete(previous.id);
			trackSender(producer, {
				source: "screen",
				base: encodings,
				scalabilityMode: choice.scalabilityMode,
			});
			applyDegradation(producer, quality);
			void sendAndWait(closeProducerFrame(previous.id)).catch(
				(error: unknown) => {
					log.debug("closeProducer failed", {
						code: classifyThrown(error).code,
					});
				},
			);
			previous.close();
		};

		const applyScreenQuality = (quality: ScreenShareQuality) => {
			screenQuality = quality;
			const producer = screenProducer;
			const track = producer?.track;
			if (!producer || !track) return;
			track.contentHint = screenContentHint(quality);
			void track
				.applyConstraints(screenVideoConstraints(quality))
				.catch((error: unknown) => {
					log.debug("screen constraints rejected", {
						code: classifyThrown(error).code,
					});
				});
			applyDegradation(producer, quality);
		};

		const startCamera = async (): Promise<boolean> => {
			const transport = sendTransport;
			if (!transport || !media || !ready) return false;
			const epoch = mediaEpoch;
			const generation = cameraGeneration;
			const stale = () =>
				mediaEpoch !== epoch || cameraGeneration !== generation;
			let stream: MediaStream;
			try {
				stream = await openCamera(
					(constraints) => media.getUserMedia(constraints),
					settings().camera,
				);
			} catch (error) {
				if (stale()) return false;
				log.warn("camera unavailable", { code: classifyThrown(error).code });
				notice("cameraFailed");
				return false;
			}
			const track = stream.getVideoTracks()[0];
			const release = () => {
				for (const entry of stream.getTracks()) entry.stop();
			};
			if (stale() || !track || camProducer) {
				release();
				return !stale() && !!camProducer;
			}
			const preview = new MediaStream([track]);
			track.contentHint = CAMERA_CONTENT_HINT;
			setVideo("self:cam", { did: viewer, source: "cam", stream: preview });
			let producer: types.Producer;
			let encodings: RTCRtpEncodingParameters[];
			try {
				({ producer, encodings } = await produceLayered(
					transport,
					{ track, appData: { source: "cam" } },
					cameraEncodings(true),
					cameraEncodings(false),
				));
			} catch (error) {
				release();
				if (stale()) return false;
				setVideo("self:cam", undefined);
				log.warn("could not send the camera", {
					code: classifyThrown(error).code,
				});
				notice("cameraFailed");
				return false;
			}
			if (mediaEpoch !== epoch) {
				producer.close();
				release();
				setVideo("self:cam", undefined);
				return false;
			}
			if (cameraGeneration !== generation) {
				closeProducer(producer);
				release();
				return false;
			}
			camProducer = producer;
			trackSender(producer, { source: "cam", base: encodings });
			camEndedListener = () => loseCamera();
			track.addEventListener("ended", camEndedListener);
			return true;
		};

		const switchCamera = async () => {
			const producer = camProducer;
			if (!producer || !media) return;
			const epoch = mediaEpoch;
			try {
				const stream = await openCamera(
					(constraints) => media.getUserMedia(constraints),
					settings().camera,
				);
				const track = stream.getVideoTracks()[0];
				if (!track || mediaEpoch !== epoch || camProducer !== producer) {
					for (const entry of stream.getTracks()) entry.stop();
					return;
				}
				const previous = producer.track;
				releaseCameraListener();
				track.contentHint = CAMERA_CONTENT_HINT;
				await producer.replaceTrack({ track });
				previous?.stop();
				camEndedListener = () => loseCamera();
				track.addEventListener("ended", camEndedListener);
				setVideo("self:cam", {
					did: viewer,
					source: "cam",
					stream: new MediaStream([track]),
				});
			} catch (error) {
				log.warn("could not switch the camera", {
					code: classifyThrown(error).code,
				});
			}
		};

		const ensureCamera = (): Promise<boolean> => {
			if (camProducer) return Promise.resolve(true);
			if (pendingCameraStart) return pendingCameraStart;
			const starting = startCamera();
			pendingCameraStart = starting;
			void starting.finally(() => {
				if (pendingCameraStart === starting) pendingCameraStart = null;
			});
			return starting;
		};

		const loseCamera = () => {
			cameraIntent += 1;
			stopCamera();
			if (!camera()) return;
			setCameraOn(false);
			for (const listener of [...cameraOffListeners]) listener();
		};

		const resumeCamera = async () => {
			const intent = cameraIntent;
			const epoch = mediaEpoch;
			const live = await ensureCamera();
			if (live || intent !== cameraIntent || epoch !== mediaEpoch) return;
			loseCamera();
		};

		const setCamera = async (on: boolean): Promise<boolean> => {
			if (!on) {
				cameraIntent += 1;
				setCameraOn(false);
				stopCamera();
				return false;
			}
			setCameraOn(true);
			const intent = cameraIntent;
			const live = await ensureCamera();
			if (!live && intent === cameraIntent) setCameraOn(false);
			return live;
		};

		createEffect(
			on(
				() => {
					const current = settings();
					return [current.outputVolume, current.speaker, volumes()] as const;
				},
				() => reapplyAudioSettings(),
				{ defer: true },
			),
		);
		createEffect(
			on(
				() => settings().noiseSuppression,
				(enabled) => suppressor?.setSuppression(enabled),
				{ defer: true },
			),
		);
		createEffect(
			on(
				() => settings().voiceGate,
				(enabled) => suppressor?.setGate(enabled),
				{ defer: true },
			),
		);
		createEffect(
			on(
				() => settings().inputVolume,
				(volume) => suppressor?.setInputGain(volume / 100),
				{ defer: true },
			),
		);
		const savedMicrophone = createMemo(() => settings().microphone);
		const savedCamera = createMemo(() => settings().camera);
		createEffect(
			on(savedMicrophone, () => void switchMicrophone(), { defer: true }),
		);
		createEffect(on(savedCamera, () => void switchCamera(), { defer: true }));

		const stopDeviceWatch = media?.onDeviceChange?.(() =>
			reapplyAudioSettings(true),
		);

		const onVisibilityChange = () => schedulePreferences();

		if (typeof document !== "undefined") {
			document.addEventListener("visibilitychange", onVisibilityChange);
		}

		const dispose = () => {
			stop();
			stopDeviceWatch?.();
			if (typeof document !== "undefined") {
				document.removeEventListener("visibilitychange", onVisibilityChange);
			}
			endedListeners.clear();
			movedListeners.clear();
			noticeListeners.clear();
			moveListeners.clear();
			screenShareListeners.clear();
			micListeners.clear();
			cameraOffListeners.clear();
			disposeRoot();
		};

		return {
			connection,
			start,
			stop,
			setMuted,
			setDeafened,
			setCamera,
			camera,
			onCameraOff: (listener) => {
				cameraOffListeners.add(listener);
				return () => cameraOffListeners.delete(listener);
			},
			shareScreen,
			stopScreen,
			applyScreenQuality,
			reportTileView,
			screenSharing,
			micAvailable,
			speakers,
			videos: () => Object.values(videoMap()),
			moderation,
			onEnded: (listener) => {
				endedListeners.add(listener);
				return () => endedListeners.delete(listener);
			},
			onMoved: (listener) => {
				movedListeners.add(listener);
				return () => movedListeners.delete(listener);
			},
			onNotice: (listener) => {
				noticeListeners.add(listener);
				return () => noticeListeners.delete(listener);
			},
			onMove: (listener) => {
				moveListeners.add(listener);
				return () => moveListeners.delete(listener);
			},
			host: signalingHost,
			onScreenShare: (listener) => {
				screenShareListeners.add(listener);
				return () => screenShareListeners.delete(listener);
			},
			onMicAvailable: (listener) => {
				micListeners.add(listener);
				return () => micListeners.delete(listener);
			},
			dispose,
		};
	});
