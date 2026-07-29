import type { LexiconDoc } from "@atproto/lexicon";
import { RECORD_IDs } from "../ids.ts";

export const actorRecordDocs: LexiconDoc[] = [
	{
		lexicon: 1,
		id: RECORD_IDs.ACTOR_PLATE,
		revision: 1,
		defs: {
			main: {
				description: "A Colibri name plate used do decorate member cards.",
				key: "tid",
				record: {
					properties: {
						$type: {
							type: "string",
							description: "The type of the record.",
							format: "nsid",
						},
						name: {
							type: "string",
							maxGraphemes: 32,
							maxLength: 320,
							description: "Plate name as exposed to the user.",
						},
						color: {
							type: "string",
							maxLength: 7,
							description: "The base plate color, blended with the image.",
						},
						picture: {
							type: "blob",
							description: "The plate image, blended with the color.",
							accept: ["image/jpeg", "image/png", "image/gif", "image/webp"],
						},
					},
					required: ["name", "color", "picture"],
					type: "object",
				},
				type: "record",
			},
		},
	},
];
