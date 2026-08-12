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
				errors: [
					{
						name: "AppViewNotAuthorized",
						description:
							"The acting account has not published this AppView as authorized to act for it.",
					},
					{
						name: "AuthRequired",
						description: "Missing, malformed, or unverifiable service auth.",
					},
					{
						name: "CommunityCredentialsUnrecoverable",
						description:
							"The AppView cannot write to the community's repo and could not repair its own access.",
					},
					{
						name: "Forbidden",
						description:
							"The caller lacks the permission this method requires.",
					},
					{
						name: "InvalidRequest",
						description: "A parameter or body field was missing or malformed.",
					},
					{
						name: "NotCommunityHub",
						description:
							"This AppView does not administer the community; the hub field names the one that does.",
					},
					{
						name: "PdsUnavailable",
						description:
							"The PDS this operation needs is unreachable or is not a PDS.",
					},
					{
						name: "UpstreamFailure",
						description: "A service outside this AppView failed.",
					},
				],
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
				errors: [
					{
						name: "AppViewNotAuthorized",
						description:
							"The acting account has not published this AppView as authorized to act for it.",
					},
					{
						name: "AuthRequired",
						description: "Missing, malformed, or unverifiable service auth.",
					},
					{
						name: "CommunityCredentialsUnrecoverable",
						description:
							"The AppView cannot write to the community's repo and could not repair its own access.",
					},
					{
						name: "Forbidden",
						description:
							"The caller lacks the permission this method requires.",
					},
					{
						name: "InvalidRequest",
						description: "A parameter or body field was missing or malformed.",
					},
					{
						name: "NotCommunityHub",
						description:
							"This AppView does not administer the community; the hub field names the one that does.",
					},
					{
						name: "PdsUnavailable",
						description:
							"The PDS this operation needs is unreachable or is not a PDS.",
					},
					{
						name: "UpstreamFailure",
						description: "A service outside this AppView failed.",
					},
				],
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
				errors: [
					{
						name: "AppViewNotAuthorized",
						description:
							"The acting account has not published this AppView as authorized to act for it.",
					},
					{
						name: "AuthRequired",
						description: "Missing, malformed, or unverifiable service auth.",
					},
					{
						name: "CommunityCredentialsUnrecoverable",
						description:
							"The AppView cannot write to the community's repo and could not repair its own access.",
					},
					{
						name: "Forbidden",
						description:
							"The caller lacks the permission this method requires.",
					},
					{
						name: "InvalidRequest",
						description: "A parameter or body field was missing or malformed.",
					},
					{
						name: "NotCommunityHub",
						description:
							"This AppView does not administer the community; the hub field names the one that does.",
					},
					{
						name: "PdsUnavailable",
						description:
							"The PDS this operation needs is unreachable or is not a PDS.",
					},
					{
						name: "UpstreamFailure",
						description: "A service outside this AppView failed.",
					},
				],
			},
		},
	},
];
