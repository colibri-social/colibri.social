import type { LexiconDoc } from "@atproto/lexicon";
import { RECORD_IDs } from "../ids.ts";

export const membershipRecordDocs: LexiconDoc[] = [
	{
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
	},
];
