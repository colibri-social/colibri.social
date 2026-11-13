import type { ByteMark, StatsLike, VideoStatsSample } from "./video-stats";

type Stat = { type?: string; id?: string } & Record<string, unknown>;

export type VoiceDebugCandidate = {
	type?: string;
	protocol?: string;
	relayProtocol?: string;
};

export type VoiceDebugTransport = {
	direction: "send" | "recv";
	state: string;
	rttMs?: number;
	local?: VoiceDebugCandidate;
	remote?: VoiceDebugCandidate;
	availableBitrate?: number;
};

export type VoiceDebugAudio = {
	id: string;
	direction: "send" | "recv";
	did?: string;
	source?: string;
	paused?: boolean;
	codec?: string;
	bitrate?: number;
	packetsLost?: number;
	jitterMs?: number;
	audioLevel?: number;
};

export type VoiceDebugNode = {
	host: string;
	id?: string;
	region?: string;
	relayOnly: boolean;
	hops: number;
};

export type VoiceDebugSnapshot = {
	node: VoiceDebugNode | null;
	failedHosts: string[];
	transports: VoiceDebugTransport[];
	audio: VoiceDebugAudio[];
	video: readonly VideoStatsSample[];
};

const num = (value: unknown): number | undefined => {
	return typeof value === "number" && Number.isFinite(value)
		? value
		: undefined;
};

const str = (value: unknown): string | undefined => {
	return typeof value === "string" && value !== "" ? value : undefined;
};

const compact = <T extends Record<string, unknown>>(value: T): T => {
	return Object.fromEntries(
		Object.entries(value).filter(([, entry]) => entry !== undefined),
	) as T;
};

const collect = (report: StatsLike) => {
	const byId = new Map<string, Stat>();
	const all: Stat[] = [];

	report.forEach((stat) => {
		if (stat.id) byId.set(stat.id, stat);
		all.push(stat);
	});

	return { byId, all };
};

const candidateOf = (
	stat: Stat | undefined,
): VoiceDebugCandidate | undefined => {
	if (!stat) return undefined;

	const type = str(stat.candidateType);

	return compact({
		type,
		protocol: str(stat.protocol),
		relayProtocol: type === "relay" ? str(stat.relayProtocol) : undefined,
	});
};

export const readTransportDebug = (
	report: StatsLike,
	direction: "send" | "recv",
	state: string,
): VoiceDebugTransport => {
	const { byId, all } = collect(report);
	const transport = all.find((stat) => stat.type === "transport");
	const pairs = all.filter((stat) => stat.type === "candidate-pair");
	const selectedId = str(transport?.selectedCandidatePairId);
	const pair =
		(selectedId ? byId.get(selectedId) : undefined) ??
		pairs.find((stat) => stat.selected === true) ??
		pairs.find((stat) => stat.nominated === true && stat.state === "succeeded");
	const rttSeconds = num(pair?.currentRoundTripTime);
	const localId = str(pair?.localCandidateId);
	const remoteId = str(pair?.remoteCandidateId);

	return compact<VoiceDebugTransport>({
		direction,
		state,
		rttMs:
			rttSeconds === undefined ? undefined : Math.round(rttSeconds * 1_000),
		local: candidateOf(localId ? byId.get(localId) : undefined),
		remote: candidateOf(remoteId ? byId.get(remoteId) : undefined),
		availableBitrate: num(
			direction === "send"
				? pair?.availableOutgoingBitrate
				: pair?.availableIncomingBitrate,
		),
	});
};

const isAudio = (stat: Stat) => {
	return stat.kind === "audio" || stat.mediaType === "audio";
};

export const readAudioDebug = (
	report: StatsLike,
	base: Pick<VoiceDebugAudio, "id" | "direction" | "did" | "source" | "paused">,
	previous: ByteMark | undefined,
): { sample: VoiceDebugAudio; mark: ByteMark | undefined } => {
	const { byId, all } = collect(report);
	const send = base.direction === "send";
	const rtpType = send ? "outbound-rtp" : "inbound-rtp";
	const rtp = all.find((stat) => stat.type === rtpType && isAudio(stat));
	const remote = all.find(
		(stat) =>
			stat.type === "remote-inbound-rtp" &&
			isAudio(stat) &&
			(!rtp?.id || stat.localId === rtp.id),
	);
	const mediaSource = all.find(
		(stat) => stat.type === "media-source" && isAudio(stat),
	);
	const bytes = num(send ? rtp?.bytesSent : rtp?.bytesReceived);
	const timestamp = num(rtp?.timestamp);
	const mark =
		bytes !== undefined && timestamp !== undefined
			? { bytes, timestamp }
			: undefined;
	const elapsed =
		previous && mark ? mark.timestamp - previous.timestamp : undefined;
	const bitrate =
		previous && mark && elapsed && elapsed > 0 && mark.bytes >= previous.bytes
			? Math.round(((mark.bytes - previous.bytes) * 8 * 1_000) / elapsed)
			: undefined;
	const codecId = str(rtp?.codecId);
	const codec = codecId ? str(byId.get(codecId)?.mimeType) : undefined;
	const jitter = num(send ? remote?.jitter : rtp?.jitter);

	return {
		sample: compact<VoiceDebugAudio>({
			...base,
			codec: codec?.replace(/^audio\//i, ""),
			bitrate,
			packetsLost: num(send ? remote?.packetsLost : rtp?.packetsLost),
			jitterMs: jitter === undefined ? undefined : Math.round(jitter * 1_000),
			audioLevel: num(send ? mediaSource?.audioLevel : rtp?.audioLevel),
		}),
		mark,
	};
};
