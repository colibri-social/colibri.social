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
					width: {
						type: "integer",
						description:
							"Pixel width declared by the source page, when it publishes one.",
					},
					height: {
						type: "integer",
						description:
							"Pixel height declared by the source page, when it publishes one.",
					},
				},
			},
			embedVideo: {
				type: "object",
				description:
					"A playable clip referenced by link metadata, for pages that publish their animation as a video rather than an animated image.",
				required: ["url"],
				properties: {
					url: { type: "string", format: "uri" },
					mimeType: {
						type: "string",
						description:
							"The clip's media type, always one the AppView will proxy (video/mp4 or video/webm).",
					},
					width: {
						type: "integer",
						description:
							"Pixel width declared by the source page, when it publishes one.",
					},
					height: {
						type: "integer",
						description:
							"Pixel height declared by the source page, when it publishes one.",
					},
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
							video: {
								type: "array",
								items: {
									type: "ref",
									ref: "social.colibri.embed.defs#embedVideo",
								},
							},
							largeImage: { type: "boolean" },
						},
					},
				},
				errors: [
					{
						name: "AuthRequired",
						description: "Missing, malformed, or unverifiable service auth.",
					},
					{
						name: "InvalidRequest",
						description: "A parameter or body field was missing or malformed.",
					},
				],
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
				errors: [
					{
						name: "NotAnImage",
						description:
							"The linked resource is not an image type the AppView serves.",
					},
					{
						name: "RateLimited",
						description: "The caller exceeded its rate budget.",
					},
				],
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.embed.getVideo",
		defs: {
			main: {
				type: "query",
				description:
					"Proxies and returns an external embed video, guarding against SSRF. Honours byte ranges.",
				parameters: {
					type: "params",
					required: ["url"],
					properties: {
						url: { type: "string", format: "uri" },
					},
				},
				output: {
					encoding: "*/*",
					description: "The proxied video bytes (Content-Type is video/*).",
				},
				errors: [
					{
						name: "NotAVideo",
						description:
							"The linked resource is not a video type the AppView serves.",
					},
					{
						name: "RateLimited",
						description: "The caller exceeded its rate budget.",
					},
				],
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
				errors: [
					{
						name: "AuthRequired",
						description: "Missing, malformed, or unverifiable service auth.",
					},
					{
						name: "InvalidRequest",
						description: "A parameter or body field was missing or malformed.",
					},
				],
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
				errors: [
					{
						name: "AuthRequired",
						description: "Missing, malformed, or unverifiable service auth.",
					},
				],
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
				errors: [
					{
						name: "AuthRequired",
						description: "Missing, malformed, or unverifiable service auth.",
					},
				],
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
