import type { types as MediasoupTypes } from "mediasoup-client";
import { describe, expect, it } from "vitest";
import { channelSpace } from "./lexicons";
import {
	closeProducerFrame,
	connectTransportFrame,
	consumeFrame,
	createTransportFrame,
	decodeMediaSource,
	decodeVoiceFrame,
	encodeMediaSource,
	encodeVoiceFrame,
	getRtpCapabilitiesFrame,
	heartbeatFrame,
	isServerVoiceFrame,
	joinFrame,
	leaveFrame,
	produceFrame,
	resumeConsumerFrame,
	setSelfStateFrame,
	VOICE_SIGNAL_LXM,
	VOICE_SIGNAL_PATH,
} from "./voice-frames";

const CHANNEL = channelSpace(
	"did:plc:examplecommunityauthority01",
	"social.colibri.beta.channel.voice",
	"3lz4x5y6z7a8b",
);

const roundTrip = (raw: ReturnType<typeof JSON.parse>) =>
	decodeVoiceFrame(JSON.stringify(raw));

describe("VOICE_SIGNAL_LXM / VOICE_SIGNAL_PATH", () => {
	it("names the new subscribeSignals method", () => {
		expect(VOICE_SIGNAL_LXM).toBe("social.colibri.beta.voice.subscribeSignals");
		expect(VOICE_SIGNAL_PATH).toBe(
			"/xrpc/social.colibri.beta.voice.subscribeSignals",
		);
	});
});

describe("encodeMediaSource / decodeMediaSource", () => {
	it("translates mic to microphone and back", () => {
		expect(encodeMediaSource("mic")).toBe("microphone");
		expect(decodeMediaSource("microphone")).toBe("mic");
	});

	it("translates cam to camera and back", () => {
		expect(encodeMediaSource("cam")).toBe("camera");
		expect(decodeMediaSource("camera")).toBe("cam");
	});

	it("leaves screen unchanged in both directions", () => {
		expect(encodeMediaSource("screen")).toBe("screen");
		expect(decodeMediaSource("screen")).toBe("screen");
	});

	it("returns null for an unrecognized wire source", () => {
		expect(decodeMediaSource("something-else")).toBeNull();
		expect(decodeMediaSource(undefined)).toBeNull();
	});
});

describe("client frame round trips", () => {
	it("round-trips join", () => {
		const frame = joinFrame(CHANNEL);
		expect(frame.$type).toBe("social.colibri.beta.voice.defs#join");
		expect(frame.channel).toBe(CHANNEL);

		const decoded = decodeVoiceFrame(encodeVoiceFrame(frame));
		expect(decoded).toEqual(frame);
	});

	it("round-trips leave", () => {
		const frame = leaveFrame();
		const decoded = decodeVoiceFrame(encodeVoiceFrame(frame));
		expect(decoded).toEqual(frame);
	});

	it("round-trips getRtpCapabilities", () => {
		const frame = getRtpCapabilitiesFrame();
		const decoded = decodeVoiceFrame(encodeVoiceFrame(frame));
		expect(decoded).toEqual(frame);
	});

	it("round-trips createTransport", () => {
		const frame = createTransportFrame("send");
		expect(frame.direction).toBe("send");
		const decoded = decodeVoiceFrame(encodeVoiceFrame(frame));
		expect(decoded).toEqual(frame);
	});

	it("round-trips connectTransport", () => {
		const dtlsParameters = {
			fingerprints: [{ algorithm: "sha-256", value: "aa:bb" }],
			role: "client",
		} as unknown as MediasoupTypes.DtlsParameters;
		const frame = connectTransportFrame("transport-1", dtlsParameters);
		expect(frame.transportId).toBe("transport-1");
		const decoded = decodeVoiceFrame(encodeVoiceFrame(frame));
		expect(decoded).toEqual(frame);
	});

	it("round-trips produce and encodes the source on the wire", () => {
		const rtpParameters = {
			codecs: [],
		} as unknown as MediasoupTypes.RtpParameters;
		const frame = produceFrame("transport-1", "audio", rtpParameters, "mic");
		expect(frame.source).toBe("microphone");
		expect(frame.kind).toBe("audio");

		const decoded = decodeVoiceFrame(encodeVoiceFrame(frame));
		expect(decoded).toEqual(frame);
	});

	it("round-trips closeProducer", () => {
		const frame = closeProducerFrame("producer-1");
		const decoded = decodeVoiceFrame(encodeVoiceFrame(frame));
		expect(decoded).toEqual(frame);
	});

	it("round-trips consume", () => {
		const rtpCapabilities = {
			codecs: [],
		} as unknown as MediasoupTypes.RtpCapabilities;
		const frame = consumeFrame("transport-2", "producer-1", rtpCapabilities);
		const decoded = decodeVoiceFrame(encodeVoiceFrame(frame));
		expect(decoded).toEqual(frame);
	});

	it("round-trips resumeConsumer", () => {
		const frame = resumeConsumerFrame("consumer-1");
		const decoded = decodeVoiceFrame(encodeVoiceFrame(frame));
		expect(decoded).toEqual(frame);
	});

	it("round-trips setSelfState with a partial update", () => {
		const frame = setSelfStateFrame({ muted: true });
		expect(frame.muted).toBe(true);
		expect(frame.deafened).toBeUndefined();

		const decoded = decodeVoiceFrame(encodeVoiceFrame(frame));
		expect(decoded).toEqual(frame);
	});

	it("round-trips heartbeat", () => {
		const frame = heartbeatFrame();
		const decoded = decodeVoiceFrame(encodeVoiceFrame(frame));
		expect(decoded).toEqual(frame);
	});
});

