import type { LexiconDoc, LexXrpcBody } from "@atproto/lexicon";

const uriResponse: LexXrpcBody = {
	encoding: "application/json",
	schema: {
		type: "object",
		required: ["uri"],
		properties: { uri: { type: "string", format: "at-uri" } },
	},
};

const didCommunityResponse: LexXrpcBody = {
	encoding: "application/json",
	schema: {
		type: "object",
		required: ["did", "community"],
		properties: {
			did: { type: "string", format: "did" },
			community: { type: "string", format: "at-uri" },
		},
	},
};

const didHandleResponse: LexXrpcBody = {
	encoding: "application/json",
	schema: {
		type: "object",
		required: ["did", "handle"],
		properties: {
			did: { type: "string", format: "did" },
			handle: { type: "string", format: "handle" },
		},
	},
};

export const communityMethodDocs: LexiconDoc[] = [
	{
		lexicon: 1,
		id: "social.colibri.community.defs",
		defs: {
			communityInfo: {
				type: "object",
				description: "Core community record data, hydrated with its AT-URI.",
				required: [
					"uri",
					"name",
					"description",
					"categoryOrder",
					"requiresApprovalToJoin",
					"appview",
				],
				properties: {
					uri: { type: "string", format: "at-uri" },
					name: { type: "string" },
					description: { type: "string" },
					picture: { type: "blob" },
					banner: { type: "blob" },
					categoryOrder: {
						type: "array",
						items: { type: "string", format: "at-uri" },
					},
					requiresApprovalToJoin: { type: "boolean" },
					appview: { type: "string", format: "did" },
				},
			},
			categoryView: {
				type: "object",
				required: ["uri", "name", "channelOrder"],
				properties: {
					uri: { type: "string", format: "at-uri" },
					name: { type: "string" },
					channelOrder: {
						type: "array",
						items: { type: "string", format: "at-uri" },
					},
				},
			},
			channelView: {
				type: "object",
				required: ["uri", "name", "type", "category"],
				properties: {
					uri: { type: "string", format: "at-uri" },
					name: { type: "string" },
					type: { type: "string", format: "nsid" },
					category: { type: "string", format: "at-uri" },
					description: { type: "string" },
					ownerOnly: { type: "boolean" },
					allowedRoles: {
						type: "array",
						items: { type: "string", format: "at-uri" },
					},
					allowedMembers: {
						type: "array",
						items: { type: "string", format: "did" },
					},
				},
			},
			roleView: {
				type: "object",
				required: ["uri", "name", "permissions", "position"],
				properties: {
					uri: { type: "string", format: "at-uri" },
					name: { type: "string" },
					color: { type: "string" },
					permissions: { type: "array", items: { type: "string" } },
					position: { type: "integer" },
					hoisted: { type: "boolean" },
					mentionable: { type: "boolean" },
					protected: { type: "boolean" },
					channelOverrides: {
						type: "array",
						items: { type: "ref", ref: "#channelOverrideView" },
					},
				},
			},
			channelOverrideView: {
				type: "object",
				required: ["channel"],
				properties: {
					channel: { type: "string", format: "at-uri" },
					allow: { type: "array", items: { type: "string" } },
					deny: { type: "array", items: { type: "string" } },
				},
			},
			memberView: {
				type: "object",
				description: "A community member, hydrated with their actor data.",
				required: ["did", "handle", "roles", "data"],
				properties: {
					did: { type: "string", format: "did" },
					handle: { type: "string", format: "handle" },
					roles: {
						type: "array",
						items: { type: "string", format: "at-uri" },
					},
					vc: {
						type: "string",
						format: "at-uri",
						description:
							"AT-URI of the voice channel the member is currently connected to, if any.",
					},
					vcMuted: {
						type: "boolean",
						description:
							"Whether the member's microphone is muted in the voice channel.",
					},
					vcDeafened: {
						type: "boolean",
						description: "Whether the member is deafened in the voice channel.",
					},
					vcServerMuted: {
						type: "boolean",
						description:
							"Whether the member has been server-muted by a moderator in the voice channel.",
					},
					vcServerDeafened: {
						type: "boolean",
						description:
							"Whether the member has been server-deafened by a moderator in the voice channel.",
					},
					data: { type: "ref", ref: "social.colibri.actor.defs#actorData" },
				},
			},
			applicationView: {
				type: "object",
				description: "A pending or dismissed membership application.",
				required: ["did", "handle", "membership", "createdAt", "data"],
				properties: {
					did: { type: "string", format: "did" },
					handle: { type: "string", format: "handle" },
					membership: { type: "string", format: "at-uri" },
					createdAt: { type: "string", format: "datetime" },
					data: { type: "ref", ref: "social.colibri.actor.defs#actorData" },
				},
			},
			invitationView: {
				type: "object",
				description: "An invitation with its creator as a bare DID.",
				required: ["code", "community", "createdBy", "active"],
				properties: {
					code: { type: "string" },
					community: { type: "string", format: "at-uri" },
					createdBy: { type: "string", format: "did" },
					active: { type: "boolean" },
				},
			},
			invitationProfileView: {
				type: "object",
				description: "An invitation with its creator hydrated as an actor.",
				required: ["code", "community", "createdBy", "active"],
				properties: {
					code: { type: "string" },
					community: { type: "string", format: "at-uri" },
					createdBy: {
						type: "ref",
						ref: "social.colibri.actor.defs#actorView",
					},
					active: { type: "boolean" },
				},
			},
			resolvedInvitationView: {
				type: "object",
				description:
					"An invitation hydrated with its community's public details, for the invite accept screen.",
				required: [
					"code",
					"community",
					"createdBy",
					"active",
					"name",
					"memberCount",
					"onlineCount",
					"requiresApprovalToJoin",
				],
				properties: {
					code: { type: "string" },
					community: { type: "string", format: "at-uri" },
					createdBy: { type: "string", format: "did" },
					active: { type: "boolean" },
					name: { type: "string" },
					picture: { type: "blob" },
					banner: { type: "blob" },
					memberCount: { type: "integer" },
					onlineCount: { type: "integer" },
					requiresApprovalToJoin: { type: "boolean" },
				},
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.community.create",
		defs: {
			main: {
				type: "procedure",
				description:
					"Creates a community, bootstrapping its DID repo with a default category, channel, owner role, and member record.",
				parameters: {
					type: "params",
					required: ["name"],
					properties: {
						name: { type: "string" },
						description: { type: "string" },
						requiresApprovalToJoin: { type: "boolean" },
						pds: {
							type: "string",
							description: "Bring-your-own PDS endpoint.",
						},
						identifier: {
							type: "string",
							description: "Bring-your-own DID or handle.",
						},
						password: {
							type: "string",
							description: "Bring-your-own account password.",
						},
					},
				},
				input: {
					encoding: "multipart/form-data",
					description:
						"Optional community image blobs, as `picture` and `banner` parts.",
				},
				output: {
					encoding: "application/json",
					schema: {
						type: "object",
						required: [
							"did",
							"community",
							"category",
							"channel",
							"ownerRole",
							"member",
						],
						properties: {
							did: { type: "string", format: "did" },
							community: { type: "string", format: "at-uri" },
							category: { type: "string", format: "at-uri" },
							channel: { type: "string", format: "at-uri" },
							ownerRole: { type: "string", format: "at-uri" },
							member: { type: "string", format: "at-uri" },
						},
					},
				},
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.community.migrate",
		defs: {
			main: {
				type: "procedure",
				description:
					"Migrates a source record into a fresh community, cloning its structure and importing its members. The 'kind' discriminator selects the migration; today only legacy communities are supported, but the endpoint is designed to host future migrations. Provisioning mirrors community.create (managed when no PDS credentials are supplied, bring-your-own otherwise).",
				parameters: {
					type: "params",
					required: ["kind", "source"],
					properties: {
						kind: {
							type: "string",
							description:
								"The migration to run. 'legacy-community' migrates a pre-rework community record.",
							knownValues: ["legacy-community"],
						},
						source: {
							type: "string",
							format: "at-uri",
							description:
								"The record being migrated (e.g. the legacy community).",
						},
						name: { type: "string" },
						description: { type: "string" },
						requiresApprovalToJoin: { type: "boolean" },
						pds: {
							type: "string",
							description: "Bring-your-own PDS endpoint.",
						},
						identifier: {
							type: "string",
							description: "Bring-your-own DID or handle.",
						},
						password: {
							type: "string",
							description: "Bring-your-own account password.",
						},
					},
				},
				input: {
					encoding: "multipart/form-data",
					description:
						"Optional replacement community picture blob, as a `picture` part. Migrated communities have no banner.",
				},
				output: {
					encoding: "application/json",
					schema: {
						type: "object",
						required: ["did", "community", "channelMap"],
						properties: {
							did: { type: "string", format: "did" },
							community: { type: "string", format: "at-uri" },
							channelMap: {
								type: "array",
								description:
									"Maps each cloned channel from its old AT-URI to its new AT-URI.",
								items: {
									type: "ref",
									ref: "social.colibri.community.migrate#channelMapping",
								},
							},
						},
					},
				},
			},
			channelMapping: {
				type: "object",
				description: "A single channel's old AT-URI mapped to its new AT-URI.",
				required: ["old", "new"],
				properties: {
					old: { type: "string", format: "at-uri" },
					new: { type: "string", format: "at-uri" },
				},
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.community.update",
		defs: {
			main: {
				type: "procedure",
				description:
					"Updates a community's metadata and optionally its picture and banner.",
				parameters: {
					type: "params",
					required: ["community"],
					properties: {
						community: { type: "string", format: "at-uri" },
						name: { type: "string" },
						description: { type: "string" },
						requiresApprovalToJoin: { type: "boolean" },
						removePicture: {
							type: "boolean",
							description:
								"Drops the community's current picture. Cannot be combined with a new picture blob.",
						},
						removeBanner: {
							type: "boolean",
							description:
								"Drops the community's current banner. Cannot be combined with a new banner blob.",
						},
					},
				},
				input: {
					encoding: "multipart/form-data",
					description:
						"Optional replacement community image blobs, as `picture` and `banner` parts.",
				},
				output: uriResponse,
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.community.delete",
		defs: {
			main: {
				type: "procedure",
				description: "Deletes a community.",
				parameters: {
					type: "params",
					required: ["community"],
					properties: {
						community: { type: "string", format: "at-uri" },
					},
				},
				output: {
					encoding: "application/json",
					schema: {
						type: "object",
						required: ["did"],
						properties: { did: { type: "string", format: "did" } },
					},
				},
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.community.getData",
		defs: {
			main: {
				type: "query",
				description:
					"Returns the full state of a community: metadata, categories, channels, roles, and members.",
				parameters: {
					type: "params",
					required: ["community"],
					properties: {
						community: { type: "string", format: "at-uri" },
					},
				},
				output: {
					encoding: "application/json",
					schema: {
						type: "object",
						required: [
							"community",
							"categories",
							"channels",
							"roles",
							"members",
							"did",
						],
						properties: {
							community: {
								type: "ref",
								ref: "social.colibri.community.defs#communityInfo",
							},
							categories: {
								type: "array",
								items: {
									type: "ref",
									ref: "social.colibri.community.defs#categoryView",
								},
							},
							channels: {
								type: "array",
								items: {
									type: "ref",
									ref: "social.colibri.community.defs#channelView",
								},
							},
							roles: {
								type: "array",
								items: {
									type: "ref",
									ref: "social.colibri.community.defs#roleView",
								},
							},
							members: {
								type: "array",
								items: {
									type: "ref",
									ref: "social.colibri.community.defs#memberView",
								},
							},
							did: { type: "string", format: "did" },
						},
					},
				},
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.community.listCategories",
		defs: {
			main: {
				type: "query",
				description: "Lists the categories of a community.",
				parameters: {
					type: "params",
					required: ["community"],
					properties: {
						community: { type: "string", format: "at-uri" },
					},
				},
				output: {
					encoding: "application/json",
					schema: {
						type: "object",
						required: ["categories"],
						properties: {
							categories: {
								type: "array",
								items: {
									type: "ref",
									ref: "social.colibri.community.defs#categoryView",
								},
							},
						},
					},
				},
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.community.listChannels",
		defs: {
			main: {
				type: "query",
				description: "Lists the channels of a community.",
				parameters: {
					type: "params",
					required: ["community"],
					properties: {
						community: { type: "string", format: "at-uri" },
					},
				},
				output: {
					encoding: "application/json",
					schema: {
						type: "object",
						required: ["channels"],
						properties: {
							channels: {
								type: "array",
								items: {
									type: "ref",
									ref: "social.colibri.community.defs#channelView",
								},
							},
						},
					},
				},
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.community.listMembers",
		defs: {
			main: {
				type: "query",
				description: "Lists the members of a community.",
				parameters: {
					type: "params",
					required: ["community"],
					properties: {
						community: { type: "string", format: "at-uri" },
					},
				},
				output: {
					encoding: "application/json",
					schema: {
						type: "object",
						required: ["members"],
						properties: {
							members: {
								type: "array",
								items: {
									type: "ref",
									ref: "social.colibri.community.defs#memberView",
								},
							},
						},
					},
				},
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.community.listRoles",
		defs: {
			main: {
				type: "query",
				description: "Lists the roles of a community.",
				parameters: {
					type: "params",
					required: ["community"],
					properties: {
						community: { type: "string", format: "at-uri" },
					},
				},
				output: {
					encoding: "application/json",
					schema: {
						type: "object",
						required: ["roles"],
						properties: {
							roles: {
								type: "array",
								items: {
									type: "ref",
									ref: "social.colibri.community.defs#roleView",
								},
							},
						},
					},
				},
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.community.listApplications",
		defs: {
			main: {
				type: "query",
				description:
					"Lists pending and dismissed membership applications for a community.",
				parameters: {
					type: "params",
					required: ["community"],
					properties: {
						community: { type: "string", format: "at-uri" },
					},
				},
				output: {
					encoding: "application/json",
					schema: {
						type: "object",
						required: ["applications", "dismissedApplications"],
						properties: {
							applications: {
								type: "array",
								items: {
									type: "ref",
									ref: "social.colibri.community.defs#applicationView",
								},
							},
							dismissedApplications: {
								type: "array",
								items: {
									type: "ref",
									ref: "social.colibri.community.defs#applicationView",
								},
							},
						},
					},
				},
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.community.listBannedUsers",
		defs: {
			main: {
				type: "query",
				description: "Lists the banned users of a community.",
				parameters: {
					type: "params",
					required: ["community"],
					properties: {
						community: { type: "string", format: "at-uri" },
					},
				},
				output: {
					encoding: "application/json",
					schema: {
						type: "object",
						required: ["users"],
						properties: {
							users: {
								type: "array",
								items: {
									type: "ref",
									ref: "social.colibri.actor.defs#actorView",
								},
							},
						},
					},
				},
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.community.approveMembership",
		defs: {
			main: {
				type: "procedure",
				description:
					"Approves a pending membership application, minting the member record.",
				parameters: {
					type: "params",
					required: ["membership"],
					properties: {
						membership: { type: "string", format: "at-uri" },
					},
				},
				output: {
					encoding: "application/json",
					schema: {
						type: "object",
						required: ["did", "community"],
						properties: {
							did: { type: "string", format: "did" },
							community: { type: "string", format: "at-uri" },
							member: { type: "string", format: "at-uri" },
						},
					},
				},
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.community.dismissApplication",
		defs: {
			main: {
				type: "procedure",
				description: "Dismisses a membership application without approving it.",
				parameters: {
					type: "params",
					required: ["community", "did"],
					properties: {
						community: { type: "string", format: "at-uri" },
						did: { type: "string", format: "did" },
					},
				},
				output: didCommunityResponse,
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.community.undismissApplication",
		defs: {
			main: {
				type: "procedure",
				description: "Restores a previously dismissed membership application.",
				parameters: {
					type: "params",
					required: ["community", "did"],
					properties: {
						community: { type: "string", format: "at-uri" },
						did: { type: "string", format: "did" },
					},
				},
				output: didCommunityResponse,
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.community.registerCredentials",
		defs: {
			main: {
				type: "procedure",
				description:
					"Registers bring-your-own PDS credentials for a community DID.",
				parameters: {
					type: "params",
					required: ["did", "pds", "identifier", "password"],
					properties: {
						did: { type: "string", format: "did" },
						pds: { type: "string" },
						identifier: { type: "string" },
						password: { type: "string" },
					},
				},
				output: {
					encoding: "application/json",
					schema: {
						type: "object",
						required: ["did", "source"],
						properties: {
							did: { type: "string", format: "did" },
							source: { type: "string" },
						},
					},
				},
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.community.setMemberRoles",
		defs: {
			main: {
				type: "procedure",
				description: "Replaces the set of roles assigned to a member.",
				parameters: {
					type: "params",
					required: ["community", "member", "roles"],
					properties: {
						community: { type: "string", format: "at-uri" },
						member: { type: "string", format: "did" },
						roles: { type: "array", items: { type: "string" } },
					},
				},
				output: {
					encoding: "application/json",
					schema: {
						type: "object",
						required: ["did", "roles"],
						properties: {
							did: { type: "string", format: "did" },
							roles: {
								type: "array",
								items: { type: "string", format: "at-uri" },
							},
						},
					},
				},
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.community.reorderChannels",
		defs: {
			main: {
				type: "procedure",
				description: "Reorders the channels within a category.",
				parameters: {
					type: "params",
					required: ["category", "channelOrder"],
					properties: {
						category: { type: "string", format: "at-uri" },
						channelOrder: { type: "array", items: { type: "string" } },
					},
				},
				output: uriResponse,
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.community.reorderCategories",
		defs: {
			main: {
				type: "procedure",
				description: "Reorders the categories within a community.",
				parameters: {
					type: "params",
					required: ["community", "categoryOrder"],
					properties: {
						community: { type: "string", format: "at-uri" },
						categoryOrder: { type: "array", items: { type: "string" } },
					},
				},
				output: uriResponse,
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.community.banUser",
		defs: {
			main: {
				type: "procedure",
				description: "Bans a user from a community.",
				parameters: {
					type: "params",
					required: ["community", "identifier"],
					properties: {
						community: { type: "string", format: "at-uri" },
						identifier: {
							type: "string",
							description: "DID or handle of the user to ban.",
						},
					},
				},
				output: didHandleResponse,
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.community.unbanUser",
		defs: {
			main: {
				type: "procedure",
				description: "Lifts a ban on a user.",
				parameters: {
					type: "params",
					required: ["community", "identifier"],
					properties: {
						community: { type: "string", format: "at-uri" },
						identifier: {
							type: "string",
							description: "DID or handle of the user to unban.",
						},
					},
				},
				output: didHandleResponse,
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.community.kickUser",
		defs: {
			main: {
				type: "procedure",
				description: "Kicks a user from a community by DID or handle.",
				parameters: {
					type: "params",
					required: ["community", "identifier"],
					properties: {
						community: { type: "string", format: "at-uri" },
						identifier: {
							type: "string",
							description: "DID or handle of the user to kick.",
						},
					},
				},
				output: didHandleResponse,
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.community.kick",
		defs: {
			main: {
				type: "procedure",
				description: "Kicks a member from a community by member record.",
				parameters: {
					type: "params",
					required: ["community", "member"],
					properties: {
						community: { type: "string", format: "at-uri" },
						member: { type: "string", format: "at-uri" },
					},
				},
				output: didHandleResponse,
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.community.blockMessage",
		defs: {
			main: {
				type: "procedure",
				description: "Hides (moderates) a message within a community.",
				parameters: {
					type: "params",
					required: ["community", "message"],
					properties: {
						community: { type: "string", format: "at-uri" },
						message: { type: "string", format: "at-uri" },
					},
				},
				output: {
					encoding: "application/json",
					schema: {
						type: "object",
						required: ["message"],
						properties: {
							message: { type: "string", format: "at-uri" },
						},
					},
				},
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.community.createInvitation",
		defs: {
			main: {
				type: "procedure",
				description: "Creates an invitation code for a community.",
				parameters: {
					type: "params",
					required: ["community"],
					properties: {
						community: { type: "string", format: "at-uri" },
					},
				},
				output: {
					encoding: "application/json",
					schema: {
						type: "ref",
						ref: "social.colibri.community.defs#invitationView",
					},
				},
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.community.getInvitation",
		defs: {
			main: {
				type: "query",
				description:
					"Resolves an invitation code to its community, hydrated with the community's public details for the invite accept screen.",
				parameters: {
					type: "params",
					required: ["code"],
					properties: {
						code: { type: "string" },
					},
				},
				output: {
					encoding: "application/json",
					schema: {
						type: "ref",
						ref: "social.colibri.community.defs#resolvedInvitationView",
					},
				},
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.community.listInvitations",
		defs: {
			main: {
				type: "procedure",
				description: "Lists the active invitations of a community.",
				parameters: {
					type: "params",
					required: ["uri"],
					properties: {
						uri: { type: "string", format: "at-uri" },
					},
				},
				output: {
					encoding: "application/json",
					schema: {
						type: "object",
						required: ["codes"],
						properties: {
							codes: {
								type: "array",
								items: {
									type: "ref",
									ref: "social.colibri.community.defs#invitationProfileView",
								},
							},
						},
					},
				},
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.community.deleteInvitation",
		defs: {
			main: {
				type: "procedure",
				description: "Deletes an invitation code.",
				parameters: {
					type: "params",
					required: ["uri", "code"],
					properties: {
						uri: { type: "string", format: "at-uri" },
						code: { type: "string" },
					},
				},
				output: {
					encoding: "application/json",
					schema: {
						type: "object",
						required: ["code"],
						properties: { code: { type: "string" } },
					},
				},
			},
		},
	},
	{
		lexicon: 1,
		id: "social.colibri.community.leave",
		defs: {
			main: {
				type: "procedure",
				description:
					"Leaves a community, removing the authenticated user's membership.",
				parameters: {
					type: "params",
					required: ["community"],
					properties: {
						community: { type: "string", format: "at-uri" },
					},
				},
				output: {
					encoding: "application/json",
					schema: { type: "object", properties: {} },
				},
			},
		},
	},
];
