import type { LexiconDoc } from "@atproto/lexicon";
import { Lexicons } from "@atproto/lexicon";

const lex = new Lexicons();

export const RECORD_IDs: Record<string, `${string}.${string}.${string}`> = {
	ACTOR_DATA: "social.colibri.actor.data",
	COMMUNITY: "social.colibri.community",
	CATEGORY: "social.colibri.category",
	CHANNEL: "social.colibri.channel",
	CHANNEL_READ_CURSOR: "social.colibri.channel.read",
	MESSAGE: "social.colibri.message",
	REACTION: "social.colibri.reaction",
	RICHTEXT_FACET: "social.colibri.richtext.facet",
	MEMBERSHIP: "social.colibri.membership",
	APPROVAL: "social.colibri.approval",
};

export const LEXICON_DOCS: LexiconDoc[] = [];

const def = (doc: LexiconDoc): LexiconDoc => {
	LEXICON_DOCS.push(doc);
	return doc;
};

lex.add(
	def({
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
							description:
								"The status for the user, displayed on their profile.",
							maxLength: 32,
							default: "",
						},
						emoji: {
							type: "string",
							description: "The emoji displayed next to status.",
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
	}),
);

lex.add(
	def({
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
					required: [
						"name",
						"description",
						"categoryOrder",
						"requiresApprovalToJoin",
					],
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
							minLength: 1,
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
						requiresApprovalToJoin: {
							type: "boolean",
							default: true,
							description:
								"Whether users can chat in this community without the owner having to create an acknowledgement record.",
						},
					},
				},
			},
		},
	}),
);

lex.add(
	def({
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
							minLength: 1,
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
	}),
);

lex.add(
	def({
		lexicon: 1,
		id: RECORD_IDs.CHANNEL,
		revision: 2,
		defs: {
			main: {
				type: "record",
				key: "tid",
				description: "A channel that belongs to a category on Colibri.",
				record: {
					required: ["name", "type", "category", "community"],
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
							minLength: 1,
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
						community: {
							type: "string",
							description:
								"The record key of the community this channel belongs to.",
							format: "record-key",
						},
						ownerOnly: {
							type: "boolean",
							description:
								"Whether the owner of the community is the only one allowed to post in the channel or not.",
							default: false,
						},
						// TODO: permissions
					},
				},
			},
		},
	}),
);

lex.add(
	def({
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
						facets: {
							type: "array",
							description: "Annotations of sections of the text.",
							items: {
								type: "ref",
								ref: "social.colibri.richtext.facet",
							},
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
						attachments: {
							type: "array",
							items: {
								type: "ref",
								ref: "social.colibri.message#attachment",
							},
							description: "An array of attachment objects for this message.",
						},
					},
				},
			},
			attachment: {
				type: "object",
				description: "A file attached to a message.",
				required: ["blob"],
				properties: {
					blob: {
						type: "blob",
						description: "The attached file.",
					},
					name: {
						type: "string",
						description: "The original filename.",
						maxLength: 256,
					},
				},
			},
		},
	}),
);

lex.add(
	def({
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
	}),
);

