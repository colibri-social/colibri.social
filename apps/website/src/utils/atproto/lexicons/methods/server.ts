import type { LexiconDoc } from "@atproto/lexicon";

export const serverMethodDocs: LexiconDoc[] = [
	{
		lexicon: 1,
		id: "social.colibri.server.describeServer",
		defs: {
			main: {
				type: "query",
				description:
					"Returns metadata describing the Colibri AppView deployment. Public and side-effect free.",
				output: {
					encoding: "application/json",
					schema: {
						type: "object",
						required: ["software", "flavor", "version"],
						properties: {
							software: { type: "string" },
							flavor: { type: "string" },
							version: { type: "string" },
						},
					},
				},
			},
		},
	},
];
