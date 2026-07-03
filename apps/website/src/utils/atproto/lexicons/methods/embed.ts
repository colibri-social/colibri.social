import type { LexiconDoc, LexXrpcBody } from "@atproto/lexicon";

const gifPageOutput: LexXrpcBody = {
	encoding: "application/json",
	schema: {
		type: "object",
		required: ["items", "page", "hasNext"],
		properties: {
			items: {
				type: "array",
				items: { type: "ref", ref: "social.colibri.embed.defs#gifItem" },
			},
			page: { type: "integer" },
			hasNext: { type: "boolean" },
		},
	},
};

export const embedMethodDocs: LexiconDoc[] = [
	{
		lexicon: 1,
		id: "social.colibri.embed.defs",
		defs: {
			gifItem: {
				type: "object",
				description: "A single GIF result.",
				required: ["id", "mediaUrl", "previewUrl"],
				properties: {
					id: { type: "string" },
					mediaUrl: { type: "string", format: "uri" },
					previewUrl: { type: "string", format: "uri" },
					width: { type: "integer" },
					height: { type: "integer" },
				},
			},
			embedImage: {
				type: "object",
				description: "An image referenced by link metadata.",
				required: ["url"],
				properties: {
					url: { type: "string", format: "uri" },
					alt: { type: "string" },
				},
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.embed.getMetadata",
		defs: {
			main: {
				type: "query",
				description:
					"Fetches Open Graph-style link preview metadata for a URL.",
				parameters: {
					type: "params",
					required: ["uri"],
					properties: {
						uri: { type: "string" },
					},
				},
				output: {
					encoding: "application/json",
					schema: {
						type: "object",
						required: ["image"],
						properties: {
							title: { type: "string" },
							description: { type: "string" },
							siteName: { type: "string" },
							themeColor: { type: "string" },
							image: {
								type: "array",
								items: {
									type: "ref",
									ref: "social.colibri.embed.defs#embedImage",
								},
							},
							largeImage: { type: "boolean" },
						},
					},
				},
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.embed.getImage",
		defs: {
			main: {
				type: "query",
				description:
					"Proxies and returns an external image, guarding against SSRF.",
				parameters: {
					type: "params",
					required: ["url"],
					properties: {
						url: { type: "string", format: "uri" },
					},
				},
				output: {
					encoding: "*/*",
					description: "The proxied image bytes (Content-Type is image/*).",
				},
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.embed.searchGifs",
		defs: {
			main: {
				type: "query",
				description: "Searches GIFs by query.",
				parameters: {
					type: "params",
					required: ["q"],
					properties: {
						q: { type: "string" },
						page: { type: "integer" },
					},
				},
				output: gifPageOutput,
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.embed.trendingGifs",
		defs: {
			main: {
				type: "query",
				description: "Returns trending GIFs.",
				parameters: {
					type: "params",
					properties: {
						page: { type: "integer" },
					},
				},
				output: gifPageOutput,
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.embed.gifCategories",
		defs: {
			main: {
				type: "query",
				description: "Lists GIF categories for the picker.",
				output: {
					encoding: "application/json",
					schema: {
						type: "object",
						required: ["categories"],
						properties: {
							categories: {
								type: "array",
								items: { type: "ref", ref: "#gifCategory" },
							},
						},
					},
				},
			},
			gifCategory: {
				type: "object",
				required: ["name"],
				properties: {
					name: { type: "string" },
					query: { type: "string" },
					previewUrl: { type: "string", format: "uri" },
				},
			},
		},
	},
];
