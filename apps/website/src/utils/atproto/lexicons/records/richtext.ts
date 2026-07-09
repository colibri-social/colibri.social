import type { LexiconDoc } from "@atproto/lexicon";
import { RECORD_IDs } from "../ids.ts";

export const richtextRecordDocs: LexiconDoc[] = [
	{
		lexicon: 1,
		id: RECORD_IDs.RICHTEXT_FACET,
		revision: 4,
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
								"social.colibri.richtext.facet#quote",
								"social.colibri.richtext.facet#heading",
								"social.colibri.richtext.facet#list",
								"social.colibri.richtext.facet#subtext",
								"social.colibri.richtext.facet#spoiler",
								"social.colibri.richtext.facet#mention",
								"social.colibri.richtext.facet#role",
								"social.colibri.richtext.facet#link",
								"social.colibri.richtext.facet#time",
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
			codeblock: {
				type: "object",
				description: "A facet feature for a multi-line code block.",
				properties: {
					lang: {
						type: "string",
						description: "The language of the code block, if specified.",
					},
				},
			},
			quote: {
				type: "object",
				description: "A facet feature for a block quote.",
				properties: {},
			},
			heading: {
				type: "object",
				description: "A facet feature for a heading line (levels 1–3).",
				required: ["level"],
				properties: {
					level: {
						type: "integer",
						description: "The heading level.",
						minimum: 1,
						maximum: 3,
					},
				},
			},
			list: {
				type: "object",
				description: "A facet feature for a single list item line.",
				required: ["ordered"],
				properties: {
					ordered: {
						type: "boolean",
						description:
							"Whether the item belongs to an ordered (numbered) list.",
					},
				},
			},
			subtext: {
				type: "object",
				description: "A facet feature for a subtext line (small, muted).",
				properties: {},
			},
			spoiler: {
				type: "object",
				description: "A facet feature for inline spoiler text.",
				properties: {},
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
			role: {
				type: "object",
				description:
					"A facet feature for a role mention. Resolves to a community role, at index time the AppView notifies every member holding the role (gated by the role's `mentionable` flag or the author's `mention.roles` permission).",
				required: ["role"],
				properties: {
					role: {
						type: "string",
						description: "The AT-URI of the mentioned role record.",
						format: "at-uri",
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
						description: "The ISO 8601 timestamp.",
						format: "datetime",
					},
					style: {
						type: "string",
						description:
							"Display style for the timestamp (mirrors Discord-style formats).",
						knownValues: [
							"time-short",
							"time-long",
							"date-short",
							"date-long",
							"datetime-short",
							"datetime-long",
							"relative",
						],
					},
				},
			},
		},
	},
];
