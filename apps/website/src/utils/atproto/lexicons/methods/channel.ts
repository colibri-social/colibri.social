import type { LexiconDoc, LexXrpcBody } from "@atproto/lexicon";

const uriResponse: LexXrpcBody = {
	encoding: "application/json",
	schema: {
		type: "object",
		required: ["uri"],
		properties: {
			uri: { type: "string", format: "at-uri" },
		},
	},
};

export const channelMethodDocs: LexiconDoc[] = [
	{
		lexicon: 1,
		id: "social.colibri.channel.defs",
		defs: {
			message: {
				type: "object",
				description: "A hydrated message as served by the AppView.",
				required: [
					"uri",
					"text",
					"facets",
					"channel",
					"community",
					"author",
					"attachments",
					"reactions",
					"createdAt",
					"edited",
				],
				properties: {
					uri: { type: "string", format: "at-uri" },
					text: { type: "string" },
					facets: {
						type: "array",
						items: { type: "ref", ref: "social.colibri.richtext.facet" },
					},
					channel: { type: "string", format: "at-uri" },
					community: { type: "string", format: "at-uri" },
					author: { type: "ref", ref: "social.colibri.actor.defs#actorView" },
					parent: {
						type: "ref",
						ref: "#message",
						description:
							"The message this one replies to, if any. Never itself nested (the parent's own parent is omitted).",
					},
					attachments: {
						type: "array",
						items: { type: "ref", ref: "#attachment" },
					},
					reactions: {
						type: "array",
						items: { type: "ref", ref: "#reactionView" },
					},
					createdAt: { type: "string", format: "datetime" },
					edited: { type: "boolean" },
				},
			},
			attachment: {
				type: "object",
				description: "A file attached to a message.",
				required: ["blob"],
				properties: {
					blob: { type: "blob" },
					name: { type: "string" },
				},
			},
			reactionView: {
				type: "object",
				description: "An aggregated reaction on a message.",
				required: ["emoji", "count", "reactorDIDs"],
				properties: {
					emoji: { type: "string" },
					count: { type: "integer" },
					reactorDIDs: {
						type: "array",
						items: { type: "string", format: "did" },
					},
				},
			},
			readCursor: {
				type: "object",
				description: "The authenticated user's read cursor for a channel.",
				required: ["uri", "cursor", "channel"],
				properties: {
					uri: { type: "string", format: "at-uri" },
					cursor: { type: "string" },
					channel: { type: "string", format: "at-uri" },
				},
			},
			unreadStatus: {
				type: "object",
				description: "Per-channel unread state for the authenticated user.",
				required: ["channelUri", "hasUnreadMessages", "unreadPingCount"],
				properties: {
					channelUri: { type: "string", format: "at-uri" },
					hasUnreadMessages: { type: "boolean" },
					unreadPingCount: { type: "integer" },
				},
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.channel.create",
		defs: {
			main: {
				type: "procedure",
				description: "Creates a channel in a category of a community.",
				parameters: {
					type: "params",
					required: ["community", "category", "name", "type"],
					properties: {
						community: { type: "string", format: "at-uri" },
						category: { type: "string", format: "at-uri" },
						name: { type: "string" },
						type: {
							type: "string",
							format: "nsid",
							description:
								"The channel type, e.g. social.colibri.channel.text.",
						},
						description: { type: "string" },
						allowedRoles: {
							type: "array",
							items: { type: "string", format: "record-key" },
						},
						allowedMembers: {
							type: "array",
							items: { type: "string", format: "did" },
						},
					},
				},
				output: uriResponse,
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.channel.update",
		defs: {
			main: {
				type: "procedure",
				description: "Updates a channel's settings.",
				parameters: {
					type: "params",
					required: ["channel"],
					properties: {
						channel: { type: "string", format: "at-uri" },
						category: { type: "string", format: "at-uri" },
						name: { type: "string" },
						description: { type: "string" },
						ownerOnly: { type: "boolean" },
						allowedRoles: {
							type: "array",
							items: { type: "string", format: "record-key" },
						},
						clearAllowedRoles: { type: "boolean" },
						allowedMembers: {
							type: "array",
							items: { type: "string", format: "did" },
						},
						clearAllowedMembers: { type: "boolean" },
					},
				},
				output: uriResponse,
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.channel.delete",
		defs: {
			main: {
				type: "procedure",
				description: "Deletes a channel.",
				parameters: {
					type: "params",
					required: ["channel"],
					properties: {
						channel: { type: "string", format: "at-uri" },
					},
				},
				output: uriResponse,
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.channel.getChannelView",
		defs: {
			main: {
				type: "query",
				description:
					"Returns the initial view of a channel: recent messages, the read cursor, and unseen notifications.",
				parameters: {
					type: "params",
					required: ["channel"],
					properties: {
						channel: { type: "string", format: "at-uri" },
						limit: { type: "integer" },
					},
				},
				output: {
					encoding: "application/json",
					schema: {
						type: "object",
						required: ["messages", "unseen"],
						properties: {
							cursor: { type: "string" },
							messages: {
								type: "array",
								items: {
									type: "ref",
									ref: "social.colibri.channel.defs#message",
								},
							},
							readCursor: {
								type: "ref",
								ref: "social.colibri.channel.defs#readCursor",
							},
							unseen: {
								type: "array",
								items: {
									type: "ref",
									ref: "social.colibri.notification.defs#unseenNotification",
								},
							},
						},
					},
				},
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.channel.getReadCursor",
		defs: {
			main: {
				type: "query",
				description:
					"Returns the authenticated user's read cursor for a channel.",
				parameters: {
					type: "params",
					required: ["channel"],
					properties: {
						channel: { type: "string", format: "at-uri" },
					},
				},
				output: {
					encoding: "application/json",
					schema: {
						type: "ref",
						ref: "social.colibri.channel.defs#readCursor",
					},
				},
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.channel.listMessages",
		defs: {
			main: {
				type: "query",
				description: "Lists messages in a channel, newest first, paginated.",
				parameters: {
					type: "params",
					required: ["channel"],
					properties: {
						channel: { type: "string", format: "at-uri" },
						limit: { type: "integer" },
						cursor: { type: "string" },
						all: {
							type: "boolean",
							description: "Include hidden (moderated) messages.",
						},
					},
				},
				output: {
					encoding: "application/json",
					schema: {
						type: "object",
						required: ["messages"],
						properties: {
							cursor: { type: "string" },
							messages: {
								type: "array",
								items: {
									type: "ref",
									ref: "social.colibri.channel.defs#message",
								},
							},
						},
					},
				},
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.channel.listReactions",
		defs: {
			main: {
				type: "query",
				description: "Lists the aggregated reactions on a message.",
				parameters: {
					type: "params",
					required: ["message"],
					properties: {
						message: { type: "string", format: "at-uri" },
					},
				},
				output: {
					encoding: "application/json",
					schema: {
						type: "object",
						required: ["reactions"],
						properties: {
							reactions: {
								type: "array",
								items: {
									type: "ref",
									ref: "social.colibri.channel.defs#reactionView",
								},
							},
						},
					},
				},
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.channel.listUnreadStatus",
		defs: {
			main: {
				type: "query",
				description:
					"Lists the unread status of every channel in a community for the authenticated user.",
				parameters: {
					type: "params",
					required: ["community"],
					properties: {
						community: { type: "string", format: "at-uri" },
					},
				},
				output: {
					encoding: "application/json",
					schema: {
						type: "object",
						required: ["channels"],
						properties: {
							channels: {
								type: "array",
								items: {
									type: "ref",
									ref: "social.colibri.channel.defs#unreadStatus",
								},
							},
						},
					},
				},
			},
		},
	},
];
