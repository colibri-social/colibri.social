import { insertAt, placeMessage } from "../../utils/message-order";
import type { MessageEventFrame } from "../sync-frames";
import type { MessageView } from "../views";
import {
	belongsToChannel,
	cursorFor,
	mergeSnapshotWindow,
	refOf,
	sameRecord,
	snapshotBelongsTo,
} from "./messages-snapshot";
import type { MessagesSnapshot } from "./schema";

let openChannel: string | undefined;

export const registerOpenChannel = (space: string | undefined): void => {
	openChannel = space || undefined;
};

export const isOpenChannel = (space: string): boolean => openChannel === space;

export type SnapshotWriterIo = {
	namespace: () => string;
	read: (
		ns: string,
		channelSpace: string,
	) => Promise<MessagesSnapshot | undefined>;
	write: (
		ns: string,
		channelSpace: string,
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

const enqueue = (channelSpace: string, work: () => Promise<void>): void => {
	const chain = (chains.get(channelSpace) ?? Promise.resolve()).then(work);
	chains.set(channelSpace, chain);
	void chain.finally(() => {
		if (chains.get(channelSpace) === chain) chains.delete(channelSpace);
	});
};

export const foldMessageEvent = (
	event: MessageEventFrame,
	limit: number,
): void => {
	const active = io;
	if (!active) return;

	const channelSpace = event.channel;
	if (!channelSpace || isOpenChannel(channelSpace)) return;

	enqueue(channelSpace, async () => {
		try {
			const current =
				pending.get(channelSpace) ??
				(await active.read(active.namespace(), channelSpace));
			if (!current) return;
			if (!snapshotBelongsTo(current, channelSpace)) return;
			if (isOpenChannel(channelSpace)) return;
			const next = applyMessageEvent(current, event, limit);
			if (next) pending.set(channelSpace, next);
		} catch (err) {
			active.onError(err);
		}
	});
};

export const offerSnapshotWindow = (
	channelSpace: string,
	messages: MessageView[],
	options: { readCursor: string | undefined; hasMore: boolean; limit: number },
): void => {
	const active = io;
	if (!active) return;
	if (!channelSpace) return;

	const owned = messages.filter((message) =>
		belongsToChannel(message, channelSpace),
	);
	if (owned.length === 0) return;
	if (isOpenChannel(channelSpace)) return;

	enqueue(channelSpace, async () => {
		try {
			const stored =
				pending.get(channelSpace) ??
				(await active.read(active.namespace(), channelSpace));
			if (isOpenChannel(channelSpace)) return;
			const current =
				stored && snapshotBelongsTo(stored, channelSpace) ? stored : undefined;
			pending.set(
				channelSpace,
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
	for (const [channelSpace, snapshot] of batch) {
		if (isOpenChannel(channelSpace)) continue;
		void active.write(ns, channelSpace, snapshot);
	}
};

export const applyMessageEvent = (
	snapshot: MessagesSnapshot,
	event: MessageEventFrame,
	limit: number,
): MessagesSnapshot | undefined => {
	if (event.event === "delete") {
		const subject = event.subject;
		if (!subject) return undefined;
		const remaining = snapshot.messages.filter((m) => !sameRecord(m, subject));
		if (remaining.length === snapshot.messages.length) return undefined;
		return {
			...snapshot,
			messages: remaining,
			cursor: cursorFor(remaining, snapshot.cursor),
			ts: Date.now(),
		};
	}

	const message = event.message;
	if (!message) return undefined;

	const ref = refOf(message);
	const existing = snapshot.messages.find((m) => sameRecord(m, ref));

	let next: MessageView[];
	if (existing) {
		next = snapshot.messages.map((m) => (sameRecord(m, ref) ? message : m));
	} else {
		if (event.event !== "create") return undefined;
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
