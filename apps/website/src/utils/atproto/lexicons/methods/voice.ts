import type { LexiconDoc } from "@atproto/lexicon";

export const voiceMethodDocs: LexiconDoc[] = [
	{
		lexicon: 1,
		id: "social.colibri.voice.signal",
		revision: 1,
		defs: {
			main: {
				type: "subscription",
				description:
					"Opens a WebSocket to the community hub AppView's embedded voice SFU (mediasoup) for a single voice channel. Bidirectional signaling: the client sends transport/produce/consume requests and the server replies and pushes producer and active-speaker events. Media itself flows over WebRTC (SRTP), not this socket. Requires service auth (aud = the community hub AppView's did:web, lxm = social.colibri.voice.signal), carried via the Sec-WebSocket-Protocol subprotocol as with subscribeEvents.",
				parameters: {
					type: "params",
					required: ["channel"],
					properties: {
						channel: {
							type: "string",
							format: "at-uri",
							description: "AT-URI of the voice channel to join.",
						},
					},
				},
				errors: [
					{ name: "AuthRequired" },
					{
						name: "SfuError",
						description:
							"The SFU could not create the channel router or a transport.",
					},
				],
				message: {
					schema: {
						type: "union",
						refs: ["#signalMessage"],
					},
				},
			},

			signalMessage: {
				type: "object",
				description:
					"A mediasoup signaling frame. `action` discriminates the frame; the remaining fields carry opaque mediasoup structures (transport options, RTP parameters/capabilities, DTLS parameters) that the client's mediasoup-client library interprets. The AppView does not validate the nested payloads.",
				required: ["action"],
				properties: {
					action: {
						type: "string",
						knownValues: [
							"init",
							"connectProducerTransport",
							"connectedProducerTransport",
							"produce",
							"produced",
							"connectConsumerTransport",
							"connectedConsumerTransport",
							"consume",
							"consumed",
							"consumerResume",
							"producerAdded",
							"producerRemoved",
							"activeSpeakers",
							"error",
						],
					},
				},
			},
		},
	},
];
