import { asDatetime, asUri, COLLECTIONS } from "./lexicons";
import type {
	Facet,
	MessageAttachment,
	MessageRecord,
	ReactionRecord,
	RecordRef,
} from "./views";

export type MessageRecordInput = {
	text: string;
	facets?: ReadonlyArray<Facet>;
	createdAt: string;
	updatedAt?: string;
	parent?: RecordRef;
	attachments?: ReadonlyArray<MessageAttachment>;
	suppressedEmbeds?: ReadonlyArray<string>;
};

export const buildMessageRecord = (
	input: MessageRecordInput,
): MessageRecord => ({
	$type: COLLECTIONS.message,
	text: input.text,
	createdAt: asDatetime(input.createdAt),
	...(input.facets && input.facets.length > 0
		? { facets: [...input.facets] }
		: {}),
	...(input.updatedAt ? { updatedAt: asDatetime(input.updatedAt) } : {}),
	...(input.parent ? { parent: input.parent } : {}),
	...(input.attachments && input.attachments.length > 0
		? { attachments: [...input.attachments] }
		: {}),
	...(input.suppressedEmbeds && input.suppressedEmbeds.length > 0
		? { suppressedEmbeds: input.suppressedEmbeds.map(asUri) }
		: {}),
});

export const buildReactionRecord = (
	emoji: string,
	target: RecordRef,
): ReactionRecord => ({
	$type: COLLECTIONS.reaction,
	emoji,
	target,
});
