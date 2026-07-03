import type { LexiconDoc } from "@atproto/lexicon";
import { RECORD_IDs } from "../ids.ts";

export const communityRecordDocs: LexiconDoc[] = [
	{
		lexicon: 1,
		id: RECORD_IDs.COMMUNITY,
		revision: 3,
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
							accept: ["image/jpeg", "image/png", "image/gif"],
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
					},
				},
			},
		},
	},
];
