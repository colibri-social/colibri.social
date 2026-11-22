import type { DiagnosticsField, DiagnosticsSection } from "@colibri-social/ui";
import type {
	VoiceDebugAudio,
	VoiceDebugCandidate,
	VoiceDebugSnapshot,
	VoiceDebugTransport,
} from "./debug-stats";
import { formatVideoSample } from "./video-stats";

const UNKNOWN = "?";

const value = (label: string, text: string): DiagnosticsField => {
	return { kind: "value", label, value: text };
};

const kbps = (bitrate: number | undefined) => {
	return bitrate === undefined
		? UNKNOWN
		: `${Math.round(bitrate / 1_000)} kbps`;
};

const candidateText = (candidate: VoiceDebugCandidate | undefined) => {
	if (!candidate) return UNKNOWN;

	const relay = candidate.relayProtocol
		? ` via ${candidate.relayProtocol}`
		: "";

	return `${candidate.type ?? UNKNOWN} ${candidate.protocol ?? UNKNOWN}${relay}`;
};

const transportText = (transport: VoiceDebugTransport) => {
	return [
		transport.state,
		`rtt ${transport.rttMs ?? UNKNOWN} ms`,
		`local ${candidateText(transport.local)}`,
		`remote ${candidateText(transport.remote)}`,
		`available ${kbps(transport.availableBitrate)}`,
	].join(" | ");
};

const audioLabel = (audio: VoiceDebugAudio) => {
	const who = audio.direction === "send" ? "You" : (audio.did ?? UNKNOWN);
	const source = audio.source === "screen" ? "screen sound" : "microphone";

	return `${who}, ${source}`;
};

const audioText = (audio: VoiceDebugAudio) => {
	const level =
		audio.audioLevel === undefined ? UNKNOWN : audio.audioLevel.toFixed(2);

	return [
		audio.direction === "send" ? "sending" : "receiving",
		audio.paused ? "paused" : "live",
		audio.codec ?? UNKNOWN,
		kbps(audio.bitrate),
		`lost ${audio.packetsLost ?? UNKNOWN}`,
		`jitter ${audio.jitterMs ?? UNKNOWN} ms`,
		`level ${level}`,
	].join(" | ");
};

export const voiceDebugSections = (
	snapshot: VoiceDebugSnapshot,
): DiagnosticsSection[] => {
	const node = snapshot.node;

	return [
		{
			title: "Node",
			fields: node
				? [
						value("Host", node.host),
						value("Node", node.id ?? UNKNOWN),
						value("Region", node.region || UNKNOWN),
						value("Relay only", node.relayOnly ? "yes" : "no"),
						value("Redirects", String(node.hops)),
						{
							kind: "list",
							label: "Skipped nodes",
							items: snapshot.failedHosts,
						},
					]
				: [value("Host", "Not connected")],
		},
		{
			title: "Connection",
			fields:
				snapshot.transports.length > 0
					? snapshot.transports.map((transport) =>
							value(
								transport.direction === "send" ? "Sending" : "Receiving",
								transportText(transport),
							),
						)
					: [value("Transports", "None")],
		},
		{
			title: "Audio",
			fields:
				snapshot.audio.length > 0
					? snapshot.audio.map((audio) =>
							value(audioLabel(audio), audioText(audio)),
						)
					: [value("Streams", "None")],
		},
		{
			title: "Video",
			fields: [
				{
					kind: "list",
					label: "Streams",
					items: snapshot.video.map(formatVideoSample),
				},
			],
		},
	];
};