describe("decodeVoiceFrame for server frame shapes", () => {
	it("decodes rtpCapabilities", () => {
		const decoded = roundTrip({
			$type: "social.colibri.beta.voice.defs#rtpCapabilities",
			payload: { codecs: [] },
		});
		expect(decoded?.$type).toBe(
			"social.colibri.beta.voice.defs#rtpCapabilities",
		);
	});

	it("rejects transportOptions with an object iceCandidates", () => {
		const decoded = roundTrip({
			$type: "social.colibri.beta.voice.defs#transportOptions",
			id: "transport-1",
			iceParameters: { usernameFragment: "u", password: "p" },
			iceCandidates: { 0: { foundation: "f", port: 1 } },
			dtlsParameters: { fingerprints: [], role: "auto" },
			direction: "send",
		});
		expect(decoded).toBeNull();
	});

	it("decodes transportOptions with a real mediasoup array iceCandidates", () => {
		const candidates = [
			{ foundation: "f", port: 1, protocol: "udp" },
			{ foundation: "g", port: 2, protocol: "tcp" },
		];
		const decoded = roundTrip({
			$type: "social.colibri.beta.voice.defs#transportOptions",
			id: "transport-1",
			iceParameters: { usernameFragment: "u", password: "p" },
			iceCandidates: candidates,
			dtlsParameters: { fingerprints: [], role: "auto" },
			direction: "recv",
		});
		expect(decoded).not.toBeNull();
		if (decoded?.$type === "social.colibri.beta.voice.defs#transportOptions") {
			expect(decoded.id).toBe("transport-1");
			expect(decoded.direction).toBe("recv");
			expect(Array.isArray(decoded.iceCandidates)).toBe(true);
			expect(decoded.iceCandidates).toEqual(candidates);
		}
	});

	it("rejects transportOptions missing a required field", () => {
		expect(
			roundTrip({
				$type: "social.colibri.beta.voice.defs#transportOptions",
				iceParameters: {},
				iceCandidates: [],
				dtlsParameters: {},
			}),
		).toBeNull();

		expect(
			roundTrip({
				$type: "social.colibri.beta.voice.defs#transportOptions",
				id: "transport-1",
				iceParameters: {},
				dtlsParameters: {},
			}),
		).toBeNull();
	});

	it("decodes ack", () => {
		const decoded = roundTrip({
			$type: "social.colibri.beta.voice.defs#ack",
		});
		expect(decoded?.$type).toBe("social.colibri.beta.voice.defs#ack");
	});

	it("decodes producerInfo for a peer's broadcast", () => {
		const decoded = roundTrip({
			$type: "social.colibri.beta.voice.defs#producerInfo",
			producerId: "producer-1",
			did: "did:plc:someoneelse00000000000000",
			kind: "audio",
			source: "microphone",
		});
		expect(decoded).not.toBeNull();
		if (decoded?.$type === "social.colibri.beta.voice.defs#producerInfo") {
			expect(decoded.did).toBe("did:plc:someoneelse00000000000000");
			expect(decodeMediaSource(decoded.source)).toBe("mic");
		}
	});

	it("decodes consumerOptions keyed by producerId", () => {
		const decoded = roundTrip({
			$type: "social.colibri.beta.voice.defs#consumerOptions",
			id: "consumer-1",
			producerId: "producer-1",
			kind: "video",
			rtpParameters: { codecs: [] },
		});
		expect(decoded).not.toBeNull();
		if (decoded?.$type === "social.colibri.beta.voice.defs#consumerOptions") {
			expect(decoded.producerId).toBe("producer-1");
		}
	});

	it("decodes error with a known code", () => {
		const decoded = roundTrip({
			$type: "social.colibri.beta.voice.defs#error",
			error: "NotJoined",
		});
		expect(decoded).not.toBeNull();
		if (decoded?.$type === "social.colibri.beta.voice.defs#error") {
			expect(decoded.error).toBe("NotJoined");
		}
	});

	it("decodes joined", () => {
		const decoded = roundTrip({
			$type: "social.colibri.beta.voice.defs#joined",
			channel: CHANNEL,
		});
		expect(decoded).not.toBeNull();
		if (decoded?.$type === "social.colibri.beta.voice.defs#joined") {
			expect(decoded.channel).toBe(CHANNEL);
		}
	});

	it("decodes peerJoined and peerLeft", () => {
		const did = "did:plc:somepeer000000000000000000";
		const joined = roundTrip({
			$type: "social.colibri.beta.voice.defs#peerJoined",
			did,
		});
		const left = roundTrip({
			$type: "social.colibri.beta.voice.defs#peerLeft",
			did,
		});
		expect(joined?.$type).toBe("social.colibri.beta.voice.defs#peerJoined");
		expect(left?.$type).toBe("social.colibri.beta.voice.defs#peerLeft");
	});

	it("decodes producerRemoved", () => {
		const decoded = roundTrip({
			$type: "social.colibri.beta.voice.defs#producerRemoved",
			producerId: "producer-1",
			did: "did:plc:somepeer000000000000000000",
		});
		expect(decoded?.$type).toBe(
			"social.colibri.beta.voice.defs#producerRemoved",
		);
	});

	it("decodes speakingUpdate", () => {
		const decoded = roundTrip({
			$type: "social.colibri.beta.voice.defs#speakingUpdate",
			did: "did:plc:somepeer000000000000000000",
			speaking: true,
			level: -20,
		});
		expect(decoded?.$type).toBe(
			"social.colibri.beta.voice.defs#speakingUpdate",
		);
	});

	it("decodes moderationChanged", () => {
		const decoded = roundTrip({
			$type: "social.colibri.beta.voice.defs#moderationChanged",
			did: "did:plc:somepeer000000000000000000",
			muted: true,
			deafened: false,
		});
		expect(decoded?.$type).toBe(
			"social.colibri.beta.voice.defs#moderationChanged",
		);
	});
});

