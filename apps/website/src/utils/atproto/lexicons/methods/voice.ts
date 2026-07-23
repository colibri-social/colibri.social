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
							"serverMuted",
							"serverDeafened",
							"kicked",
							"superseded",
							"error",
						],
					},
				},
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.voice.moderate",
		revision: 1,
		defs: {
			main: {
				type: "procedure",
				description:
					"Moderates a member's participation in a voice channel: server-mute, server-deafen, or force-disconnect. Requires the `voice.moderate` community permission and the caller must outrank the target. Server-mute/deafen are enforced by the SFU and persist for the room's lifetime, disconnect is transient (the target may rejoin).",
				parameters: {
					type: "params",
					required: ["community", "channel", "target", "action"],
					properties: {
						community: {
							type: "string",
							format: "at-uri",
							description: "AT-URI of the community the channel belongs to.",
						},
						channel: {
							type: "string",
							format: "at-uri",
							description: "AT-URI of the voice channel.",
						},
						target: {
							type: "string",
							format: "did",
							description: "DID of the member to moderate.",
						},
						action: {
							type: "string",
							knownValues: [
								"mute",
								"unmute",
								"deafen",
								"undeafen",
								"disconnect",
							],
							description: "The moderation action to apply.",
						},
					},
				},
				output: {
					encoding: "application/json",
					schema: {
						type: "object",
						required: ["did"],
						properties: {
							did: {
								type: "string",
								format: "did",
								description: "DID of the moderated member.",
							},
						},
					},
				},
				errors: [
					{ name: "AuthRequired" },
					{ name: "Forbidden" },
					{ name: "InvalidRequest" },
				],
			},
		},
	},
];
