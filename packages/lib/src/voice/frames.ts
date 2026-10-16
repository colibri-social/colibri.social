import { asSpaceRef } from "@colibri-social/lexicons";
import { colibri } from "../protocol/lexicons.js";

const defs: typeof colibri.voice.defs = colibri.voice.defs;

export const VOICE_SIGNAL_LXM = "social.colibri.beta.voice.subscribeSignals";
export const VOICE_SIGNAL_PATH = `/xrpc/${VOICE_SIGNAL_LXM}`;

export type VoiceMediaSource = "mic" | "cam" | "screen";

export type VoiceMediaKind = "audio" | "video";

type WireObject = { [key: string]: unknown };
export type WireMediaSource = "microphone" | "camera" | "screen";

export const encodeMediaSource = (
	source: VoiceMediaSource,
): WireMediaSource => {
	if (source === "mic") return "microphone";
	if (source === "cam") return "camera";
	return "screen";
};

export const decodeMediaSource = (
	source: string | undefined,
): VoiceMediaSource | null => {
	if (source === "microphone") return "mic";
	if (source === "camera") return "cam";
	if (source === "screen") return "screen";
	return null;
};

export type JoinFrame = ReturnType<typeof defs.join.build>;
export type LeaveFrame = ReturnType<typeof defs.leave.build>;
export type GetRtpCapabilitiesFrame = ReturnType<
	typeof defs.getRtpCapabilities.build
>;
export type CreateTransportFrame = ReturnType<
	typeof defs.createTransport.build
>;
export type ConnectTransportFrame = ReturnType<
	typeof defs.connectTransport.build
>;
export type ProduceFrame = ReturnType<typeof defs.produce.build>;
export type CloseProducerFrame = ReturnType<typeof defs.closeProducer.build>;
export type ConsumeFrame = ReturnType<typeof defs.consume.build>;
export type ResumeConsumerFrame = ReturnType<typeof defs.resumeConsumer.build>;
export type SetSelfStateFrame = ReturnType<typeof defs.setSelfState.build>;
export type VoiceHeartbeatFrame = ReturnType<typeof defs.heartbeat.build>;

export type ClientVoiceFrame =
	| JoinFrame
	| LeaveFrame
	| GetRtpCapabilitiesFrame
	| CreateTransportFrame
	| ConnectTransportFrame
	| ProduceFrame
	| CloseProducerFrame
	| ConsumeFrame
	| ResumeConsumerFrame
	| SetSelfStateFrame
	| VoiceHeartbeatFrame;

export type RtpCapabilitiesFrame = ReturnType<
	typeof defs.rtpCapabilities.build
>;
export type TransportOptionsFrame = ReturnType<
	typeof defs.transportOptions.build
>;
export type VoiceAckFrame = ReturnType<typeof defs.ack.build>;
export type ProducerInfoFrame = ReturnType<typeof defs.producerInfo.build>;
export type ConsumerOptionsFrame = ReturnType<
	typeof defs.consumerOptions.build
>;
export type VoiceErrorFrame = ReturnType<typeof defs.error.build>;
export type JoinedFrame = ReturnType<typeof defs.joined.build>;
export type PeerJoinedFrame = ReturnType<typeof defs.peerJoined.build>;
export type PeerLeftFrame = ReturnType<typeof defs.peerLeft.build>;
export type ProducerRemovedFrame = ReturnType<
	typeof defs.producerRemoved.build
>;
export type SpeakingUpdateFrame = ReturnType<typeof defs.speakingUpdate.build>;
export type ModerationChangedFrame = ReturnType<
	typeof defs.moderationChanged.build
>;
export type DisconnectedFrame = ReturnType<typeof defs.disconnected.build>;

export type ServerVoiceFrame =
	| RtpCapabilitiesFrame
	| TransportOptionsFrame
	| VoiceAckFrame
	| ProducerInfoFrame
	| ConsumerOptionsFrame
	| VoiceErrorFrame
	| JoinedFrame
	| PeerJoinedFrame
	| PeerLeftFrame
	| ProducerRemovedFrame
	| SpeakingUpdateFrame
	| ModerationChangedFrame
	| DisconnectedFrame;

export type VoiceFrame = ClientVoiceFrame | ServerVoiceFrame;