lex.add(
	def({
		lexicon: 1,
		id: RECORD_IDs.RICHTEXT_FACET,
		revision: 2,
		defs: {
			main: {
				type: "object",
				description: "A rich text facet annotation on a message.",
				required: ["index", "features"],
				properties: {
					index: {
						type: "ref",
						ref: "social.colibri.richtext.facet#byteSlice",
					},
					features: {
						type: "array",
						description: "The features of this facet.",
						items: {
							type: "union",
							refs: [
								"social.colibri.richtext.facet#channel",
								"social.colibri.richtext.facet#bold",
								"social.colibri.richtext.facet#italic",
								"social.colibri.richtext.facet#underline",
								"social.colibri.richtext.facet#strikethrough",
								"social.colibri.richtext.facet#code",
								"social.colibri.richtext.facet#codeblock",
								"social.colibri.richtext.facet#mention",
								"social.colibri.richtext.facet#link",
								"social.colibri.richtext.facet#time",
								"social.colibri.richtext.facet#quote",
							],
						},
					},
				},
			},
			byteSlice: {
				type: "object",
				description:
					"Specifies the sub-string range a facet feature applies to. Start index is inclusive, end index is exclusive. Indices are zero-based, counting bytes of the UTF-8 encoded text.",
				required: ["byteStart", "byteEnd"],
				properties: {
					byteStart: {
						type: "integer",
						description: "The start index of the byte slice (inclusive).",
						minimum: 0,
					},
					byteEnd: {
						type: "integer",
						description: "The end index of the byte slice (exclusive).",
						minimum: 0,
					},
				},
			},
			channel: {
				type: "object",
				description: "A facet feature for a channel reference.",
				required: ["channel"],
				properties: {
					channel: {
						type: "string",
						description: "The record key of the referenced channel.",
						format: "record-key",
					},
				},
			},
			bold: {
				type: "object",
				description: "A facet feature for bold text.",
				properties: {},
			},
			italic: {
				type: "object",
				description: "A facet feature for italic text.",
				properties: {},
			},
			underline: {
				type: "object",
				description: "A facet feature for underlined text.",
				properties: {},
			},
			strikethrough: {
				type: "object",
				description: "A facet feature for strikethrough text.",
				properties: {},
			},
			code: {
				type: "object",
				description: "A facet feature for inline code text.",
				properties: {},
			},
			quote: {
				type: "object",
				description: "A facet feature for inline code text.",
				properties: {},
			},
			codeblock: {
				type: "object",
				description: "A facet feature for a code block.",
				properties: {
					lang: {
						type: "string",
						description: "The language of the code.",
					},
				},
			},
			mention: {
				type: "object",
				description: "A facet feature for a user mention.",
				required: ["did"],
				properties: {
					did: {
						type: "string",
						description: "The DID of the mentioned user.",
						format: "did",
					},
				},
			},
			link: {
				type: "object",
				description: "A facet feature for a hyperlink.",
				required: ["uri"],
				properties: {
					uri: {
						type: "string",
						description: "The URI of the link.",
						format: "uri",
					},
				},
			},
			time: {
				type: "object",
				description: "A facet feature for a timestamp.",
				required: ["datetime"],
				properties: {
					datetime: {
						type: "string",
						description: "The timestamp for this facet.",
						format: "datetime",
					},
				},
			},
		},
	}),
);

lex.add(
	def({
		lexicon: 1,
		id: RECORD_IDs.MEMBERSHIP,
		description:
			"A declaration that a user would like to be part of a certain community.",
		defs: {
			main: {
				type: "record",
				key: "tid",
				record: {
					type: "object",
					required: ["community", "createdAt"],
					properties: {
						community: {
							type: "string",
							format: "at-uri",
							description:
								"AT-URI of the social.colibri.community record being joined",
						},
						createdAt: { type: "string", format: "datetime" },
					},
				},
			},
		},
	}),
);

lex.add(
	def({
		lexicon: 1,
		id: RECORD_IDs.APPROVAL,
		defs: {
			main: {
				type: "record",
				key: "tid",
				record: {
					type: "object",
					required: ["membership", "community", "createdAt"],
					properties: {
						membership: {
							type: "string",
							format: "at-uri",
							description:
								"AT-URI of the user's social.colibri.membership record",
						},
						community: {
							type: "string",
							format: "at-uri",
							description: "AT-URI of the social.colibri.community record",
						},
						createdAt: { type: "string", format: "datetime" },
					},
				},
			},
		},
	}),
);

lex.add(
	def({
		lexicon: 1,
		id: RECORD_IDs.CHANNEL_READ_CURSOR,
		revision: 1,
		defs: {
			main: {
				type: "record",
				description:
					"A read cursor for a Colibri channel, indicating the last read message by a user.",
				key: "tid",
				record: {
					required: ["channel", "cursor"],
					type: "object",
					properties: {
						$type: {
							type: "string",
							description: "The type of the record.",
							format: "nsid",
						},
						channel: {
							type: "string",
							description: "The channel this message was sent in.",
							format: "at-uri",
						},
						cursor: {
							type: "string",
							description: "The timestamp the channel was last read at.",
							format: "datetime",
						},
					},
				},
			},
		},
	}),
);

/**
 * A lexicon that can be used to validate records before inserting them:
 * ```ts
 * lexicon.assertValidRecord('social.colibri.community', { ... })
 * ```
 */
export const lexicon = lex;
