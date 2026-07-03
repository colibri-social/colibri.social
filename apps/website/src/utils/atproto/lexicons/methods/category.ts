import type { LexiconDoc, LexXrpcBody } from "@atproto/lexicon";

const uriResponse: LexXrpcBody = {
	encoding: "application/json",
	schema: {
		type: "object",
		required: ["uri"],
		properties: { uri: { type: "string", format: "at-uri" } },
	},
};

export const categoryMethodDocs: LexiconDoc[] = [
	{
		lexicon: 1,
		id: "social.colibri.category.create",
		defs: {
			main: {
				type: "procedure",
				description: "Creates a category in a community.",
				parameters: {
					type: "params",
					required: ["community", "name"],
					properties: {
						community: { type: "string", format: "at-uri" },
						name: { type: "string" },
					},
				},
				output: uriResponse,
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.category.update",
		defs: {
			main: {
				type: "procedure",
				description: "Renames a category.",
				parameters: {
					type: "params",
					required: ["category"],
					properties: {
						category: { type: "string", format: "at-uri" },
						name: { type: "string" },
					},
				},
				output: uriResponse,
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.category.delete",
		defs: {
			main: {
				type: "procedure",
				description: "Deletes a category.",
				parameters: {
					type: "params",
					required: ["category"],
					properties: {
						category: { type: "string", format: "at-uri" },
					},
				},
				output: uriResponse,
			},
		},
	},
];
