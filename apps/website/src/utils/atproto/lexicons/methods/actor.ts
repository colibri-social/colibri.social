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
					preferredBadge: { type: "string" },
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
				errors: [
					{
						name: "AuthRequired",
						description: "Missing, malformed, or unverifiable service auth.",
					},
				],
			},
			communityView: {
				type: "object",
				description:
					"A community summary as seen from the member's perspective.",
				required: ["name", "requiresApprovalToJoin"],
				properties: {
					name: { type: "string" },
					picture: { type: "blob" },
					banner: { type: "blob" },
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
				errors: [
					{
						name: "AuthRequired",
						description: "Missing, malformed, or unverifiable service auth.",
					},
				],
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
				errors: [
					{
						name: "AuthRequired",
						description: "Missing, malformed, or unverifiable service auth.",
					},
					{
						name: "InvalidState",
						description: "The given state is not one of the accepted values.",
					},
				],
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.actor.getDeletionStatus",
		defs: {
			main: {
				type: "query",
				description:
					"Reports whether the authenticated user's Colibri data can be deleted, and how much data deletion would remove.",
				output: {
					encoding: "application/json",
					schema: {
						type: "object",
						required: ["soleOwnedCommunities", "counts"],
						properties: {
							soleOwnedCommunities: {
								type: "array",
								description:
									"Communities the user is the only owner of. Deletion is blocked while this is non-empty.",
								items: { type: "ref", ref: "#soleOwnedCommunity" },
							},
							counts: { type: "ref", ref: "#deletionCounts" },
							pdsAccountPage: {
								type: "string",
								format: "uri",
								description:
									"The account page the caller's PDS serves at /account, when it serves one. Absent otherwise.",
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
			soleOwnedCommunity: {
				type: "object",
				required: ["uri", "name", "memberCount"],
				properties: {
					uri: { type: "string", format: "at-uri" },
					name: { type: "string" },
					memberCount: { type: "integer" },
				},
			},
			deletionCounts: {
				type: "object",
				description: "Row counts the AppView holds for the authenticated user.",
				required: [
					"records",
					"notifications",
					"pushSubscriptions",
					"invitations",
				],
				properties: {
					records: { type: "integer" },
					notifications: { type: "integer" },
					pushSubscriptions: { type: "integer" },
					invitations: { type: "integer" },
				},
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.actor.deleteAccount",
		defs: {
			main: {
				type: "procedure",
				description:
					"Deletes everything the AppView holds for the authenticated user.",
				output: {
					encoding: "application/json",
					schema: {
						type: "object",
						required: ["deleted"],
						properties: {
							deleted: { type: "ref", ref: "#deletedCounts" },
						},
					},
				},
				errors: [
					{
						name: "AuthRequired",
						description: "Missing, malformed, or unverifiable service auth.",
					},
					{
						name: "InvalidState",
						description: "The request is not valid for the current state.",
					},
				],
			},
			deletedCounts: {
				type: "object",
				description: "What the purge removed, per storage area.",
				required: [
					"recordData",
					"communityRecords",
					"notifications",
					"pushSubscriptions",
					"userState",
					"invitations",
					"dismissedApplications",
				],
				properties: {
					recordData: { type: "integer" },
					communityRecords: { type: "integer" },
					notifications: { type: "integer" },
					pushSubscriptions: { type: "integer" },
					userState: { type: "integer" },
					invitations: { type: "integer" },
					dismissedApplications: { type: "integer" },
				},
			},
		},
	},
];