export type VoiceFrameErrorCode = VoiceErrorFrame["error"];

export const joinFrame = (channel: string): JoinFrame =>
	defs.join.build({ channel: asSpaceRef(channel) });

export const leaveFrame = (): LeaveFrame => defs.leave.build({});

export const getRtpCapabilitiesFrame = (): GetRtpCapabilitiesFrame =>
	defs.getRtpCapabilities.build({});

export const createTransportFrame = (
	direction: "send" | "recv",
): CreateTransportFrame => defs.createTransport.build({ direction });

export const connectTransportFrame = (
	transportId: string,
	dtlsParameters: object,
): ConnectTransportFrame =>
	defs.connectTransport.build({
		transportId,
		dtlsParameters: dtlsParameters as WireObject as never,
	});

export const produceFrame = (
	transportId: string,
	kind: VoiceMediaKind,
	rtpParameters: object,
	source: VoiceMediaSource,
): ProduceFrame =>
	defs.produce.build({
		transportId,
		kind,
		rtpParameters: rtpParameters as WireObject as never,
		source: encodeMediaSource(source),
	});

export const closeProducerFrame = (producerId: string): CloseProducerFrame =>
	defs.closeProducer.build({ producerId });

export const consumeFrame = (
	transportId: string,
	producerId: string,
	rtpCapabilities: object,
): ConsumeFrame =>
	defs.consume.build({
		transportId,
		producerId,
		rtpCapabilities: rtpCapabilities as WireObject as never,
	});

export const resumeConsumerFrame = (consumerId: string): ResumeConsumerFrame =>
	defs.resumeConsumer.build({ consumerId });

export const setSelfStateFrame = (state: {
	muted?: boolean;
	deafened?: boolean;
}): SetSelfStateFrame => defs.setSelfState.build(state);

export const voiceHeartbeatFrame = (): VoiceHeartbeatFrame =>
	defs.heartbeat.build({});

export const encodeVoiceFrame = (frame: VoiceFrame): string =>
	JSON.stringify(frame);

type AnyFrameSchema = {
	$type: string;
	safeParse: (input: unknown) => { success: boolean; value?: unknown };
	build: (input: unknown) => unknown;
};

const FRAME_SCHEMAS = [
	defs.join,
	defs.leave,
	defs.getRtpCapabilities,
	defs.createTransport,
	defs.connectTransport,
	defs.produce,
	defs.closeProducer,
	defs.consume,
	defs.resumeConsumer,
	defs.setSelfState,
	defs.heartbeat,
	defs.rtpCapabilities,
	defs.transportOptions,
	defs.ack,
	defs.producerInfo,
	defs.consumerOptions,
	defs.error,
	defs.joined,
	defs.peerJoined,
	defs.peerLeft,
	defs.producerRemoved,
	defs.speakingUpdate,
	defs.moderationChanged,
	defs.disconnected,
] as unknown as ReadonlyArray<AnyFrameSchema>;

const FRAME_SCHEMA_BY_TYPE = new Map<string, AnyFrameSchema>(
	FRAME_SCHEMAS.map((schema) => [schema.$type, schema]),
);

const SERVER_FRAME_TYPES = new Set<string>([
	defs.rtpCapabilities.$type,
	defs.transportOptions.$type,
	defs.ack.$type,
	defs.producerInfo.$type,
	defs.consumerOptions.$type,
	defs.error.$type,
	defs.joined.$type,
	defs.peerJoined.$type,
	defs.peerLeft.$type,
	defs.producerRemoved.$type,
	defs.speakingUpdate.$type,
	defs.moderationChanged.$type,
	defs.disconnected.$type,
]);

export const isServerVoiceFrame = (
	frame: VoiceFrame,
): frame is ServerVoiceFrame => SERVER_FRAME_TYPES.has(frame.$type);

export const decodeVoiceFrame = (raw: string): VoiceFrame | null => {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}

	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		return null;
	}

	const type = (parsed as { $type?: unknown }).$type;
	if (typeof type !== "string") return null;

	const schema = FRAME_SCHEMA_BY_TYPE.get(type);
	if (!schema) return null;

	const result = schema.safeParse(parsed);
	if (!result.success) return null;

	return schema.build(result.value) as VoiceFrame;
};
