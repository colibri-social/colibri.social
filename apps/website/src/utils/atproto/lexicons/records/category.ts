import type { LexiconDoc } from "@atproto/lexicon";
import { RECORD_IDs } from "../ids.ts";

export const categoryRecordDocs: LexiconDoc[] = [
	{
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
					},
				},
			},
		},
	},
];
