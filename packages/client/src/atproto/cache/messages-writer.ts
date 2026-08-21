import type { Colibri_MessageEvent } from "@colibri-social/lib";
import { insertAt, placeMessage } from "../../utils/message-order";
import type { Message } from "../xrpc/social/colibri/channel/listMessages";
import {
	belongsToChannel,
	cursorFor,
	mergeSnapshotWindow,
	snapshotBelongsTo,
} from "./messages-snapshot";
import type { MessagesSnapshot } from "./schema";

let openChannel: string | undefined;

export const registerOpenChannel = (uri: string | undefined): void => {
	openChannel = uri || undefined;
};

export const isOpenChannel = (uri: string): boolean => openChannel === uri;

export type SnapshotWriterIo = {
	namespace: () => string;
	read: (
		ns: string,
		channelUri: string,
	) => Promise<MessagesSnapshot | undefined>;
	write: (
		ns: string,
		channelUri: string,
		snapshot: MessagesSnapshot,
	) => Promise<void>;
	onError: (err: unknown) => void;
};

let io: SnapshotWriterIo | undefined;
const pending = new Map<string, MessagesSnapshot>();
const chains = new Map<string, Promise<void>>();

export const configureSnapshotWriter = (next: SnapshotWriterIo): void => {
	io = next;
	pending.clear();
	chains.clear();
};

export const resetSnapshotWriter = (): void => {
	io = undefined;
	pending.clear();
	chains.clear();
};

const enqueue = (channelUri: string, work: () => Promise<void>): void => {
	const chain = (chains.get(channelUri) ?? Promise.resolve()).then(work);
	chains.set(channelUri, chain);
	void chain.finally(() => {
		if (chains.get(channelUri) === chain) chains.delete(channelUri);
	});
};

export const foldMessageEvent = (
	event: NonNullable<Colibri_MessageEvent["data"]>,
	limit: number,
): void => {
	const active = io;
	if (!active) return;

	const channelUri = event.channel;
	if (!channelUri || isOpenChannel(channelUri)) return;

	enqueue(channelUri, async () => {
		try {
			const current =
				pending.get(channelUri) ??
				(await active.read(active.namespace(), channelUri));
			if (!current) return;
			if (!snapshotBelongsTo(current, channelUri)) return;
			if (isOpenChannel(channelUri)) return;
			const next = applyMessageEvent(current, event, limit);
			if (next) pending.set(channelUri, next);
		} catch (err) {
			active.onError(err);
		}
	});
};

export const offerSnapshotWindow = (
	channelUri: string,
	messages: Message[],
	options: { readCursor: string | undefined; hasMore: boolean; limit: number },
): void => {
	const active = io;
	if (!active) return;
	if (!channelUri) return;

	const owned = messages.filter((message) =>
		belongsToChannel(message, channelUri),
	);
	if (owned.length === 0) return;
	if (isOpenChannel(channelUri)) return;

	enqueue(channelUri, async () => {
		try {
			const stored =
				pending.get(channelUri) ??
				(await active.read(active.namespace(), channelUri));
			if (isOpenChannel(channelUri)) return;
			const current =
				stored && snapshotBelongsTo(stored, channelUri) ? stored : undefined;
			pending.set(
				channelUri,
				mergeSnapshotWindow(current, owned, {
					...options,
					now: Date.now(),
				}),
			);
		} catch (err) {
			active.onError(err);
		}
	});
};

export const flushSnapshotWriter = (): void => {
	const active = io;
	if (!active || pending.size === 0) return;

	const batch = [...pending.entries()];
	pending.clear();
	const ns = active.namespace();
	for (const [channelUri, snapshot] of batch) {
		if (isOpenChannel(channelUri)) continue;
		void active.write(ns, channelUri, snapshot);
	}
};

export const applyMessageEvent = (
	snapshot: MessagesSnapshot,
	event: NonNullable<Colibri_MessageEvent["data"]>,
	limit: number,
): MessagesSnapshot | undefined => {
	if (event.event === "delete") {
		const remaining = snapshot.messages.filter((m) => m.uri !== event.uri);
		if (remaining.length === snapshot.messages.length) return undefined;
		return {
			...snapshot,
			messages: remaining,
			cursor: cursorFor(remaining, snapshot.cursor),
			ts: Date.now(),
		};
	}

	const community = snapshot.messages[0]?.community;
	if (!community) return undefined;

	const existing = snapshot.messages.find((m) => m.uri === event.uri);

	if (event.event === "embeds") {
		if (!existing) return undefined;
		return {
			...snapshot,
			messages: snapshot.messages.map((m) =>
				m.uri === event.uri
					? { ...m, modSuppressedEmbeds: event.modSuppressedEmbeds }
					: m,
			),
			ts: Date.now(),
		};
	}

	const message: Message = {
		uri: event.uri,
		text: event.text,
		facets: event.facets,
		channel: event.channel,
		community,
		author: event.author,
		parent: existing?.parent,
		attachments: event.attachments,
		reactions: existing?.reactions ?? [],
		createdAt: event.createdAt,
		edited: event.edited,
		suppressedEmbeds: event.suppressedEmbeds ?? existing?.suppressedEmbeds,
		modSuppressedEmbeds:
			event.modSuppressedEmbeds ?? existing?.modSuppressedEmbeds,
	};

	let next: Message[];
	if (existing) {
		next = snapshot.messages.map((m) => (m.uri === event.uri ? message : m));
	} else {
		const placement = placeMessage(snapshot.messages, message, {
			hasMore: snapshot.hasMore ?? false,
		});
		if (placement.kind === "drop") return undefined;
		next =
			placement.kind === "append"
				? [...snapshot.messages, message]
				: insertAt(snapshot.messages, message, placement.index);
	}
	const messages = next.slice(-limit);

	return {
		...snapshot,
		messages,
		cursor: cursorFor(messages, snapshot.cursor),
		hasMore: messages.length < next.length ? true : snapshot.hasMore,
		ts: Date.now(),
	};
};
