import type { LexiconDoc } from "@atproto/lexicon";
import { RECORD_IDs } from "../ids.ts";

export const approvalRecordDocs: LexiconDoc[] = [
	{
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
	},
];
