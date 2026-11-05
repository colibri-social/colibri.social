import { asDatetime, asUri, COLLECTIONS } from "./lexicons.js";
import { spaceRecordUri } from "./space-ref.js";
import type {
	Facet,
	MessageAttachment,
	MessageForward,
	MessageRecord,
	ReactionRecord,
	RecordRef,
} from "./views.js";

export type MessageRecordInput = {
	text: string;
	facets?: ReadonlyArray<Facet>;
	createdAt: string;
	updatedAt?: string;
	parent?: RecordRef;
	space?: string;
	attachments?: ReadonlyArray<MessageAttachment>;
	forward?: MessageForward;
	suppressedEmbeds?: ReadonlyArray<string>;
};

const messageUri = (space: string | undefined, ref: RecordRef) =>
	space
		? spaceRecordUri(space, ref.did, COLLECTIONS.message, ref.rkey)
		: undefined;

export const buildMessageRecord = (
	input: MessageRecordInput,
): MessageRecord => {
	const parentUri = input.parent
		? messageUri(input.space, input.parent)
		: undefined;
	return {
		$type: COLLECTIONS.message,
		text: input.text,
		createdAt: asDatetime(input.createdAt),
		...(input.facets && input.facets.length > 0
			? { facets: [...input.facets] }
			: {}),
		...(input.updatedAt ? { updatedAt: asDatetime(input.updatedAt) } : {}),
		...(input.parent ? { parent: input.parent } : {}),
		...(parentUri ? { parentUri } : {}),
		...(input.attachments && input.attachments.length > 0
			? { attachments: [...input.attachments] }
			: {}),
		...(input.forward ? { forward: input.forward } : {}),
		...(input.suppressedEmbeds && input.suppressedEmbeds.length > 0
			? { suppressedEmbeds: input.suppressedEmbeds.map(asUri) }
			: {}),
	};
};

export const buildReactionRecord = (
	emoji: string,
	target: RecordRef,
	space?: string,
): ReactionRecord => {
	const uri = messageUri(space, target);
	return {
		$type: COLLECTIONS.reaction,
		emoji,
		target,
		...(uri ? { uri } : {}),
	};
};
