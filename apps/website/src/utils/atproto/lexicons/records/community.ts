import type { LexiconDoc } from "@atproto/lexicon";
import { RECORD_IDs } from "../ids.ts";

export const communityRecordDocs: LexiconDoc[] = [
	{
		lexicon: 1,
		id: RECORD_IDs.COMMUNITY,
		revision: 5,
		defs: {
			main: {
				type: "record",
				description:
					'A community, or "server", is where users join to interact with each other on Colibri. Singleton record on the community DID\'s repo.',
				key: "literal:self",
				record: {
					type: "object",
					required: [
						"name",
						"description",
						"categoryOrder",
						"requiresApprovalToJoin",
					],
					properties: {
						$type: {
							type: "string",
							description: "The type of the record.",
							format: "nsid",
						},
						name: {
							type: "string",
							description: "The name of the community.",
							maxLength: 32,
							minLength: 1,
							default: "New Community",
						},
						description: {
							type: "string",
							description: "A description of the community.",
							maxLength: 256,
							default: "",
						},
						picture: {
							type: "blob",
							description:
								"An image for the community that will be shown to users.",
							accept: ["image/jpeg", "image/png", "image/gif", "image/webp"],
						},
						banner: {
							type: "blob",
							description:
								"A banner for the community that will be shown to users.",
							accept: ["image/jpeg", "image/png", "image/gif", "image/webp"],
						},
						categoryOrder: {
							type: "array",
							description: "The order of the categories in this community.",
							items: {
								type: "string",
								format: "record-key",
								description: "A category in this community.",
							},
						},
						requiresApprovalToJoin: {
							type: "boolean",
							default: true,
							description:
								"Whether users can chat in this community without the owner having to create an acknowledgement record.",
						},
						linkEmbeds: {
							type: "boolean",
							default: true,
							description:
								"Whether link previews are displayed in this community by default. Individual channels may override this.",
						},
						migratedTo: {
							type: "string",
							format: "at-uri",
							description:
								"Set on a legacy community record once it has been migrated. Points at the new community record that replaces it; consumers treat this community as retired and hide it.",
						},
						migratedFrom: {
							type: "string",
							format: "at-uri",
							description:
								"Set on a community created by migrating a legacy community. Points at the legacy community record this one replaces.",
						},
						appview: {
							type: "string",
							format: "did",
							description:
								"DID of the AppView that administers this community and acts as its off-protocol hub (Humming presence relay and voice SFU host). Written by the credential-holding AppView. Consumers that find this field absent fall back to did:web:api.colibri.social.",
						},
					},
				},
			},
		},
	},
];
