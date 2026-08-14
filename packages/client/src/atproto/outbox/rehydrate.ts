import type { ColibriRichTextFacet } from "@colibri-social/lib";
import type {
	Message,
	PendingMessage,
} from "../xrpc/social/colibri/channel/listMessages";
import type { QueuedRecord } from "./outbox";

const asString = (value: unknown): string | undefined =>
	typeof value === "string" ? value : undefined;

const asFacets = (value: unknown): ColibriRichTextFacet[] =>
	Array.isArray(value) ? (value as ColibriRichTextFacet[]) : [];

const asAttachments = (value: unknown): Message["attachments"] =>
	Array.isArray(value) ? (value as Message["attachments"]) : [];

const asStrings = (value: unknown): string[] =>
	Array.isArray(value) ? value.filter((v) => typeof v === "string") : [];

const sameStrings = (a: string[], b: string[]): boolean =>
	a.length === b.length && a.every((v, i) => v === b[i]);

const toPendingMessage = (
	queued: QueuedRecord,
	context: {
		channelUri: string;
		community: string;
		author: Message["author"];
		parentOf: (uri: string) => Message | undefined;
	},
): PendingMessage => {
	const parentUri = asString(queued.record.parent);
	return {
		hash: `outbox:${queued.rkey}`,
		uri: queued.uri,
		text: asString(queued.record.text) ?? "",
		facets: asFacets(queued.record.facets),
		channel: context.channelUri,
		community: context.community,
		author: context.author,
		parent: parentUri ? context.parentOf(parentUri) : undefined,
		attachments: asAttachments(queued.record.attachments),
		reactions: [],
		createdAt: asString(queued.record.createdAt) ?? new Date(0).toISOString(),
		edited: false,
		suppressedEmbeds: asStrings(queued.record.suppressedEmbeds),
	};
};

export const rehydrateQueuedMessages = (input: {
	channelUri: string;
	community: string;
	author: Message["author"];
	queued: QueuedRecord[];
	existing: (Message | PendingMessage)[];
}): (Message | PendingMessage)[] | undefined => {
	const mine = input.queued.filter(
		(q) => asString(q.record.channel) === input.channelUri,
	);
	if (mine.length === 0) return undefined;

	const byUri = new Map(input.existing.map((m) => [m.uri, m]));
	const parentOf = (uri: string) => {
		const found = byUri.get(uri);
		return found && !("hash" in found) ? found : undefined;
	};

	const edits = new Map(
		mine
			.filter((q) => q.kind === "put" && byUri.has(q.uri))
			.map((q) => [q.uri, q]),
	);

	const additions = mine
		.filter((q) => q.kind === "create" && !byUri.has(q.uri))
		.sort((a, b) => a.createdAt - b.createdAt)
		.map((q) =>
			toPendingMessage(q, {
				channelUri: input.channelUri,
				community: input.community,
				author: input.author,
				parentOf,
			}),
		);

	if (additions.length === 0 && edits.size === 0) return undefined;

	const reconciled = input.existing.map((m) => {
		const edit = edits.get(m.uri);
		if (!edit) return m;
		const text = asString(edit.record.text) ?? m.text;
		const facets = asFacets(edit.record.facets);
		const suppressedEmbeds = asStrings(edit.record.suppressedEmbeds);
		const edited =
			edit.record.edited === undefined ? true : edit.record.edited === true;
		const unchanged =
			text === m.text &&
			m.edited === edited &&
			sameStrings(suppressedEmbeds, m.suppressedEmbeds ?? []);
		if (unchanged) return m;
		return { ...m, text, facets, edited, suppressedEmbeds };
	});

	const changed =
		additions.length > 0 || reconciled.some((m, i) => m !== input.existing[i]);
	if (!changed) return undefined;

	return [...reconciled, ...additions];
};
