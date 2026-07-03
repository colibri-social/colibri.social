import type { LexiconDoc } from "@atproto/lexicon";
import { RECORD_IDs } from "../ids.ts";

export const roleRecordDocs: LexiconDoc[] = [
	{
		lexicon: 1,
		id: RECORD_IDs.ROLE,
		revision: 2,
		defs: {
			main: {
				type: "record",
				description:
					"A named bundle of permissions assignable to community members. Lives on the community repo.",
				key: "tid",
				record: {
					type: "object",
					required: ["name", "permissions", "position"],
					properties: {
						$type: {
							type: "string",
							description: "The type of the record.",
							format: "nsid",
						},
						name: {
							type: "string",
							description: "Display name of the role.",
							minLength: 1,
							maxLength: 32,
						},
						color: {
							type: "string",
							description:
								"Optional hex color displayed alongside the role (e.g. '#ff8800').",
						},
						permissions: {
							type: "array",
							description: "Permission identifiers granted by this role.",
							items: {
								type: "string",
								description:
									"A namespaced permission identifier. See AppView permission catalog.",
							},
						},
						position: {
							type: "integer",
							description:
								"Hierarchy position. Higher values sit higher in the role hierarchy and outrank lower values.",
						},
						hoisted: {
							type: "boolean",
							description:
								"Whether members of this role are displayed separately in the member list.",
							default: false,
						},
						mentionable: {
							type: "boolean",
							description:
								"Whether `@role`-style mentions resolve to this role.",
							default: false,
						},
						protected: {
							type: "boolean",
							description:
								"Whether this role is protected from modification or deletion. Set true for system-managed roles (e.g. the bootstrap 'Owner' role minted by `community.create`).",
							default: false,
						},
						channelOverrides: {
							type: "array",
							description: "Per-channel permission overrides for this role.",
							items: {
								type: "ref",
								ref: "#channelOverride",
							},
						},
					},
				},
			},
			channelOverride: {
				type: "object",
				description: "Allow / deny lists scoped to a single channel.",
				required: ["channel"],
				properties: {
					channel: {
						type: "string",
						description: "The channel this override applies to.",
						format: "record-key",
					},
					allow: {
						type: "array",
						description: "Permissions granted within this channel.",
						items: { type: "string" },
					},
					deny: {
						type: "array",
						description:
							"Permissions denied within this channel. Deny wins over base permissions and overrides allow.",
						items: { type: "string" },
					},
				},
			},
		},
	},
];
