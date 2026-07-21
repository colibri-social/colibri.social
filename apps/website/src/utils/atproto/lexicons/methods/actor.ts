import type { LexiconDoc } from "@atproto/lexicon";

export const actorMethodDocs: LexiconDoc[] = [
	{
		lexicon: 1,
		id: "social.colibri.actor.defs",
		defs: {
			actorView: {
				type: "object",
				description: "A hydrated Colibri actor: identity plus profile data.",
				required: ["did", "handle", "data"],
				properties: {
					did: { type: "string", format: "did" },
					handle: { type: "string", format: "handle" },
					data: { type: "ref", ref: "#actorData" },
				},
			},
			actorData: {
				type: "object",
				description: "The profile and presence data for a Colibri actor.",
				required: [
					"displayName",
					"isBot",
					"onlineState",
					"syncBluesky",
					"status",
				],
				properties: {
					displayName: { type: "string" },
					avatar: { type: "blob" },
					banner: { type: "blob" },
					description: { type: "string" },
					isBot: { type: "boolean" },
					onlineState: {
						type: "string",
						knownValues: ["online", "away", "dnd", "offline"],
					},
					syncBluesky: { type: "boolean" },
					theme: { type: "ref", ref: "#profileTheme" },
					status: { type: "ref", ref: "#actorStatus" },
				},
			},
			actorStatus: {
				type: "object",
				description: "A user's Colibri status line.",
				required: ["text"],
				properties: {
					text: { type: "string" },
					emoji: { type: "string" },
				},
			},
			profileTheme: {
				type: "object",
				description: "Colibri-only profile theming.",
				properties: {
					accentColor: { type: "string" },
					gradient: { type: "ref", ref: "#profileGradient" },
					bannerColor: { type: "string" },
				},
			},
			profileGradient: {
				type: "object",
				description: "Two-color gradient profile theme.",
				properties: {
					primary: { type: "string" },
					secondary: { type: "string" },
				},
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.actor.getData",
		defs: {
			main: {
				type: "query",
				description:
					"Resolves an identifier (DID or handle) to its hydrated Colibri actor data.",
				parameters: {
					type: "params",
					required: ["identifier"],
					properties: {
						identifier: {
							type: "string",
							description: "The DID or handle to resolve.",
						},
					},
				},
				output: {
					encoding: "application/json",
					schema: {
						type: "ref",
						ref: "social.colibri.actor.defs#actorView",
					},
				},
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.actor.listCommunities",
		defs: {
			main: {
				type: "query",
				description:
					"Lists the communities the authenticated user is a member of, in their preferred sidebar order.",
				output: {
					encoding: "application/json",
					schema: {
						type: "object",
						required: ["communities"],
						properties: {
							communities: {
								type: "array",
								items: { type: "ref", ref: "#communityView" },
							},
						},
					},
				},
			},
			communityView: {
				type: "object",
				description:
					"A community summary as seen from the member's perspective.",
				required: ["name", "requiresApprovalToJoin"],
				properties: {
					name: { type: "string" },
					picture: { type: "blob" },
					description: { type: "string" },
					categoryOrder: {
						type: "array",
						items: { type: "string", format: "record-key" },
					},
					requiresApprovalToJoin: { type: "boolean" },
					uri: { type: "string", format: "at-uri" },
					isLegacy: { type: "boolean" },
					isOwner: { type: "boolean" },
				},
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.actor.listMutes",
		defs: {
			main: {
				type: "query",
				description: "Lists the subjects the authenticated user has muted.",
				output: {
					encoding: "application/json",
					schema: {
						type: "object",
						required: ["mutes"],
						properties: {
							mutes: {
								type: "array",
								items: { type: "ref", ref: "#mute" },
							},
						},
					},
				},
			},
			mute: {
				type: "object",
				required: ["uri", "subject"],
				properties: {
					uri: {
						type: "string",
						format: "at-uri",
						description: "AT-URI of the mute record.",
					},
					subject: {
						type: "string",
						description: "The muted subject (a DID).",
					},
				},
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.actor.getNotificationPreference",
		defs: {
			main: {
				type: "query",
				description:
					"Returns the authenticated user's notification level, defaulting to 'all' when they haven't set one.",
				output: {
					encoding: "application/json",
					schema: {
						type: "object",
						required: ["level"],
						properties: {
							level: {
								type: "string",
								knownValues: ["all", "mentionsAndReplies"],
							},
						},
					},
				},
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.actor.setState",
		defs: {
			main: {
				type: "procedure",
				description: "Sets the authenticated user's online presence state.",
				parameters: {
					type: "params",
					required: ["state"],
					properties: {
						state: {
							type: "string",
							description: "The presence state to set.",
							knownValues: ["online", "away", "dnd", "offline"],
						},
					},
				},
				output: {
					encoding: "application/json",
					schema: {
						type: "object",
						required: ["onlineState"],
						properties: {
							onlineState: { type: "string" },
						},
					},
				},
			},
		},
	},
];
