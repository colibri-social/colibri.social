import { asVisibleParent } from "../../utils/message-parent";
import { sameRecord } from "../cache/messages-snapshot";
import type { PendingMessage } from "../cache/schema";
import { asAtUri, asDatetime, asSpaceRef, COLLECTIONS } from "../lexicons";
import type { ForwardView, MessageView, RecordRef } from "../views";
import type { QueuedRecord } from "./outbox";

const EPOCH = "1970-01-01T00:00:00.000Z";

const asString = (value: unknown): string | undefined =>
	typeof value === "string" ? value : undefined;

const asFacets = (value: unknown): MessageView["facets"] =>
	Array.isArray(value) ? (value as MessageView["facets"]) : [];

const isAttachmentView = (value: unknown): boolean => {
	if (typeof value !== "object" || value === null) return false;
	const { url, mimeType } = value as Record<string, unknown>;
	return typeof url === "string" && typeof mimeType === "string";
};

const asAttachments = (value: unknown): MessageView["attachments"] =>
	Array.isArray(value)
		? (value.filter(isAttachmentView) as MessageView["attachments"])
		: [];

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

const asSpaceRecordRef = (
	value: unknown,
): ForwardView["source"] | undefined => {
	if (typeof value !== "object" || value === null) return undefined;
	const { space, did, rkey, cid } = value as Record<string, unknown>;
	if (
		typeof space !== "string" ||
		typeof did !== "string" ||
		typeof rkey !== "string"
	)
		return undefined;
	return {
		space,
		did,
		rkey,
		...(typeof cid === "string" ? { cid } : {}),
	} as ForwardView["source"];
};

const asForward = (value: unknown): ForwardView | undefined => {
	if (typeof value !== "object" || value === null) return undefined;
	const { source, createdAt, text, facets, attachments } = value as Record<
		string,
		unknown
	>;
	const ref = asSpaceRecordRef(source);
	if (!ref) return undefined;
	return {
		source: ref,
		createdAt: asCreatedAt(createdAt),
		text: asString(text) ?? "",
		...(Array.isArray(facets) ? { facets: asFacets(facets) } : {}),
		attachments: asAttachments(attachments) ?? [],
	} as ForwardView;
};

export const messageUriFor = (
	authorDid: string,
	rkey: string,
): MessageView["uri"] =>
	asAtUri(`at://${authorDid}/${COLLECTIONS.message}/${rkey}`);

const asRecordRef = (value: unknown): RecordRef | undefined => {
	if (typeof value !== "object" || value === null) return undefined;
	const { did, rkey } = value as Record<string, unknown>;
	if (typeof did !== "string" || typeof rkey !== "string") return undefined;
	return { did, rkey } as RecordRef;
};

type ParentResolver = (ref: RecordRef) => MessageView | undefined;

const toPendingMessage = (
	queued: QueuedRecord,
	context: {
		channelSpace: string;
		author: MessageView["author"];
		resolveParent: ParentResolver;
	},
): PendingMessage => {
	const parentRef = asRecordRef(queued.record.parent);
	const parent = parentRef ? context.resolveParent(parentRef) : undefined;
	const forward = asForward(queued.record.forward);
	return {
		hash: `outbox:${queued.rkey}`,
		uri: messageUriFor(context.author.did, queued.rkey),
		channel: asSpaceRef(context.channelSpace),
		author: context.author,
		text: asString(queued.record.text) ?? "",
		facets: asFacets(queued.record.facets),
		attachments: asAttachments(queued.record.attachments),
		createdAt: asCreatedAt(queued.record.createdAt),
		...(parent ? { parent: asVisibleParent(parent) } : {}),
		...(forward ? { forward } : {}),
		...(queued.failed ? { failed: true } : {}),
	};
};

const dedupeByRkey = (queued: QueuedRecord[]): QueuedRecord[] => {
	const seen = new Set<string>();
	return queued.filter((q) => {
		const key = `${q.kind}:${q.rkey}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
};

export const rehydrateQueuedMessages = (input: {
	channelSpace: string;
	author: MessageView["author"];
	queued: QueuedRecord[];
	existing: (MessageView | PendingMessage)[];
}): (MessageView | PendingMessage)[] | undefined => {
	const mine = dedupeByRkey(input.queued).filter(
		(q) => q.space === input.channelSpace,
	);
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

	const sendStates = new Map(
		mine
			.filter((q) => q.kind === "spaceCreate")
			.map((q) => [`outbox:${q.rkey}`, q.failed === true]),
	);

	const resolveParent: ParentResolver = (ref) =>
		input.existing.find(
			(m): m is MessageView => !("hash" in m) && sameRecord(m, ref),
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
				resolveParent,
			}),
		);

	const reconciled: (MessageView | PendingMessage)[] = input.existing.map(
		(m) => {
			if ("hash" in m) {
				const failed = sendStates.get(m.hash);
				if (failed === undefined || failed === (m.failed === true)) return m;
				return failed
					? { ...m, failed: true }
					: (({ failed: _failed, ...rest }) => rest)(m);
			}
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
