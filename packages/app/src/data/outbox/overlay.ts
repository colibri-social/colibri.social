import type { Did, MessageView, SpaceRef } from "../types";
import type { OutboxEntry, OutboxOp } from "./types";

type EditOp = Extract<OutboxOp, { t: "edit" }>;
type ReactOp = Extract<OutboxOp, { t: "react" }>;
type QueuedWrite = { op: EditOp | ReactOp; createdAt: number };

const queuedWritesFor = (
	entries: readonly OutboxEntry[],
	channel: SpaceRef,
): QueuedWrite[] =>
	entries.flatMap((entry) =>
		(entry.op.t === "edit" || entry.op.t === "react") &&
		entry.op.channel === channel &&
		!entry.failed
			? [{ op: entry.op, createdAt: entry.createdAt }]
			: [],
	);

const withEdit = (
	message: MessageView,
	op: EditOp,
	createdAt: number,
): MessageView => {
	const next: MessageView = {
		...message,
		text: op.text,
		updatedAt: new Date(createdAt).toISOString() as MessageView["updatedAt"],
	};
	if (op.facets?.length) next.facets = op.facets;
	else delete next.facets;
	return next;
};

export const withReaction = (
	message: MessageView,
	emoji: string,
	actor: Did,
	add: boolean,
	viewer: Did,
): MessageView => {
	const reactions = message.reactions.slice();
	const index = reactions.findIndex((entry) => entry.emoji === emoji);
	const current = reactions[index];
	if (add) {
		if (current?.reactors.includes(actor)) return message;
		const next = current
			? {
					...current,
					count: current.count + 1,
					reactors: [...current.reactors, actor],
				}
			: { emoji, count: 1, reactors: [actor] };
		if (actor === viewer) next.viewerReacted = true;
		if (current) reactions[index] = next;
		else reactions.push(next);
		return { ...message, reactions };
	}
	if (!current?.reactors.includes(actor)) return message;
	const next = {
		...current,
		count: current.count - 1,
		reactors: current.reactors.filter((did) => did !== actor),
		viewerReacted: actor === viewer ? false : current.viewerReacted,
	};
	if (next.count <= 0) reactions.splice(index, 1);
	else reactions[index] = next;
	return { ...message, reactions };
};

export const applyQueuedWrites = (
	messages: readonly MessageView[],
	entries: readonly OutboxEntry[],
	channel: SpaceRef,
	viewer: Did,
): readonly MessageView[] => {
	const writes = queuedWritesFor(entries, channel);
	if (writes.length === 0) return messages;
	const targets = new Set(writes.map((write) => write.op.rkey));
	let changed = false;
	const next = messages.map((message) => {
		if (!targets.has(message.rkey)) return message;
		let result = message;
		for (const { op, createdAt } of writes) {
			if (op.rkey !== message.rkey) continue;
			result =
				op.t === "edit"
					? withEdit(result, op, createdAt)
					: withReaction(result, op.emoji, viewer, op.add, viewer);
		}
		if (result !== message) changed = true;
		return result;
	});
	return changed ? next : messages;
};

export const withQueuedWrites = (
	messages: () => readonly MessageView[],
	entries: () => readonly OutboxEntry[],
	channel: SpaceRef,
	viewer: Did,
): (() => readonly MessageView[]) => {
	let lastMessages: readonly MessageView[] | undefined;
	let lastEntries: readonly OutboxEntry[] | undefined;
	let lastResult: readonly MessageView[] = [];
	return () => {
		const currentMessages = messages();
		const currentEntries = entries();
		if (currentMessages === lastMessages && currentEntries === lastEntries) {
			return lastResult;
		}
		lastMessages = currentMessages;
		lastEntries = currentEntries;
		lastResult = applyQueuedWrites(
			currentMessages,
			currentEntries,
			channel,
			viewer,
		);
		return lastResult;
	};
};
