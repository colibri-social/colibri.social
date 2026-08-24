import type { PendingMessage } from "../cache/schema";
import { asAtUri, asDatetime, asSpaceRef, COLLECTIONS } from "../lexicons";
import type { MessageView } from "../views";
import type { QueuedRecord } from "./outbox";

const EPOCH = "1970-01-01T00:00:00.000Z";

const asString = (value: unknown): string | undefined =>
	typeof value === "string" ? value : undefined;

const asFacets = (value: unknown): MessageView["facets"] =>
	Array.isArray(value) ? (value as MessageView["facets"]) : [];

const asAttachments = (value: unknown): MessageView["attachments"] =>
	Array.isArray(value) ? (value as MessageView["attachments"]) : [];

export const messageUriFor = (
	authorDid: string,
	rkey: string,
): MessageView["uri"] =>
	asAtUri(`at://${authorDid}/${COLLECTIONS.message}/${rkey}`);

const asDatetimeOrUndefined = (
	value: unknown,
): MessageView["updatedAt"] | undefined => {
	const raw = asString(value);
	if (raw === undefined) return undefined;
	try {
		return asDatetime(raw);
	} catch {
		return undefined;
	}
};

const asCreatedAt = (value: unknown): PendingMessage["createdAt"] =>
	asDatetimeOrUndefined(value) ?? asDatetime(EPOCH);

const toPendingMessage = (
	queued: QueuedRecord,
	context: { channelSpace: string; author: MessageView["author"] },
): PendingMessage => ({
	hash: `outbox:${queued.rkey}`,
	uri: messageUriFor(context.author.did, queued.rkey),
	channel: asSpaceRef(context.channelSpace),
	author: context.author,
	text: asString(queued.record.text) ?? "",
	facets: asFacets(queued.record.facets),
	attachments: asAttachments(queued.record.attachments),
	createdAt: asCreatedAt(queued.record.createdAt),
});

export const rehydrateQueuedMessages = (input: {
	channelSpace: string;
	author: MessageView["author"];
	queued: QueuedRecord[];
	existing: (MessageView | PendingMessage)[];
}): (MessageView | PendingMessage)[] | undefined => {
	const mine = input.queued.filter((q) => q.space === input.channelSpace);
	if (mine.length === 0) return undefined;

	const byUri = new Map(input.existing.map((m) => [m.uri, m]));

	const edits = new Map(
		mine
			.filter(
				(q) =>
					q.kind === "spacePut" &&
					byUri.has(messageUriFor(input.author.did, q.rkey)),
			)
			.map((q) => [messageUriFor(input.author.did, q.rkey), q]),
	);

	const additions = mine
		.filter(
			(q) =>
				q.kind === "spaceCreate" &&
				!byUri.has(messageUriFor(input.author.did, q.rkey)),
		)
		.sort((a, b) => a.createdAt - b.createdAt)
		.map((q) =>
			toPendingMessage(q, {
				channelSpace: input.channelSpace,
				author: input.author,
			}),
		);

	if (additions.length === 0 && edits.size === 0) return undefined;

	const reconciled: (MessageView | PendingMessage)[] = input.existing.map(
		(m) => {
			const edit = edits.get(m.uri);
			if (!edit) return m;
			const text = asString(edit.record.text) ?? m.text;
			const facets = asFacets(edit.record.facets);
			const updatedAt = asDatetimeOrUndefined(edit.record.updatedAt);
			const existingUpdatedAt = "updatedAt" in m ? m.updatedAt : undefined;
			const unchanged = text === m.text && existingUpdatedAt === updatedAt;
			if (unchanged) return m;
			return { ...m, text, facets, ...(updatedAt ? { updatedAt } : {}) };
		},
	);

	const changed =
		additions.length > 0 || reconciled.some((m, i) => m !== input.existing[i]);
	if (!changed) return undefined;

	return [...reconciled, ...additions];
};
