import { createSignal } from "solid-js";

export const VIDEO_STATS_INTERVAL_MS = 2_000;

export type VideoStatsDirection = "send" | "recv";

export type VideoStatsSource = "cam" | "screen";

export type VideoStatsSample = {
	id: string;
	direction: VideoStatsDirection;
	source: VideoStatsSource;
	did?: string;
	codec?: string;
	width?: number;
	height?: number;
	fps?: number;
	captureFps?: number;
	trackFps?: number;
	bitrate?: number;
	limitation?: string;
	limitationShares?: Record<string, number>;
	implementation?: string;
	powerEfficient?: boolean;
	scalabilityMode?: string;
	nackCount?: number;
	pliCount?: number;
	packetsLost?: number;
	fractionLost?: number;
	framesDropped?: number;
	freezeCount?: number;
	keyFrames?: number;
	protocol?: string;
	candidateType?: string;
	relayed?: boolean;
	relayProtocol?: string;
	rtt?: number;
	availableBitrate?: number;
};

export type ByteMark = { bytes: number; timestamp: number };

type Stat = { type?: string; id?: string } & Record<string, unknown>;

export type StatsLike = {
	forEach(callback: (stat: Stat) => void): void;
};

const num = (value: unknown): number | undefined =>
	typeof value === "number" && Number.isFinite(value) ? value : undefined;

const str = (value: unknown): string | undefined =>
	typeof value === "string" && value !== "" ? value : undefined;

const bool = (value: unknown): boolean | undefined =>
	typeof value === "boolean" ? value : undefined;

const isVideo = (stat: Stat) =>
	stat.kind === "video" || stat.mediaType === "video";

const shares = (durations: unknown): Record<string, number> | undefined => {
	if (!durations || typeof durations !== "object") return undefined;
	const entries = Object.entries(durations as Record<string, unknown>)
		.map(([reason, seconds]) => [reason, num(seconds) ?? 0] as const)
		.filter(([, seconds]) => seconds > 0);
	const total = entries.reduce((sum, [, seconds]) => sum + seconds, 0);
	if (total <= 0) return undefined;
	return Object.fromEntries(
		entries.map(([reason, seconds]) => [
			reason,
			Math.round((seconds / total) * 100),
		]),
	);
};

const bitrateSince = (
	previous: ByteMark | undefined,
	next: ByteMark | undefined,
): number | undefined => {
	if (!previous || !next) return undefined;
	const elapsed = next.timestamp - previous.timestamp;
	const sent = next.bytes - previous.bytes;
	if (elapsed <= 0 || sent < 0) return undefined;
	return Math.round((sent * 8 * 1_000) / elapsed);
};

const selectedPair = (
	byId: ReadonlyMap<string, Stat>,
	transport: Stat | undefined,
	pairs: readonly Stat[],
): Stat | undefined => {
	const selectedId = str(transport?.selectedCandidatePairId);
	const fromTransport = selectedId ? byId.get(selectedId) : undefined;
	if (fromTransport) return fromTransport;
	return (
		pairs.find((stat) => stat.selected === true) ??
		pairs.find((stat) => stat.nominated === true && stat.state === "succeeded")
	);
};

const compact = <T extends Record<string, unknown>>(value: T): T =>
	Object.fromEntries(
		Object.entries(value).filter(([, entry]) => entry !== undefined),
	) as T;

