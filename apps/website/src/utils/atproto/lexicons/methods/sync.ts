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
				errors: [{ name: "AuthRequired" }],
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
					categoryOrder: { type: "array", items: { type: "string" } },
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
				required: ["event", "community", "membership"],
				properties: {
					event: { type: "string", knownValues: ["join", "leave"] },
					community: { type: "string", format: "at-uri" },
					membership: { type: "string", format: "at-uri" },
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
					channelOrder: { type: "array", items: { type: "string" } },
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
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.sync.sendHum",
		defs: {
			main: {
				type: "procedure",
				description:
					"Sends a client-to-client 'hum' event (e.g. typing, presence, or channel view) to be broadcast to other connected clients.",
				input: {
					encoding: "application/json",
					schema: {
						type: "object",
						required: ["event"],
						properties: {
							event: {
								type: "unknown",
								description:
									"A Colibri client event payload. See the client's ColibriEvent union for the exact shapes.",
							},
						},
					},
				},
			},
		},
	},
];
