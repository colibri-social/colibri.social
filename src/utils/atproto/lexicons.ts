import { Lexicons } from "@atproto/lexicon";

const lex = new Lexicons();

export const RECORD_IDs: Record<string, `${string}.${string}.${string}`> = {
	ACTOR_DATA: "social.colibri.actor.data",
	COMMUNITY: "social.colibri.community",
	CATEGORY: "social.colibri.category",
	CHANNEL: "social.colibri.channel",
	MESSAGE: "social.colibri.message",
	REACTION: "social.colibri.reaction",
};

lex.add({
	lexicon: 1,
	id: RECORD_IDs.ACTOR_DATA,
	revision: 1,
	defs: {
		main: {
			description: "The main actor data used in Colibri",
			key: "tid",
			record: {
				properties: {
					$type: {
						type: "string",
						description: "The type of the record.",
						format: "nsid",
					},
					status: {
						type: "string",
						description: "The status for the user, displayed on their profile.",
						maxLength: 32,
						default: "",
					},
					communities: {
						type: "array",
						description:
							"A list of references to communities this user has joined and does not own.",
						items: {
							type: "string",
							format: "record-key",
							description:
								"A reference to a community this user has joined and does not own.",
						},
					},
				},
				required: ["status", "communities"],
				type: "object",
			},
			type: "record",
		},
	},
});

lex.add({
	lexicon: 1,
	id: RECORD_IDs.COMMUNITY,
	revision: 1,
	defs: {
		main: {
			type: "record",
			description:
				'A community, or "server", is where users join to interact with each other on Colibri.',
			key: "tid",
			record: {
				type: "object",
				required: ["name", "description", "categoryOrder"],
				properties: {
					$type: {
						type: "string",
						description: "The type of the record.",
						format: "nsid",
					},
					name: {
						type: "string",
						description: "The name of the community.",
						maxLength: 32,
						default: "New Community",
					},
					description: {
						type: "string",
						description: "A description of the community.",
						maxLength: 256,
						default: "",
					},
					picture: {
						type: "blob",
						description:
							"An image for the community that will be shown to users.",
						accept: ["image/jpeg", "image/png", "image/gif"],
					},
					categoryOrder: {
						type: "array",
						description: "The order of the categories in this community.",
						items: {
							type: "string",
							format: "record-key",
							description: "A category in this community.",
						},
					},
				},
			},
		},
	},
});

lex.add({
	lexicon: 1,
	id: RECORD_IDs.CATEGORY,
	revision: 1,
	defs: {
		main: {
			description:
				"A category belongs to a community and contains multiple channels on Colibri.",
			key: "tid",
			type: "record",
			record: {
				type: "object",
				required: ["name", "channelOrder", "community"],
				properties: {
					$type: {
						type: "string",
						description: "The type of the record.",
						format: "nsid",
					},
					name: {
						type: "string",
						description: "The name of the category.",
						maxLength: 32,
						default: "New category",
					},
					channelOrder: {
						type: "array",
						description: "The order of the channels in this category.",
						items: {
							type: "string",
							description: "A channel in this category.",
							format: "record-key",
						},
					},
					community: {
						type: "string",
						description: "The community this category belongs to.",
						format: "record-key",
					},
					// TODO: permissions
				},
			},
		},
	},
});

lex.add({
	lexicon: 1,
	id: RECORD_IDs.CHANNEL,
	revision: 1,
	defs: {
		main: {
			type: "record",
			key: "tid",
			description: "A channel that belongs to a category on Colibri.",
			record: {
				required: ["name", "type", "category"],
				type: "object",
				properties: {
					$type: {
						type: "string",
						description: "The type of the record.",
						format: "nsid",
					},
					name: {
						type: "string",
						description: "The name of the channel.",
						maxLength: 32,
						default: "New channel",
					},
					description: {
						type: "string",
						description: "A description of the channel.",
						maxLength: 256,
						default: "",
					},
					type: {
						type: "string",
						description: "The type of the channel.",
						enum: ["text", "voice", "forum"],
					},
					category: {
						type: "string",
						description: "The category this channel belongs to.",
						format: "record-key",
					},
					// TODO: permissions
				},
			},
		},
	},
});

lex.add({
	lexicon: 1,
	id: RECORD_IDs.MESSAGE,
	description: "A message sent in a channel on Colibri.",
	revision: 2,
	defs: {
		main: {
			type: "record",
			description: "A message sent in a channel on Colibri",
			key: "tid",
			record: {
				required: ["text", "createdAt", "channel"],
				type: "object",
				properties: {
					$type: {
						type: "string",
						description: "The type of the record.",
						format: "nsid",
					},
					text: {
						type: "string",
						description: "The message content.",
						maxLength: 2048,
					},
					createdAt: {
						type: "string",
						description: "When the message was sent.",
						format: "datetime",
					},
					channel: {
						type: "string",
						description: "The channel this message was sent in.",
						format: "record-key",
					},
					edited: {
						type: "boolean",
						description: "Whether this message has been edited.",
						default: false,
					},
					parent: {
						type: "string",
						description:
							"The record key of a message this message is replying to.",
						format: "record-key",
					},
				},
			},
		},
	},
});

lex.add({
	lexicon: 1,
	id: RECORD_IDs.REACTION,
	revision: 1,
	defs: {
		main: {
			type: "record",
			key: "tid",
			description: "A reaction on a Colibri message.",
			record: {
				required: ["name", "type", "category"],
				type: "object",
				properties: {
					$type: {
						type: "string",
						description: "The type of the record.",
						format: "nsid",
					},
					emoji: {
						type: "string",
						description:
							"The emoji of the reaction. This allows for any string to support for custom emojis later down the line.",
						default: "New channel",
					},
					targetMessage: {
						type: "string",
						description: "The message this relation belongs to.",
						format: "record-key",
					},
				},
			},
		},
	},
});

/**
 * A lexicon that can be used to validate records before inserting them:
 * ```ts
 * lexicon.assertValidRecord('social.colibri.community', { ... })
 * ```
 */
export const lexicon = lex;