export const readVideoStats = (
	report: StatsLike,
	base: Pick<VideoStatsSample, "id" | "direction" | "source" | "did"> & {
		trackFps?: number;
	},
	previous: ByteMark | undefined,
): { sample: VideoStatsSample; mark: ByteMark | undefined } => {
	const byId = new Map<string, Stat>();
	const rtp: Stat[] = [];
	const remotes: Stat[] = [];
	const pairs: Stat[] = [];
	let mediaSource: Stat | undefined;
	let transport: Stat | undefined;
	const rtpType = base.direction === "send" ? "outbound-rtp" : "inbound-rtp";
	report.forEach((stat) => {
		if (stat.id) byId.set(stat.id, stat);
		if (stat.type === rtpType && isVideo(stat)) rtp.push(stat);
		if (stat.type === "media-source" && isVideo(stat)) mediaSource = stat;
		if (stat.type === "remote-inbound-rtp" && isVideo(stat)) remotes.push(stat);
		if (stat.type === "candidate-pair") pairs.push(stat);
		if (stat.type === "transport") transport = stat;
	});
	const main = rtp.reduce<Stat | undefined>(
		(best, stat) =>
			(num(stat.frameWidth) ?? 0) >= (num(best?.frameWidth) ?? -1)
				? stat
				: best,
		undefined,
	);
	const bytesKey = base.direction === "send" ? "bytesSent" : "bytesReceived";
	const bytes = rtp.reduce((sum, stat) => sum + (num(stat[bytesKey]) ?? 0), 0);
	const timestamp = num(main?.timestamp);
	const mark =
		main && timestamp !== undefined ? { bytes, timestamp } : undefined;
	const codecId = str(main?.codecId);
	const codec = codecId ? str(byId.get(codecId)?.mimeType) : undefined;
	const send = base.direction === "send";
	const remote =
		remotes.find((stat) => main?.id && stat.localId === main.id) ?? remotes[0];
	const pair = send ? selectedPair(byId, transport, pairs) : undefined;
	const pairLocalId = str(pair?.localCandidateId);
	const local = pairLocalId ? byId.get(pairLocalId) : undefined;
	const candidateType = str(local?.candidateType);
	const rttSeconds = num(pair?.currentRoundTripTime);
	const sample = compact<VideoStatsSample>({
		id: base.id,
		direction: base.direction,
		source: base.source,
		did: base.did,
		codec: codec?.replace(/^video\//i, ""),
		width: num(main?.frameWidth),
		height: num(main?.frameHeight),
		fps: num(main?.framesPerSecond),
		captureFps: send ? num(mediaSource?.framesPerSecond) : undefined,
		trackFps: base.trackFps,
		bitrate: bitrateSince(previous, mark),
		limitation: send ? str(main?.qualityLimitationReason) : undefined,
		limitationShares: send
			? shares(main?.qualityLimitationDurations)
			: undefined,
		implementation: str(
			send ? main?.encoderImplementation : main?.decoderImplementation,
		),
		powerEfficient: bool(
			send ? main?.powerEfficientEncoder : main?.powerEfficientDecoder,
		),
		scalabilityMode: send ? str(main?.scalabilityMode) : undefined,
		nackCount: num(main?.nackCount),
		pliCount: num(main?.pliCount),
		packetsLost: send ? num(remote?.packetsLost) : num(main?.packetsLost),
		fractionLost: send ? num(remote?.fractionLost) : undefined,
		framesDropped: send ? undefined : num(main?.framesDropped),
		freezeCount: send ? undefined : num(main?.freezeCount),
		keyFrames: num(send ? main?.keyFramesEncoded : main?.keyFramesDecoded),
		protocol: str(local?.protocol),
		candidateType,
		relayed: candidateType ? candidateType === "relay" : undefined,
		relayProtocol:
			candidateType === "relay" ? str(local?.relayProtocol) : undefined,
		rtt: rttSeconds === undefined ? undefined : Math.round(rttSeconds * 1_000),
		availableBitrate: num(pair?.availableOutgoingBitrate),
	});
	return { sample, mark };
};

const TRANSPORT_STAT_TYPES = new Set([
	"transport",
	"candidate-pair",
	"local-candidate",
	"remote-candidate",
]);

export const withTransportStats = async (
	report: StatsLike,
	readTransport: (() => Promise<StatsLike>) | undefined,
): Promise<StatsLike> => {
	let hasPair = false;
	report.forEach((stat) => {
		if (stat.type === "candidate-pair") hasPair = true;
	});
	if (hasPair || !readTransport) return report;
	const extra: Stat[] = [];
	(await readTransport()).forEach((stat) => {
		if (stat.type && TRANSPORT_STAT_TYPES.has(stat.type)) extra.push(stat);
	});
	return {
		forEach(callback) {
			report.forEach(callback);
			for (const stat of extra) callback(stat);
		},
	};
};

const round = (value: number | undefined) =>
	value === undefined ? "?" : String(Math.round(value));

const mbps = (bitrate: number | undefined) =>
	bitrate === undefined ? "?" : `${(bitrate / 1_000_000).toFixed(2)} Mbps`;

const yesNo = (value: boolean | undefined) =>
	value === undefined ? "?" : value ? "yes" : "no";

const shareText = (value: Record<string, number> | undefined) =>
	value
		? Object.entries(value)
				.map(([reason, percent]) => `${reason} ${percent}%`)
				.join(", ")
		: undefined;

const networkText = (sample: VideoStatsSample): string | undefined => {
	if (
		sample.protocol === undefined &&
		sample.rtt === undefined &&
		sample.availableBitrate === undefined
	) {
		return undefined;
	}
	const route =
		sample.relayed === undefined
			? "?"
			: sample.relayed
				? `relay${sample.relayProtocol ? ` ${sample.relayProtocol}` : ""}`
				: "direct";
	const loss =
		sample.fractionLost === undefined
			? "?"
			: `${Math.round(sample.fractionLost * 100)}%`;
	return `net ${sample.protocol ?? "?"} ${route} rtt ${round(sample.rtt)} ms avail ${mbps(sample.availableBitrate)} loss ${loss}`;
};

export const formatVideoSample = (sample: VideoStatsSample): string => {
	const parts = [
		`${sample.source} ${sample.direction}`,
		sample.codec ?? "?",
		`${round(sample.width)}x${round(sample.height)}`,
		`${round(sample.fps)} fps`,
	];
	if (sample.direction === "send") {
		parts.push(
			`capture ${round(sample.captureFps)} fps (track ${round(sample.trackFps)})`,
		);
	}
	parts.push(mbps(sample.bitrate));
	if (sample.direction === "send") {
		const limitShares = shareText(sample.limitationShares);
		parts.push(
			`limit ${sample.limitation ?? "?"}${limitShares ? ` (${limitShares})` : ""}`,
		);
		if (sample.scalabilityMode) parts.push(sample.scalabilityMode);
		const network = networkText(sample);
		if (network) parts.push(network);
	}
	parts.push(
		`${sample.direction === "send" ? "encoder" : "decoder"} ${sample.implementation ?? "?"} hw ${yesNo(sample.powerEfficient)}`,
		`nack ${round(sample.nackCount)} pli ${round(sample.pliCount)} lost ${round(sample.packetsLost)}`,
	);
	if (sample.direction === "recv") {
		parts.push(
			`dropped ${round(sample.framesDropped)} freezes ${round(sample.freezeCount)} keyframes ${round(sample.keyFrames)}`,
		);
	}
	return parts.join(" | ");
};

const [videoStats, setVideoStats] = createSignal<readonly VideoStatsSample[]>(
	[],
);

export const latestVideoStats = videoStats;

export const publishVideoStats = (samples: readonly VideoStatsSample[]) =>
	setVideoStats(samples);
