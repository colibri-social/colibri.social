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
	produceFrame,
	resumeConsumerFrame,
	type ServerVoiceFrame,
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
import { openCamera, openMicrophone } from "../media-devices";
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
	captureConstraints,
	createNoiseSuppressor,
	type NoiseSuppressor,
	type NoiseSuppressorOptions,
} from "./noise-suppressor";
import { createProducerRegistry } from "./producer-registry";
import {
	DISCONNECTED,
	qualityFor,
	type ScreenCapture,
	type VoiceConnection,
	type VoiceConnectionMonitor,
	type VoiceEndReason,
	type VoiceModeration,
	type VoiceNotice,
	type VoiceSession,
	type VoiceVideo,
} from "./types";
import {
	browserEncodingProbe,
	pickScreenCodec,
	type ScreenCodecChoice,
	sendableVideoCodecs,
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

export const MAX_RECONNECT_ATTEMPTS = 6;
export const STATS_INTERVAL_MS = 3_000;
export const STATS_FAST_MS = 400;
export const HEARTBEAT_INTERVAL_MS = 20_000;
export const ICE_WATCHDOG_MS = 8_000;
export const REPLY_TIMEOUT_MS = 15_000;
export const VIDEO_SETTLE_MS = 300;
export const TOKEN_TTL_S = 60;

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

export type VoiceMedia = {
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
};

export type VoiceEngine = {
	camera: () => boolean;
	onCameraOff: (listener: () => void) => () => void;
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

export const syncGroupFor = (owner: {
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
			abandonSignaling();
		};

		const finish = (reason: VoiceEndReason) => {
			intentionalClose = true;
			session = null;
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
		};

		const removeProducer = (producerId: string) => {
			producers.remove(producerId);
			consumersByProducer.delete(producerId);
			for (const [id, consumer] of consumers) {
				if (consumer.producerId !== producerId) continue;
				consumer.close();
				consumers.delete(id);
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
				toTransportOptions(sendOptions),
			);
			wireSendTransport(sendTransport);

			const recvOptions = expectFrame(
				await sendAndWait(createTransportFrame("recv")),
				"transportOptions",
			);
			if (stale()) return;
			recvTransport = loaded.createRecvTransport(
				toTransportOptions(recvOptions),
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

		const openSignaling = async () => {
			const current = session;
			if (!current) return;
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
				if (id !== sessionId) return;
				log.warn("could not authorize the voice connection", {
					code: classifyThrown(error).code,
				});
				scheduleReconnect();
				return;
			}
			if (id !== sessionId || !session) return;

			intentionalClose = false;
			pendingReplies = [];
			sendChain = Promise.resolve();
			abandonSignaling();
			const socket = createSocket(voiceSocketUrl(options.appViewHost), [
				AUTH_SUBPROTOCOL,
				token,
			]);
			ws = socket;

			socket.onopen = () => {
				sendAndWait(joinFrame(current.channel))
					.then((frame) => {
						expectFrame(frame, "joined");
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
				if (ws !== socket || intentionalClose) return;
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
			const sender = producer.rtpSender;
			if (!sender) return;
			try {
				const params = sender.getParameters() as RTCRtpSendParameters & {
					degradationPreference?: RTCDegradationPreference;
				};
				const maxBitrate = screenEncodings(quality)[0]?.maxBitrate;
				params.degradationPreference = screenDegradationPreference(quality);
				for (const encoding of params.encodings ?? []) {
					encoding.maxBitrate = maxBitrate;
					encoding.maxFramerate = quality.framerate;
				}
				void sender.setParameters(params).catch((error: unknown) => {
					log.debug("screen parameters rejected", {
						code: classifyThrown(error).code,
					});
				});
			} catch (error) {
				log.debug("screen parameters unavailable", {
					code: classifyThrown(error).code,
				});
			}
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
			try {
				producer = await transport.produce({
					track: capture.video,
					appData: { source: "screen" },
					encodings: screenEncodings(quality, choice.scalabilityMode),
					codecOptions: screenCodecOptions(quality),
					stopTracks: false,
					...(choice.codec ? { codec: choice.codec } : {}),
					onRtpSender: (sender) => presetDegradation(sender, quality),
				});
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
			try {
				producer = await transport.produce({
					track: capture.video,
					appData: { source: "screen" },
					encodings: screenEncodings(quality, choice.scalabilityMode),
					codecOptions: screenCodecOptions(quality),
					stopTracks: false,
					...(choice.codec ? { codec: choice.codec } : {}),
					onRtpSender: (sender) => presetDegradation(sender, quality),
				});
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
			setVideo("self:cam", { did: viewer, source: "cam", stream: preview });
			let producer: types.Producer;
			try {
				producer = await transport.produce({
					track,
					appData: { source: "cam" },
				});
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

		const dispose = () => {
			stop();
			stopDeviceWatch?.();
			endedListeners.clear();
			movedListeners.clear();
			noticeListeners.clear();
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
