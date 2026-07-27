import type { LexiconDoc } from "@atproto/lexicon";
import { RECORD_IDs } from "../ids.ts";

export const messageRecordDocs: LexiconDoc[] = [
	{
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
							format: "at-uri",
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
	},
];
