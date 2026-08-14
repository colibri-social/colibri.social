import type { JsonBlobRef } from "@atproto/lexicon";
import type { ColibriRichTextFacet } from "@colibri-social/lib";
import type { Message } from "./xrpc/social/colibri/channel/listMessages";

export type MessageRecordAttachment = {
	blob: JsonBlobRef;
	name?: string;
};

export type MessageRecord = {
	text: string;
	facets: Array<ColibriRichTextFacet>;
	channel: string;
	createdAt: string;
	edited: boolean;
	parent?: string;
	attachments?: Array<MessageRecordAttachment>;
	suppressedEmbeds?: Array<string>;
};

export const buildMessageRecord = (
	message: Message,
	fields: {
		text: string;
		facets: Array<ColibriRichTextFacet>;
		edited: boolean;
		suppressedEmbeds?: Array<string>;
	},
): MessageRecord => {
	const suppressed = fields.suppressedEmbeds ?? message.suppressedEmbeds ?? [];
	const attachments: Array<MessageRecordAttachment> = (
		message.attachments ?? []
	).map((attachment) => ({
		blob: attachment.blob,
		...(attachment.name !== undefined ? { name: attachment.name } : {}),
	}));

	return {
		text: fields.text,
		facets: fields.facets,
		channel: message.channel,
		createdAt: message.createdAt,
		edited: fields.edited,
		...(message.parent ? { parent: message.parent.uri } : {}),
		...(attachments.length > 0 ? { attachments } : {}),
		...(suppressed.length > 0 ? { suppressedEmbeds: suppressed } : {}),
	};
};