describe("isServerVoiceFrame", () => {
	it("is false for client frames and true for server frames", () => {
		const ack = roundTrip({ $type: "social.colibri.beta.voice.defs#ack" });
		expect(isServerVoiceFrame(leaveFrame())).toBe(false);
		expect(ack).not.toBeNull();
		if (ack) expect(isServerVoiceFrame(ack)).toBe(true);
	});
});

describe("decodeVoiceFrame rejects bad input", () => {
	it("returns null for malformed JSON", () => {
		expect(decodeVoiceFrame("{not json")).toBeNull();
	});

	it("returns null for JSON that is not an object", () => {
		expect(decodeVoiceFrame("42")).toBeNull();
		expect(decodeVoiceFrame("null")).toBeNull();
		expect(decodeVoiceFrame("[]")).toBeNull();
	});

	it("returns null when $type is missing", () => {
		expect(decodeVoiceFrame(JSON.stringify({ channel: CHANNEL }))).toBeNull();
	});

	it("returns null for an unknown $type", () => {
		expect(
			decodeVoiceFrame(
				JSON.stringify({ $type: "social.colibri.beta.voice.defs#nope" }),
			),
		).toBeNull();
	});

	it("returns null for a frame missing a required field", () => {
		expect(
			decodeVoiceFrame(
				JSON.stringify({ $type: "social.colibri.beta.voice.defs#join" }),
			),
		).toBeNull();
	});

	it("returns null when a field violates its format", () => {
		expect(
			decodeVoiceFrame(
				JSON.stringify({
					$type: "social.colibri.beta.voice.defs#join",
					channel: "not-a-space-ref",
				}),
			),
		).toBeNull();
	});

	it("returns null when a knownValues field carries an unrelated string", () => {
		expect(
			decodeVoiceFrame(
				JSON.stringify({
					$type: "social.colibri.beta.voice.defs#error",
					error: 42,
				}),
			),
		).toBeNull();
	});
});

describe("disconnected", () => {
	it("decodes a disconnect the server sent with a reason", () => {
		const frame = decodeVoiceFrame(
			JSON.stringify({
				$type: "social.colibri.beta.voice.defs#disconnected",
				reason: "moderator",
			}),
		);

		expect(frame?.$type).toBe("social.colibri.beta.voice.defs#disconnected");
		expect(frame && isServerVoiceFrame(frame)).toBe(true);
	});

	it("decodes one that names no reason", () => {
		const frame = decodeVoiceFrame(
			JSON.stringify({
				$type: "social.colibri.beta.voice.defs#disconnected",
			}),
		);

		expect(frame?.$type).toBe("social.colibri.beta.voice.defs#disconnected");
	});
});
