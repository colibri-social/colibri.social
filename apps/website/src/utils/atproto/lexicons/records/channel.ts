import type { LexiconDoc } from "@atproto/lexicon";
import { RECORD_IDs } from "../ids.ts";

export const channelRecordDocs: LexiconDoc[] = [
	{
		lexicon: 1,
		id: RECORD_IDs.CHANNEL,
		revision: 5,
		defs: {
			main: {
				type: "record",
				key: "tid",
				description: "A channel that belongs to a category on Colibri.",
				record: {
					required: ["name", "type", "category", "community"],
					type: "object",
					properties: {
						$type: {
							type: "string",
							description: "The type of the record.",
							format: "nsid",
						},
						name: {
							type: "string",
							description: "The name of the channel.",
							maxLength: 32,
							minLength: 1,
							default: "New channel",
						},
						description: {
							type: "string",
							description: "A description of the channel.",
							maxLength: 256,
							default: "",
						},
						type: {
							type: "string",
							description:
								"The type of the channel. Colibri provides social.colibri.channel.text, social.colibri.channel.forum, social.colibri.channel.link, and social.colibri.channel.voice.",
							format: "nsid",
						},
						category: {
							type: "string",
							description: "The category this channel belongs to.",
							format: "record-key",
						},
						community: {
							type: "string",
							description:
								"The record key of the community this channel belongs to.",
							format: "record-key",
						},
						ownerOnly: {
							type: "boolean",
							description:
								"Whether the owner of the community is the only one allowed to post in the channel or not.",
							default: false,
						},
						allowedRoles: {
							type: "array",
							description:
								"Role record-keys allowed to post in this channel. Empty/absent means no role restriction.",
							items: { type: "string", format: "record-key" },
						},
						allowedMembers: {
							type: "array",
							description:
								"Member DIDs explicitly allowed to post in this channel, in addition to allowedRoles.",
							items: { type: "string", format: "did" },
						},
						linkEmbeds: {
							type: "boolean",
							description:
								"Whether link previews are displayed in this channel. Absent means the community default applies.",
						},
						migratedFrom: {
							type: "string",
							format: "at-uri",
							description:
								"Set on a channel created by migrating a legacy community. Points at the legacy channel record this one replaces, so message history for the old channel can be surfaced here.",
						},
					},
				},
			},
		},
	},
	{
		lexicon: 1,
		id: RECORD_IDs.CHANNEL_READ_CURSOR,
		revision: 1,
		defs: {
			main: {
				type: "record",
				description:
					"A read cursor for a Colibri channel, indicating the last read message by a user.",
				key: "tid",
				record: {
					required: ["channel", "cursor"],
					type: "object",
					properties: {
						$type: {
							type: "string",
							description: "The type of the record.",
							format: "nsid",
						},
						channel: {
							type: "string",
							description: "The channel this message was sent in.",
							format: "at-uri",
						},
						cursor: {
							type: "string",
							description: "The timestamp the channel was last read at.",
							format: "datetime",
						},
					},
				},
			},
		},
	},
];
