import type { LexiconDoc } from "@atproto/lexicon";
import { RECORD_IDs } from "../ids.ts";

export const moderationRecordDocs: LexiconDoc[] = [
	{
		lexicon: 1,
		id: RECORD_IDs.MODERATION,
		revision: 1,
		defs: {
			main: {
				type: "record",
				description:
					"A moderation event scoped to the community that owns this repo. Acts as an append-only audit log; current state is derived from the action history per subject.",
				key: "tid",
				record: {
					type: "object",
					required: ["action", "subject", "createdBy", "createdAt"],
					properties: {
						$type: {
							type: "string",
							description: "The type of the record.",
							format: "nsid",
						},
						action: {
							type: "string",
							description: "The moderation action being recorded.",
							knownValues: [
								"ban",
								"unban",
								"hideMessage",
								"unhideMessage",
								"kick",
							],
						},
						subject: {
							type: "ref",
							ref: "#subject",
						},
						reason: {
							type: "string",
							description: "Optional human-readable reason for the action.",
							maxLength: 512,
						},
						createdBy: {
							type: "string",
							description:
								"DID of the issuer (typically a member with the required permission).",
							format: "did",
						},
						createdAt: { type: "string", format: "datetime" },
					},
				},
			},
			subject: {
				type: "object",
				description:
					"Target of the moderation action. Use `did` for user-targeted actions, `uri` for content-targeted actions.",
				properties: {
					did: { type: "string", format: "did" },
					uri: { type: "string", format: "at-uri" },
				},
			},
		},
	},
];
