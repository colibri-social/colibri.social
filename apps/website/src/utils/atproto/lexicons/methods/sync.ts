import type { LexiconDoc } from "@atproto/lexicon";

export const syncMethodDocs: LexiconDoc[] = [
	{
		lexicon: 1,
		id: "social.colibri.sync.subscribeEvents",
		revision: 1,
		defs: {
			main: {
				type: "subscription",
				description:
					"Opens a WebSocket stream that transmits relevant events for the authenticated user.",
				errors: [
					{
						name: "AuthRequired",
						description: "Missing, malformed, or unverifiable service auth.",
					},
				],
				message: {
					schema: {
						type: "union",
						refs: [
							"#ack",
							"#communityEvent",
							"#memberEvent",
							"#categoryEvent",
							"#channelEvent",
							"#messageEvent",
							"#reactionEvent",
							"#userEvent",
							"#typingEvent",
							"#voicePresenceEvent",
							"#voiceStateEvent",
						],
					},
				},
			},

			ack: {
				type: "object",
				description: "Sent in response to a heartbeat message.",
				required: ["type"],
				properties: {
					type: { type: "string", const: "ack" },
				},
			},

			communityEvent: {
				type: "object",
				description: "Sent when a community has been updated or deleted.",
				required: ["type", "data"],
				properties: {
					type: { type: "string", const: "community_event" },
					data: { type: "ref", ref: "#communityEventData" },
				},
			},
			communityEventData: {
				type: "object",
				required: ["event", "uri"],
				properties: {
					event: { type: "string", knownValues: ["upsert", "delete"] },
					uri: { type: "string", format: "at-uri" },
					name: { type: "string" },
					description: { type: "string" },
					picture: { type: "blob" },
					banner: { type: "blob" },
					categoryOrder: {
						type: "array",
						items: { type: "string", format: "at-uri" },
					},
					requiresApprovalToJoin: { type: "boolean" },
				},
			},

			memberEvent: {
				type: "object",
				description: "Sent when a member has joined or left a community.",
				required: ["type", "data"],
				properties: {
					type: { type: "string", const: "member_event" },
					data: { type: "ref", ref: "#memberEventData" },
				},
			},
			memberEventData: {
				type: "object",
				required: ["event", "community"],
				properties: {
					event: {
						type: "string",
						knownValues: ["join", "leave", "roles_updated"],
					},
					community: { type: "string", format: "at-uri" },
					membership: { type: "string", format: "at-uri" },
					member: {
						type: "ref",
						ref: "#memberEventMember",
						description:
							"The affected member, hydrated. Present on `join` and `roles_updated`.",
					},
					memberDid: {
						type: "string",
						format: "did",
						description: "DID of the member who left. Present on `leave`.",
					},
				},
			},
			memberEventMember: {
				type: "object",
				description:
					"The affected member as carried by a member event. Mirrors `social.colibri.community.defs#memberView`, including the member's current voice channel state so a receiving client can place them in a voice channel without refetching.",
				required: ["did", "handle", "roles", "data"],
				properties: {
					did: { type: "string", format: "did" },
					handle: { type: "string", format: "handle" },
					roles: {
						type: "array",
						items: { type: "string", format: "at-uri" },
					},
					joinedAt: { type: "string", format: "datetime" },
					nickname: { type: "string" },
					vc: {
						type: "string",
						format: "at-uri",
						description:
							"AT-URI of the voice channel the member is currently connected to, if any. Only set when that channel belongs to `community`.",
					},
					vcMuted: { type: "boolean" },
					vcDeafened: { type: "boolean" },
					data: { type: "ref", ref: "social.colibri.actor.defs#actorData" },
				},
			},

			categoryEvent: {
				type: "object",
				description:
					"Sent when a category has been created, updated, or deleted.",
				required: ["type", "data"],
				properties: {
					type: { type: "string", const: "category_event" },
					data: { type: "ref", ref: "#categoryEventData" },
				},
			},
			categoryEventData: {
				type: "object",
				required: ["event", "uri", "community"],
				properties: {
					event: { type: "string", knownValues: ["upsert", "delete"] },
					uri: { type: "string", format: "at-uri" },
					community: { type: "string", format: "at-uri" },
					name: { type: "string" },
					channelOrder: {
						type: "array",
						items: { type: "string", format: "at-uri" },
					},
				},
			},

			channelEvent: {
				type: "object",
				description:
					"Sent when a channel has been created, updated, or deleted.",
				required: ["type", "data"],
				properties: {
					type: { type: "string", const: "channel_event" },
					data: { type: "ref", ref: "#channelEventData" },
				},
			},
			channelEventData: {
				type: "object",
				required: ["event", "uri", "community"],
				properties: {
					event: { type: "string", knownValues: ["upsert", "delete"] },
					uri: { type: "string", format: "at-uri" },
					community: { type: "string", format: "at-uri" },
					category: { type: "string", format: "at-uri" },
					name: { type: "string" },
					description: { type: "string" },
					type: { type: "string" },
				},
			},

			messageEvent: {
				type: "object",
				description: "Sent when a message has been sent, edited, or deleted.",
				required: ["type", "data"],
				properties: {
					type: { type: "string", const: "message_event" },
					data: { type: "ref", ref: "#messageEventData" },
				},
			},
			messageEventData: {
				type: "object",
				required: ["event", "uri", "channel"],
				properties: {
					event: { type: "string", knownValues: ["upsert", "delete"] },
					uri: { type: "string", format: "at-uri" },
					channel: { type: "string", format: "at-uri" },
					text: { type: "string" },
					facets: {
						type: "array",
						items: { type: "ref", ref: "social.colibri.richtext.facet" },
					},
					createdAt: { type: "string", format: "datetime" },
					indexedAt: { type: "string", format: "datetime" },
					edited: { type: "boolean" },
					parent: { type: "string", format: "at-uri" },
					attachments: { type: "array", items: { type: "blob" } },
				},
			},

			reactionEvent: {
				type: "object",
				description:
					"Sent when a reaction has been added to or removed from a message.",
				required: ["type", "data"],
				properties: {
					type: { type: "string", const: "reaction_event" },
					data: { type: "ref", ref: "#reactionEventData" },
				},
			},
			reactionEventData: {
				type: "object",
				required: ["event", "uri", "emoji", "target", "channel"],
				properties: {
					event: { type: "string", knownValues: ["added", "removed"] },
					uri: { type: "string", format: "at-uri" },
					emoji: { type: "string" },
					target: { type: "string", format: "at-uri" },
					channel: { type: "string", format: "at-uri" },
				},
			},

			userEvent: {
				type: "object",
				description:
					"Sent when a known user has updated their profile or Colibri status.",
				required: ["type", "data"],
				properties: {
					type: { type: "string", const: "user_event" },
					data: { type: "ref", ref: "#userEventData" },
				},
			},
			userEventData: {
				type: "object",
				required: ["did", "profile"],
				properties: {
					did: { type: "string", format: "did" },
					status: { type: "ref", ref: "#userStatus" },
					profile: { type: "ref", ref: "#userProfile" },
				},
			},
			userStatus: {
				type: "object",
				required: ["state", "text"],
				properties: {
					emoji: { type: "string" },
					text: { type: "string" },
					state: {
						type: "string",
						knownValues: ["online", "away", "dnd", "offline"],
					},
				},
			},
			userProfile: {
				type: "object",
				required: ["handle"],
				properties: {
					displayName: { type: "string" },
					avatar: { type: "blob" },
					banner: { type: "blob" },
					description: { type: "string" },
					handle: { type: "string", format: "handle" },
				},
			},

			typingEvent: {
				type: "object",
				description:
					"Sent when a user is typing in a channel the client is viewing.",
				required: ["type", "data"],
				properties: {
					type: { type: "string", const: "typing_event" },
					data: { type: "ref", ref: "#typingEventData" },
				},
			},
			typingEventData: {
				type: "object",
				required: ["event", "channel", "did"],
				properties: {
					event: { type: "string", knownValues: ["start", "stop"] },
					channel: { type: "string", format: "at-uri" },
					did: { type: "string", format: "did" },
				},
			},

			voicePresenceEvent: {
				type: "object",
				description: "Sent when a user joins or leaves a voice channel.",
				required: ["type", "data"],
				properties: {
					type: { type: "string", const: "voice_presence_event" },
					data: { type: "ref", ref: "#voicePresenceEventData" },
				},
			},
			voicePresenceEventData: {
				type: "object",
				required: ["event", "channel", "did"],
				properties: {
					event: { type: "string", knownValues: ["join", "leave"] },
					channel: { type: "string", format: "at-uri" },
					did: { type: "string", format: "did" },
				},
			},

			voiceStateEvent: {
				type: "object",
				description:
					"Sent when a user's voice state changes within a voice channel. `muted` and `deafened` are the user's own choices; `serverMuted` and `serverDeafened` are moderator-applied and enforced by the SFU. Each field is absent when unchanged.",
				required: ["type", "data"],
				properties: {
					type: { type: "string", const: "voice_state_event" },
					data: { type: "ref", ref: "#voiceStateEventData" },
				},
			},
			voiceStateEventData: {
				type: "object",
				required: ["channel", "did"],
				properties: {
					channel: { type: "string", format: "at-uri" },
					did: { type: "string", format: "did" },
					muted: { type: "boolean" },
					deafened: { type: "boolean" },
					serverMuted: { type: "boolean" },
					serverDeafened: { type: "boolean" },
				},
			},

			humEnvelope: {
				type: "object",
				description:
					"An off-protocol event relayed between AppViews. The authenticated sender (inter-service auth JWT: aud = receiving AppView did:web, lxm = social.colibri.sync.sendHum) is the origin of record; `origin` is echoed for relay/loop control and MUST match the JWT issuer. Only off-protocol event types are permitted — on-protocol events are never carried by a Hum and are derived from the firehose instead.",
				required: ["origin", "id", "ttl", "subject", "community", "event"],
				properties: {
					origin: {
						type: "string",
						format: "did",
						description: "DID of the AppView that first emitted this Hum.",
					},
					id: {
						type: "string",
						maxLength: 64,
						description:
							"Unique id for this Hum, used by receivers to dedup across relay paths.",
					},
					ttl: {
						type: "integer",
						minimum: 0,
						maximum: 8,
						description:
							"Remaining relay hops. Decremented on each forward; a Hum at ttl 0 is delivered locally but never relayed.",
					},
					subject: {
						type: "string",
						format: "did",
						description:
							"The user this event is about. Receiver MUST verify origin equals subject's declared presenceService before trusting or relaying.",
					},
					community: {
						type: "string",
						format: "at-uri",
						description:
							"Community the event is scoped to. Receiver relays to local clients only if they are members of this community.",
					},
					event: {
						type: "union",
						description:
							"Ephemeral event payload. Only off-protocol types are permitted.",
						refs: [
							"#userEvent",
							"#typingEvent",
							"#voicePresenceEvent",
							"#voiceStateEvent",
						],
					},
				},
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.sync.sendHum",
		defs: {
			main: {
				type: "procedure",
				description:
					"Informs this AppView of an off-protocol event that occurred on a peer AppView. Requires inter-service auth: a JWT signed by the caller's AppView signing key, aud = this AppView's did:web, lxm = social.colibri.sync.sendHum. The receiver drops the Hum unless the JWT issuer equals both the envelope `origin` and the `subject`'s declared presenceService.",
				input: {
					encoding: "application/json",
					schema: {
						type: "ref",
						ref: "social.colibri.sync.subscribeEvents#humEnvelope",
					},
				},
				errors: [
					{
						name: "AuthRequired",
						description: "Missing or invalid service-auth JWT.",
					},
					{
						name: "Forbidden",
						description:
							"A trust-model check failed (origin is not the subject's declared presenceService, subject is not a community member, origin is not an AppView, or a channel does not belong to the community).",
					},
					{
						name: "InvalidRequest",
						description: "A parameter or body field was missing or malformed.",
					},
					{
						name: "NotEnabled",
						description: "Humming is disabled on this AppView.",
					},
					{
						name: "RateLimited",
						description: "The peer exceeded its per-peer sendHum rate budget.",
					},
				],
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.sync.subscribeHums",
		defs: {
			main: {
				type: "subscription",
				description:
					"Egress-only WebSocket stream of Hums this AppView is relaying. Peers subscribe to receive off-protocol events for shared communities, optionally narrowing to declared `communities` (repeated query param). Requires inter-service auth (subprotocol-carried, as with subscribeEvents). Clients cannot send messages on this stream.",
				parameters: {
					type: "params",
					properties: {
						communities: {
							type: "array",
							description:
								"DIDs of the communities the peer wants Hums for, repeated once per community. Narrowing only: the intersection with what the peer is authorised for is what gets streamed, so declaring a community grants nothing. Omit it entirely to receive every authorised community.",
							items: {
								type: "string",
								format: "did",
							},
						},
					},
				},
				errors: [
					{
						name: "AuthRequired",
						description: "Missing, malformed, or unverifiable service auth.",
					},
					{
						name: "NotEnabled",
						description: "Humming is disabled on this AppView.",
					},
					{
						name: "TooManySubscribers",
						description: "The hub is at its subscribeHums connection limit.",
					},
				],
				message: {
					schema: {
						type: "union",
						refs: ["social.colibri.sync.subscribeEvents#humEnvelope"],
					},
				},
			},
		},
	},
];
