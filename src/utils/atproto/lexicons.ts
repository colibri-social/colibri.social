import { Lexicons } from '@atproto/lexicon';

const lex = new Lexicons();

lex.add({
	lexicon: 1,
	id: `social.colibri.actor.data`,
	description: "Actor data used for Colibri",
	revision: 1,
	defs: {
		status: {
			type: "string",
			description: "The status for the user, displayed on their profile.",
			maxLength: 32,
			default: "",
		},
		communities: {
			type: "array",
			description: "A list of references to communities this user has joined and does not own.",
			items: {
				type: "string",
				format: "cid",
				description: "A reference to a community this user has joined and does not own.",
			}
		}
	},
});

lex.add({
	lexicon: 1,
	id: `social.colibri.community`,
	description: 'A community, or "server", is where users join to interact with each other on Colibri.',
	revision: 1,
	defs: {
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
			description: "An image for the community that will be shown to users.",
			accept: ["image/jpeg", "image/png", "image/gif"],
		},
		categoryOrder: {
			type: "array",
			description: "The order of the categories in this community.",
			items: {
				type: "string",
				format: "cid",
				description: "A category in this community."
			},
		}
	}
});

lex.add({
	lexicon: 1,
	id: `social.colibri.category`,
	description: 'A category belongs to a community and contains multiple channels on Colibri.',
	revision: 1,
	defs: {
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
				format: "cid",
			},
		},
		community: {
			type: "string",
			description: "The community this category belongs to.",
			format: "cid"
		},
		// TODO: permissions
	}
});

lex.add({
	lexicon: 1,
	id: `social.colibri.channel`,
	description: 'A channel belongs to a category on Colibri.',
	revision: 1,
	defs: {
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
			enum: ["text", "voice", "forum"]
		},
		category: {
			type: "string",
			description: "The category this channel belongs to.",
			format: "cid"
		},
		// TODO: permissions
	}
});

lex.add({
	lexicon: 1,
	id: `social.colibri.message`,
	description: 'A message sent in a channel on Colibri.',
	revision: 1,
	defs: {
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
			format: "cid"
		}
	}
});

/**
 * A lexicon that can be used to validate records before inserting them:
 * ```ts
 * lexicon.assertValidRecord('social.colibri.community', { ... })
 * ```
 */
export const lexicon = lex;
