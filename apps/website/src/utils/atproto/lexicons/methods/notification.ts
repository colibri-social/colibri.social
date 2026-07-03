import type { LexiconDoc, LexXrpcBody } from "@atproto/lexicon";

const updatedResponse: LexXrpcBody = {
	encoding: "application/json",
	schema: {
		type: "object",
		required: ["updated"],
		properties: { updated: { type: "integer" } },
	},
};

export const notificationMethodDocs: LexiconDoc[] = [
	{
		lexicon: 1,
		id: "social.colibri.notification.defs",
		defs: {
			notificationView: {
				type: "object",
				description: "A notification in the authenticated user's feed.",
				required: [
					"id",
					"recipientDid",
					"kind",
					"messageUri",
					"authorDid",
					"channelUri",
					"indexedAt",
					"message",
				],
				properties: {
					id: { type: "integer" },
					recipientDid: { type: "string", format: "did" },
					kind: { type: "string" },
					messageUri: { type: "string", format: "at-uri" },
					authorDid: { type: "string", format: "did" },
					channelUri: { type: "string", format: "at-uri" },
					indexedAt: { type: "string", format: "datetime" },
					seenAt: { type: "string", format: "datetime" },
					message: { type: "ref", ref: "#notificationMessage" },
				},
			},
			notificationMessage: {
				type: "object",
				description: "The message a notification refers to.",
				required: ["text", "facets", "createdAt", "attachments"],
				properties: {
					text: { type: "string" },
					facets: {
						type: "array",
						items: { type: "ref", ref: "social.colibri.richtext.facet" },
					},
					createdAt: { type: "string", format: "datetime" },
					parent: { type: "string", format: "at-uri" },
					attachments: {
						type: "array",
						items: {
							type: "ref",
							ref: "social.colibri.channel.defs#attachment",
						},
					},
					edited: { type: "boolean" },
				},
			},
			unseenNotification: {
				type: "object",
				description: "A minimal unseen-notification pointer.",
				required: ["id", "messageUri", "indexedAt"],
				properties: {
					id: { type: "integer" },
					messageUri: { type: "string", format: "at-uri" },
					indexedAt: { type: "string", format: "datetime" },
				},
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.notification.listNotifications",
		defs: {
			main: {
				type: "query",
				description: "Lists the authenticated user's notifications, paginated.",
				parameters: {
					type: "params",
					properties: {
						limit: { type: "integer" },
						cursor: { type: "string" },
					},
				},
				output: {
					encoding: "application/json",
					schema: {
						type: "object",
						required: ["notifications"],
						properties: {
							cursor: { type: "string" },
							notifications: {
								type: "array",
								items: {
									type: "ref",
									ref: "social.colibri.notification.defs#notificationView",
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
		id: "social.colibri.notification.getUnreadCount",
		defs: {
			main: {
				type: "query",
				description: "Returns the count of unread notifications.",
				output: {
					encoding: "application/json",
					schema: {
						type: "object",
						required: ["count"],
						properties: { count: { type: "integer" } },
					},
				},
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.notification.getUnseen",
		defs: {
			main: {
				type: "query",
				description: "Returns unseen notifications for a specific channel.",
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
						type: "object",
						required: ["notifications"],
						properties: {
							notifications: {
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
		id: "social.colibri.notification.updateSeen",
		defs: {
			main: {
				type: "procedure",
				description: "Marks all notifications up to a timestamp as seen.",
				parameters: {
					type: "params",
					properties: {
						seenAt: {
							type: "string",
							format: "datetime",
							description: "Defaults to now if omitted.",
						},
					},
				},
				output: updatedResponse,
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.notification.updateSeenForMessage",
		defs: {
			main: {
				type: "procedure",
				description: "Marks notifications for a specific message as seen.",
				parameters: {
					type: "params",
					required: ["message"],
					properties: {
						message: { type: "string", format: "at-uri" },
					},
				},
				output: updatedResponse,
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.notification.registerPush",
		defs: {
			main: {
				type: "procedure",
				description:
					"Registers a Web Push subscription for the authenticated user.",
				input: {
					encoding: "application/json",
					schema: {
						type: "object",
						required: ["platform", "endpoint", "keys"],
						properties: {
							platform: {
								type: "string",
								knownValues: ["web", "tauri"],
							},
							endpoint: { type: "string", format: "uri" },
							keys: { type: "ref", ref: "#pushKeys" },
						},
					},
				},
				output: {
					encoding: "application/json",
					schema: {
						type: "object",
						required: ["registered"],
						properties: { registered: { type: "boolean" } },
					},
				},
			},
			pushKeys: {
				type: "object",
				description: "Web Push subscription keys.",
				required: ["p256dh", "auth"],
				properties: {
					p256dh: { type: "string" },
					auth: { type: "string" },
				},
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.notification.unregisterPush",
		defs: {
			main: {
				type: "procedure",
				description: "Removes a Web Push subscription.",
				input: {
					encoding: "application/json",
					schema: {
						type: "object",
						required: ["endpoint"],
						properties: {
							endpoint: { type: "string", format: "uri" },
						},
					},
				},
				output: {
					encoding: "application/json",
					schema: {
						type: "object",
						required: ["unregistered"],
						properties: { unregistered: { type: "boolean" } },
					},
				},
			},
		},
	},
];
