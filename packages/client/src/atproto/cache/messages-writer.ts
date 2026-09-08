import { insertAt, placeMessage } from "../../utils/message-order";
import { HIDDEN } from "../labels";
import type { LabelEventFrame, MessageEventFrame } from "../sync-frames";
import type { MessageView } from "../views";
import { messagesKey } from "./keys";
import {
	clearMessagesMemory,
	recallMessages,
	rememberMessages,
} from "./messages-memory";
import {
	cursorFor,
	mergeSnapshotWindow,
	refOf,
	sameRecord,
	snapshotBelongsTo,
} from "./messages-snapshot";
import type { MessagesSnapshot } from "./schema";

const openBySurface = new Map<string, string>();

export const registerOpenChannel = (
	space: string | undefined,
	surface = "primary",
): void => {
	if (space) openBySurface.set(surface, space);
	else openBySurface.delete(surface);
};

export const isOpenChannel = (space: string): boolean => {
	if (!space) return false;
	for (const open of openBySurface.values()) if (open === space) return true;
	return false;
};

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

const dirty = new Map<string, string>();
const chains = new Map<string, Promise<void>>();

const reset = (): void => {
	dirty.clear();
	chains.clear();
	clearMessagesMemory();
};

export const configureSnapshotWriter = (next: SnapshotWriterIo): void => {
	io = next;
	reset();
};

export const resetSnapshotWriter = (): void => {
	io = undefined;
	reset();
};

const load = async (
	active: SnapshotWriterIo,
	ns: string,
	channelSpace: string,
): Promise<MessagesSnapshot | undefined> => {
	const remembered = recallMessages(messagesKey(ns, channelSpace));
	if (remembered) return remembered;

	const stored = await active.read(ns, channelSpace);
	if (stored) rememberMessages(messagesKey(ns, channelSpace), stored);
	return stored;
};

const stage = (
	ns: string,
	channelSpace: string,
	snapshot: MessagesSnapshot,
) => {
	rememberMessages(messagesKey(ns, channelSpace), snapshot);
	dirty.set(channelSpace, ns);
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
			const ns = active.namespace();
			const current = await load(active, ns, channelSpace);
			if (!current) return;
			if (!snapshotBelongsTo(current, channelSpace)) return;
			if (isOpenChannel(channelSpace)) return;
			const next = applyMessageEvent(current, event, limit);
			if (next) stage(ns, channelSpace, next);
		} catch (err) {
			active.onError(err);
		}
	});
};

export const foldLabelEvent = (event: LabelEventFrame): void => {
	const active = io;
	if (!active) return;

	const channelSpace = event.space;
	if (!channelSpace || isOpenChannel(channelSpace)) return;

	enqueue(channelSpace, async () => {
		try {
			const ns = active.namespace();
			const current = await load(active, ns, channelSpace);
			if (!current) return;
			if (!snapshotBelongsTo(current, channelSpace)) return;
			if (isOpenChannel(channelSpace)) return;
			const next = applyLabelEvent(current, event);
			if (next) stage(ns, channelSpace, next);
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

	if (messages.length === 0) return;
	if (isOpenChannel(channelSpace)) return;

	enqueue(channelSpace, async () => {
		try {
			const ns = active.namespace();
			const stored = await load(active, ns, channelSpace);
			if (isOpenChannel(channelSpace)) return;
			const current =
				stored && snapshotBelongsTo(stored, channelSpace) ? stored : undefined;
			stage(
				ns,
				channelSpace,
				mergeSnapshotWindow(current, messages, {
					...options,
					space: channelSpace,
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
	if (!active || dirty.size === 0) return;

	const batch = [...dirty.entries()];
	dirty.clear();
	for (const [channelSpace, ns] of batch) {
		if (isOpenChannel(channelSpace)) continue;
		const snapshot = recallMessages(messagesKey(ns, channelSpace));
		if (!snapshot) continue;
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

export const applyLabelEvent = (
	snapshot: MessagesSnapshot,
	event: LabelEventFrame,
): MessagesSnapshot | undefined => {
	if (event.val !== HIDDEN || event.event !== "create") return undefined;

	const remaining = snapshot.messages.filter(
		(m) => m.author.did !== event.subject.did || m.rkey !== event.subject.rkey,
	);
	if (remaining.length === snapshot.messages.length) return undefined;

	return {
		...snapshot,
		messages: remaining,
		cursor: cursorFor(remaining, snapshot.cursor),
		ts: Date.now(),
	};
};
