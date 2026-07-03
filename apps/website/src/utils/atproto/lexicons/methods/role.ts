import type { LexiconDoc, LexXrpcBody } from "@atproto/lexicon";

const uriResponse: LexXrpcBody = {
	encoding: "application/json",
	schema: {
		type: "object",
		required: ["uri"],
		properties: { uri: { type: "string", format: "at-uri" } },
	},
};

export const roleMethodDocs: LexiconDoc[] = [
	{
		lexicon: 1,
		id: "social.colibri.role.create",
		defs: {
			main: {
				type: "procedure",
				description: "Creates a role in a community.",
				parameters: {
					type: "params",
					required: ["community", "name", "permissions", "position"],
					properties: {
						community: { type: "string", format: "at-uri" },
						name: { type: "string" },
						color: { type: "string" },
						permissions: { type: "array", items: { type: "string" } },
						position: { type: "integer" },
						hoisted: { type: "boolean" },
						mentionable: { type: "boolean" },
					},
				},
				output: uriResponse,
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.role.update",
		defs: {
			main: {
				type: "procedure",
				description: "Updates a role.",
				parameters: {
					type: "params",
					required: ["role"],
					properties: {
						role: { type: "string", format: "at-uri" },
						name: { type: "string" },
						color: { type: "string" },
						permissions: { type: "array", items: { type: "string" } },
						position: { type: "integer" },
						hoisted: { type: "boolean" },
						mentionable: { type: "boolean" },
					},
				},
				output: uriResponse,
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.role.delete",
		defs: {
			main: {
				type: "procedure",
				description: "Deletes a role.",
				parameters: {
					type: "params",
					required: ["role"],
					properties: {
						role: { type: "string", format: "at-uri" },
					},
				},
				output: uriResponse,
			},
		},
	},
];
